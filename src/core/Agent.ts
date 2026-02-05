/**
 * Too Many Claw - Agent Base Class
 */

import { AgentState, AgentDefinition, AgentInstance, PlatformAdapter } from '../types/index.js';
import { MessageRouter } from './MessageRouter.js';

export class Agent {
  readonly definition: AgentDefinition;
  private _state: AgentState;
  private _activatedAt?: Date;
  private _activatedBy?: string;
  private messageRouter: MessageRouter;

  constructor(definition: AgentDefinition) {
    this.definition = definition;
    this._state = definition.alwaysActive ? AgentState.ACTIVE : AgentState.DORMANT;
    this._activatedAt = definition.alwaysActive ? new Date() : undefined;
    this._activatedBy = definition.alwaysActive ? 'system' : undefined;
    this.messageRouter = new MessageRouter();
  }

  // Getters
  get state(): AgentState {
    return this._state;
  }

  get isActive(): boolean {
    return this._state === AgentState.ACTIVE;
  }

  get isDormant(): boolean {
    return this._state === AgentState.DORMANT;
  }

  get id(): string {
    return this.definition.id;
  }

  get name(): string {
    return this.definition.name;
  }

  get emoji(): string {
    return this.definition.emoji;
  }

  get activatedAt(): Date | undefined {
    return this._activatedAt;
  }

  get activatedBy(): string | undefined {
    return this._activatedBy;
  }

  /**
   * Activate this agent
   */
  activate(activatedBy: string): boolean {
    if (this._state === AgentState.ACTIVE) {
      return false;
    }
    this._state = AgentState.ACTIVE;
    this._activatedAt = new Date();
    this._activatedBy = activatedBy;
    return true;
  }

  /**
   * Deactivate this agent (unless alwaysActive)
   */
  deactivate(): boolean {
    if (this.definition.alwaysActive) {
      return false;
    }
    this._state = AgentState.DORMANT;
    this._activatedAt = undefined;
    this._activatedBy = undefined;
    return true;
  }

  /**
   * Send entry message (입장)
   */
  async enter(platform: PlatformAdapter, content: string): Promise<void> {
    const formattedContent = this.messageRouter.formatEntryMessage(this.definition, content);
    const message = this.messageRouter.createMessage(this.id, formattedContent, { isEntry: true });
    await platform.sendMessage(message);
    await platform.sendStatusUpdate(this.id, 'enter');
  }

  /**
   * Send exit message (퇴장)
   */
  async exit(platform: PlatformAdapter, content: string): Promise<void> {
    const formattedContent = this.messageRouter.formatExitMessage(this.definition, content);
    const message = this.messageRouter.createMessage(this.id, formattedContent, { isExit: true });
    await platform.sendMessage(message);
    await platform.sendStatusUpdate(this.id, 'exit');
  }

  /**
   * Send regular message
   */
  async speak(platform: PlatformAdapter, content: string): Promise<void> {
    const formattedContent = this.messageRouter.formatMessage(this.definition, content);
    const message = this.messageRouter.createMessage(this.id, formattedContent);
    await platform.sendMessage(message);
  }

  /**
   * Convert to AgentInstance format
   */
  toInstance(): AgentInstance {
    return {
      definition: this.definition,
      state: this._state,
      activatedAt: this._activatedAt,
      activatedBy: this._activatedBy,
    };
  }
}
