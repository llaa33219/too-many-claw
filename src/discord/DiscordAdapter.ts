/**
 * Too Many Claw - Discord Platform Adapter
 * Implements PlatformAdapter interface for Discord
 */

import { Message, PlatformAdapter, AgentDefinition } from '../types/index.js';
import { getAgentById, AGENT_DEFINITIONS } from '../agents/definitions.js';
import { Bot, BotConfig } from './Bot.js';
import { WebhookManager } from './WebhookManager.js';

export class DiscordAdapter implements PlatformAdapter {
  private bot: Bot;
  private webhookManager: WebhookManager;
  private statusChannelId?: string;

  constructor(config: BotConfig) {
    this.bot = new Bot(config);
    this.webhookManager = new WebhookManager();
    this.statusChannelId = config.statusChannelId;
  }

  /**
   * Send a message - uses webhook if available, otherwise bot
   */
  async sendMessage(message: Message): Promise<void> {
    const { authorId, content } = message;

    // Use webhook if available for this agent
    if (authorId !== 'user' && this.webhookManager.hasWebhook(authorId)) {
      await this.webhookManager.sendAsAgent(authorId, content);
    } else {
      // Fallback to bot sending
      const channel = await this.bot.getChatChannel();
      if (channel) {
        await channel.send(content);
      }
    }
  }

  /**
   * Send status update to status channel
   */
  async sendStatusUpdate(agentId: string, status: 'enter' | 'exit'): Promise<void> {
    const channel = await this.bot.getStatusChannel();
    if (!channel) return;

    const agent = getAgentById(agentId);
    if (!agent) return;

    const statusEmoji = status === 'enter' ? '🟢' : '🔴';
    const statusText = status === 'enter' ? '입장' : '퇴장';
    const timestamp = new Date().toLocaleTimeString('ko-KR');

    await channel.send(`${statusEmoji} [${timestamp}] ${agent.emoji} **${agent.name}** ${statusText}`);
  }

  /**
   * Register message handler
   */
  onMessage(handler: (message: Message) => void): void {
    this.bot.onMessage(handler);
  }

  /**
   * Create a new thread
   */
  async createThread(name: string): Promise<string> {
    return this.bot.createThread(name);
  }

  /**
   * Connect to Discord
   */
  async connect(): Promise<void> {
    await this.bot.connect();
  }

  /**
   * Disconnect from Discord
   */
  async disconnect(): Promise<void> {
    await this.bot.disconnect();
    this.webhookManager.destroy();
  }

  /**
   * Set webhook for an agent
   */
  setWebhook(agentId: string, webhookUrl: string): void {
    this.webhookManager.setWebhook(agentId, webhookUrl);
  }

  /**
   * Bulk set webhooks
   */
  setWebhooks(webhooks: Record<string, string>): void {
    this.webhookManager.setWebhooks(webhooks);
  }

  /**
   * Check if agent has a webhook
   */
  hasWebhook(agentId: string): boolean {
    return this.webhookManager.hasWebhook(agentId);
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.bot.isConnected;
  }

  /**
   * Detect guild ID from connected bot
   */
  async detectGuildId(): Promise<string | null> {
    return this.bot.detectGuildId();
  }

  /**
   * Get all connected guilds
   */
  getConnectedGuilds() {
    return this.bot.getConnectedGuilds();
  }

  /**
   * Check if bot has webhook permission in channel
   */
  async hasWebhookPermission(channelId: string): Promise<boolean> {
    return this.bot.hasWebhookPermission(channelId);
  }

  /**
   * Get existing webhooks in a channel
   */
  async getExistingWebhooks(channelId: string) {
    return this.bot.getExistingWebhooks(channelId);
  }

  /**
   * Auto-create webhooks for all agents
   * @param channelId - Channel to create webhooks in
   * @param onProgress - Progress callback
   * @returns Record of agentId -> webhook URL
   */
  async autoCreateWebhooks(
    channelId: string,
    onProgress?: (current: number, total: number, agentName: string) => void
  ): Promise<Record<string, string>> {
    return this.bot.autoCreateWebhooks(channelId, AGENT_DEFINITIONS, onProgress);
  }

  /**
   * Auto-create webhooks for specific agents
   */
  async autoCreateWebhooksForAgents(
    channelId: string,
    agents: AgentDefinition[],
    onProgress?: (current: number, total: number, agentName: string) => void
  ): Promise<Record<string, string>> {
    return this.bot.autoCreateWebhooks(channelId, agents, onProgress);
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookUrl: string): Promise<boolean> {
    return this.bot.deleteWebhook(webhookUrl);
  }
}
