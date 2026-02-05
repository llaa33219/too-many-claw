/**
 * Too Many Claw - Orchestrator
 * Main coordinator that manages agent lifecycle and message routing
 */

import { Message, PlatformAdapter } from '../types/index.js';
import { AGENT_DEFINITIONS, getAgentById } from '../agents/definitions.js';
import { StateManager } from './StateManager.js';
import { MessageRouter } from './MessageRouter.js';
import { Agent } from './Agent.js';

export class Orchestrator {
  private stateManager: StateManager;
  private messageRouter: MessageRouter;
  private platform: PlatformAdapter;
  private agents: Map<string, Agent>;

  constructor(platform: PlatformAdapter) {
    this.stateManager = new StateManager();
    this.messageRouter = new MessageRouter();
    this.platform = platform;
    this.agents = new Map();

    // Initialize all agents
    for (const definition of AGENT_DEFINITIONS) {
      this.agents.set(definition.id, new Agent(definition));
    }
  }

  /**
   * Handle incoming user message
   * Base agent analyzes and routes appropriately
   */
  async handleUserMessage(message: Message): Promise<void> {
    // Parse mentions from the message
    const mentionedAgentIds = this.messageRouter.parseMentions(message.content);

    // Activate mentioned agents
    for (const agentId of mentionedAgentIds) {
      if (!this.stateManager.isActive(agentId)) {
        await this.summonAgent(agentId, `사용자가 @${agentId} 멘션`);
      }
    }

    // If no specific agents mentioned, base handles it
    if (mentionedAgentIds.length === 0) {
      // Base agent processes the request and decides which agents to summon
      // This would typically involve LLM integration
    }
  }

  /**
   * Summon an agent (activate and announce)
   */
  async summonAgent(id: string, reason?: string): Promise<boolean> {
    const agent = this.agents.get(id);
    if (!agent) return false;

    const activated = this.stateManager.activateAgent(id, 'base');
    if (!activated) return false;

    agent.activate('base');

    // Send entry notification
    const definition = getAgentById(id);
    if (definition) {
      const entryMessage = reason
        ? `알겠어, ${reason}. 참여할게.`
        : '알겠어, 참여할게.';
      await agent.enter(this.platform, entryMessage);
    }

    return true;
  }

  /**
   * Dismiss an agent (deactivate and announce)
   */
  async dismissAgent(id: string, reason?: string): Promise<boolean> {
    const agent = this.agents.get(id);
    if (!agent) return false;

    // Send exit notification before deactivating
    const exitMessage = reason ?? '작업 완료.';
    await agent.exit(this.platform, exitMessage);

    const deactivated = this.stateManager.deactivateAgent(id);
    if (deactivated) {
      agent.deactivate();
    }

    return deactivated;
  }

  /**
   * Get all active agent IDs
   */
  getActiveAgentIds(): string[] {
    return this.stateManager.getActiveAgents().map((a) => a.definition.id);
  }

  /**
   * Get all active agents
   */
  getActiveAgents(): Agent[] {
    return this.getActiveAgentIds()
      .map((id) => this.agents.get(id))
      .filter((agent): agent is Agent => agent !== undefined);
  }

  /**
   * Check if an agent is active
   */
  isAgentActive(id: string): boolean {
    return this.stateManager.isActive(id);
  }

  /**
   * Get a specific agent
   */
  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  /**
   * Get current status summary
   */
  getStatus(): { active: number; dormant: number; activeIds: string[] } {
    return {
      active: this.stateManager.getActiveCount(),
      dormant: this.stateManager.getDormantCount(),
      activeIds: this.getActiveAgentIds(),
    };
  }

  /**
   * Reset all agents to initial state
   */
  reset(): void {
    this.stateManager.reset();
    for (const agent of this.agents.values()) {
      if (!agent.definition.alwaysActive) {
        agent.deactivate();
      }
    }
  }
}
