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
  PermissionFlagsBits,
  Webhook,
  Collection,
  Guild,
} from 'discord.js';
import { Message } from '../types/index.js';
import { AgentDefinition } from '../types/index.js';
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

  /**
   * Detect guild ID from connected guilds
   * Returns the first guild the bot is connected to, or the configured guildId
   */
  async detectGuildId(): Promise<string | null> {
    if (!this.client.isReady()) {
      return this.config.guildId || null;
    }

    // If we have a configured guildId, verify it exists
    if (this.config.guildId) {
      const guild = this.client.guilds.cache.get(this.config.guildId);
      if (guild) {
        return this.config.guildId;
      }
    }

    // Otherwise, return the first guild
    const firstGuild = this.client.guilds.cache.first();
    return firstGuild?.id || null;
  }

  /**
   * Get all connected guilds
   */
  getConnectedGuilds(): Collection<string, Guild> {
    return this.client.guilds.cache;
  }

  /**
   * Get existing webhooks in a channel
   */
  async getExistingWebhooks(channelId: string): Promise<Webhook[]> {
    const channel = await this.client.channels.fetch(channelId);
    if (!(channel instanceof TextChannel)) {
      throw new Error('Channel is not a text channel');
    }

    // Check if bot has permission to manage webhooks
    const permissions = channel.permissionsFor(this.client.user!);
    if (!permissions?.has(PermissionFlagsBits.ManageWebhooks)) {
      throw new Error('Bot does not have MANAGE_WEBHOOKS permission in this channel');
    }

    const webhooks = await channel.fetchWebhooks();
    return Array.from(webhooks.values());
  }

  /**
   * Check if bot has webhook management permission in a channel
   */
  async hasWebhookPermission(channelId: string): Promise<boolean> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!(channel instanceof TextChannel)) {
        return false;
      }

      const permissions = channel.permissionsFor(this.client.user!);
      return permissions?.has(PermissionFlagsBits.ManageWebhooks) ?? false;
    } catch {
      return false;
    }
  }

  /**
   * Auto-create webhooks for agents in a channel
   * @param channelId - The channel to create webhooks in
   * @param agents - Array of agent definitions to create webhooks for
   * @param onProgress - Optional callback for progress updates
   * @returns Record of agentId -> webhook URL
   */
  async autoCreateWebhooks(
    channelId: string,
    agents: AgentDefinition[],
    onProgress?: (current: number, total: number, agentName: string) => void
  ): Promise<Record<string, string>> {
    const channel = await this.client.channels.fetch(channelId);
    if (!(channel instanceof TextChannel)) {
      throw new Error('Channel is not a text channel');
    }

    // Check permissions
    const permissions = channel.permissionsFor(this.client.user!);
    if (!permissions?.has(PermissionFlagsBits.ManageWebhooks)) {
      throw new Error('Bot does not have MANAGE_WEBHOOKS permission in this channel');
    }

    // Get existing webhooks to avoid duplicates
    const existingWebhooks = await channel.fetchWebhooks();
    const webhooksByName = new Map<string, Webhook>();
    for (const webhook of existingWebhooks.values()) {
      if (webhook.name) {
        webhooksByName.set(webhook.name, webhook);
      }
    }

    const result: Record<string, string> = {};
    let current = 0;
    const total = agents.length;

    for (const agent of agents) {
      current++;
      const webhookName = `${agent.emoji} ${agent.name}`;

      if (onProgress) {
        onProgress(current, total, agent.name);
      }

      // Check if webhook already exists
      const existing = webhooksByName.get(webhookName);
      if (existing) {
        result[agent.id] = existing.url;
        continue;
      }

      // Create new webhook
      try {
        const webhook = await channel.createWebhook({
          name: webhookName,
          reason: `Too Many Claw - Auto-created webhook for agent: ${agent.id}`,
        });
        result[agent.id] = webhook.url;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to create webhook for ${agent.name}:`, error);
        // Continue with other agents even if one fails
      }
    }

    return result;
  }

  /**
   * Delete a webhook by URL
   */
  async deleteWebhook(webhookUrl: string): Promise<boolean> {
    try {
      // Extract webhook ID and token from URL
      const match = webhookUrl.match(/webhooks\/(\d+)\/([\w-]+)/);
      if (!match) {
        return false;
      }

      const [, id, token] = match;
      const webhook = await this.client.fetchWebhook(id, token);
      await webhook.delete('Too Many Claw - Webhook cleanup');
      return true;
    } catch {
      return false;
    }
  }
}
