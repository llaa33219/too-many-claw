/**
 * Too Many Claw - Main Package Entry
 * 35 AI agents collaborating via Discord
 */

// Types
export * from './types/index.js';

// Agent definitions
export { AGENT_DEFINITIONS, getAgentById, getAgentsByCategory, getAgentsByModel, getAllAgentIds } from './agents/definitions.js';
export { SOUL_TEMPLATES, getSoulTemplate } from './agents/souls/index.js';

// Core system
export { Agent, Orchestrator, StateManager, MessageRouter } from './core/index.js';

// Discord integration
export { WebhookManager, DiscordAdapter, BotMessageSuppressor, DetectedBotMessage } from './discord/index.js';

// Simulation
export { TerminalAdapter, TerminalUI } from './simulation/index.js';

// Configuration
export { ConfigManager } from './config/index.js';

// OpenClaw Integration
export { GatewayClient, GatewayClientConfig, GatewayMessage, ConnectionState } from './openclaw/index.js';

// Daemon
export { OpenClawDaemon, DaemonConfig, DaemonStats } from './daemon/index.js';
