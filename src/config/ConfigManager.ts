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
  /** Gateway authentication token */
  token?: string;
  /** Gateway password (alternative to token) */
  password?: string;
}

/**
 * OpenClaw guild configuration within channels.discord.guilds
 */
export interface OpenClawGuildConfig {
  channels?: Record<string, {
    requireMention?: boolean;
    activation?: string;
  } | boolean>;
  requireMention?: boolean;
  users?: string[];
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
    /** Guilds configuration - keys are guild IDs */
    guilds?: Record<string, OpenClawGuildConfig>;
    /** Group policy (allowlist, open, etc.) */
    groupPolicy?: string;
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

/** Discord webhook URL pattern */
const WEBHOOK_URL_PATTERN = /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/;

/**
 * Configuration validation error
 */
export interface ConfigValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Repair report showing what would be fixed
 */
export interface RepairReport {
  configFileExists: boolean;
  configFileValid: boolean;
  configFileCorrupted: boolean;
  invalidWebhooks: string[];
  missingFields: string[];
  canImportFromOpenClaw: boolean;
  openClawSettings: string[];
  totalIssues: number;
}

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
   * Set the base webhook URL (used for all agents with dynamic username/avatar)
   * This is the recommended approach to avoid Discord's 15 webhook per channel limit
   */
  setBaseWebhook(webhookUrl: string): void {
    this.config.webhooks['base'] = webhookUrl;
    this.save();
  }

  /**
   * Get the base webhook URL
   */
  getBaseWebhook(): string | undefined {
    return this.config.webhooks['base'];
  }

  /**
   * Check if base webhook is configured
   */
  hasBaseWebhook(): boolean {
    return !!this.config.webhooks['base'];
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
    const channelsDiscord = config?.channels?.discord as (OpenClawDiscordConfig & { 
      channel?: string; 
      channels?: string[]; 
      guilds?: Record<string, OpenClawGuildConfig>;
    }) | undefined;
    
    if (!discord && !channelsDiscord) return null;

    const settings: ExtractedDiscordSettings = {};

    // Extract token
    if (discord?.token) {
      settings.token = discord.token;
    }

    // Extract from channels.discord.guilds structure (OpenClaw's primary format)
    // Structure: { guilds: { "GUILD_ID": { channels: { "CHANNEL_ID": { ... } } } } }
    if (channelsDiscord?.guilds) {
      const guildIds = Object.keys(channelsDiscord.guilds);
      if (guildIds.length > 0) {
        // First guild ID becomes our guildId
        const firstGuildId = guildIds[0];
        if (!settings.guildId && /^\d{17,19}$/.test(firstGuildId)) {
          settings.guildId = firstGuildId;
        }
        
        // Get channels from the first guild
        const guildConfig = channelsDiscord.guilds[firstGuildId];
        if (guildConfig?.channels) {
          const channelKeys = Object.keys(guildConfig.channels);
          const channelIds: string[] = [];
          
          for (const channelKey of channelKeys) {
            // Channel key could be a numeric ID or a slug name
            // Only use numeric IDs (17-19 digits) as channel IDs
            if (/^\d{17,19}$/.test(channelKey)) {
              channelIds.push(channelKey);
            }
          }
          
          // First channel becomes chat channel
          if (channelIds.length > 0 && !settings.chatChannelId) {
            settings.chatChannelId = channelIds[0];
          }
          
          // Second channel becomes status channel if available
          if (channelIds.length > 1 && !settings.statusChannelId) {
            settings.statusChannelId = channelIds[1];
          }
          
          // Store all channel IDs
          if (channelIds.length > 0) {
            settings.allowedChannels = channelIds;
          }
        }
      }
    }

    // Extract guildId (may be stored as guildId, serverId, or in allowlist.guilds)
    if (!settings.guildId && discord?.guildId) {
      settings.guildId = discord.guildId;
    } else if (!settings.guildId && discord?.serverId) {
      settings.guildId = discord.serverId;
    } else if (!settings.guildId && discord?.allowlist?.guilds && discord.allowlist.guilds.length > 0) {
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

  /**
   * Get the OpenClaw Gateway authentication token
   * First checks environment variable OPENCLAW_GATEWAY_TOKEN,
   * then falls back to openclaw.json gateway.token or gateway.password
   */
  getGatewayToken(): string | undefined {
    // First check environment variable
    const envToken = process.env.OPENCLAW_GATEWAY_TOKEN;
    if (envToken) {
      return envToken;
    }

    // Fall back to openclaw.json
    const config = this.readOpenClawConfig();
    if (config?.gateway?.token) {
      return config.gateway.token;
    }
    if (config?.gateway?.password) {
      return config.gateway.password;
    }

    return undefined;
  }

  // ============================================
  // Validation & Repair
  // ============================================

  /**
   * Validate a Discord webhook URL
   * @param url The webhook URL to validate
   * @returns true if valid, false otherwise
   */
  validateWebhook(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }
    return WEBHOOK_URL_PATTERN.test(url);
  }

  /**
   * Validate the current configuration and return any errors/warnings
   * @returns Array of validation errors
   */
  validateConfig(): ConfigValidationError[] {
    const errors: ConfigValidationError[] = [];

    // Check if config file exists and is valid JSON
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        try {
          JSON.parse(raw);
        } catch {
          errors.push({
            field: 'configFile',
            message: 'Configuration file contains invalid JSON',
            severity: 'error',
          });
        }
      }
    } catch {
      errors.push({
        field: 'configFile',
        message: 'Cannot read configuration file',
        severity: 'error',
      });
    }

    // Validate Discord config structure
    if (this.config.discord) {
      const { token, guildId, chatChannelId, statusChannelId } = this.config.discord;

      // Token validation
      if (token && (typeof token !== 'string' || token.length < 50)) {
        errors.push({
          field: 'discord.token',
          message: 'Discord token appears to be invalid (too short)',
          severity: 'warning',
        });
      }

      // Guild ID validation (17-19 digit snowflake)
      if (guildId && !/^\d{17,19}$/.test(guildId)) {
        errors.push({
          field: 'discord.guildId',
          message: 'Guild ID is not a valid Discord snowflake (should be 17-19 digits)',
          severity: 'error',
        });
      }

      // Channel ID validation
      if (chatChannelId && !/^\d{17,19}$/.test(chatChannelId)) {
        errors.push({
          field: 'discord.chatChannelId',
          message: 'Chat channel ID is not a valid Discord snowflake (should be 17-19 digits)',
          severity: 'error',
        });
      }

      if (statusChannelId && !/^\d{17,19}$/.test(statusChannelId)) {
        errors.push({
          field: 'discord.statusChannelId',
          message: 'Status channel ID is not a valid Discord snowflake (should be 17-19 digits)',
          severity: 'error',
        });
      }
    }

    // Validate webhooks
    if (this.config.webhooks) {
      for (const [agentId, webhookUrl] of Object.entries(this.config.webhooks)) {
        if (!this.validateWebhook(webhookUrl)) {
          errors.push({
            field: `webhooks.${agentId}`,
            message: `Invalid webhook URL for agent "${agentId}"`,
            severity: 'error',
          });
        }
      }
    }

    return errors;
  }

  /**
   * Get a list of invalid webhook agent IDs
   */
  getInvalidWebhooks(): string[] {
    const invalid: string[] = [];
    for (const [agentId, webhookUrl] of Object.entries(this.config.webhooks)) {
      if (!this.validateWebhook(webhookUrl)) {
        invalid.push(agentId);
      }
    }
    return invalid;
  }

  /**
   * Remove all webhooks with invalid URLs
   * @returns Number of webhooks removed
   */
  cleanInvalidWebhooks(): number {
    const invalidAgents = this.getInvalidWebhooks();
    
    for (const agentId of invalidAgents) {
      delete this.config.webhooks[agentId];
    }

    if (invalidAgents.length > 0) {
      this.save();
    }

    return invalidAgents.length;
  }

  /**
   * Generate a repair report showing what would be fixed
   * This does NOT make any changes
   */
  getRepairReport(): RepairReport {
    const report: RepairReport = {
      configFileExists: false,
      configFileValid: true,
      configFileCorrupted: false,
      invalidWebhooks: [],
      missingFields: [],
      canImportFromOpenClaw: false,
      openClawSettings: [],
      totalIssues: 0,
    };

    // Check config file status
    report.configFileExists = fs.existsSync(this.configPath);

    if (report.configFileExists) {
      try {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        JSON.parse(raw);
        report.configFileValid = true;
      } catch {
        report.configFileValid = false;
        report.configFileCorrupted = true;
        report.totalIssues++;
      }
    }

    // Check for invalid webhooks
    report.invalidWebhooks = this.getInvalidWebhooks();
    report.totalIssues += report.invalidWebhooks.length;

    // Check for missing required fields
    const discord = this.config.discord;
    if (!discord.token) {
      report.missingFields.push('discord.token');
    }
    if (!discord.guildId) {
      report.missingFields.push('discord.guildId');
    }
    if (!discord.chatChannelId) {
      report.missingFields.push('discord.chatChannelId');
    }

    // Check if OpenClaw can help
    if (this.hasOpenClawDiscordConfig()) {
      const openClawSummary = this.getOpenClawImportSummary();
      if (openClawSummary.hasConfig && openClawSummary.availableSettings.length > 0) {
        report.canImportFromOpenClaw = true;
        report.openClawSettings = openClawSummary.availableSettings;
      }
    }

    // Count missing fields as issues (only if OpenClaw can't help fill them)
    if (report.missingFields.length > 0 && !report.canImportFromOpenClaw) {
      report.totalIssues += report.missingFields.length;
    }

    return report;
  }

  /**
   * Attempt to repair the configuration
   * - Rebuilds from defaults if corrupted
   * - Removes invalid webhooks
   * - Imports missing settings from OpenClaw if available
   * @returns Object describing what was repaired
   */
  repairConfig(): {
    configRebuilt: boolean;
    webhooksRemoved: number;
    openClawImported: boolean;
    importedFields: string[];
  } {
    const result = {
      configRebuilt: false,
      webhooksRemoved: 0,
      openClawImported: false,
      importedFields: [] as string[],
    };

    // Step 1: Check if config file is corrupted and needs rebuilding
    let needsRebuild = false;
    let existingValidData: Partial<TooManyClawConfig> = {};

    if (fs.existsSync(this.configPath)) {
      try {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        existingValidData = parsed;
      } catch {
        // Config is corrupted, need to rebuild
        needsRebuild = true;
      }
    }

    if (needsRebuild) {
      // Start fresh with defaults
      this.config = { ...DEFAULT_CONFIG };
      
      // Try to salvage any valid data from the corrupted config
      // (this is best-effort, the file was corrupted so we might not have anything)
      if (existingValidData.discord && typeof existingValidData.discord === 'object') {
        this.config.discord = { ...existingValidData.discord };
      }
      if (existingValidData.webhooks && typeof existingValidData.webhooks === 'object') {
        this.config.webhooks = { ...existingValidData.webhooks };
      }
      if (existingValidData.simulation && typeof existingValidData.simulation === 'object') {
        this.config.simulation = { ...DEFAULT_CONFIG.simulation, ...existingValidData.simulation };
      }
      
      result.configRebuilt = true;
    }

    // Step 2: Clean invalid webhooks
    const invalidCount = this.cleanInvalidWebhooks();
    result.webhooksRemoved = invalidCount;

    // Step 3: Import from OpenClaw if we're missing critical fields
    const discord = this.config.discord;
    const hasMissingFields = !discord.token || !discord.guildId || !discord.chatChannelId;

    if (hasMissingFields && this.hasOpenClawDiscordConfig()) {
      const extracted = this.extractOpenClawDiscordSettings();
      
      if (extracted) {
        if (!discord.token && extracted.token) {
          discord.token = extracted.token;
          result.importedFields.push('token');
        }
        if (!discord.guildId && extracted.guildId) {
          discord.guildId = extracted.guildId;
          result.importedFields.push('guildId');
        }
        if (!discord.chatChannelId && extracted.chatChannelId) {
          discord.chatChannelId = extracted.chatChannelId;
          result.importedFields.push('chatChannelId');
        }
        if (!discord.statusChannelId && extracted.statusChannelId) {
          discord.statusChannelId = extracted.statusChannelId;
          result.importedFields.push('statusChannelId');
        }

        if (result.importedFields.length > 0) {
          this.config.discord = discord;
          result.openClawImported = true;
        }
      }
    }

    // Save the repaired config
    this.save();

    return result;
  }

  /**
   * Check if the config file is corrupted (invalid JSON)
   */
  isConfigCorrupted(): boolean {
    if (!fs.existsSync(this.configPath)) {
      return false; // No file is not corrupted, just missing
    }

    try {
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      JSON.parse(raw);
      return false;
    } catch {
      return true;
    }
  }

  /**
   * Create a backup of the current config file
   * @returns The backup file path, or null if no config exists
   */
  backupConfig(): string | null {
    if (!fs.existsSync(this.configPath)) {
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = this.configPath.replace('.json', `.backup-${timestamp}.json`);
    
    try {
      fs.copyFileSync(this.configPath, backupPath);
      return backupPath;
    } catch {
      return null;
    }
  }

  /**
   * Restore config from a backup file
   * @param backupPath Path to the backup file
   * @returns true if successful
   */
  restoreFromBackup(backupPath: string): boolean {
    try {
      // Security: ensure path is within config directory to prevent path traversal
      const configDir = path.dirname(this.configPath);
      const resolvedPath = path.resolve(backupPath);
      if (!resolvedPath.startsWith(configDir + path.sep) && resolvedPath !== configDir) {
        return false;
      }

      if (!fs.existsSync(backupPath)) {
        return false;
      }

      // Validate the backup is valid JSON
      const raw = fs.readFileSync(backupPath, 'utf-8');
      const parsed = JSON.parse(raw);

      // Copy backup to config path
      fs.copyFileSync(backupPath, this.configPath);
      
      // Reload the config
      this.config = { ...DEFAULT_CONFIG, ...parsed };
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List available backup files
   * @returns Array of backup file paths sorted by date (newest first)
   */
  listBackups(): string[] {
    const configDir = path.dirname(this.configPath);
    const backupPattern = /too-many-claw\.backup-.*\.json$/;
    
    try {
      const files = fs.readdirSync(configDir);
      const backups = files
        .filter(f => backupPattern.test(f))
        .map(f => path.join(configDir, f))
        .sort((a, b) => {
          // Sort by modification time, newest first
          const statA = fs.statSync(a);
          const statB = fs.statSync(b);
          return statB.mtime.getTime() - statA.mtime.getTime();
        });
      
      return backups;
    } catch {
      return [];
    }
  }
}
