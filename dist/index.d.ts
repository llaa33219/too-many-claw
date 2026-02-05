import { TextChannel } from 'discord.js';

/**
 * Too Many Claw - Core Types and Interfaces
 */
/** Agent state - DORMANT (inactive) or ACTIVE (participating in conversation) */
declare enum AgentState {
    DORMANT = "DORMANT",
    ACTIVE = "ACTIVE"
}
/** Model tier mapping to Claude models */
declare enum ModelTier {
    OPUS = "claude-opus-4-5",
    SONNET = "claude-sonnet-4-5",
    HAIKU = "claude-haiku-4-5"
}
/** Agent categories for grouping */
declare enum AgentCategory {
    CORE = "CORE",
    RESEARCH = "RESEARCH",
    PSYCHOLOGY = "PSYCHOLOGY",
    PLANNING = "PLANNING",
    DEVELOPMENT = "DEVELOPMENT",
    TESTING = "TESTING",
    CRITIQUE = "CRITIQUE",
    SPECIAL = "SPECIAL"
}
/** Static agent definition */
interface AgentDefinition {
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
interface AgentInstance {
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
interface Message {
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
interface PlatformAdapter {
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
interface AgentConfigEntry {
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
interface OpenClawConfig {
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
interface TooManyClawConfig {
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
interface Config {
    openclaw: OpenClawConfig;
    tooManyClaw: TooManyClawConfig;
}

/**
 * Too Many Claw - Agent Definitions
 * All 35 agents with their metadata
 */

/** All 35 agent definitions */
declare const AGENT_DEFINITIONS: AgentDefinition[];
/**
 * Get agent definition by ID
 */
declare function getAgentById(id: string): AgentDefinition | undefined;
/**
 * Get all agents in a category
 */
declare function getAgentsByCategory(category: AgentCategory): AgentDefinition[];
/**
 * Get all agents using a specific model tier
 */
declare function getAgentsByModel(model: ModelTier): AgentDefinition[];
/**
 * Get all agent IDs
 */
declare function getAllAgentIds(): string[];

/**
 * Too Many Claw - Agent SOUL Templates
 * Each template defines the agent's personality, expertise, and behavior
 */
declare const SOUL_TEMPLATES: Record<string, string>;
/**
 * Get SOUL template by agent ID
 */
declare function getSoulTemplate(agentId: string): string | undefined;

/**
 * Too Many Claw - State Manager
 * Manages DORMANT/ACTIVE states for all 35 agents
 */

declare class StateManager {
    private agents;
    constructor();
    /**
     * Initialize all agents - DORMANT by default, base is ACTIVE
     */
    private initialize;
    /**
     * Activate an agent
     */
    activateAgent(id: string, activatedBy: string): boolean;
    /**
     * Deactivate an agent (except alwaysActive agents)
     */
    deactivateAgent(id: string): boolean;
    /**
     * Get all active agents
     */
    getActiveAgents(): AgentInstance[];
    /**
     * Check if an agent is active
     */
    isActive(id: string): boolean;
    /**
     * Get a specific agent instance
     */
    getAgent(id: string): AgentInstance | undefined;
    /**
     * Get all agents
     */
    getAllAgents(): AgentInstance[];
    /**
     * Get count of active agents
     */
    getActiveCount(): number;
    /**
     * Get count of dormant agents
     */
    getDormantCount(): number;
    /**
     * Reset all agents to initial state
     */
    reset(): void;
}

/**
 * Too Many Claw - Message Router
 * Routes messages and parses @mentions
 */

declare class MessageRouter {
    private agentIds;
    constructor();
    /**
     * Parse @mentions from message content
     * Returns array of valid agent IDs mentioned
     */
    parseMentions(content: string): string[];
    /**
     * Check if content mentions a specific agent
     */
    mentionsAgent(content: string, agentId: string): boolean;
    /**
     * Get agent definitions for all mentioned agents
     */
    getMentionedAgents(content: string): AgentDefinition[];
    /**
     * Format entry message (입장)
     * Example: "🔬 Tech Researcher (입장) 알겠어, 조사해볼게."
     */
    formatEntryMessage(agent: AgentDefinition, content: string): string;
    /**
     * Format exit message (퇴장)
     * Example: "🔬 Tech Researcher 조사 완료. (퇴장)"
     */
    formatExitMessage(agent: AgentDefinition, content: string): string;
    /**
     * Format regular message
     * Example: "🔬 Tech Researcher: 내용..."
     */
    formatMessage(agent: AgentDefinition, content: string): string;
    /**
     * Create a new Message object
     */
    createMessage(authorId: string, content: string, options?: {
        threadId?: string;
        isEntry?: boolean;
        isExit?: boolean;
    }): Message;
    /**
     * Create a user message
     */
    createUserMessage(content: string, threadId?: string): Message;
}

/**
 * Too Many Claw - Agent Base Class
 */

declare class Agent {
    readonly definition: AgentDefinition;
    private _state;
    private _activatedAt?;
    private _activatedBy?;
    private messageRouter;
    constructor(definition: AgentDefinition);
    get state(): AgentState;
    get isActive(): boolean;
    get isDormant(): boolean;
    get id(): string;
    get name(): string;
    get emoji(): string;
    get activatedAt(): Date | undefined;
    get activatedBy(): string | undefined;
    /**
     * Activate this agent
     */
    activate(activatedBy: string): boolean;
    /**
     * Deactivate this agent (unless alwaysActive)
     */
    deactivate(): boolean;
    /**
     * Send entry message (입장)
     */
    enter(platform: PlatformAdapter, content: string): Promise<void>;
    /**
     * Send exit message (퇴장)
     */
    exit(platform: PlatformAdapter, content: string): Promise<void>;
    /**
     * Send regular message
     */
    speak(platform: PlatformAdapter, content: string): Promise<void>;
    /**
     * Convert to AgentInstance format
     */
    toInstance(): AgentInstance;
}

/**
 * Too Many Claw - Orchestrator
 * Main coordinator that manages agent lifecycle and message routing
 */

declare class Orchestrator {
    private stateManager;
    private messageRouter;
    private platform;
    private agents;
    constructor(platform: PlatformAdapter);
    /**
     * Handle incoming user message
     * Base agent analyzes and routes appropriately
     */
    handleUserMessage(message: Message): Promise<void>;
    /**
     * Summon an agent (activate and announce)
     */
    summonAgent(id: string, reason?: string): Promise<boolean>;
    /**
     * Dismiss an agent (deactivate and announce)
     */
    dismissAgent(id: string, reason?: string): Promise<boolean>;
    /**
     * Get all active agent IDs
     */
    getActiveAgentIds(): string[];
    /**
     * Get all active agents
     */
    getActiveAgents(): Agent[];
    /**
     * Check if an agent is active
     */
    isAgentActive(id: string): boolean;
    /**
     * Get a specific agent
     */
    getAgent(id: string): Agent | undefined;
    /**
     * Get current status summary
     */
    getStatus(): {
        active: number;
        dormant: number;
        activeIds: string[];
    };
    /**
     * Reset all agents to initial state
     */
    reset(): void;
}

/**
 * Too Many Claw - Discord Bot
 * Main Discord bot that receives messages
 */

interface BotConfig {
    token: string;
    guildId: string;
    chatChannelId: string;
    statusChannelId?: string;
}
declare class Bot {
    private client;
    private config;
    private messageHandlers;
    private agentIds;
    constructor(config: BotConfig);
    private setupEventHandlers;
    private convertMessage;
    private cleanMessageContent;
    private parseMentions;
    /**
     * Register a message handler
     */
    onMessage(handler: (message: Message) => void): void;
    /**
     * Connect to Discord
     */
    connect(): Promise<void>;
    /**
     * Disconnect from Discord
     */
    disconnect(): Promise<void>;
    /**
     * Send a message to a channel
     */
    sendMessage(channelId: string, content: string): Promise<void>;
    /**
     * Get the chat channel
     */
    getChatChannel(): Promise<TextChannel | null>;
    /**
     * Get the status channel
     */
    getStatusChannel(): Promise<TextChannel | null>;
    /**
     * Create a thread in the chat channel
     */
    createThread(name: string): Promise<string>;
    /**
     * Check if bot is connected
     */
    get isConnected(): boolean;
}

/**
 * Too Many Claw - Discord Webhook Manager
 * Manages webhooks for 35 agent personas
 */
declare class WebhookManager {
    private webhooks;
    private clients;
    /**
     * Register a webhook URL for an agent
     */
    setWebhook(agentId: string, webhookUrl: string): void;
    /**
     * Bulk register webhooks from config
     */
    setWebhooks(webhooks: Record<string, string>): void;
    /**
     * Check if webhook exists for an agent
     */
    hasWebhook(agentId: string): boolean;
    /**
     * Send message as an agent via webhook
     */
    sendAsAgent(agentId: string, content: string): Promise<void>;
    /**
     * Get all registered agent IDs
     */
    getRegisteredAgents(): string[];
    /**
     * Remove a webhook
     */
    removeWebhook(agentId: string): void;
    /**
     * Destroy all webhook clients
     */
    destroy(): void;
}

/**
 * Too Many Claw - Discord Platform Adapter
 * Implements PlatformAdapter interface for Discord
 */

declare class DiscordAdapter implements PlatformAdapter {
    private bot;
    private webhookManager;
    private statusChannelId?;
    constructor(config: BotConfig);
    /**
     * Send a message - uses webhook if available, otherwise bot
     */
    sendMessage(message: Message): Promise<void>;
    /**
     * Send status update to status channel
     */
    sendStatusUpdate(agentId: string, status: 'enter' | 'exit'): Promise<void>;
    /**
     * Register message handler
     */
    onMessage(handler: (message: Message) => void): void;
    /**
     * Create a new thread
     */
    createThread(name: string): Promise<string>;
    /**
     * Connect to Discord
     */
    connect(): Promise<void>;
    /**
     * Disconnect from Discord
     */
    disconnect(): Promise<void>;
    /**
     * Set webhook for an agent
     */
    setWebhook(agentId: string, webhookUrl: string): void;
    /**
     * Bulk set webhooks
     */
    setWebhooks(webhooks: Record<string, string>): void;
    /**
     * Check if agent has a webhook
     */
    hasWebhook(agentId: string): boolean;
    /**
     * Check if connected
     */
    get isConnected(): boolean;
}

/**
 * Too Many Claw - Terminal Platform Adapter
 * Implements PlatformAdapter for terminal simulation
 */

declare class TerminalAdapter implements PlatformAdapter {
    private messageHandler?;
    private threadCounter;
    /**
     * Send a message - prints to console with colors
     */
    sendMessage(message: Message): Promise<void>;
    /**
     * Send status update
     */
    sendStatusUpdate(agentId: string, status: 'enter' | 'exit'): Promise<void>;
    /**
     * Register message handler
     */
    onMessage(handler: (message: Message) => void): void;
    /**
     * Simulate thread creation
     */
    createThread(name: string): Promise<string>;
    /**
     * Trigger a message from user input
     */
    triggerMessage(content: string): void;
    private parseMentions;
    private getAgentColor;
    /**
     * Print system message
     */
    printSystem(message: string): void;
    /**
     * Print error message
     */
    printError(message: string): void;
}

/**
 * Too Many Claw - Terminal UI
 * Interactive terminal interface for simulation
 */
declare class TerminalUI {
    private adapter;
    private orchestrator;
    private rl;
    private isRunning;
    constructor();
    /**
     * Start the terminal UI
     */
    start(): Promise<void>;
    /**
     * Stop the terminal UI
     */
    stop(): void;
    private printWelcome;
    private printHelp;
    private inputLoop;
    private prompt;
    private handleInput;
    private handleCommand;
    private printStatus;
    private printAllAgents;
    private handleSummon;
    private handleDismiss;
}

/**
 * Too Many Claw - Configuration Manager
 */
interface DiscordConfig {
    token?: string;
    guildId?: string;
    chatChannelId?: string;
    statusChannelId?: string;
}
declare class ConfigManager {
    private configPath;
    private config;
    constructor();
    /**
     * Load configuration from disk
     */
    private load;
    /**
     * Save configuration to disk
     */
    private save;
    /**
     * Get Discord configuration
     */
    getDiscordConfig(): DiscordConfig;
    /**
     * Set Discord configuration
     */
    setDiscordConfig(discord: DiscordConfig): void;
    /**
     * Check if Discord is configured
     */
    isDiscordConfigured(): boolean;
    /**
     * Get webhook URL for an agent
     */
    getWebhook(agentId: string): string | undefined;
    /**
     * Set webhook URL for an agent
     */
    setWebhook(agentId: string, webhookUrl: string): void;
    /**
     * Check if agent has a webhook
     */
    hasWebhook(agentId: string): boolean;
    /**
     * Remove webhook for an agent
     */
    removeWebhook(agentId: string): void;
    /**
     * Get all webhooks
     */
    getAllWebhooks(): Record<string, string>;
    /**
     * Set all webhooks
     */
    setAllWebhooks(webhooks: Record<string, string>): void;
    /**
     * Get config file path
     */
    getConfigPath(): string;
    /**
     * Reset configuration
     */
    reset(): void;
}

export { AGENT_DEFINITIONS, Agent, AgentCategory, type AgentConfigEntry, type AgentDefinition, type AgentInstance, AgentState, Bot, type Config, ConfigManager, DiscordAdapter, type Message, MessageRouter, ModelTier, type OpenClawConfig, Orchestrator, type PlatformAdapter, SOUL_TEMPLATES, StateManager, TerminalAdapter, TerminalUI, type TooManyClawConfig, WebhookManager, getAgentById, getAgentsByCategory, getAgentsByModel, getAllAgentIds, getSoulTemplate };
