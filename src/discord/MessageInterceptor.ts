/**
 * Too Many Claw - Discord Message Interceptor
 * Monitors for OpenClaw bot messages and replaces them with webhook messages
 * that have agent-specific usernames and avatars.
 * 
 * Uses Discord REST API directly to avoid conflicts with OpenClaw's Discord client.
 */

import { EventEmitter } from 'events';
import { WebhookManager } from './WebhookManager.js';
import { AgentMapper } from '../daemon/AgentMapper.js';
import { AgentDefinition } from '../types/index.js';

/** Discord REST API base URL */
const DISCORD_API_BASE = 'https://discord.com/api/v10';

/** Message interceptor configuration */
export interface MessageInterceptorConfig {
  /** Discord bot token for API access */
  botToken: string;
  /** Channel ID to monitor (optional - if not set, intercepts all channels) */
  channelId?: string;
  /** Delay in ms before deleting message (to ensure it was sent) */
  deleteDelay?: number;
  /** Enable verbose logging */
  verbose?: boolean;
}

/** Message sent event data from Gateway */
export interface MessageSentEvent {
  /** Discord message ID */
  messageId?: string;
  /** Discord channel ID */
  channelId?: string;
  /** Message content */
  content?: string;
  /** Agent identifier */
  agentId?: string;
  agentName?: string;
  /** Guild ID (optional) */
  guildId?: string;
  /** Whether this was sent by the bot */
  isBot?: boolean;
  /** Raw event data */
  raw?: unknown;
}

/** Events emitted by MessageInterceptor */
export interface MessageInterceptorEvents {
  'intercepted': (messageId: string, agentId: string) => void;
  'deleted': (messageId: string, channelId: string) => void;
  'resent': (agentId: string, content: string) => void;
  'error': (error: Error, context: string) => void;
}

/**
 * Intercepts OpenClaw bot messages and replaces them with webhook messages
 */
export class MessageInterceptor extends EventEmitter {
  private config: Required<MessageInterceptorConfig>;
  private webhookManager: WebhookManager;
  private agentMapper: AgentMapper;
  private enabled = true;
  
  // Track recently processed messages to avoid duplicates
  private processedMessages: Set<string> = new Set();
  private readonly MAX_PROCESSED_CACHE = 100;

  constructor(
    config: MessageInterceptorConfig,
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
    return this.enabled;
  }

  /**
   * Handle a message_sent event from OpenClaw Gateway
   * Deletes the original bot message and resends via webhook
   */
  async handleMessageSent(event: MessageSentEvent): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    const { messageId, channelId, content, agentId, agentName } = event;

    // Validate required fields
    if (!messageId || !channelId || !content) {
      this.log(`Missing required fields: messageId=${messageId}, channelId=${channelId}, hasContent=${!!content}`);
      return false;
    }

    // Check if we should intercept this channel
    if (this.config.channelId && channelId !== this.config.channelId) {
      this.log(`Skipping message in channel ${channelId} (not monitored)`);
      return false;
    }

    // Check if already processed (avoid duplicates)
    if (this.processedMessages.has(messageId)) {
      this.log(`Message ${messageId} already processed, skipping`);
      return false;
    }

    // Mark as processed
    this.addToProcessedCache(messageId);

    try {
      // Resolve agent from identifier or content
      const agentIdentifier = agentId || agentName || 'assistant';
      const agent = this.agentMapper.resolve(agentIdentifier) || 
                   this.agentMapper.getDefaultAgent();

      this.emit('intercepted', messageId, agent.id);
      this.log(`Intercepting message ${messageId} from agent ${agent.name}`);

      // Wait a small delay to ensure the message was fully sent
      if (this.config.deleteDelay > 0) {
        await this.delay(this.config.deleteDelay);
      }

      // Delete the original bot message
      const deleted = await this.deleteMessage(channelId, messageId);
      if (!deleted) {
        this.log(`Failed to delete message ${messageId}, sending via webhook anyway`);
      }

      // Send via webhook with agent avatar
      await this.sendViaWebhook(agent, content);
      this.emit('resent', agent.id, content);

      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.emit('error', err, `handleMessageSent for ${messageId}`);
      this.log(`Error handling message ${messageId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Delete a message using Discord REST API
   */
  async deleteMessage(channelId: string, messageId: string): Promise<boolean> {
    try {
      const url = `${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}`;
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bot ${this.config.botToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok || response.status === 204) {
        this.emit('deleted', messageId, channelId);
        this.log(`Deleted message ${messageId} from channel ${channelId}`);
        return true;
      }

      // Handle specific error cases
      if (response.status === 404) {
        this.log(`Message ${messageId} not found (already deleted?)`);
        return true; // Consider this a success
      }

      if (response.status === 403) {
        this.log(`Permission denied to delete message ${messageId}`);
        return false;
      }

      const errorBody = await response.text();
      this.log(`Failed to delete message: ${response.status} - ${errorBody}`);
      return false;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      this.emit('error', err, `deleteMessage ${messageId}`);
      this.log(`Error deleting message ${messageId}: ${err.message}`);
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
      console.log(`[${timestamp}] [MessageInterceptor] ${message}`);
    }
  }

  /**
   * Force log regardless of verbose setting
   */
  forceLog(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] [MessageInterceptor] ${message}`);
  }
}
