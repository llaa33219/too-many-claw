/**
 * Too Many Claw - Core Types and Interfaces
 */

/** Agent state - DORMANT (inactive) or ACTIVE (participating in conversation) */
export enum AgentState {
  DORMANT = 'DORMANT',
  ACTIVE = 'ACTIVE',
}

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

/** Runtime agent instance */
export interface AgentInstance {
  /** Static definition */
  definition: AgentDefinition;
  /** Current state */
  state: AgentState;
  /** When the agent was activated */
  activatedAt?: Date;
  /** Who activated the agent (agent id or 'user') */
  activatedBy?: string;
}

/** Message in the conversation */
export interface Message {
  /** Unique message ID */
  id: string;
  /** Message content */
  content: string;
  /** Author's agent ID or 'user' */
  authorId: string;
  /** Author's display name */
  authorName: string;
  /** Author's emoji */
  authorEmoji: string;
  /** Message timestamp */
  timestamp: Date;
  /** Thread ID if in a thread */
  threadId?: string;
  /** Agent IDs mentioned in the message */
  mentions: string[];
  /** Is this an entry (입장) message */
  isEntry?: boolean;
  /** Is this an exit (퇴장) message */
  isExit?: boolean;
}

/** Platform adapter interface for Discord, terminal, etc. */
export interface PlatformAdapter {
  /** Send a message to the chat */
  sendMessage(message: Message): Promise<void>;
  /** Send status update (enter/exit) to status channel */
  sendStatusUpdate(agentId: string, status: 'enter' | 'exit'): Promise<void>;
  /** Register message handler */
  onMessage(handler: (message: Message) => void): void;
  /** Create a new thread */
  createThread(name: string): Promise<string>;
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

/** Too Many Claw specific configuration */
export interface TooManyClawConfig {
  discord?: {
    botToken?: string;
    guildId?: string;
    chatChannelId?: string;
    statusChannelId?: string;
    webhooks: Record<string, string>;
  };
  simulation?: {
    enabled: boolean;
  };
}

/** Combined configuration */
export interface Config {
  openclaw: OpenClawConfig;
  tooManyClaw: TooManyClawConfig;
}
