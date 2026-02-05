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

/**
 * OpenClaw configuration structure (partial - only what we need)
 */
export interface OpenClawDiscordConfig {
  token?: string;
  intents?: string[];
  allowlist?: {
    channels?: string[];
    users?: string[];
  };
}

export interface OpenClawGatewayConfig {
  discord?: OpenClawDiscordConfig;
}

export interface OpenClawConfig {
  gateway?: OpenClawGatewayConfig;
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
  private openclawConfigPath: string;
  private config: TooManyClawConfig;

  constructor() {
    const openclawDir = path.join(os.homedir(), '.openclaw');
    this.configPath = path.join(openclawDir, 'too-many-claw.json');
    this.openclawConfigPath = path.join(openclawDir, 'openclaw.json');
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

  // ============================================
  // OpenClaw Integration
  // ============================================

  /**
   * Check if OpenClaw config file exists
   */
  hasOpenClawConfig(): boolean {
    return fs.existsSync(this.openclawConfigPath);
  }

  /**
   * Read OpenClaw configuration file
   */
  readOpenClawConfig(): OpenClawConfig | null {
    try {
      if (!this.hasOpenClawConfig()) {
        return null;
      }
      return fs.readJsonSync(this.openclawConfigPath) as OpenClawConfig;
    } catch {
      return null;
    }
  }

  /**
   * Check if OpenClaw has Discord configuration
   */
  hasOpenClawDiscordConfig(): boolean {
    const config = this.readOpenClawConfig();
    return !!(config?.gateway?.discord?.token);
  }

  /**
   * Get Discord settings from OpenClaw config
   */
  getOpenClawDiscordConfig(): OpenClawDiscordConfig | null {
    const config = this.readOpenClawConfig();
    return config?.gateway?.discord ?? null;
  }

  /**
   * Import Discord settings from OpenClaw configuration
   * Returns true if successful, false if no OpenClaw Discord config found
   */
  importFromOpenClaw(): { success: boolean; imported: Partial<DiscordConfig>; message: string } {
    const openclawDiscord = this.getOpenClawDiscordConfig();

    if (!openclawDiscord) {
      return {
        success: false,
        imported: {},
        message: 'No OpenClaw Discord configuration found',
      };
    }

    const imported: Partial<DiscordConfig> = {};

    // Import token
    if (openclawDiscord.token) {
      imported.token = openclawDiscord.token;
    }

    // Import allowed channels (first as chat, second as status if available)
    if (openclawDiscord.allowlist?.channels && openclawDiscord.allowlist.channels.length > 0) {
      imported.chatChannelId = openclawDiscord.allowlist.channels[0];
      if (openclawDiscord.allowlist.channels.length > 1) {
        imported.statusChannelId = openclawDiscord.allowlist.channels[1];
      }
    }

    if (Object.keys(imported).length === 0) {
      return {
        success: false,
        imported: {},
        message: 'OpenClaw Discord config exists but has no usable settings',
      };
    }

    // Merge: imported values take precedence over existing
    const currentDiscord = this.getDiscordConfig();
    this.setDiscordConfig({
      ...currentDiscord, // Base: existing settings
      ...imported,       // Override with imported values
    });

    return {
      success: true,
      imported,
      message: `Imported ${Object.keys(imported).length} setting(s) from OpenClaw`,
    };
  }

  /**
   * Get OpenClaw config file path
   */
  getOpenClawConfigPath(): string {
    return this.openclawConfigPath;
  }
}
