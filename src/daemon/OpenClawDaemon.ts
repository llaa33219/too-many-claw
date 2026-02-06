/**
 * Too Many Claw - OpenClaw Daemon
 * Automatically connects to OpenClaw Gateway and routes agent responses through webhooks
 */

import { EventEmitter } from 'events';
import { execSync } from 'child_process';
import { GatewayClient, ConnectionState, AgentResponseMessage, GatewayMessage, ChannelMessage, extractTextContent } from '../openclaw/GatewayClient.js';
import { WebhookManager } from '../discord/WebhookManager.js';
import { BotMessageSuppressor, DetectedBotMessage } from '../discord/BotMessageSuppressor.js';
import { ConfigManager } from '../config/ConfigManager.js';
import { AgentMapper } from './AgentMapper.js';
import { AgentDefinition } from '../types/index.js';
import { AGENT_DEFINITIONS } from '../agents/definitions.js';

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
  /** Enable bot message suppression (delete OpenClaw's direct bot messages) */
  suppressBotMessages?: boolean;
  /** @deprecated Use suppressBotMessages instead */
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
  /** Number of bot messages suppressed */
  messagesSuppressed: number;
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
  suppressBotMessages: true,
  interceptMessages: true,
};

/**
 * OpenClaw Daemon - Bridges OpenClaw agent responses to Discord webhooks
 */
export class OpenClawDaemon extends EventEmitter {
  private config: Required<DaemonConfig>;
  private gatewayClient: GatewayClient;
  private webhookManager: WebhookManager;
  private botMessageSuppressor: BotMessageSuppressor | null = null;
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
  private messagesSuppressed = 0;
  private lastMessageAt: Date | null = null;
  private reconnectAttempts = 0;
  
  // Track active agents in conversation
  private activeAgents: Set<string> = new Set();
  
  // Buffer for accumulating streaming responses
  private responseBuffers: Map<string, { agentId: string; content: string; lastUpdate: number }> = new Map();
  private bufferCleanupTimer: NodeJS.Timeout | null = null;
  
  // Buffer stale threshold in ms (60 seconds)
  private readonly BUFFER_STALE_THRESHOLD = 60000;
  
  // Dedup: track recently sent webhook messages to prevent double-sends
  private recentlySent: Map<string, number> = new Map();
  private readonly DEDUP_TTL = 10000; // 10 seconds
  
  // Content-only dedup: contentHash → timestamp (for relay to check if already forwarded)
  private recentContentHashes: Map<string, number> = new Map();
  // Agent hints from Gateway events: contentHash → { agentId, timestamp }
  private agentHints: Map<string, { agentId: string; timestamp: number }> = new Map();
  private readonly AGENT_HINT_TTL = 30000; // 30 seconds

  constructor(config: DaemonConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Backward compatibility: interceptMessages → suppressBotMessages
    if (config.interceptMessages !== undefined && config.suppressBotMessages === undefined) {
      this.config.suppressBotMessages = config.interceptMessages;
    }
    
    this.configManager = new ConfigManager();
    this.webhookManager = new WebhookManager();
    this.agentMapper = new AgentMapper();
    
    // Ensure gateway token exists (auto-generate if missing)
    const { token: gatewayToken, generated } = this.configManager.ensureGatewayToken();
    if (generated) {
      this.forceLog('🔑 Auto-generated gateway token and saved to openclaw.json');
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

    // Set up bot message suppressor
    await this.setupBotMessageSuppressor();

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
    
    // Disconnect bot message suppressor
    if (this.botMessageSuppressor) {
      await this.botMessageSuppressor.disconnect();
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
      messagesSuppressed: this.messagesSuppressed,
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
      const hasWebhook = this.webhookManager.hasBaseWebhook() || this.webhookManager.getRegisteredAgents().length > 0;
      this.forceLog(`Connected to OpenClaw Gateway (webhook: ${hasWebhook ? '✓' : '✗ NOT CONFIGURED'})`);
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
      this.handleAgentResponse(message);
    });

    this.gatewayClient.on('agent_delta', (message: AgentResponseMessage) => {
      this.handleAgentDelta(message);
    });

    this.gatewayClient.on('agent_start', (message: GatewayMessage) => {
      this.handleAgentStart(message);
    });

    this.gatewayClient.on('agent_end', (message: AgentResponseMessage) => {
      this.handleAgentEnd(message);
    });

    this.gatewayClient.on('channel_message', (message: ChannelMessage) => {
      this.handleChannelMessage(message);
    });

    // message_sent events are not used - daemon sends via webhook directly
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
      this.forceLog('⚠ No webhooks configured — messages will not be forwarded to Discord. Run `tmc setup`');
    }
  }

  /**
   * Set up bot message suppressor to delete OpenClaw's direct Discord messages.
   * The daemon sends via webhook directly — the suppressor just cleans up duplicates.
   */
  private async setupBotMessageSuppressor(): Promise<void> {
    if (!this.config.suppressBotMessages) {
      this.log('Bot message suppression disabled');
      return;
    }

    const discordConfig = this.configManager.getDiscordConfig();
    
    if (!discordConfig.token) {
      this.log('Discord token not configured - bot message suppression disabled');
      return;
    }

    this.botMessageSuppressor = new BotMessageSuppressor({
      botToken: discordConfig.token,
      channelId: discordConfig.chatChannelId,
      verbose: this.config.verbose,
      deleteDelay: 150,
    });

    this.botMessageSuppressor.on('ready', (_botId: string, botTag: string) => {
      this.forceLog(`Bot message suppressor ready: ${botTag}`);
    });

    this.botMessageSuppressor.on('suppressed', (messageId: string, channelId: string) => {
      this.messagesSuppressed++;
      this.log(`Suppressed bot message ${messageId} in channel ${channelId}`);
    });

    this.botMessageSuppressor.on('error', (error: Error, context: string) => {
      this.log(`Suppressor error in ${context}: ${error.message}`);
      this.emit('error', error);
    });

    try {
      await this.botMessageSuppressor.connect();
      this.setupRelayHandler();
      this.forceLog('Bot message suppression enabled — webhook relay active');
    } catch (error) {
      this.forceLog(`Failed to connect bot message suppressor: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.botMessageSuppressor = null;
    }
  }

  /**
   * Set up relay handler on the Suppressor.
   * When the Suppressor detects an OpenClaw bot message, this handler:
   *   1. Checks if the content was already forwarded via webhook (Gateway path)
   *   2. If not, resolves the agent and forwards via webhook (relay fallback)
   *   3. Deletes the original bot message
   */
  private setupRelayHandler(): void {
    if (!this.botMessageSuppressor) return;

    this.botMessageSuppressor.on('bot_message_detected', async (detected: DetectedBotMessage) => {
      const contentHash = this.hashForDedup(detected.content);
      const now = Date.now();

      const lastSentAt = this.recentContentHashes.get(contentHash);
      if (lastSentAt && now - lastSentAt < this.DEDUP_TTL) {
        this.log('Relay: content already forwarded via Gateway, just deleting bot message');
      } else {
        // Resolve agent: Gateway hint → content parsing → default
        const hint = this.agentHints.get(contentHash);
        const hintedAgent = hint ? this.agentMapper.resolve(hint.agentId) : null;
        const agent = hintedAgent
          || this.resolveAgentFromContent(detected.content)
          || this.agentMapper.getDefaultAgent();

        this.forceLog(`📨 Relay: forwarding bot message as ${agent.emoji} ${agent.name}`);
        await this.forwardToWebhook(agent, detected.content);
      }

      // Delete the original bot message (suppression count tracked by 'suppressed' event)
      try {
        await detected.deleteMessage();
      } catch (error) {
        this.log(`Relay: failed to delete bot message: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  /**
   * Try to resolve an agent from message content.
   * OpenClaw may prefix messages with agent emoji/name.
   */
  private resolveAgentFromContent(content: string): AgentDefinition | null {
    const trimmed = content.trim();
    for (const agent of AGENT_DEFINITIONS) {
      if (trimmed.startsWith(agent.emoji)) {
        return agent;
      }
      if (trimmed.startsWith(`${agent.name}:`) || trimmed.startsWith(`${agent.name} `)) {
        return agent;
      }
      if (trimmed.startsWith(`[${agent.name}]`) || trimmed.startsWith(`**${agent.name}**`)) {
        return agent;
      }
    }
    return null;
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
   * Always forwards directly via webhook with correct agent identity.
   */
  private async handleAgentResponse(message: AgentResponseMessage): Promise<void> {
    const agentIdentifier = this.extractAgentIdentifier(message);
    
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
      content = (message as any).text || (message as any).message || '';
    }
    
    if (!content || content.trim() === '') {
      this.log(`Empty content for agent response from: ${agentIdentifier}`);
      return;
    }

    const agent = this.agentMapper.resolve(agentIdentifier) || this.agentMapper.getDefaultAgent();
    
    // Store agent hint for relay fallback path
    this.agentHints.set(this.hashForDedup(content), { agentId: agent.id, timestamp: Date.now() });
    
    this.forceLog(`📥 Gateway: agent response from ${agent.emoji} ${agent.name}`);
    this.emit('message_received', agent.id, content);
    
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
   * Always forwards directly via webhook. Dedup prevents double-sends.
   */
  private async handleAgentEnd(message: AgentResponseMessage): Promise<void> {
    const messageId = message.id || (message as any).runId || message.agentId || message.agentName || 'default';
    const agentIdentifier = this.extractAgentIdentifier(message);
    
    if (this.config.verbose) {
      this.log(`Agent end - messageId: ${messageId}, extracted identifier: ${agentIdentifier}`);
    }
    
    this.log(`Agent end event [${messageId}] from: ${agentIdentifier}`);
    
    // Flush buffered streaming content
    const buffered = this.responseBuffers.get(messageId);
    if (buffered && buffered.content && buffered.content.trim()) {
      const agent = this.agentMapper.resolve(buffered.agentId) || this.agentMapper.getDefaultAgent();
      
      this.agentHints.set(this.hashForDedup(buffered.content), { agentId: agent.id, timestamp: Date.now() });
      this.log(`Flushing buffer for ${agent.name}: ${buffered.content.length} chars`);
      this.emit('message_received', agent.id, buffered.content);
      
      await this.forwardToWebhook(agent, buffered.content);
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
      this.agentHints.set(this.hashForDedup(content), { agentId: agent.id, timestamp: Date.now() });
      this.log(`End message content for ${agent.name}: ${content.length} chars`);
      this.emit('message_received', agent.id, content);
      
      await this.forwardToWebhook(agent, content);
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

  /**
   * Forward a message to Discord via webhook with deduplication.
   * Uses sendAsAgentDirect to pass agent info directly, allowing base webhook to use correct username/avatar.
   */
  private async forwardToWebhook(agent: AgentDefinition, content: string): Promise<void> {
    if (!this.webhookManager.canSend(agent.id)) {
      this.forceLog(`⚠ No webhook available for agent: ${agent.id} — run 'tmc setup' to configure`);
      return;
    }

    const contentHash = this.hashForDedup(content);
    const now = Date.now();

    // Content-only dedup: skip if same content was recently sent (by any agent/path)
    const lastContentSent = this.recentContentHashes.get(contentHash);
    if (lastContentSent && now - lastContentSent < this.DEDUP_TTL) {
      this.log(`Dedup: content already sent via another path, skipping`);
      return;
    }

    // Agent-specific dedup: skip if same agent sent same content recently
    const dedupKey = `${agent.id}:${contentHash}`;
    const lastSent = this.recentlySent.get(dedupKey);
    if (lastSent && now - lastSent < this.DEDUP_TTL) {
      this.log(`Dedup: skipping duplicate webhook send for ${agent.name}`);
      return;
    }

    // Set content hash optimistically BEFORE sending to prevent race conditions
    // between Gateway path and Relay path (both check this map before sending)
    this.recentContentHashes.set(contentHash, now);

    try {
      await this.webhookManager.sendAsAgentDirect(agent, content);
      this.recentlySent.set(dedupKey, now);
      this.messagesForwarded++;
      this.emit('message_forwarded', agent.id, content);
      this.log(`Forwarded message from ${agent.emoji} ${agent.name}`);
    } catch (error) {
      this.recentContentHashes.delete(contentHash); // rollback on failure to allow retry
      this.webhookErrors++;
      this.forceLog(`✗ Webhook send failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.emit('error', error instanceof Error ? error : new Error('Webhook send failed'));
    }
  }

  /**
   * Simple content hash for deduplication
   */
  private hashForDedup(content: string): string {
    const normalized = content.trim().replace(/\s+/g, ' ').toLowerCase();
    return `${normalized.substring(0, 200)}|${normalized.length}`;
  }

  /**
   * Clean up expired dedup entries
   */
  private cleanupDedupCache(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.recentlySent) {
      if (now - timestamp > this.DEDUP_TTL) {
        this.recentlySent.delete(key);
      }
    }
    for (const [key, timestamp] of this.recentContentHashes) {
      if (now - timestamp > this.DEDUP_TTL) {
        this.recentContentHashes.delete(key);
      }
    }
    for (const [key, hint] of this.agentHints) {
      if (now - hint.timestamp > this.AGENT_HINT_TTL) {
        this.agentHints.delete(key);
      }
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
      
      for (const [id, buffer] of this.responseBuffers) {
        if (now - buffer.lastUpdate > this.BUFFER_STALE_THRESHOLD) {
          if (buffer.content.trim()) {
            const agent = this.agentMapper.resolve(buffer.agentId) || this.agentMapper.getDefaultAgent();
            this.forwardToWebhook(agent, buffer.content).catch(() => {});
          }
          this.responseBuffers.delete(id);
          cleanedCount++;
        }
      }
      
      // Also clean up expired dedup entries
      this.cleanupDedupCache();
      
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
