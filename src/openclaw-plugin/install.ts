/**
 * TMC OpenClaw Plugin Installer
 * Copies the plugin to ~/.openclaw/extensions/tmc-webhook
 * 
 * Note: This file generates JavaScript at install time rather than
 * relying on TypeScript compilation, ensuring the plugin works
 * regardless of the host project's build setup.
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const OPENCLAW_DIR = path.join(os.homedir(), '.openclaw');
const EXTENSIONS_DIR = path.join(OPENCLAW_DIR, 'extensions');
const PLUGIN_DIR = path.join(EXTENSIONS_DIR, 'tmc-webhook');

/**
 * Install the TMC webhook plugin to OpenClaw extensions directory
 */
export async function installPlugin(): Promise<{ success: boolean; path: string; message: string }> {
  try {
    // Ensure extensions directory exists
    await fs.ensureDir(EXTENSIONS_DIR);
    
    // Remove existing plugin if present
    if (await fs.pathExists(PLUGIN_DIR)) {
      await fs.remove(PLUGIN_DIR);
    }
    
    // Create plugin directory
    await fs.ensureDir(PLUGIN_DIR);
    
    // Write package.json
    const packageJson = {
      name: '@too-many-claw/openclaw-plugin',
      version: '1.0.0',
      description: 'OpenClaw channel plugin for Too Many Claw webhook delivery',
      type: 'module',
      main: 'index.js',
      openclaw: {
        extensions: ['./index.js'],
      },
    };
    await fs.writeJson(path.join(PLUGIN_DIR, 'package.json'), packageJson, { spaces: 2 });
    
    // Write the plugin JavaScript files
    // agents.js
    const agentsJs = `
/**
 * TMC Agent definitions for webhook delivery
 */

export const AGENTS = [
  { id: 'base', name: 'Base', emoji: '🏠' },
  { id: 'searcher', name: 'Search Specialist', emoji: '🔍' },
  { id: 'tech-researcher', name: 'Technology Research Specialist', emoji: '🔬' },
  { id: 'trend-analyst', name: 'Trend Analysis Specialist', emoji: '📈' },
  { id: 'data-provider', name: 'Data Preparation Specialist', emoji: '📊' },
  { id: 'counselor', name: 'Psychological Counselor', emoji: '💚' },
  { id: 'user-psychologist', name: 'User Psychology Analyst', emoji: '🧠' },
  { id: 'questioner', name: 'Questioning Specialist', emoji: '❓' },
  { id: 'persuader', name: 'Rational Persuasion Specialist', emoji: '🎯' },
  { id: 'educator', name: 'Education Specialist', emoji: '📚' },
  { id: 'planner', name: 'Professional Planning Specialist', emoji: '📋' },
  { id: 'team-composer', name: 'Agent Team Composition Specialist', emoji: '👥' },
  { id: 'promoter', name: 'Promotion Specialist', emoji: '📢' },
  { id: 'uploader', name: 'Uploader', emoji: '⬆️' },
  { id: 'backend-dev', name: 'Backend Developer', emoji: '⚙️' },
  { id: 'frontend-dev', name: 'Frontend Developer', emoji: '🎨' },
  { id: 'designer', name: 'Professional Designer', emoji: '🖌️' },
  { id: 'code-reviewer', name: 'Code Reviewer', emoji: '👀' },
  { id: 'doc-writer', name: 'Documentation Specialist', emoji: '📝' },
  { id: 'automator', name: 'Automation Specialist', emoji: '🤖' },
  { id: 'prompt-engineer', name: 'Prompt Engineer', emoji: '💬' },
  { id: 'ai-illustrator', name: 'AI Illustration Generation Specialist', emoji: '🎭' },
  { id: 'program-tester', name: 'Program Testing Specialist', emoji: '🧪' },
  { id: 'user-tester', name: 'General User Testing Specialist', emoji: '👤' },
  { id: 'security-checker', name: 'Security Check Specialist', emoji: '🛡️' },
  { id: 'vuln-finder', name: 'Vulnerability Discovery Specialist', emoji: '🔓' },
  { id: 'pentester', name: 'Penetration Testing Specialist', emoji: '💀' },
  { id: 'fact-bomber', name: 'Fact Check Specialist', emoji: '💣' },
  { id: 'roaster', name: 'Blunt Critic', emoji: '🔥' },
  { id: 'critic', name: 'Critic', emoji: '🧐' },
  { id: 'negativist', name: 'Negative Agent', emoji: '👎' },
  { id: 'praiser', name: 'Praise Specialist', emoji: '👏' },
  { id: 'loophole-finder', name: 'Loophole Discovery Specialist', emoji: '🕳️' },
  { id: 'threatener', name: 'Pressure Specialist', emoji: '⚡' },
  { id: 'dirty-worker', name: 'Dirty Worker', emoji: '🪠' },
];

export const DEFAULT_AGENT = { id: 'base', name: 'Base', emoji: '🏠' };

export function getAgentById(id) {
  return AGENTS.find(a => a.id === id);
}

export function getAgentByEmoji(emoji) {
  return AGENTS.find(a => a.emoji === emoji);
}

export function extractAgentFromText(text) {
  const match = text.match(/^([\\p{Emoji}])\\s+([^:]+):/u);
  if (match) {
    const emoji = match[1];
    const agent = getAgentByEmoji(emoji);
    if (agent) return agent;
  }
  
  const emojiMatch = text.match(/^([\\p{Emoji}])/u);
  if (emojiMatch) {
    const agent = getAgentByEmoji(emojiMatch[1]);
    if (agent) return agent;
  }
  
  return undefined;
}

export function getEmojiAvatarUrl(emoji) {
  try {
    const codePoints = [...emoji]
      .map(char => char.codePointAt(0)?.toString(16).toLowerCase())
      .filter(Boolean)
      .join('-');
    
    if (codePoints) {
      return \`https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/\${codePoints}.png\`;
    }
  } catch {}
  
  return 'https://cdn.discordapp.com/embed/avatars/0.png';
}
`.trim();
    await fs.writeFile(path.join(PLUGIN_DIR, 'agents.js'), agentsJs, 'utf-8');
    
    // channel.js
    const channelJs = `
import { DEFAULT_AGENT, extractAgentFromText, getAgentById, getEmojiAvatarUrl } from './agents.js';

const DEFAULT_ACCOUNT_ID = 'default';

const meta = {
  id: 'tmc-webhook',
  label: 'TMC Webhook',
  selectionLabel: 'TMC Webhook (Too Many Claw)',
  detailLabel: 'Discord Webhook Delivery',
  docsPath: '/channels/tmc-webhook',
  docsLabel: 'tmc-webhook',
  blurb: 'Delivers messages via Discord webhook with agent-specific avatars',
  systemImage: 'paperplane.fill',
  order: 100,
  quickstartAllowFrom: false,
};

async function sendToWebhook(webhookUrl, content, agent) {
  const username = \`\${agent.emoji} \${agent.name}\`;
  const avatarUrl = getEmojiAvatarUrl(agent.emoji);
  
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      username,
      avatar_url: avatarUrl,
    }),
  });
  
  if (!response.ok) {
    throw new Error(\`Webhook request failed: \${response.status} \${response.statusText}\`);
  }
  
  let messageId;
  if (response.status !== 204) {
    const data = await response.json();
    messageId = data.id;
  }
  
  return { messageId, success: true };
}

function resolveAgent(text, config) {
  const extracted = extractAgentFromText(text);
  if (extracted) return extracted;
  
  if (config.defaultAgentId) {
    const agent = getAgentById(config.defaultAgentId);
    if (agent) return agent;
  }
  
  return DEFAULT_AGENT;
}

export const tmcWebhookPlugin = {
  id: 'tmc-webhook',
  meta: { ...meta },
  capabilities: {
    chatTypes: ['channel'],
    media: false,
    reactions: false,
  },
  streaming: {
    blockStreamingCoalesceDefaults: { minChars: 1500, idleMs: 1000 },
  },
  reload: { configPrefixes: ['channels.tmc-webhook'] },
  config: {
    listAccountIds: () => [DEFAULT_ACCOUNT_ID],
    resolveAccount: (cfg, accountId) => {
      const config = cfg.channels?.['tmc-webhook'];
      return {
        accountId: accountId ?? DEFAULT_ACCOUNT_ID,
        name: 'TMC Webhook',
        enabled: config?.enabled !== false,
        configured: !!config?.webhookUrl,
        webhookUrl: config?.webhookUrl,
        config: config ?? {},
      };
    },
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    setAccountEnabled: ({ cfg, enabled }) => {
      const channels = cfg.channels ?? {};
      const tmcConfig = channels['tmc-webhook'] ?? {};
      return {
        ...cfg,
        channels: {
          ...channels,
          'tmc-webhook': { ...tmcConfig, enabled },
        },
      };
    },
    deleteAccount: ({ cfg }) => {
      const channels = { ...cfg.channels };
      delete channels['tmc-webhook'];
      return { ...cfg, channels };
    },
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: account.configured,
    }),
    resolveAllowFrom: () => [],
    formatAllowFrom: () => [],
  },
  security: {
    resolveDmPolicy: () => ({
      policy: 'reject',
      allowFrom: [],
      policyPath: 'channels.tmc-webhook.dmPolicy',
      allowFromPath: 'channels.tmc-webhook.',
      approveHint: '',
      normalizeEntry: (raw) => raw.trim(),
    }),
    collectWarnings: () => [],
  },
  messaging: {
    normalizeTarget: (target) => target,
    targetResolver: {
      looksLikeId: (target) => /^\\d{17,19}$/.test(target),
      hint: '<channelId>',
    },
  },
  outbound: {
    deliveryMode: 'direct',
    chunker: null,
    textChunkLimit: 2000,
    sendText: async ({ text, accountId, deps }) => {
      const cfg = deps?.cfg ?? {};
      const config = cfg.channels?.['tmc-webhook'];
      
      const webhookUrl = config?.webhookUrl;
      if (!webhookUrl) {
        throw new Error('TMC Webhook URL not configured. Set channels.tmc-webhook.webhookUrl in openclaw.json');
      }
      
      const agent = resolveAgent(text, config ?? {});
      const result = await sendToWebhook(webhookUrl, text, agent);
      
      return {
        channel: 'tmc-webhook',
        messageId: result.messageId,
        target: 'webhook',
      };
    },
    sendMedia: async ({ text, mediaUrl, accountId, deps }) => {
      const cfg = deps?.cfg ?? {};
      const config = cfg.channels?.['tmc-webhook'];
      
      const webhookUrl = config?.webhookUrl;
      if (!webhookUrl) {
        throw new Error('TMC Webhook URL not configured');
      }
      
      const agent = resolveAgent(text ?? '', config ?? {});
      const contentWithMedia = mediaUrl ? \`\${text ?? ''}\\n\${mediaUrl}\` : (text ?? '');
      const result = await sendToWebhook(webhookUrl, contentWithMedia, agent);
      
      return {
        channel: 'tmc-webhook',
        messageId: result.messageId,
        target: 'webhook',
      };
    },
  },
};
`.trim();
    await fs.writeFile(path.join(PLUGIN_DIR, 'channel.js'), channelJs, 'utf-8');
    
    // index.js (plugin entry)
    const indexJs = `
import { tmcWebhookPlugin } from './channel.js';

const plugin = {
  id: 'tmc-webhook',
  name: 'TMC Webhook',
  description: 'Too Many Claw webhook channel - delivers messages via Discord webhook with agent avatars',
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {},
  },
  register(api) {
    api.registerChannel({ plugin: tmcWebhookPlugin });
  },
};

export default plugin;
export { tmcWebhookPlugin } from './channel.js';
`.trim();
    await fs.writeFile(path.join(PLUGIN_DIR, 'index.js'), indexJs, 'utf-8');
    
    return {
      success: true,
      path: PLUGIN_DIR,
      message: 'TMC webhook plugin installed successfully',
    };
  } catch (error) {
    return {
      success: false,
      path: PLUGIN_DIR,
      message: `Failed to install plugin: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Check if plugin is installed
 */
export async function isPluginInstalled(): Promise<boolean> {
  return fs.pathExists(path.join(PLUGIN_DIR, 'package.json'));
}

/**
 * Remove the plugin from OpenClaw extensions
 */
export async function uninstallPlugin(): Promise<boolean> {
  try {
    if (await fs.pathExists(PLUGIN_DIR)) {
      await fs.remove(PLUGIN_DIR);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Configure the plugin in openclaw.json
 * Note: We no longer try to modify OpenClaw's Discord output settings.
 * Instead, TMC daemon uses message interception (delete bot message + resend via webhook).
 * This function now just cleans up any invalid config keys we may have added previously.
 */
export async function configurePlugin(webhookUrl: string): Promise<boolean> {
  try {
    const openclawConfigPath = path.join(OPENCLAW_DIR, 'openclaw.json');
    
    if (!await fs.pathExists(openclawConfigPath)) {
      return true; // Nothing to configure
    }
    
    const config: Record<string, unknown> = await fs.readJson(openclawConfigPath);
    let modified = false;
    
    // Clean up invalid top-level keys we may have added before
    if (config.discord) {
      delete config.discord;
      modified = true;
    }
    if (config.defaults) {
      delete config.defaults;
      modified = true;
    }
    
    // Clean up invalid channel configurations
    if (config.channels) {
      const channels = config.channels as Record<string, unknown>;
      
      // Remove tmc-webhook channel (no longer used)
      if (channels['tmc-webhook']) {
        delete channels['tmc-webhook'];
        modified = true;
      }
      
      // Clean up discord channel invalid keys
      if (channels.discord) {
        const discordChannel = channels.discord as Record<string, unknown>;
        if (discordChannel.actions) {
          delete discordChannel.actions;
          modified = true;
        }
        if (discordChannel.replyToMode) {
          delete discordChannel.replyToMode;
          modified = true;
        }
        // Remove empty discord object
        if (Object.keys(discordChannel).length === 0) {
          delete channels.discord;
          modified = true;
        }
      }
      
      // Remove empty channels object
      if (Object.keys(channels).length === 0) {
        delete config.channels;
        modified = true;
      }
    }
    
    if (modified) {
      await fs.writeJson(openclawConfigPath, config, { spaces: 2 });
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the plugin installation directory
 */
export function getPluginDir(): string {
  return PLUGIN_DIR;
}
