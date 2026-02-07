/**
 * Too Many Claw - Main Package Entry
 * 35 AI agents collaborating via OpenClaw
 */

// Types
export * from './types/index.js';

// Agent definitions
export { AGENT_DEFINITIONS, getAgentById, getAgentsByCategory, getAgentsByModel, getAllAgentIds } from './agents/definitions.js';
export { SOUL_TEMPLATES, getSoulTemplate } from './agents/souls/index.js';

// Configuration
export { ConfigManager } from './config/index.js';
