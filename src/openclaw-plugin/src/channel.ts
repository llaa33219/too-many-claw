/**
 * TMC Webhook Channel Plugin for OpenClaw
 * Redirects outbound messages to Discord webhook with agent-specific username/avatar
 */

import type { ChannelPlugin } from 'openclaw/plugin-sdk';
import { DEFAULT_AGENT, extractAgentFromText, getAgentById, getEmojiAvatarUrl, type AgentInfo } from './agents.js';

/**
 * Plugin configuration stored in openclaw.json under channels.tmc-webhook
 */
export interface TmcWebhookConfig {
  /** Discord webhook URL */
  webhookUrl?: string;
  /** Default agent ID to use if not detectable from message */
  defaultAgentId?: string;
  /** Whether the channel is enabled */
  enabled?: boolean;
}

/**
 * Resolved account configuration
 */
export interface ResolvedTmcWebhookAccount {
  accountId: string;
  name: string;
  enabled: boolean;
  configured: boolean;
  webhookUrl?: string;
  config: TmcWebhookConfig;
}

const DEFAULT_ACCOUNT_ID = 'default';

/**
 * Channel metadata
 */
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
} as const;

/**
 * Send message to Discord webhook
 */
async function sendToWebhook(
  webhookUrl: string,
  content: string,
  agent: AgentInfo,
): Promise<{ messageId?: string; success: boolean }> {
  const username = `${agent.emoji} ${agent.name}`;
  const avatarUrl = getEmojiAvatarUrl(agent.emoji);
  
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content,
      username,
      avatar_url: avatarUrl,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
  }
  
  // Discord returns 204 No Content for successful webhook posts
  // or a message object with ID if wait=true
  let messageId: string | undefined;
  if (response.status !== 204) {
    const data = await response.json();
    messageId = data.id;
  }
  
  return { messageId, success: true };
}

/**
 * Determine which agent should be used for a message
 */
function resolveAgent(text: string, config: TmcWebhookConfig): AgentInfo {
  // Try to extract agent from message text first
  const extracted = extractAgentFromText(text);
  if (extracted) {
    return extracted;
  }
  
  // Use configured default agent
  if (config.defaultAgentId) {
    const agent = getAgentById(config.defaultAgentId);
    if (agent) {
      return agent;
    }
  }
  
  // Fall back to base agent
  return DEFAULT_AGENT;
}

/**
 * TMC Webhook Channel Plugin
 * This plugin handles outbound message delivery via Discord webhook
 */
export const tmcWebhookPlugin: ChannelPlugin<ResolvedTmcWebhookAccount> = {
  id: 'tmc-webhook',
  meta: {
    ...meta,
  },
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
      const config = (cfg.channels as Record<string, unknown>)?.['tmc-webhook'] as TmcWebhookConfig | undefined;
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
      const channels = (cfg.channels ?? {}) as Record<string, unknown>;
      const tmcConfig = (channels['tmc-webhook'] ?? {}) as TmcWebhookConfig;
      return {
        ...cfg,
        channels: {
          ...channels,
          'tmc-webhook': {
            ...tmcConfig,
            enabled,
          },
        },
      };
    },
    deleteAccount: ({ cfg }) => {
      const channels = { ...(cfg.channels ?? {}) } as Record<string, unknown>;
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
      normalizeEntry: (raw: string) => raw.trim(),
    }),
    collectWarnings: () => [],
  },
  messaging: {
    normalizeTarget: (target: string) => target,
    targetResolver: {
      looksLikeId: (target: string) => /^\d{17,19}$/.test(target),
      hint: '<channelId>',
    },
  },
  outbound: {
    deliveryMode: 'direct',
    chunker: null,
    textChunkLimit: 2000,
    sendText: async ({ text, accountId, deps }) => {
      // Get account configuration
      const cfg = deps?.cfg ?? {};
      const config = (cfg.channels as Record<string, unknown>)?.['tmc-webhook'] as TmcWebhookConfig | undefined;
      
      // Check if webhook URL is configured
      const webhookUrl = config?.webhookUrl;
      if (!webhookUrl) {
        throw new Error('TMC Webhook URL not configured. Set channels.tmc-webhook.webhookUrl in openclaw.json');
      }
      
      // Determine agent from message content or config
      const agent = resolveAgent(text, config ?? {});
      
      // Send to webhook
      const result = await sendToWebhook(webhookUrl, text, agent);
      
      return {
        channel: 'tmc-webhook',
        messageId: result.messageId,
        target: 'webhook',
      };
    },
    sendMedia: async ({ text, mediaUrl, accountId, deps }) => {
      // Get account configuration
      const cfg = deps?.cfg ?? {};
      const config = (cfg.channels as Record<string, unknown>)?.['tmc-webhook'] as TmcWebhookConfig | undefined;
      
      const webhookUrl = config?.webhookUrl;
      if (!webhookUrl) {
        throw new Error('TMC Webhook URL not configured');
      }
      
      const agent = resolveAgent(text ?? '', config ?? {});
      
      // Include media URL in message content
      const contentWithMedia = mediaUrl ? `${text ?? ''}\n${mediaUrl}` : (text ?? '');
      
      const result = await sendToWebhook(webhookUrl, contentWithMedia, agent);
      
      return {
        channel: 'tmc-webhook',
        messageId: result.messageId,
        target: 'webhook',
      };
    },
  },
};
