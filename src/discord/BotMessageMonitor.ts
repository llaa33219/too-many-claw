/**
 * Too Many Claw - Bot Message Monitor
 * Uses Discord.js Client to directly monitor Discord channel for bot messages.
 * When the bot (OpenClaw) sends a message, it deletes the message and resends
 * via webhook with agent-specific username and avatar.
 * 
 * This approach is more reliable than depending on OpenClaw Gateway events,
 * as it directly monitors Discord for bot messages.
 */

import { Client, GatewayIntentBits, Message, Partials } from 'discord.js';
import { EventEmitter } from 'events';
import { WebhookManager } from './WebhookManager.js';
import { AgentMapper } from '../daemon/AgentMapper.js';
import { AgentDefinition } from '../types/index.js';

/** Bot message monitor configuration */
export interface BotMessageMonitorConfig {
  /** Discord bot token */
  botToken: string;
  /** Channel ID to monitor (if not set, monitors all channels the bot can see) */
  channelId?: string;
  /** Delay in ms before deleting message (to ensure it was fully sent) */
  deleteDelay?: number;
  /** Enable verbose logging */
  verbose?: boolean;
}

/** Events emitted by BotMessageMonitor */
export interface BotMessageMonitorEvents {
  'ready': (botId: string, botTag: string) => void;
  'intercepted': (messageId: string, channelId: string, agentId: string) => void;
  'deleted': (messageId: string, channelId: string) => void;
  'resent': (agentId: string, content: string) => void;
  'error': (error: Error, context: string) => void;
  'disconnect': () => void;
}

/**
 * Monitors Discord for bot messages and replaces them with webhook messages
 */
export class BotMessageMonitor extends EventEmitter {
  private client: Client;
  private config: Required<BotMessageMonitorConfig>;
  private webhookManager: WebhookManager;
  private agentMapper: AgentMapper;
  private enabled = true;
  private connected = false;
  private botUserId: string | null = null;
  
  // Track recently processed messages to avoid duplicates
  private processedMessages: Set<string> = new Set();
  private readonly MAX_PROCESSED_CACHE = 200;

  // Pending messages from Gateway events (content hash -> agentId)
  // This allows us to match Discord messages to their agent
  private pendingMessages: Map<string, { agentId: string; timestamp: number }> = new Map();
  private readonly PENDING_MESSAGE_TTL = 30000; // 30 seconds TTL

  constructor(
    config: BotMessageMonitorConfig,
    webhookManager: WebhookManager,
    agentMapper: AgentMapper
  ) {
    super();
    this.config = {
      botToken: config.botToken,
      channelId: config.channelId || '',
      deleteDelay: config.deleteDelay ?? 100,
      verbose: config.verbose ?? false,
    };
    this.webhookManager = webhookManager;
    this.agentMapper = agentMapper;

    // Create Discord client with necessary intents
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Message, Partials.Channel],
    });

    this.setupEventHandlers();
  }

  /**
   * Connect to Discord
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    this.log('Connecting to Discord...');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Discord connection timeout after 30 seconds'));
      }, 30000);

      this.client.once('ready', () => {
        clearTimeout(timeout);
        this.connected = true;
        this.botUserId = this.client.user?.id || null;
        const botTag = this.client.user?.tag || 'Unknown';
        this.forceLog(`Connected to Discord as ${botTag} (ID: ${this.botUserId})`);
        this.emit('ready', this.botUserId, botTag);
        resolve();
      });

      this.client.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.client.login(this.config.botToken).catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Disconnect from Discord
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    this.log('Disconnecting from Discord...');
    this.connected = false;
    this.client.destroy();
    this.emit('disconnect');
  }

  /**
   * Enable or disable message interception
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.log(`Message interception ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if interception is enabled
   */
  isEnabled(): boolean {
    return this.enabled && this.connected;
  }

  /**
   * Check if connected to Discord
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Register a pending message from Gateway event
   * This allows BotMessageMonitor to know which agent sent the message
   * @param agentId - The agent ID from Gateway event
   * @param content - The message content (will be hashed for lookup)
   */
  registerPendingMessage(agentId: string, content: string): void {
    if (!content || !agentId) return;
    
    const hash = this.hashContent(content);
    this.pendingMessages.set(hash, {
      agentId,
      timestamp: Date.now(),
    });
    
    this.log(`Registered pending message for agent ${agentId}: ${content.substring(0, 50)}...`);
    
    // Clean up old entries
    this.cleanupPendingMessages();
  }

  /**
   * Create a hash from content for lookup
   */
  private hashContent(content: string): string {
    // Normalize content: trim, remove extra whitespace, lowercase
    const normalized = content.trim().replace(/\s+/g, ' ').toLowerCase();
    // Use first 200 chars + length as a simple hash
    return `${normalized.substring(0, 200)}|${normalized.length}`;
  }

  /**
   * Clean up expired pending messages
   */
  private cleanupPendingMessages(): void {
    const now = Date.now();
    for (const [hash, data] of this.pendingMessages) {
      if (now - data.timestamp > this.PENDING_MESSAGE_TTL) {
        this.pendingMessages.delete(hash);
      }
    }
    
    // Also limit size
    if (this.pendingMessages.size > 100) {
      const entries = Array.from(this.pendingMessages.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      // Remove oldest half
      for (let i = 0; i < 50; i++) {
        this.pendingMessages.delete(entries[i][0]);
      }
    }
  }

  /**
   * Look up agent from pending messages by content
   */
  private lookupPendingAgent(content: string): string | null {
    const hash = this.hashContent(content);
    const pending = this.pendingMessages.get(hash);
    
    if (pending && Date.now() - pending.timestamp < this.PENDING_MESSAGE_TTL) {
      // Remove from pending after use
      this.pendingMessages.delete(hash);
      this.log(`Found pending agent ${pending.agentId} for message`);
      return pending.agentId;
    }
    
    // Try partial matching for streaming/chunked messages
    const normalizedContent = content.trim().toLowerCase();
    for (const [pendingHash, data] of this.pendingMessages) {
      const pendingContent = pendingHash.split('|')[0];
      // Check if the message content starts with or contains the pending content
      if (normalizedContent.includes(pendingContent.substring(0, 100)) ||
          pendingContent.includes(normalizedContent.substring(0, 100))) {
        if (Date.now() - data.timestamp < this.PENDING_MESSAGE_TTL) {
          this.pendingMessages.delete(pendingHash);
          this.log(`Found pending agent ${data.agentId} via partial match`);
          return data.agentId;
        }
      }
    }
    
    return null;
  }

  /**
   * Get the bot's user ID
   */
  getBotUserId(): string | null {
    return this.botUserId;
  }

  /**
   * Set up Discord event handlers
   */
  private setupEventHandlers(): void {
    // Handle incoming messages
    this.client.on('messageCreate', async (message: Message) => {
      await this.handleMessage(message);
    });

    // Handle errors
    this.client.on('error', (error: Error) => {
      this.emit('error', error, 'Discord client error');
      this.log(`Discord client error: ${error.message}`);
    });

    // Handle disconnection
    this.client.on('shardDisconnect', () => {
      this.connected = false;
      this.log('Disconnected from Discord');
      this.emit('disconnect');
    });

    // Handle reconnection
    this.client.on('shardReconnecting', () => {
      this.log('Reconnecting to Discord...');
    });

    this.client.on('shardResume', () => {
      this.connected = true;
      this.log('Reconnected to Discord');
    });
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(message: Message): Promise<void> {
    // Skip if interception is disabled
    if (!this.enabled) {
      return;
    }

    // Skip if this is not our bot's message
    if (message.author.id !== this.botUserId) {
      return;
    }

    // Skip if we're filtering by channel and this isn't the target channel
    if (this.config.channelId && message.channel.id !== this.config.channelId) {
      return;
    }

    // Skip if already processed
    if (this.processedMessages.has(message.id)) {
      this.log(`Message ${message.id} already processed, skipping`);
      return;
    }

    // Skip empty messages
    if (!message.content || message.content.trim() === '') {
      return;
    }

    // Mark as processed
    this.addToProcessedCache(message.id);

    this.log(`Intercepting bot message ${message.id}: ${message.content.substring(0, 50)}...`);

    try {
      // First, try to find agent from pending Gateway messages
      const pendingAgentId = this.lookupPendingAgent(message.content);
      
      let agent: AgentDefinition;
      let cleanContent: string;
      
      if (pendingAgentId) {
        // Found agent from Gateway event
        agent = this.agentMapper.resolve(pendingAgentId) || this.agentMapper.getDefaultAgent();
        cleanContent = message.content; // Keep content as-is, no need to strip agent prefix
        this.log(`Using agent ${agent.id} from Gateway event`);
      } else {
        // Fallback: try to extract agent from message content
        const extracted = this.extractAgentFromContent(message.content);
        agent = extracted.agent;
        cleanContent = extracted.cleanContent;
        this.log(`Using agent ${agent.id} from content extraction (fallback)`);
      }
      
      this.emit('intercepted', message.id, message.channel.id, agent.id);
      this.forceLog(`🦀 Intercepted message → ${agent.emoji} ${agent.name}`);

      // Wait a small delay to ensure the message is fully processed
      if (this.config.deleteDelay > 0) {
        await this.delay(this.config.deleteDelay);
      }

      // Delete the original bot message
      const deleted = await this.deleteMessage(message);
      if (deleted) {
        this.emit('deleted', message.id, message.channel.id);
      } else {
        // If deletion failed, skip webhook resend to avoid duplicate messages
        this.log(`Skipping webhook resend - original message not deleted`);
        return;
      }

      // Resend via webhook with agent avatar
      await this.sendViaWebhook(agent, cleanContent);
      this.emit('resent', agent.id, cleanContent);

      this.forceLog(`✅ Resent as ${agent.emoji} ${agent.name}: ${cleanContent.substring(0, 50)}...`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.emit('error', err, `handleMessage for ${message.id}`);
      this.log(`Error handling message ${message.id}: ${err.message}`);
    }
  }

  /**
   * Extract agent info from message content
   * Tries to detect agent patterns in the message
   */
  private extractAgentFromContent(content: string): { agent: AgentDefinition; cleanContent: string } {
    // Try to match common patterns:
    // 1. "[AgentName]: message"
    // 2. "**AgentName**: message"
    // 3. "AgentName: message" (at start of message)
    // 4. "🏠 Base: message" (emoji + name pattern)

    let cleanContent = content;
    let agentIdentifier: string | null = null;

    // Pattern 1: [AgentName]: message
    const bracketMatch = content.match(/^\[([^\]]+)\]:\s*(.*)$/s);
    if (bracketMatch) {
      agentIdentifier = bracketMatch[1].trim();
      cleanContent = bracketMatch[2];
    }

    // Pattern 2: **AgentName**: message
    if (!agentIdentifier) {
      const boldMatch = content.match(/^\*\*([^*]+)\*\*:\s*(.*)$/s);
      if (boldMatch) {
        agentIdentifier = boldMatch[1].trim();
        cleanContent = boldMatch[2];
      }
    }

    // Pattern 3: Emoji + AgentName: message (e.g., "🏠 Base: ...")
    if (!agentIdentifier) {
      const emojiNameMatch = content.match(/^([\p{Emoji}]\s*[^:]+):\s*(.*)$/su);
      if (emojiNameMatch) {
        agentIdentifier = emojiNameMatch[1].trim();
        cleanContent = emojiNameMatch[2];
      }
    }

    // Pattern 4: Simple "AgentName: message" at start (only if AgentName is short)
    if (!agentIdentifier) {
      const simpleMatch = content.match(/^([A-Za-z][A-Za-z0-9\s-]{2,25}):\s*(.*)$/s);
      if (simpleMatch) {
        // Only use this if the "name" part looks like an agent name
        const possibleName = simpleMatch[1].trim();
        const resolved = this.agentMapper.resolve(possibleName);
        if (resolved && resolved.id !== 'base') {
          agentIdentifier = possibleName;
          cleanContent = simpleMatch[2];
        }
      }
    }

    // Resolve agent or use default
    const agent = agentIdentifier 
      ? (this.agentMapper.resolve(agentIdentifier) || this.agentMapper.getDefaultAgent())
      : this.agentMapper.getDefaultAgent();

    // If no pattern matched, use original content
    if (!agentIdentifier) {
      cleanContent = content;
    }

    return { agent, cleanContent: cleanContent.trim() };
  }

  /**
   * Delete a message
   */
  private async deleteMessage(message: Message): Promise<boolean> {
    try {
      await message.delete();
      this.log(`Deleted message ${message.id}`);
      return true;
    } catch (error) {
      // Handle specific error cases
      const err = error as { code?: number; message?: string };
      
      if (err.code === 10008) {
        // Unknown Message - already deleted
        this.log(`Message ${message.id} already deleted`);
        return true;
      }
      
      if (err.code === 50013) {
        // Missing Permissions
        this.log(`Missing permission to delete message ${message.id}`);
        return false;
      }

      this.log(`Failed to delete message ${message.id}: ${err.message}`);
      return false;
    }
  }

  /**
   * Send message via webhook with agent avatar
   */
  private async sendViaWebhook(agent: AgentDefinition, content: string): Promise<void> {
    if (!this.webhookManager.canSend(agent.id)) {
      this.log(`No webhook available for agent ${agent.id}`);
      throw new Error(`No webhook available for agent: ${agent.id}`);
    }

    await this.webhookManager.sendAsAgentDirect(agent, content);
    this.log(`Sent message via webhook as ${agent.emoji} ${agent.name}`);
  }

  /**
   * Add message ID to processed cache with eviction
   */
  private addToProcessedCache(messageId: string): void {
    this.processedMessages.add(messageId);
    
    // Evict oldest entries if cache is full
    if (this.processedMessages.size > this.MAX_PROCESSED_CACHE) {
      const iterator = this.processedMessages.values();
      const first = iterator.next().value;
      if (first) {
        this.processedMessages.delete(first);
      }
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log message if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.config.verbose) {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] [BotMessageMonitor] ${message}`);
    }
  }

  /**
   * Force log regardless of verbose setting
   */
  forceLog(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] [BotMessageMonitor] ${message}`);
  }
}
