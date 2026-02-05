/**
 * Too Many Claw - Discord Webhook Manager
 * Manages webhooks for 35 agent personas
 * Supports single shared webhook with dynamic username/avatar per agent
 */

import { WebhookClient } from 'discord.js';
import { getAgentById } from '../agents/definitions.js';
import { AgentDefinition } from '../types/index.js';

/**
 * Convert emoji to a Twemoji CDN URL for avatar
 * Falls back to a placeholder if conversion fails
 */
function getEmojiAvatarUrl(emoji: string): string {
  try {
    // Get the unicode code point(s) for the emoji
    const codePoints = [...emoji]
      .map(char => char.codePointAt(0)?.toString(16).toLowerCase())
      .filter(Boolean)
      .join('-');
    
    if (codePoints) {
      // Use Twemoji CDN for high-quality emoji images
      return `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/${codePoints}.png`;
    }
  } catch {
    // Fall through to placeholder
  }
  
  // Fallback to a generic avatar
  return 'https://cdn.discordapp.com/embed/avatars/0.png';
}

export class WebhookManager {
  private webhooks: Map<string, string> = new Map();
  private clients: Map<string, WebhookClient> = new Map();
  
  // Shared base webhook for all agents (single webhook approach)
  private baseWebhookUrl: string | null = null;
  private baseWebhookClient: WebhookClient | null = null;

  /**
   * Register a webhook URL for an agent
   */
  setWebhook(agentId: string, webhookUrl: string): void {
    this.webhooks.set(agentId, webhookUrl);
    
    // Create or update client
    const existingClient = this.clients.get(agentId);
    if (existingClient) {
      existingClient.destroy();
    }
    this.clients.set(agentId, new WebhookClient({ url: webhookUrl }));
  }

  /**
   * Bulk register webhooks from config
   */
  setWebhooks(webhooks: Record<string, string>): void {
    for (const [agentId, url] of Object.entries(webhooks)) {
      this.setWebhook(agentId, url);
    }
  }

  /**
   * Set a shared base webhook URL that will be used for all agents
   * This is the recommended approach to avoid Discord's 15 webhook per channel limit
   * Each agent will use a different username and avatar when sending through this webhook
   */
  setBaseWebhook(webhookUrl: string): void {
    this.baseWebhookUrl = webhookUrl;
    
    // Destroy existing base client if any
    if (this.baseWebhookClient) {
      this.baseWebhookClient.destroy();
    }
    
    this.baseWebhookClient = new WebhookClient({ url: webhookUrl });
  }

  /**
   * Check if base webhook is configured
   */
  hasBaseWebhook(): boolean {
    return this.baseWebhookUrl !== null && this.baseWebhookClient !== null;
  }

  /**
   * Get the base webhook URL
   */
  getBaseWebhookUrl(): string | null {
    return this.baseWebhookUrl;
  }

  /**
   * Check if webhook exists for an agent
   */
  hasWebhook(agentId: string): boolean {
    return this.webhooks.has(agentId);
  }

  /**
   * Send message as an agent via webhook
   * Priority: 1) Agent-specific webhook, 2) Base webhook with dynamic username/avatar
   */
  async sendAsAgent(agentId: string, content: string): Promise<void> {
    const agent = getAgentById(agentId);
    if (!agent) {
      throw new Error(`Unknown agent: ${agentId}`);
    }
    await this.sendAsAgentDirect(agent, content);
  }

  /**
   * Send message as an agent using explicit agent definition
   * Useful when the agent might not be in AGENT_DEFINITIONS (dynamic agents)
   */
  async sendAsAgentDirect(agent: AgentDefinition, content: string): Promise<void> {
    // Try agent-specific webhook first
    const agentClient = this.clients.get(agent.id);
    if (agentClient) {
      await agentClient.send({
        content,
        username: `${agent.emoji} ${agent.name}`,
        avatarURL: getEmojiAvatarUrl(agent.emoji),
      });
      return;
    }

    // Fall back to base webhook with dynamic username and avatar
    if (this.baseWebhookClient) {
      await this.baseWebhookClient.send({
        content,
        username: `${agent.emoji} ${agent.name}`,
        avatarURL: getEmojiAvatarUrl(agent.emoji),
      });
      return;
    }

    throw new Error(`No webhook available for agent: ${agent.id}. Configure a base webhook or agent-specific webhook.`);
  }

  /**
   * Check if any webhook is available for sending (either agent-specific or base)
   */
  canSend(agentId: string): boolean {
    return this.hasWebhook(agentId) || this.hasBaseWebhook();
  }

  /**
   * Get all registered agent IDs
   */
  getRegisteredAgents(): string[] {
    return Array.from(this.webhooks.keys());
  }

  /**
   * Remove a webhook
   */
  removeWebhook(agentId: string): void {
    const client = this.clients.get(agentId);
    if (client) {
      client.destroy();
      this.clients.delete(agentId);
    }
    this.webhooks.delete(agentId);
  }

  /**
   * Destroy all webhook clients
   */
  destroy(): void {
    for (const client of this.clients.values()) {
      client.destroy();
    }
    this.clients.clear();
    this.webhooks.clear();
    
    // Also destroy base webhook client
    if (this.baseWebhookClient) {
      this.baseWebhookClient.destroy();
      this.baseWebhookClient = null;
      this.baseWebhookUrl = null;
    }
  }
}
