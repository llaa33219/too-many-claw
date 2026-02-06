/**
 * TMC OpenClaw Plugin Module
 * 
 * This module contains the OpenClaw channel plugin for TMC webhook delivery
 * and utilities for installing/configuring the plugin.
 */

export { installPlugin, uninstallPlugin, isPluginInstalled, configurePlugin, getPluginDir } from './install.js';
export type { TmcWebhookConfig, ResolvedTmcWebhookAccount } from './src/channel.js';
