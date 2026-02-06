/**
 * Too Many Claw - Bot Message Suppressor
 * Deletes bot messages from the monitored channel so that only
 * webhook messages (with correct agent identity) remain visible.
 *
 * This is intentionally minimal: no content matching, no webhook sending,
 * no pending-message registration. The daemon sends via webhook directly;
 * this class merely cleans up the duplicate bot messages that OpenClaw
 * sends to Discord on its own.
 */

import { Client, GatewayIntentBits, Message, Partials } from 'discord.js';
import { EventEmitter } from 'events';

export interface BotMessageSuppressorConfig {
  botToken: string;
  channelId?: string;
  deleteDelay?: number;
  verbose?: boolean;
}

export interface BotMessageSuppressorEvents {
  'ready': (botId: string, botTag: string) => void;
  'suppressed': (messageId: string, channelId: string) => void;
  'error': (error: Error, context: string) => void;
  'disconnect': () => void;
}

export class BotMessageSuppressor extends EventEmitter {
  private client: Client;
  private config: Required<BotMessageSuppressorConfig>;
  private enabled = true;
  private connected = false;
  private botUserId: string | null = null;
  private processedMessages: Set<string> = new Set();
  private readonly MAX_PROCESSED_CACHE = 200;
  private readonly MAX_MESSAGE_AGE_MS = 5000;

  constructor(config: BotMessageSuppressorConfig) {
    super();
    this.config = {
      botToken: config.botToken,
      channelId: config.channelId || '',
      deleteDelay: config.deleteDelay ?? 100,
      verbose: config.verbose ?? false,
    };

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

  async connect(): Promise<void> {
    if (this.connected) return;

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
        this.forceLog(`Connected as ${botTag} (ID: ${this.botUserId})`);
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

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    this.log('Disconnecting from Discord...');
    this.connected = false;
    this.client.destroy();
    this.emit('disconnect');
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.log(`Suppression ${enabled ? 'enabled' : 'disabled'}`);
  }

  isEnabled(): boolean {
    return this.enabled && this.connected;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getBotUserId(): string | null {
    return this.botUserId;
  }

  private setupEventHandlers(): void {
    this.client.on('messageCreate', async (message: Message) => {
      await this.handleMessage(message);
    });

    this.client.on('error', (error: Error) => {
      this.emit('error', error, 'Discord client error');
      this.log(`Discord client error: ${error.message}`);
    });

    this.client.on('shardDisconnect', () => {
      this.connected = false;
      this.log('Disconnected from Discord');
      this.emit('disconnect');
    });

    this.client.on('shardResume', () => {
      this.connected = true;
      this.log('Reconnected to Discord');
    });
  }

  private async handleMessage(message: Message): Promise<void> {
    if (!this.enabled) return;

    // Only suppress messages from our bot (not from webhooks)
    if (message.author.id !== this.botUserId) return;
    if (message.webhookId) return;

    // Channel filter
    if (this.config.channelId && message.channel.id !== this.config.channelId) return;

    // Skip already-processed
    if (this.processedMessages.has(message.id)) return;

    // Skip empty messages
    if (!message.content || message.content.trim() === '') return;

    // Safety: ignore messages older than threshold (e.g. on restart)
    const age = Date.now() - message.createdTimestamp;
    if (age > this.MAX_MESSAGE_AGE_MS) {
      this.log(`Ignoring old message ${message.id} (age: ${age}ms)`);
      return;
    }

    this.addToProcessedCache(message.id);

    // Small delay to ensure the message was fully delivered
    if (this.config.deleteDelay > 0) {
      await this.delay(this.config.deleteDelay);
    }

    try {
      await message.delete();
      this.emit('suppressed', message.id, message.channel.id);
      this.forceLog(`🗑️ Suppressed bot message ${message.id}`);
    } catch (error) {
      const err = error as { code?: number; message?: string };
      if (err.code === 10008) {
        // Already deleted
        this.log(`Message ${message.id} already deleted`);
      } else {
        this.log(`Failed to delete message ${message.id}: ${err.message}`);
        this.emit('error', error instanceof Error ? error : new Error('Delete failed'), `suppress ${message.id}`);
      }
    }
  }

  private addToProcessedCache(messageId: string): void {
    this.processedMessages.add(messageId);
    if (this.processedMessages.size > this.MAX_PROCESSED_CACHE) {
      const first = this.processedMessages.values().next().value;
      if (first) this.processedMessages.delete(first);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private log(message: string): void {
    if (this.config.verbose) {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] [BotMessageSuppressor] ${message}`);
    }
  }

  forceLog(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] [BotMessageSuppressor] ${message}`);
  }
}
