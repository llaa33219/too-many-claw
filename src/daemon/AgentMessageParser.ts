/**
 * Too Many Claw - Agent Message Parser
 * Parses AI responses to identify which agent is speaking using XML-style tags.
 *
 * Agents wrap their responses in <agentId>content</agentId> tags:
 *   <base>안녕하세요!</base>
 *   <searcher>검색 결과입니다...</searcher>
 *
 * Tags are stripped before forwarding to Discord webhooks.
 */

import { AgentDefinition } from '../types/index.js';
import { AGENT_DEFINITIONS } from '../agents/definitions.js';

/** A parsed section attributed to a specific agent */
export interface AgentSection {
  agent: AgentDefinition;
  content: string;
}

/**
 * Parses message content into agent-attributed sections using XML-style tags.
 *
 * - <agentId>content</agentId> → attributed to that agent
 * - Untagged content → attributed to defaultAgent
 * - No tags found → entire content attributed to defaultAgent (backward compat)
 * - Consecutive same-agent sections are merged
 */
export class AgentMessageParser {
  private agentById: Map<string, AgentDefinition>;

  constructor() {
    this.agentById = new Map();
    for (const agent of AGENT_DEFINITIONS) {
      this.agentById.set(agent.id, agent);
    }
  }

  /**
   * Parse content into agent-attributed sections.
   * Returns an empty array for empty/blank content.
   */
  parse(content: string, defaultAgent: AgentDefinition): AgentSection[] {
    if (!content || !content.trim()) {
      return [];
    }

    const tagPattern = /<([a-z][a-z0-9-]*)>([\s\S]*?)<\/\1>/gi;
    const sections: AgentSection[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tagPattern.exec(content)) !== null) {
      // Untagged text before this tag → default agent
      if (match.index > lastIndex) {
        const before = content.slice(lastIndex, match.index).trim();
        if (before) {
          sections.push({ agent: defaultAgent, content: before });
        }
      }

      const tagName = match[1].toLowerCase();
      const tagContent = match[2].trim();
      const agent = this.agentById.get(tagName);

      if (tagContent) {
        sections.push({
          agent: agent || defaultAgent,
          content: tagContent,
        });
      }

      lastIndex = match.index + match[0].length;
    }

    // Untagged text after last tag → default agent
    if (lastIndex < content.length) {
      const after = content.slice(lastIndex).trim();
      if (after) {
        sections.push({ agent: defaultAgent, content: after });
      }
    }

    // No tags found → entire content goes to default agent
    if (sections.length === 0) {
      return [{ agent: defaultAgent, content: content.trim() }];
    }

    return this.mergeSections(sections);
  }

  /**
   * Merge consecutive sections attributed to the same agent.
   */
  private mergeSections(sections: AgentSection[]): AgentSection[] {
    if (sections.length <= 1) return sections;

    const merged: AgentSection[] = [];
    let current = sections[0];

    for (let i = 1; i < sections.length; i++) {
      if (sections[i].agent.id === current.agent.id) {
        current = {
          agent: current.agent,
          content: current.content + '\n\n' + sections[i].content,
        };
      } else {
        merged.push(current);
        current = sections[i];
      }
    }
    merged.push(current);

    return merged;
  }
}
