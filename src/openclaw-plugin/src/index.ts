/**
 * TMC Webhook Plugin for OpenClaw
 * 
 * This plugin provides a channel that delivers messages via Discord webhook
 * with agent-specific username and avatar for each TMC agent.
 * 
 * Configuration in openclaw.json:
 * {
 *   "channels": {
 *     "tmc-webhook": {
 *       "enabled": true,
 *       "webhookUrl": "https://discord.com/api/webhooks/..."
 *     }
 *   }
 * }
 */

import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
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
  register(api: OpenClawPluginApi) {
    api.registerChannel({ plugin: tmcWebhookPlugin });
  },
};

export default plugin;
export { tmcWebhookPlugin } from './channel.js';
export type { TmcWebhookConfig, ResolvedTmcWebhookAccount } from './channel.js';
