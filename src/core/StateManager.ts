/**
 * Too Many Claw - State Manager
 * Manages DORMANT/ACTIVE states for all 35 agents
 */

import { AgentState, AgentInstance } from '../types/index.js';
import { AGENT_DEFINITIONS, getAgentById } from '../agents/definitions.js';

export class StateManager {
  private agents: Map<string, AgentInstance> = new Map();

  constructor() {
    this.initialize();
  }

  /**
   * Initialize all agents - DORMANT by default, base is ACTIVE
   */
  private initialize(): void {
    for (const definition of AGENT_DEFINITIONS) {
      this.agents.set(definition.id, {
        definition,
        state: definition.alwaysActive ? AgentState.ACTIVE : AgentState.DORMANT,
        activatedAt: definition.alwaysActive ? new Date() : undefined,
        activatedBy: definition.alwaysActive ? 'system' : undefined,
      });
    }
  }

  /**
   * Activate an agent
   */
  activateAgent(id: string, activatedBy: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;

    if (agent.state === AgentState.ACTIVE) {
      return true; // Already active
    }

    agent.state = AgentState.ACTIVE;
    agent.activatedAt = new Date();
    agent.activatedBy = activatedBy;
    return true;
  }

  /**
   * Deactivate an agent (except alwaysActive agents)
   */
  deactivateAgent(id: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) return false;

    // Cannot deactivate alwaysActive agents
    if (agent.definition.alwaysActive) {
      return false;
    }

    agent.state = AgentState.DORMANT;
    agent.activatedAt = undefined;
    agent.activatedBy = undefined;
    return true;
  }

  /**
   * Get all active agents
   */
  getActiveAgents(): AgentInstance[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.state === AgentState.ACTIVE
    );
  }

  /**
   * Check if an agent is active
   */
  isActive(id: string): boolean {
    const agent = this.agents.get(id);
    return agent?.state === AgentState.ACTIVE;
  }

  /**
   * Get a specific agent instance
   */
  getAgent(id: string): AgentInstance | undefined {
    return this.agents.get(id);
  }

  /**
   * Get all agents
   */
  getAllAgents(): AgentInstance[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get count of active agents
   */
  getActiveCount(): number {
    return this.getActiveAgents().length;
  }

  /**
   * Get count of dormant agents
   */
  getDormantCount(): number {
    return this.agents.size - this.getActiveCount();
  }

  /**
   * Reset all agents to initial state
   */
  reset(): void {
    this.agents.clear();
    this.initialize();
  }
}
