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

/**
 * OpenClaw channels configuration
 * Discord settings may be stored under channels.discord
 */
export interface OpenClawChannelsConfig {
  discord?: OpenClawDiscordConfig & {
    /** Channel in format "guildId/channelId" or just channelId */
    channel?: string;
    /** Array of channels in format "guildId/channelId" */
    channels?: string[];
  };
}

export interface OpenClawConfig {
  gateway?: OpenClawGatewayConfig;
  /** Some configs may store discord at root level */
  discord?: OpenClawDiscordConfig;
  /** OpenClaw often stores Discord config under channels.discord */
  channels?: OpenClawChannelsConfig;
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
    // Check all possible locations for Discord config
    return !!(
      config?.gateway?.discord?.token ||
      config?.discord?.token ||
      config?.channels?.discord?.token
    );
  }

  /**
   * Get raw Discord settings from OpenClaw config
   */
  getOpenClawDiscordConfig(): OpenClawDiscordConfig | null {
    const config = this.readOpenClawConfig();
    // Check all possible locations: gateway.discord, channels.discord, root discord
    return config?.gateway?.discord ?? config?.channels?.discord ?? config?.discord ?? null;
  }

  /**
   * Parse a channel string that may be in "guildId/channelId" format
   * Returns { guildId, channelId } or just { channelId } if no slash
   */
  private parseChannelString(channelStr: string): { guildId?: string; channelId: string } {
    if (channelStr.includes('/')) {
      const [guildId, channelId] = channelStr.split('/');
      return { guildId, channelId };
    }
    return { channelId: channelStr };
  }

  /**
   * Get the full OpenClaw config for debugging
   */
  getOpenClawRawConfig(): Record<string, unknown> | null {
    return this.readOpenClawConfig() as Record<string, unknown> | null;
  }

  /**
   * Extract and normalize Discord settings from OpenClaw config
   * Returns a clean, normalized structure regardless of how OpenClaw stores it
   */
  extractOpenClawDiscordSettings(): ExtractedDiscordSettings | null {
    const config = this.readOpenClawConfig();
    if (!config) return null;

    // Get Discord config from all possible locations
    const discord = this.getOpenClawDiscordConfig();
    const channelsDiscord = config?.channels?.discord as (OpenClawDiscordConfig & { channel?: string; channels?: string[] }) | undefined;
    
    if (!discord && !channelsDiscord) return null;

    const settings: ExtractedDiscordSettings = {};

    // Extract token
    if (discord?.token) {
      settings.token = discord.token;
    }

    // Extract guildId (may be stored as guildId, serverId, or in allowlist.guilds)
    if (discord?.guildId) {
      settings.guildId = discord.guildId;
    } else if (discord?.serverId) {
      settings.guildId = discord.serverId;
    } else if (discord?.allowlist?.guilds && discord.allowlist.guilds.length > 0) {
      settings.guildId = discord.allowlist.guilds[0];
    }

    // Check for channel in "guildId/channelId" format from channels.discord
    if (channelsDiscord?.channel) {
      const parsed = this.parseChannelString(channelsDiscord.channel);
      if (parsed.guildId && !settings.guildId) {
        settings.guildId = parsed.guildId;
      }
      if (!settings.chatChannelId) {
        settings.chatChannelId = parsed.channelId;
      }
    }

    // Check for channels array in "guildId/channelId" format
    if (channelsDiscord?.channels && channelsDiscord.channels.length > 0) {
      const parsedChannels: Array<{ guildId?: string; channelId: string }> = [];
      for (const ch of channelsDiscord.channels) {
        parsedChannels.push(this.parseChannelString(ch));
      }
      
      // Extract guildId from first channel if not already set
      if (!settings.guildId && parsedChannels[0]?.guildId) {
        settings.guildId = parsedChannels[0].guildId;
      }
      
      // Use first channel as chat channel
      if (!settings.chatChannelId && parsedChannels[0]) {
        settings.chatChannelId = parsedChannels[0].channelId;
      }
      
      // Use second channel as status channel if available
      if (!settings.statusChannelId && parsedChannels[1]) {
        settings.statusChannelId = parsedChannels[1].channelId;
      }
      
      // Store all channel IDs
      settings.allowedChannels = parsedChannels.map(p => p.channelId);
    }

    // Extract channels from nested channels object
    if (discord?.channels?.chat) {
      const parsed = this.parseChannelString(discord.channels.chat);
      if (parsed.guildId && !settings.guildId) {
        settings.guildId = parsed.guildId;
      }
      if (!settings.chatChannelId) {
        settings.chatChannelId = parsed.channelId;
      }
    } else if (discord?.channels?.default) {
      const parsed = this.parseChannelString(discord.channels.default);
      if (parsed.guildId && !settings.guildId) {
        settings.guildId = parsed.guildId;
      }
      if (!settings.chatChannelId) {
        settings.chatChannelId = parsed.channelId;
      }
    }

    // Extract from allowlist.channels
    if (discord?.allowlist?.channels && discord.allowlist.channels.length > 0) {
      const parsedChannels: Array<{ guildId?: string; channelId: string }> = [];
      for (const ch of discord.allowlist.channels) {
        parsedChannels.push(this.parseChannelString(ch));
      }
      
      if (!settings.guildId && parsedChannels[0]?.guildId) {
        settings.guildId = parsedChannels[0].guildId;
      }
      
      if (!settings.chatChannelId && parsedChannels[0]) {
        settings.chatChannelId = parsedChannels[0].channelId;
      }
      
      if (!settings.statusChannelId && parsedChannels[1]) {
        settings.statusChannelId = parsedChannels[1].channelId;
      }
      
      if (!settings.allowedChannels) {
        settings.allowedChannels = parsedChannels.map(p => p.channelId);
      }
    }

    if (discord?.channels?.status) {
      const parsed = this.parseChannelString(discord.channels.status);
      if (!settings.statusChannelId) {
        settings.statusChannelId = parsed.channelId;
      }
    }

    // Store allowed users
    if (discord?.allowlist?.users) {
      settings.allowedUsers = [...discord.allowlist.users];
    }

    // Return null if nothing useful was extracted
    if (Object.keys(settings).length === 0) {
      return null;
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
