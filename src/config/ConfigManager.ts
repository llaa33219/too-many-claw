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
 * OpenClaw configuration structure (comprehensive)
 */
export interface OpenClawDiscordConfig {
  /** Whether Discord integration is enabled */
  enabled?: boolean;
  /** Discord bot token */
  token?: string;
  /** Gateway intents */
  intents?: string[];
  /** Guild/Server ID (may be stored as guildId or serverId) */
  guildId?: string;
  serverId?: string;
  /** Allowlist configuration */
  allowlist?: {
    channels?: string[];
    users?: string[];
    guilds?: string[];
  };
  /** Direct message settings */
  dm?: {
    enabled?: boolean;
    allowFrom?: string[];
  };
  /** Channel configurations */
  channels?: {
    chat?: string;
    status?: string;
    default?: string;
  };
}

export interface OpenClawGatewayConfig {
  discord?: OpenClawDiscordConfig;
}

export interface OpenClawConfig {
  gateway?: OpenClawGatewayConfig;
  /** Some configs may store discord at root level */
  discord?: OpenClawDiscordConfig;
}

/**
 * Extracted Discord settings from OpenClaw (normalized)
 */
export interface ExtractedDiscordSettings {
  token?: string;
  guildId?: string;
  chatChannelId?: string;
  statusChannelId?: string;
  allowedChannels?: string[];
  allowedUsers?: string[];
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
   * Get raw Discord settings from OpenClaw config
   */
  getOpenClawDiscordConfig(): OpenClawDiscordConfig | null {
    const config = this.readOpenClawConfig();
    // Check both gateway.discord and root discord
    return config?.gateway?.discord ?? config?.discord ?? null;
  }

  /**
   * Extract and normalize Discord settings from OpenClaw config
   * Returns a clean, normalized structure regardless of how OpenClaw stores it
   */
  extractOpenClawDiscordSettings(): ExtractedDiscordSettings | null {
    const discord = this.getOpenClawDiscordConfig();
    if (!discord) return null;

    const settings: ExtractedDiscordSettings = {};

    // Extract token
    if (discord.token) {
      settings.token = discord.token;
    }

    // Extract guildId (may be stored as guildId, serverId, or in allowlist.guilds)
    if (discord.guildId) {
      settings.guildId = discord.guildId;
    } else if (discord.serverId) {
      settings.guildId = discord.serverId;
    } else if (discord.allowlist?.guilds && discord.allowlist.guilds.length > 0) {
      settings.guildId = discord.allowlist.guilds[0];
    }

    // Extract channels
    if (discord.channels?.chat) {
      settings.chatChannelId = discord.channels.chat;
    } else if (discord.channels?.default) {
      settings.chatChannelId = discord.channels.default;
    } else if (discord.allowlist?.channels && discord.allowlist.channels.length > 0) {
      settings.chatChannelId = discord.allowlist.channels[0];
    }

    if (discord.channels?.status) {
      settings.statusChannelId = discord.channels.status;
    } else if (discord.allowlist?.channels && discord.allowlist.channels.length > 1) {
      settings.statusChannelId = discord.allowlist.channels[1];
    }

    // Store all allowed channels for reference
    if (discord.allowlist?.channels) {
      settings.allowedChannels = [...discord.allowlist.channels];
    }

    // Store allowed users
    if (discord.allowlist?.users) {
      settings.allowedUsers = [...discord.allowlist.users];
    }

    return settings;
  }

  /**
   * Import Discord settings from OpenClaw configuration
   * Returns true if successful, false if no OpenClaw Discord config found
   */
  importFromOpenClaw(): { success: boolean; imported: Partial<DiscordConfig>; message: string } {
    const extracted = this.extractOpenClawDiscordSettings();

    if (!extracted) {
      return {
        success: false,
        imported: {},
        message: 'No OpenClaw Discord configuration found',
      };
    }

    const imported: Partial<DiscordConfig> = {};

    // Import token
    if (extracted.token) {
      imported.token = extracted.token;
    }

    // Import guildId
    if (extracted.guildId) {
      imported.guildId = extracted.guildId;
    }

    // Import chat channel
    if (extracted.chatChannelId) {
      imported.chatChannelId = extracted.chatChannelId;
    }

    // Import status channel
    if (extracted.statusChannelId) {
      imported.statusChannelId = extracted.statusChannelId;
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
   * Update guildId after bot connects and detects it
   * This is called when the bot auto-detects the guild from connection
   */
  updateGuildId(guildId: string): void {
    const currentDiscord = this.getDiscordConfig();
    if (!currentDiscord.guildId) {
      this.setDiscordConfig({
        ...currentDiscord,
        guildId,
      });
    }
  }

  /**
   * Get summary of what can be imported from OpenClaw
   * Useful for displaying to user before import
   */
  getOpenClawImportSummary(): {
    hasConfig: boolean;
    availableSettings: string[];
    extracted: ExtractedDiscordSettings | null;
  } {
    const extracted = this.extractOpenClawDiscordSettings();
    
    if (!extracted) {
      return {
        hasConfig: false,
        availableSettings: [],
        extracted: null,
      };
    }

    const availableSettings: string[] = [];
    if (extracted.token) availableSettings.push('Bot Token');
    if (extracted.guildId) availableSettings.push('Server (Guild) ID');
    if (extracted.chatChannelId) availableSettings.push('Chat Channel');
    if (extracted.statusChannelId) availableSettings.push('Status Channel');
    if (extracted.allowedChannels && extracted.allowedChannels.length > 0) {
      availableSettings.push(`${extracted.allowedChannels.length} Allowed Channel(s)`);
    }

    return {
      hasConfig: true,
      availableSettings,
      extracted,
    };
  }

  /**
   * Get OpenClaw config file path
   */
  getOpenClawConfigPath(): string {
    return this.openclawConfigPath;
  }
}
