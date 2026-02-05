/**
 * Too Many Claw - Discord Bot
 * Main Discord bot that receives messages
 */

import {
  Client,
  GatewayIntentBits,
  Message as DiscordMessage,
  TextChannel,
  Partials,
} from 'discord.js';
import { Message } from '../types/index.js';
import { getAgentById, getAllAgentIds } from '../agents/definitions.js';

export interface BotConfig {
  token: string;
  guildId: string;
  chatChannelId: string;
  statusChannelId?: string;
}

export class Bot {
  private client: Client;
  private config: BotConfig;
  private messageHandlers: ((message: Message) => void)[] = [];
  private agentIds: Set<string>;

  constructor(config: BotConfig) {
    this.config = config;
    this.agentIds = new Set(getAllAgentIds());

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
      ],
      partials: [Partials.Message, Partials.Channel],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('ready', () => {
      console.log(`✅ Bot logged in as ${this.client.user?.tag}`);
    });

    this.client.on('messageCreate', async (discordMessage: DiscordMessage) => {
      // Ignore bot messages
      if (discordMessage.author.bot) return;

      // Only process messages from chat channel
      if (discordMessage.channelId !== this.config.chatChannelId) return;

      // Convert to our Message format
      const message = this.convertMessage(discordMessage);

      // Notify all handlers
      for (const handler of this.messageHandlers) {
        handler(message);
      }
    });

    this.client.on('error', (error) => {
      console.error('Discord bot error:', error);
    });
  }

  private convertMessage(discordMessage: DiscordMessage): Message {
    const content = this.cleanMessageContent(discordMessage.content);
    const mentions = this.parseMentions(content);

    return {
      id: discordMessage.id,
      content,
      authorId: 'user',
      authorName: discordMessage.author.displayName || discordMessage.author.username,
      authorEmoji: '👤',
      timestamp: discordMessage.createdAt,
      threadId: discordMessage.thread?.id,
      mentions,
    };
  }

  private cleanMessageContent(content: string): string {
    // Replace Discord user mentions with readable format
    return content.replace(/<@!?(\d+)>/g, '@user');
  }

  private parseMentions(content: string): string[] {
    const mentionPattern = /@([a-z-]+)/gi;
    const matches = content.matchAll(mentionPattern);
    const mentions: string[] = [];

    for (const match of matches) {
      const agentId = match[1].toLowerCase();
      if (this.agentIds.has(agentId) && !mentions.includes(agentId)) {
        mentions.push(agentId);
      }
    }

    return mentions;
  }

  /**
   * Register a message handler
   */
  onMessage(handler: (message: Message) => void): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Connect to Discord
   */
  async connect(): Promise<void> {
    await this.client.login(this.config.token);
  }

  /**
   * Disconnect from Discord
   */
  async disconnect(): Promise<void> {
    this.client.destroy();
  }

  /**
   * Send a message to a channel
   */
  async sendMessage(channelId: string, content: string): Promise<void> {
    const channel = await this.client.channels.fetch(channelId);
    if (channel && channel instanceof TextChannel) {
      await channel.send(content);
    }
  }

  /**
   * Get the chat channel
   */
  async getChatChannel(): Promise<TextChannel | null> {
    const channel = await this.client.channels.fetch(this.config.chatChannelId);
    if (channel instanceof TextChannel) {
      return channel;
    }
    return null;
  }

  /**
   * Get the status channel
   */
  async getStatusChannel(): Promise<TextChannel | null> {
    if (!this.config.statusChannelId) return null;
    const channel = await this.client.channels.fetch(this.config.statusChannelId);
    if (channel instanceof TextChannel) {
      return channel;
    }
    return null;
  }

  /**
   * Create a thread in the chat channel
   */
  async createThread(name: string): Promise<string> {
    const channel = await this.getChatChannel();
    if (!channel) {
      throw new Error('Chat channel not found');
    }

    const thread = await channel.threads.create({
      name,
      autoArchiveDuration: 1440, // 24 hours
    });

    return thread.id;
  }

  /**
   * Check if bot is connected
   */
  get isConnected(): boolean {
    return this.client.isReady();
  }
}
