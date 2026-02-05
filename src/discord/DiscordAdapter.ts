/**
 * Too Many Claw - Discord Platform Adapter
 * Implements PlatformAdapter interface for Discord
 */

import { Message, PlatformAdapter } from '../types/index.js';
import { getAgentById } from '../agents/definitions.js';
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
}
