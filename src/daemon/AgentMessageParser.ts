/**
 * Too Many Claw - Agent Message Parser
 * Parses AI responses to identify which agent is speaking in each section.
 * Splits multi-agent responses into separate sections for correct webhook attribution.
 *
 * The key rule: a colon (:) after the agent identifier distinguishes
 * "agent is speaking" from "base mentions an agent".
 *
 *   ✅ "🔍 Search Specialist: results here"  → searcher speaking
 *   ❌ "🔍 검색을 시작하겠습니다"             → base speaking (no colon)
 */

import { AgentDefinition } from '../types/index.js';
import { AGENT_DEFINITIONS } from '../agents/definitions.js';

/** A parsed section attributed to a specific agent */
export interface AgentSection {
  agent: AgentDefinition;
  content: string;
}

/**
 * Parses message content into agent-attributed sections.
 *
 * Supported header patterns (all optionally preceded by "> "):
 *   **E N**: content    — bold emoji + name + colon
 *   [E N]: content      — bracketed emoji + name + colon
 *   E N: content        — plain emoji + name + colon
 *   E: content          — emoji + colon (minimal)
 *
 * Lines without headers are attributed to the current agent (initially defaultAgent).
 * Consecutive same-agent sections are merged.
 */
export class AgentMessageParser {
  private agents: readonly AgentDefinition[];

  constructor() {
    // Sort agents by name length descending so longer names match first
    // (prevents "Base" matching before "Base Developer" if such existed)
    this.agents = [...AGENT_DEFINITIONS].sort((a, b) => b.name.length - a.name.length);
  }

  /**
   * Parse content into agent-attributed sections.
   * Returns an empty array for empty/blank content.
   */
  parse(content: string, defaultAgent: AgentDefinition): AgentSection[] {
    if (!content || !content.trim()) {
      return [];
    }

    const lines = content.split('\n');
    const sections: AgentSection[] = [];
    let currentAgent = defaultAgent;
    let currentLines: string[] = [];
    let inCodeBlock = false;

    for (const line of lines) {
      // Track fenced code blocks — never parse headers inside them
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        currentLines.push(line);
        continue;
      }

      if (inCodeBlock) {
        currentLines.push(line);
        continue;
      }

      const header = this.detectAgentHeader(line);
      if (header) {
        // Flush accumulated lines as a section
        const text = currentLines.join('\n').trim();
        if (text) {
          sections.push({ agent: currentAgent, content: text });
        }
        // Start new section with detected agent
        currentAgent = header.agent;
        currentLines = header.remainingContent ? [header.remainingContent] : [];
      } else {
        currentLines.push(line);
      }
    }

    // Flush final section
    const text = currentLines.join('\n').trim();
    if (text) {
      sections.push({ agent: currentAgent, content: text });
    }

    return this.mergeSections(sections);
  }

  /**
   * Detect if a line starts with a strict agent-speaking header.
   * Returns the matched agent and the remaining content after the colon,
   * or null if no header is detected.
   */
  private detectAgentHeader(rawLine: string): { agent: AgentDefinition; remainingContent: string } | null {
    // Strip blockquote prefix(es): "> ", "> > ", etc.
    let line = rawLine.replace(/^(?:>\s*)+/, '');

    // Quick bail: a colon is required for any header pattern
    if (!line.includes(':')) return null;

    for (const agent of this.agents) {
      const { emoji, name } = agent;

      // Pattern 1: **E N**: content  (bold emoji + name)
      const boldEmojiName = `**${emoji} ${name}**`;
      if (line.startsWith(boldEmojiName)) {
        const rest = line.slice(boldEmojiName.length);
        const colonMatch = rest.match(/^\s*:\s*(.*)/);
        if (colonMatch) {
          return { agent, remainingContent: colonMatch[1].trim() };
        }
      }

      // Pattern 2: [E N]: content  (bracketed)
      const bracketedEmojiName = `[${emoji} ${name}]`;
      if (line.startsWith(bracketedEmojiName)) {
        const rest = line.slice(bracketedEmojiName.length);
        const colonMatch = rest.match(/^\s*:\s*(.*)/);
        if (colonMatch) {
          return { agent, remainingContent: colonMatch[1].trim() };
        }
      }

      // Pattern 3: E N: content  (plain emoji + name + colon)
      const emojiName = `${emoji} ${name}`;
      if (line.startsWith(emojiName)) {
        const rest = line.slice(emojiName.length);
        const colonMatch = rest.match(/^\s*:\s*(.*)/);
        if (colonMatch) {
          return { agent, remainingContent: colonMatch[1].trim() };
        }
      }

      // Pattern 4: **N**: content  (bold name only, no emoji)
      // Only match multi-word names to prevent false positives ("**Base**:" is too common in markdown)
      if (name.includes(' ')) {
        const boldName = `**${name}**`;
        if (line.startsWith(boldName)) {
          const rest = line.slice(boldName.length);
          const colonMatch = rest.match(/^\s*:\s*(.*)/);
          if (colonMatch) {
            return { agent, remainingContent: colonMatch[1].trim() };
          }
        }
      }

      // Pattern 5: E: content  (emoji-only + colon, minimal but explicit)
      if (line.startsWith(emoji)) {
        const rest = line.slice(emoji.length);
        const colonMatch = rest.match(/^\s*:\s*(.*)/);
        if (colonMatch) {
          return { agent, remainingContent: colonMatch[1].trim() };
        }
      }
    }

    return null;
  }

  /**
   * Merge consecutive sections attributed to the same agent.
   * Prevents sending multiple small webhook messages for one agent's continuous speech.
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
