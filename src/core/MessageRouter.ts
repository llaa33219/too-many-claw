/**
 * Too Many Claw - Message Router
 * Routes messages and parses @mentions
 */

import { Message, AgentDefinition } from '../types/index.js';
import { getAgentById, getAllAgentIds } from '../agents/definitions.js';

/**
 * Generate a simple UUID v4
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class MessageRouter {
  private agentIds: Set<string>;

  constructor() {
    this.agentIds = new Set(getAllAgentIds());
  }

  /**
   * Parse @mentions from message content
   * Returns array of valid agent IDs mentioned
   */
  parseMentions(content: string): string[] {
    const mentionPattern = /@([a-z-]+)/gi;
    const matches = content.matchAll(mentionPattern);
    const mentions: string[] = [];

    for (const match of matches) {
      const agentId = match[1].toLowerCase();
      if (this.agentIds.has(agentId) && !mentions.includes(agentId)) {
        mentions.push(agentId);
      }
    }

    return mentions;
  }

  /**
   * Check if content mentions a specific agent
   */
  mentionsAgent(content: string, agentId: string): boolean {
    return this.parseMentions(content).includes(agentId);
  }

  /**
   * Get agent definitions for all mentioned agents
   */
  getMentionedAgents(content: string): AgentDefinition[] {
    const mentionedIds = this.parseMentions(content);
    return mentionedIds
      .map((id) => getAgentById(id))
      .filter((agent): agent is AgentDefinition => agent !== undefined);
  }

  /**
   * Format entry message (입장)
   * Example: "🔬 Tech Researcher (입장) 알겠어, 조사해볼게."
   */
  formatEntryMessage(agent: AgentDefinition, content: string): string {
    return `${agent.emoji} ${agent.name} (입장) ${content}`;
  }

  /**
   * Format exit message (퇴장)
   * Example: "🔬 Tech Researcher 조사 완료. (퇴장)"
   */
  formatExitMessage(agent: AgentDefinition, content: string): string {
    return `${agent.emoji} ${agent.name} ${content} (퇴장)`;
  }

  /**
   * Format regular message
   * Example: "🔬 Tech Researcher: 내용..."
   */
  formatMessage(agent: AgentDefinition, content: string): string {
    return `${agent.emoji} ${agent.name}: ${content}`;
  }

  /**
   * Create a new Message object
   */
  createMessage(
    authorId: string,
    content: string,
    options?: {
      threadId?: string;
      isEntry?: boolean;
      isExit?: boolean;
    }
  ): Message {
    const agent = getAgentById(authorId);

    return {
      id: generateId(),
      content,
      authorId,
      authorName: agent?.name ?? (authorId === 'user' ? '사용자' : authorId),
      authorEmoji: agent?.emoji ?? '👤',
      timestamp: new Date(),
      threadId: options?.threadId,
      mentions: this.parseMentions(content),
      isEntry: options?.isEntry,
      isExit: options?.isExit,
    };
  }

  /**
   * Create a user message
   */
  createUserMessage(content: string, threadId?: string): Message {
    return {
      id: generateId(),
      content,
      authorId: 'user',
      authorName: '사용자',
      authorEmoji: '👤',
      timestamp: new Date(),
      threadId,
      mentions: this.parseMentions(content),
    };
  }
}
