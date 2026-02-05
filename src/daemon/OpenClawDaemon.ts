/**
 * Too Many Claw - OpenClaw Daemon
 * Automatically connects to OpenClaw Gateway and routes agent responses through webhooks
 */

import { EventEmitter } from 'events';
import { execSync } from 'child_process';
import { GatewayClient, ConnectionState, AgentResponseMessage, GatewayMessage, ChannelMessage } from '../openclaw/GatewayClient.js';
import { WebhookManager } from '../discord/WebhookManager.js';
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
};

/**
 * OpenClaw Daemon - Bridges OpenClaw agent responses to Discord webhooks
 */
export class OpenClawDaemon extends EventEmitter {
  private config: Required<DaemonConfig>;
  private gatewayClient: GatewayClient;
  private webhookManager: WebhookManager;
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
    
    this.gatewayClient = new GatewayClient({
      url: this.config.gatewayUrl,
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
  }

  /**
   * Load webhooks from configuration
   */
  private loadWebhooks(): void {
    const webhooks = this.configManager.getAllWebhooks();
    if (Object.keys(webhooks).length > 0) {
      this.webhookManager.setWebhooks(webhooks);
      this.log(`Loaded ${Object.keys(webhooks).length} webhooks`);
    } else {
      this.log('No webhooks configured - messages will not be forwarded to Discord');
    }
  }

  /**
   * Handle raw message from gateway (for debugging/logging)
   */
  private handleRawMessage(message: GatewayMessage): void {
    this.messagesProcessed++;
    this.lastMessageAt = new Date();
    
    if (this.config.verbose) {
      this.log(`Raw message: ${JSON.stringify(message).substring(0, 200)}...`);
    }
  }

  /**
   * Handle agent response (complete response)
   */
  private async handleAgentResponse(message: AgentResponseMessage): Promise<void> {
    const agentIdentifier = message.agentId || message.agentName || (message as any).agent;
    const content = message.content || (message as any).text || (message as any).message;
    
    if (!content) {
      return;
    }

    const agent = this.agentMapper.resolve(agentIdentifier);
    if (!agent) {
      this.log(`Unknown agent: ${agentIdentifier}`);
      return;
    }

    this.emit('message_received', agent.id, content);
    await this.forwardToWebhook(agent, content);
  }

  /**
   * Handle streaming delta (partial response)
   */
  private handleAgentDelta(message: AgentResponseMessage): void {
    const agentIdentifier = message.agentId || message.agentName || (message as any).agent;
    const delta = message.delta || message.content || (message as any).text;
    const messageId = message.id || agentIdentifier || 'default';
    
    if (!delta) {
      return;
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
   */
  private async handleAgentEnd(message: AgentResponseMessage): Promise<void> {
    const messageId = message.id || message.agentId || message.agentName || 'default';
    const agentIdentifier = message.agentId || message.agentName || (message as any).agent;
    
    // Check if there's buffered content to send
    const buffered = this.responseBuffers.get(messageId);
    if (buffered && buffered.content) {
      const agent = this.agentMapper.resolve(buffered.agentId) || this.agentMapper.getDefaultAgent();
      
      this.emit('message_received', agent.id, buffered.content);
      await this.forwardToWebhook(agent, buffered.content);
      
      this.responseBuffers.delete(messageId);
    }
    
    // Also handle any content in the end message itself
    const content = message.content || (message as any).text;
    if (content) {
      const agent = this.agentMapper.resolve(agentIdentifier);
      if (agent) {
        this.emit('message_received', agent.id, content);
        await this.forwardToWebhook(agent, content);
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

  /**
   * Forward a message to Discord via webhook
   */
  private async forwardToWebhook(agent: AgentDefinition, content: string): Promise<void> {
    let webhookAgentId = agent.id;
    
    if (!this.webhookManager.hasWebhook(agent.id)) {
      // No webhook for this agent, try using the default/base webhook
      if (!this.webhookManager.hasWebhook('base')) {
        this.log(`No webhook available for agent: ${agent.id}`);
        return;
      }
      // Fall back to base agent's webhook
      webhookAgentId = 'base';
      this.log(`Using base webhook for agent: ${agent.id}`);
    }

    try {
      await this.webhookManager.sendAsAgent(webhookAgentId, content);
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
      
      for (const [id, buffer] of this.responseBuffers) {
        if (now - buffer.lastUpdate > this.BUFFER_STALE_THRESHOLD) {
          // Buffer is stale - flush it if it has content
          if (buffer.content.trim()) {
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
