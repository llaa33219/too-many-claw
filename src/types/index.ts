/**
 * Too Many Claw - Core Types and Interfaces
 */

/** Model tier mapping to Claude models */
export enum ModelTier {
  OPUS = 'anthropic/claude-opus-4-5',
  SONNET = 'anthropic/claude-sonnet-4-5',
  HAIKU = 'anthropic/claude-haiku-3-5',
}

/** Agent categories for grouping */
export enum AgentCategory {
  CORE = 'CORE',
  RESEARCH = 'RESEARCH',
  PSYCHOLOGY = 'PSYCHOLOGY',
  PLANNING = 'PLANNING',
  DEVELOPMENT = 'DEVELOPMENT',
  TESTING = 'TESTING',
  CRITIQUE = 'CRITIQUE',
  SPECIAL = 'SPECIAL',
}

/** Static agent definition */
export interface AgentDefinition {
  /** Unique agent ID (e.g., 'base', 'searcher') */
  id: string;
  /** Display name in Korean (e.g., '검색 전문가') */
  name: string;
  /** Single emoji for the agent */
  emoji: string;
  /** Detailed role description in Korean */
  role: string;
  /** Agent category */
  category: AgentCategory;
  /** Model tier to use */
  model: ModelTier;
  /** If true, agent is always active (only for base) */
  alwaysActive?: boolean;
}

/** Agent configuration entry for openclaw.json */
export interface AgentConfigEntry {
  /** Agent ID */
  id: string;
  /** Display name */
  name: string;
  /** Model to use */
  model: string;
  /** Workspace path */
  workspace: string;
  /** Subagent configuration */
  subagents: {
    allowAgents: string[];
  };
}

/** OpenClaw main configuration structure */
export interface OpenClawConfig {
  tools: {
    agentToAgent: {
      enabled: boolean;
      allow: string[];
    };
  };
  agents: {
    list: AgentConfigEntry[];
  };
}
