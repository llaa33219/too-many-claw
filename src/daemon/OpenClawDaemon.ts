/**
 * Too Many Claw - OpenClaw Daemon
 * Automatically connects to OpenClaw Gateway and routes agent responses through webhooks
 */

import { EventEmitter } from 'events';
import { execSync } from 'child_process';
import { GatewayClient, ConnectionState, AgentResponseMessage, GatewayMessage, ChannelMessage, extractTextContent } from '../openclaw/GatewayClient.js';
import { WebhookManager } from '../discord/WebhookManager.js';
import { BotMessageMonitor } from '../discord/BotMessageMonitor.js';
import { ConfigManager } from '../config/ConfigManager.js';
import { AgentMapper } from './AgentMapper.js';
import { AgentDefinition } from '../types/index.js';

/** Daemon configuration */
export interface DaemonConfig {
  /** Gateway URL (default: ws://127.0.0.1:18789) */
  gatewayUrl?: string;
  /** Auto-start when OpenClaw is detected (default: true) */
  autoStart?: boolean;
  /** Process detection interval in ms (default: 5000) */
  processCheckInterval?: number;
  /** Enable verbose logging (default: false) */
  verbose?: boolean;
  /** Enable message interception (delete bot messages and resend via webhook) */
  interceptMessages?: boolean;
}

/** Daemon statistics */
export interface DaemonStats {
  /** Whether connected to OpenClaw Gateway */
  connected: boolean;
  /** Connection state */
  connectionState: ConnectionState;
  /** Number of messages processed */
  messagesProcessed: number;
  /** Number of messages forwarded to webhooks */
  messagesForwarded: number;
  /** Number of failed webhook sends */
  webhookErrors: number;
  /** Last message timestamp */
  lastMessageAt: Date | null;
  /** Uptime in ms */
  uptimeMs: number;
  /** Reconnection attempts */
  reconnectAttempts: number;
}

/** Events emitted by the daemon */
export interface DaemonEvents {
  'start': () => void;
  'stop': () => void;
  'connected': () => void;
  'disconnected': (reason: string) => void;
  'reconnecting': (attempt: number) => void;
  'error': (error: Error) => void;
  'message_received': (agentId: string, content: string) => void;
  'message_forwarded': (agentId: string, content: string) => void;
  'agent_enter': (agent: AgentDefinition) => void;
  'agent_exit': (agent: AgentDefinition) => void;
  'openclaw_detected': () => void;
  'openclaw_lost': () => void;
}

const DEFAULT_CONFIG: Required<DaemonConfig> = {
  gatewayUrl: 'ws://127.0.0.1:18789',
  autoStart: true,
  processCheckInterval: 5000,
  verbose: false,
  interceptMessages: true,
};

/**
 * OpenClaw Daemon - Bridges OpenClaw agent responses to Discord webhooks
 */
export class OpenClawDaemon extends EventEmitter {
  private config: Required<DaemonConfig>;
  private gatewayClient: GatewayClient;
  private webhookManager: WebhookManager;
  private botMessageMonitor: BotMessageMonitor | null = null;
  private configManager: ConfigManager;
  private agentMapper: AgentMapper;
  
  private running = false;
  private startTime: Date | null = null;
  private processCheckTimer: NodeJS.Timeout | null = null;
  private openclawDetected = false;
  
  // Stats
  private messagesProcessed = 0;
  private messagesForwarded = 0;
  private webhookErrors = 0;
  private lastMessageAt: Date | null = null;
  private reconnectAttempts = 0;
  
  // Track active agents in conversation
  private activeAgents: Set<string> = new Set();
  
  // Buffer for accumulating streaming responses
  private responseBuffers: Map<string, { agentId: string; content: string; lastUpdate: number }> = new Map();
  private bufferCleanupTimer: NodeJS.Timeout | null = null;
  
  // Buffer stale threshold in ms (60 seconds)
  private readonly BUFFER_STALE_THRESHOLD = 60000;

  constructor(config: DaemonConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.configManager = new ConfigManager();
    this.webhookManager = new WebhookManager();
    this.agentMapper = new AgentMapper();
    
    // Get gateway token from environment or config
    const gatewayToken = this.configManager.getGatewayToken();
    if (!gatewayToken) {
      this.forceLog('Warning: No gateway token found. Set OPENCLAW_GATEWAY_TOKEN env var or configure in openclaw.json');
    }
    
    this.gatewayClient = new GatewayClient({
      url: this.config.gatewayUrl,
      gatewayToken,
      verbose: this.config.verbose,
      reconnect: {
        enabled: true,
        maxAttempts: -1, // Infinite reconnection
        baseDelay: 1000,
        maxDelay: 30000,
      },
    });
    
    this.setupEventHandlers();
    this.loadWebhooks();
  }

  /**
   * Start the daemon
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    this.startTime = new Date();
    this.emit('start');
    this.forceLog('Daemon starting...');
    
    // Start buffer cleanup interval
    this.startBufferCleanup();

    // Start process detection if auto-start is enabled
    if (this.config.autoStart) {
      this.startProcessDetection();
    }

    // Set up and start the bot message monitor
    await this.setupBotMessageMonitor();

    // Try to connect immediately
    await this.connect();
  }

  /**
   * Stop the daemon
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.forceLog('Daemon stopping...');
    
    this.stopProcessDetection();
    this.stopBufferCleanup();
    await this.gatewayClient.disconnect();
    
    // Disconnect bot message monitor
    if (this.botMessageMonitor) {
      await this.botMessageMonitor.disconnect();
    }
    
    this.webhookManager.destroy();
    
    this.emit('stop');
  }

  /**
   * Connect to OpenClaw Gateway
   */
  async connect(): Promise<boolean> {
    try {
      await this.gatewayClient.connect();
      return true;
    } catch (error) {
      this.log(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Get daemon statistics
   */
  getStats(): DaemonStats {
    return {
      connected: this.gatewayClient.isConnected,
      connectionState: this.gatewayClient.connectionState,
      messagesProcessed: this.messagesProcessed,
      messagesForwarded: this.messagesForwarded,
      webhookErrors: this.webhookErrors,
      lastMessageAt: this.lastMessageAt,
      uptimeMs: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Check if daemon is running
   */
  get isRunning(): boolean {
    return this.running;
  }

  /**
   * Check if connected to OpenClaw
   */
  get isConnected(): boolean {
    return this.gatewayClient.isConnected;
  }

  /**
   * Get list of active agents
   */
  getActiveAgents(): string[] {
    return Array.from(this.activeAgents);
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Set up event handlers for the gateway client
   */
  private setupEventHandlers(): void {
    // Connection events
    this.gatewayClient.on('connect', () => {
      this.forceLog('Connected to OpenClaw Gateway');
      this.openclawDetected = true;
      this.emit('connected');
      this.emit('openclaw_detected');
    });

    this.gatewayClient.on('disconnect', (code: number, reason: string) => {
      this.forceLog(`Disconnected from Gateway: ${code} - ${reason}`);
      this.emit('disconnected', reason);
    });

    this.gatewayClient.on('reconnecting', (attempt: number) => {
      this.reconnectAttempts = attempt;
      this.forceLog(`Reconnecting... (attempt ${attempt})`);
      this.emit('reconnecting', attempt);
    });

    this.gatewayClient.on('reconnect_failed', () => {
      this.forceLog('Reconnection failed - max attempts reached');
      if (this.openclawDetected) {
        this.openclawDetected = false;
        this.emit('openclaw_lost');
      }
    });

    this.gatewayClient.on('error', (error: Error) => {
      this.forceLog(`Gateway error: ${error.message}`);
      this.emit('error', error);
    });

    this.gatewayClient.on('shutdown', () => {
      this.forceLog('Gateway shutdown signal received');
      this.openclawDetected = false;
      this.emit('openclaw_lost');
    });

    // Message events
    this.gatewayClient.on('message', (message: GatewayMessage) => {
      this.handleRawMessage(message);
    });

    this.gatewayClient.on('agent_response', (message: AgentResponseMessage) => {
      // Register the message with BotMessageMonitor before OpenClaw sends it to Discord
      this.registerPendingMessageForMonitor(message);
      this.handleAgentResponse(message);
    });

    this.gatewayClient.on('agent_delta', (message: AgentResponseMessage) => {
      // Don't register deltas - they are partial content that won't match the final Discord message
      // Instead, we register the accumulated buffer content in handleAgentEnd
      this.handleAgentDelta(message);
    });

    this.gatewayClient.on('agent_start', (message: GatewayMessage) => {
      this.handleAgentStart(message);
    });

    this.gatewayClient.on('agent_end', (message: AgentResponseMessage) => {
      // Register the final message as well
      this.registerPendingMessageForMonitor(message);
      this.handleAgentEnd(message);
    });

    this.gatewayClient.on('channel_message', (message: ChannelMessage) => {
      this.handleChannelMessage(message);
    });

    // message_sent events are no longer used - BotMessageMonitor handles interception directly
  }

  /**
   * Load webhooks from configuration
   */
  private loadWebhooks(): void {
    const webhooks = this.configManager.getAllWebhooks();
    
    // Check for base webhook first (recommended single-webhook approach)
    if (webhooks['base']) {
      this.webhookManager.setBaseWebhook(webhooks['base']);
      this.log('Loaded base webhook for all agents');
    }
    
    // Also load any agent-specific webhooks
    const agentWebhooks = Object.entries(webhooks).filter(([id]) => id !== 'base');
    if (agentWebhooks.length > 0) {
      for (const [agentId, url] of agentWebhooks) {
        this.webhookManager.setWebhook(agentId, url);
      }
      this.log(`Loaded ${agentWebhooks.length} agent-specific webhooks`);
    }
    
    // Warning if no webhooks at all
    if (!webhooks['base'] && agentWebhooks.length === 0) {
      this.log('No webhooks configured - messages will not be forwarded to Discord');
    }
  }

  /**
   * Set up bot message monitor for delete-and-resend functionality
   * Uses Discord.js Client to directly monitor for bot messages
   */
  private async setupBotMessageMonitor(): Promise<void> {
    if (!this.config.interceptMessages) {
      this.log('Message interception disabled');
      return;
    }

    const discordConfig = this.configManager.getDiscordConfig();
    
    if (!discordConfig.token) {
      this.log('Discord token not configured - message interception disabled');
      return;
    }

    this.botMessageMonitor = new BotMessageMonitor(
      {
        botToken: discordConfig.token,
        channelId: discordConfig.chatChannelId,
        verbose: this.config.verbose,
        deleteDelay: 150, // Small delay to ensure message is sent
      },
      this.webhookManager,
      this.agentMapper
    );

    // Set up monitor event handlers
    this.botMessageMonitor.on('ready', (botId: string, botTag: string) => {
      this.forceLog(`Bot message monitor ready: ${botTag}`);
    });

    this.botMessageMonitor.on('intercepted', (messageId: string, channelId: string, agentId: string) => {
      this.log(`Intercepted message ${messageId} in channel ${channelId} from agent ${agentId}`);
    });

    this.botMessageMonitor.on('deleted', (messageId: string, channelId: string) => {
      this.log(`Deleted bot message ${messageId} from channel ${channelId}`);
    });

    this.botMessageMonitor.on('resent', (agentId: string, content: string) => {
      this.messagesForwarded++;
      this.emit('message_forwarded', agentId, content);
      this.log(`Resent message via webhook as ${agentId}`);
    });

    this.botMessageMonitor.on('error', (error: Error, context: string) => {
      this.log(`Monitor error in ${context}: ${error.message}`);
      this.emit('error', error);
    });

    // Connect to Discord
    try {
      await this.botMessageMonitor.connect();
      this.forceLog('Message interception enabled - bot messages will be replaced with webhook messages');
    } catch (error) {
      this.forceLog(`Failed to connect bot message monitor: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.botMessageMonitor = null;
    }
  }

  /**
   * Register a pending message with BotMessageMonitor
   * This allows the monitor to know which agent sent the message
   */
  private registerPendingMessageForMonitor(message: AgentResponseMessage): void {
    if (!this.botMessageMonitor) return;
    
    const agentIdentifier = this.extractAgentIdentifier(message);
    const agent = this.agentMapper.resolve(agentIdentifier);
    const agentId = agent?.id || 'base';
    
    // Log for debugging
    if (this.config.verbose) {
      this.log(`registerPendingMessageForMonitor - identifier: ${agentIdentifier}, resolved to: ${agentId}`);
    }
    
    // Extract content
    let content = '';
    if (typeof message.content === 'string') {
      content = message.content;
    } else if (Array.isArray(message.content)) {
      content = extractTextContent(message.content);
    } else if (typeof message.delta === 'string') {
      content = message.delta;
    } else if ((message as any).text) {
      content = (message as any).text;
    }
    
    if (content && content.trim()) {
      this.botMessageMonitor.registerPendingMessage(agentId, content);
      this.log(`Registered pending message for ${agentId}: ${content.substring(0, 50)}...`);
    }
  }

  /**
   * Handle raw message from gateway (for debugging/logging)
   */
  private handleRawMessage(message: GatewayMessage): void {
    this.messagesProcessed++;
    this.lastMessageAt = new Date();
    
    if (this.config.verbose) {
      this.log(`Raw message: ${JSON.stringify(message).substring(0, 500)}...`);
      // Log message structure for debugging
      const keys = Object.keys(message);
      this.log(`  Keys: ${keys.join(', ')}`);
      if ((message as any).role) {
        this.log(`  Role: ${(message as any).role}`);
      }
      if ((message as any).stream) {
        this.log(`  Stream: ${(message as any).stream}`);
      }
      if ((message as any).agentId) {
        this.log(`  AgentId: ${(message as any).agentId}`);
      }
      if ((message as any).runId) {
        this.log(`  RunId: ${(message as any).runId}`);
      }
      if ((message as any).data) {
        this.log(`  Data keys: ${Object.keys((message as any).data).join(', ')}`);
      }
    }
  }

  /**
   * Handle agent response (complete response)
   * Note: When message interception is enabled, we skip direct webhook forwarding here
   * because the message_sent event handler will intercept and resend via webhook.
   */
  private async handleAgentResponse(message: AgentResponseMessage): Promise<void> {
    const agentIdentifier = this.extractAgentIdentifier(message);
    
    // Log for debugging
    if (this.config.verbose) {
      this.log(`Agent response - extracted identifier: ${agentIdentifier}`);
    }
    
    // Extract content - handle both string and array formats
    let content = '';
    if (typeof message.content === 'string') {
      content = message.content;
    } else if (Array.isArray(message.content)) {
      content = extractTextContent(message.content);
    } else {
      // Try other possible content fields
      content = (message as any).text || (message as any).message || '';
    }
    
    if (!content || content.trim() === '') {
      this.log(`Empty content for agent response from: ${agentIdentifier}`);
      return;
    }

    // Resolve agent or use default
    const agent = this.agentMapper.resolve(agentIdentifier) || this.agentMapper.getDefaultAgent();
    
    this.log(`Agent response from ${agent.name}: ${content.substring(0, 100)}...`);
    this.emit('message_received', agent.id, content);
    
    // If message interception is enabled, don't forward here - BotMessageMonitor handles it
    // This avoids duplicate messages (one from here, one from interception)
    if (this.botMessageMonitor && this.botMessageMonitor.isEnabled()) {
      this.log('Skipping direct webhook forward (message interception enabled)');
      return;
    }
    
    await this.forwardToWebhook(agent, content);
  }

  /**
   * Extract agent identifier from OpenClaw Gateway message
   * Checks multiple fields since OpenClaw may send agent info in different places
   */
  private extractAgentIdentifier(message: AgentResponseMessage): string {
    // Direct fields
    if (message.agentId) return message.agentId;
    if (message.agentName) return message.agentName;
    if ((message as any).agent) return (message as any).agent;
    if ((message as any).name) return (message as any).name;
    
    // Check nested data object
    const data = (message as any).data;
    if (data) {
      if (data.agentId) return data.agentId;
      if (data.agentName) return data.agentName;
      if (data.agent) return data.agent;
      if (data.name) return data.name;
    }
    
    // Check runId - might contain agent info like "base-12345" or "agentId-xxx"
    const runId = message.id || (message as any).runId;
    if (runId && typeof runId === 'string') {
      // Try to extract agent from runId formats like "base-xxx" or "searcher-xxx"
      const runIdMatch = runId.match(/^([a-z][a-z0-9-]*)-[a-z0-9]+$/i);
      if (runIdMatch) {
        const potentialAgent = runIdMatch[1];
        // Verify it's a known agent ID
        if (this.agentMapper.resolve(potentialAgent)) {
          return potentialAgent;
        }
      }
    }
    
    // Log for debugging when we can't find agent
    if (this.config.verbose) {
      this.log(`Could not extract agent from message. Keys: ${Object.keys(message).join(', ')}`);
      this.log(`  Full message: ${JSON.stringify(message).substring(0, 300)}`);
    }
    
    return 'assistant';
  }

  /**
   * Handle streaming delta (partial response)
   */
  private handleAgentDelta(message: AgentResponseMessage): void {
    const agentIdentifier = this.extractAgentIdentifier(message);
    
    // Extract delta content
    let delta = '';
    if (typeof message.delta === 'string') {
      delta = message.delta;
    } else if (typeof message.content === 'string') {
      delta = message.content;
    } else if ((message as any).data?.text) {
      delta = (message as any).data.text;
    } else if ((message as any).data?.thinking) {
      // Thinking deltas - include them as they may be useful
      delta = (message as any).data.thinking;
    } else if ((message as any).text) {
      delta = (message as any).text;
    }
    
    const messageId = message.id || (message as any).runId || agentIdentifier || 'default';
    
    if (!delta) {
      return;
    }

    // Log delta in verbose mode
    if (this.config.verbose) {
      this.log(`Delta [${messageId}]: ${delta.substring(0, 50)}...`);
    }

    // Accumulate delta in buffer
    const existing = this.responseBuffers.get(messageId);
    if (existing) {
      existing.content += delta;
      existing.lastUpdate = Date.now();
    } else {
      const agent = this.agentMapper.resolve(agentIdentifier);
      this.responseBuffers.set(messageId, {
        agentId: agent?.id || 'base',
        content: delta,
        lastUpdate: Date.now(),
      });
    }
  }

  /**
   * Handle agent start event
   */
  private handleAgentStart(message: GatewayMessage): void {
    const agentIdentifier = (message as any).agentId || (message as any).agentName || (message as any).agent;
    const agent = this.agentMapper.resolve(agentIdentifier);
    
    if (agent && !this.activeAgents.has(agent.id)) {
      this.activeAgents.add(agent.id);
      this.emit('agent_enter', agent);
      this.log(`Agent entered: ${agent.emoji} ${agent.name}`);
    }
  }

  /**
   * Handle agent end event (flush buffer and send)
   * Note: When message interception is enabled, we skip direct webhook forwarding here
   * because the message_sent event handler will intercept and resend via webhook.
   */
  private async handleAgentEnd(message: AgentResponseMessage): Promise<void> {
    const messageId = message.id || (message as any).runId || message.agentId || message.agentName || 'default';
    const agentIdentifier = this.extractAgentIdentifier(message);
    
    // Log for debugging
    if (this.config.verbose) {
      this.log(`Agent end - messageId: ${messageId}, extracted identifier: ${agentIdentifier}`);
    }
    
    this.log(`Agent end event [${messageId}] from: ${agentIdentifier}`);
    
    // If message interception is enabled, skip direct webhook forwarding
    const skipWebhook = this.botMessageMonitor && this.botMessageMonitor.isEnabled();
    
    // Check if there's buffered content to send
    const buffered = this.responseBuffers.get(messageId);
    if (buffered && buffered.content && buffered.content.trim()) {
      const agent = this.agentMapper.resolve(buffered.agentId) || this.agentMapper.getDefaultAgent();
      
      this.log(`Flushing buffer for ${agent.name}: ${buffered.content.length} chars`);
      this.emit('message_received', agent.id, buffered.content);
      
      // Register the accumulated buffer content with BotMessageMonitor
      // This is the full content that will match the final Discord message
      if (this.botMessageMonitor) {
        this.botMessageMonitor.registerPendingMessage(agent.id, buffered.content);
        this.forceLog(`📝 Registered streaming response for ${agent.emoji} ${agent.name}`);
      }
      
      if (!skipWebhook) {
        await this.forwardToWebhook(agent, buffered.content);
      } else {
        this.log('Skipping direct webhook forward (message interception enabled)');
      }
      
      this.responseBuffers.delete(messageId);
    }
    
    // Also handle any content in the end message itself
    let content = '';
    if (typeof message.content === 'string') {
      content = message.content;
    } else if (Array.isArray(message.content)) {
      content = extractTextContent(message.content);
    } else if ((message as any).text) {
      content = (message as any).text;
    }
    
    if (content && content.trim()) {
      const agent = this.agentMapper.resolve(agentIdentifier) || this.agentMapper.getDefaultAgent();
      this.log(`End message content for ${agent.name}: ${content.length} chars`);
      this.emit('message_received', agent.id, content);
      
      if (!skipWebhook) {
        await this.forwardToWebhook(agent, content);
      } else {
        this.log('Skipping direct webhook forward (message interception enabled)');
      }
    }
    
    // Mark agent as exited if appropriate
    const agent = this.agentMapper.resolve(agentIdentifier);
    if (agent && message.complete !== false) {
      // Don't remove from active agents immediately as they might respond again
      // this.activeAgents.delete(agent.id);
      // this.emit('agent_exit', agent);
    }
  }

  /**
   * Handle channel message (user messages from Discord)
   */
  private handleChannelMessage(message: ChannelMessage): void {
    // We don't need to forward user messages, but we could track them for context
    if (this.config.verbose) {
      this.log(`Channel message from ${message.author?.name || 'unknown'}: ${message.content?.substring(0, 50)}...`);
    }
  }

  // Note: handleMessageSent has been removed.
  // Message interception is now handled by BotMessageMonitor which directly monitors Discord
  // for bot messages using Discord.js Client, instead of depending on Gateway events.

  /**
   * Forward a message to Discord via webhook
   * Uses sendAsAgentDirect to pass agent info directly, allowing base webhook to use correct username/avatar
   */
  private async forwardToWebhook(agent: AgentDefinition, content: string): Promise<void> {
    // Check if we can send via any webhook (agent-specific or base)
    if (!this.webhookManager.canSend(agent.id)) {
      this.log(`No webhook available for agent: ${agent.id}`);
      return;
    }

    try {
      // Use sendAsAgentDirect to ensure correct username/avatar even with base webhook
      await this.webhookManager.sendAsAgentDirect(agent, content);
      this.messagesForwarded++;
      this.emit('message_forwarded', agent.id, content);
      this.log(`Forwarded message from ${agent.emoji} ${agent.name}`);
    } catch (error) {
      this.webhookErrors++;
      this.log(`Failed to forward message: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.emit('error', error instanceof Error ? error : new Error('Webhook send failed'));
    }
  }

  /**
   * Start process detection loop
   */
  private startProcessDetection(): void {
    if (this.processCheckTimer) {
      return;
    }

    this.processCheckTimer = setInterval(() => {
      this.checkOpenClawProcess();
    }, this.config.processCheckInterval);
  }

  /**
   * Stop process detection loop
   */
  private stopProcessDetection(): void {
    if (this.processCheckTimer) {
      clearInterval(this.processCheckTimer);
      this.processCheckTimer = null;
    }
  }

  /**
   * Check if OpenClaw process is running
   */
  private checkOpenClawProcess(): void {
    const isRunning = this.isOpenClawRunning();
    
    if (isRunning && !this.gatewayClient.isConnected) {
      // OpenClaw detected but not connected - try to connect
      this.log('OpenClaw process detected, attempting to connect...');
      this.connect();
    } else if (!isRunning && this.openclawDetected) {
      // OpenClaw was running but now it's not
      this.openclawDetected = false;
      this.emit('openclaw_lost');
    }
  }

  /**
   * Start periodic cleanup of stale response buffers
   */
  private startBufferCleanup(): void {
    if (this.bufferCleanupTimer) {
      return;
    }

    this.bufferCleanupTimer = setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;
      
      // Don't forward via webhook if interception is enabled
      const skipWebhook = this.botMessageMonitor && this.botMessageMonitor.isEnabled();
      
      for (const [id, buffer] of this.responseBuffers) {
        if (now - buffer.lastUpdate > this.BUFFER_STALE_THRESHOLD) {
          // Buffer is stale - flush it if it has content (and interception is off)
          if (buffer.content.trim() && !skipWebhook) {
            const agent = this.agentMapper.resolve(buffer.agentId) || this.agentMapper.getDefaultAgent();
            this.forwardToWebhook(agent, buffer.content).catch(() => {});
          }
          this.responseBuffers.delete(id);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0 && this.config.verbose) {
        this.log(`Cleaned ${cleanedCount} stale response buffer(s)`);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop buffer cleanup interval
   */
  private stopBufferCleanup(): void {
    if (this.bufferCleanupTimer) {
      clearInterval(this.bufferCleanupTimer);
      this.bufferCleanupTimer = null;
    }
  }

  /**
   * Check if OpenClaw process is running on the system
   */
  private isOpenClawRunning(): boolean {
    try {
      // Try to detect OpenClaw process
      // This is platform-specific and may not work in all environments
      const platform = process.platform;
      
      if (platform === 'win32') {
        const result = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV', { encoding: 'utf8', timeout: 5000 });
        return result.toLowerCase().includes('openclaw');
      } else {
        // Unix-like systems
        const result = execSync('ps aux', { encoding: 'utf8', timeout: 5000 });
        return result.toLowerCase().includes('openclaw');
      }
    } catch {
      // If process check fails, assume we can try connecting
      return true;
    }
  }

  /**
   * Log a message (if verbose mode or important)
   */
  private log(message: string): void {
    if (this.config.verbose) {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] [TMC Daemon] ${message}`);
    }
  }

  /**
   * Force log regardless of verbose setting
   */
  forceLog(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] [TMC Daemon] ${message}`);
  }
}
