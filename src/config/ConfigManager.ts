/**
 * Too Many Claw - Configuration Manager
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export interface DiscordConfig {
  token?: string;
  guildId?: string;
  chatChannelId?: string;
  statusChannelId?: string;
}

export interface TooManyClawConfig {
  discord: DiscordConfig;
  webhooks: Record<string, string>;
  simulation: {
    enabled: boolean;
  };
}

const DEFAULT_CONFIG: TooManyClawConfig = {
  discord: {},
  webhooks: {},
  simulation: {
    enabled: false,
  },
};

export class ConfigManager {
  private configPath: string;
  private config: TooManyClawConfig;

  constructor() {
    const openclawDir = path.join(os.homedir(), '.openclaw');
    this.configPath = path.join(openclawDir, 'too-many-claw.json');
    this.config = this.load();
  }

  /**
   * Load configuration from disk
   */
  private load(): TooManyClawConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readJsonSync(this.configPath);
        return { ...DEFAULT_CONFIG, ...data };
      }
    } catch {
      // Ignore errors, use default
    }
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Save configuration to disk
   */
  private save(): void {
    try {
      fs.ensureDirSync(path.dirname(this.configPath));
      fs.writeJsonSync(this.configPath, this.config, { spaces: 2 });
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  /**
   * Get Discord configuration
   */
  getDiscordConfig(): DiscordConfig {
    return this.config.discord;
  }

  /**
   * Set Discord configuration
   */
  setDiscordConfig(discord: DiscordConfig): void {
    this.config.discord = { ...this.config.discord, ...discord };
    this.save();
  }

  /**
   * Check if Discord is configured
   */
  isDiscordConfigured(): boolean {
    const { token, guildId, chatChannelId } = this.config.discord;
    return !!(token && guildId && chatChannelId);
  }

  /**
   * Get webhook URL for an agent
   */
  getWebhook(agentId: string): string | undefined {
    return this.config.webhooks[agentId];
  }

  /**
   * Set webhook URL for an agent
   */
  setWebhook(agentId: string, webhookUrl: string): void {
    this.config.webhooks[agentId] = webhookUrl;
    this.save();
  }

  /**
   * Check if agent has a webhook
   */
  hasWebhook(agentId: string): boolean {
    return !!this.config.webhooks[agentId];
  }

  /**
   * Remove webhook for an agent
   */
  removeWebhook(agentId: string): void {
    delete this.config.webhooks[agentId];
    this.save();
  }

  /**
   * Get all webhooks
   */
  getAllWebhooks(): Record<string, string> {
    return { ...this.config.webhooks };
  }

  /**
   * Set all webhooks
   */
  setAllWebhooks(webhooks: Record<string, string>): void {
    this.config.webhooks = { ...webhooks };
    this.save();
  }

  /**
   * Get config file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Reset configuration
   */
  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
    try {
      if (fs.existsSync(this.configPath)) {
        fs.removeSync(this.configPath);
      }
    } catch {
      // Ignore errors
    }
  }
}
