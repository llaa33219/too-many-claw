/**
 * Too Many Claw - Agent Mapper
 * Maps OpenClaw agent identifiers to TMC agent definitions
 */

import { AgentDefinition } from '../types/index.js';
import { AGENT_DEFINITIONS, getAgentById } from '../agents/definitions.js';

/**
 * Maps OpenClaw agent identifiers to TMC agent definitions
 * Handles various naming conventions and fuzzy matching
 */
export class AgentMapper {
  private idMap: Map<string, AgentDefinition> = new Map();
  private nameMap: Map<string, AgentDefinition> = new Map();
  private aliasMap: Map<string, AgentDefinition> = new Map();

  constructor() {
    this.buildMaps();
  }

  /**
   * Build lookup maps for efficient agent resolution
   */
  private buildMaps(): void {
    for (const agent of AGENT_DEFINITIONS) {
      // Map by ID (exact)
      this.idMap.set(agent.id, agent);
      this.idMap.set(agent.id.toLowerCase(), agent);
      
      // Map by name (normalized)
      const normalizedName = this.normalizeName(agent.name);
      this.nameMap.set(normalizedName, agent);
      
      // Map by OpenClaw agent name format: "emoji name" (e.g., "🏠 Base")
      const openClawName = `${agent.emoji} ${agent.name}`.toLowerCase();
      this.nameMap.set(openClawName, agent);
      this.nameMap.set(this.normalizeName(openClawName), agent);
      
      // Also map just the emoji
      this.aliasMap.set(agent.emoji, agent);
      
      // Common aliases and variations
      this.buildAliases(agent);
    }
  }

  /**
   * Build common aliases for an agent
   */
  private buildAliases(agent: AgentDefinition): void {
    const { id, name } = agent;
    
    // Snake_case version
    this.aliasMap.set(id.replace(/-/g, '_'), agent);
    
    // CamelCase version
    const camelCase = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    this.aliasMap.set(camelCase, agent);
    this.aliasMap.set(camelCase.toLowerCase(), agent);
    
    // Name without spaces
    this.aliasMap.set(name.replace(/\s+/g, '').toLowerCase(), agent);
    
    // Name with underscores
    this.aliasMap.set(name.replace(/\s+/g, '_').toLowerCase(), agent);
    
    // Special cases for common agent names
    const specialAliases: Record<string, string[]> = {
      'base': ['coordinator', 'main', 'primary', 'default', 'openclaw', 'assistant'],
      'backend-dev': ['backend', 'server', 'api'],
      'frontend-dev': ['frontend', 'ui', 'web'],
      'code-reviewer': ['reviewer', 'review'],
      'program-tester': ['tester', 'qa', 'testing'],
      'security-checker': ['security', 'securitycheck'],
      'vuln-finder': ['vulnerability', 'vulnscanner'],
      'tech-researcher': ['researcher', 'research'],
      'doc-writer': ['documentation', 'docs', 'writer'],
      'prompt-engineer': ['prompter', 'prompt'],
      'ai-illustrator': ['illustrator', 'artist', 'image'],
      'user-psychologist': ['psychologist', 'psychology'],
      'fact-bomber': ['factcheck', 'factchecker'],
      'dirty-worker': ['worker', 'grunt'],
    };
    
    if (specialAliases[id]) {
      for (const alias of specialAliases[id]) {
        this.aliasMap.set(alias, agent);
      }
    }
  }

  /**
   * Normalize a name for comparison
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Resolve an OpenClaw agent identifier to a TMC agent
   * Tries multiple matching strategies
   */
  resolve(identifier: string | undefined | null): AgentDefinition | null {
    if (!identifier) {
      return this.getDefaultAgent();
    }

    // Clean up the identifier - remove leading emoji if present
    let cleanIdentifier = identifier.trim();
    
    // Check if identifier starts with an emoji - extract just the emoji for lookup
    const emojiMatch = cleanIdentifier.match(/^([\p{Emoji}])\s*/u);
    if (emojiMatch) {
      const emoji = emojiMatch[1];
      const byEmoji = this.aliasMap.get(emoji);
      if (byEmoji) return byEmoji;
    }

    const normalized = cleanIdentifier.toLowerCase().trim();

    // Try exact ID match
    const byId = this.idMap.get(normalized);
    if (byId) return byId;

    // Try OpenClaw format match ("emoji name")
    const byOpenClawName = this.nameMap.get(normalized);
    if (byOpenClawName) return byOpenClawName;

    // Try name match (normalized - removes all non-alphanumeric)
    const byName = this.nameMap.get(this.normalizeName(identifier));
    if (byName) return byName;

    // Try alias match
    const byAlias = this.aliasMap.get(normalized);
    if (byAlias) return byAlias;

    // Try partial matching
    const partial = this.partialMatch(normalized);
    if (partial) return partial;

    // Fallback to default agent (base)
    return this.getDefaultAgent();
  }

  /**
   * Try partial/fuzzy matching
   */
  private partialMatch(query: string): AgentDefinition | null {
    // Check if query is contained in any agent ID
    for (const agent of AGENT_DEFINITIONS) {
      if (agent.id.includes(query) || query.includes(agent.id)) {
        return agent;
      }
    }

    // Check if query is contained in any agent name
    const normalizedQuery = this.normalizeName(query);
    for (const agent of AGENT_DEFINITIONS) {
      const normalizedAgentName = this.normalizeName(agent.name);
      if (normalizedAgentName.includes(normalizedQuery) || normalizedQuery.includes(normalizedAgentName)) {
        return agent;
      }
    }

    return null;
  }

  /**
   * Get the default agent (base/coordinator)
   */
  getDefaultAgent(): AgentDefinition {
    return getAgentById('base') || AGENT_DEFINITIONS[0];
  }

  /**
   * Check if an identifier maps to a known agent
   */
  isKnownAgent(identifier: string): boolean {
    return this.resolve(identifier) !== null;
  }

  /**
   * Get all registered agent IDs
   */
  getAllAgentIds(): string[] {
    return AGENT_DEFINITIONS.map(a => a.id);
  }
}
