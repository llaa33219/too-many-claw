/**
 * Too Many Claw - Discord Webhook Manager
 * Manages webhooks for 35 agent personas
 */

import { WebhookClient } from 'discord.js';
import { getAgentById } from '../agents/definitions.js';

export class WebhookManager {
  private webhooks: Map<string, string> = new Map();
  private clients: Map<string, WebhookClient> = new Map();

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
   * Check if webhook exists for an agent
   */
  hasWebhook(agentId: string): boolean {
    return this.webhooks.has(agentId);
  }

  /**
   * Send message as an agent via webhook
   */
  async sendAsAgent(agentId: string, content: string): Promise<void> {
    const client = this.clients.get(agentId);
    if (!client) {
      throw new Error(`No webhook registered for agent: ${agentId}`);
    }

    const agent = getAgentById(agentId);
    if (!agent) {
      throw new Error(`Unknown agent: ${agentId}`);
    }

    await client.send({
      content,
      username: `${agent.emoji} ${agent.name}`,
      // Avatar URL could be set here if we have agent avatar images
    });
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
  }
}
