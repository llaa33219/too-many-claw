/**
 * TMC Agent definitions for webhook delivery
 */

export interface AgentInfo {
  id: string;
  name: string;
  emoji: string;
}

/**
 * All TMC agents with their metadata
 */
export const AGENTS: AgentInfo[] = [
  { id: 'base', name: 'Base', emoji: '🏠' },
  { id: 'searcher', name: 'Search Specialist', emoji: '🔍' },
  { id: 'tech-researcher', name: 'Technology Research Specialist', emoji: '🔬' },
  { id: 'trend-analyst', name: 'Trend Analysis Specialist', emoji: '📈' },
  { id: 'data-provider', name: 'Data Preparation Specialist', emoji: '📊' },
  { id: 'counselor', name: 'Psychological Counselor', emoji: '💚' },
  { id: 'user-psychologist', name: 'User Psychology Analyst', emoji: '🧠' },
  { id: 'questioner', name: 'Questioning Specialist', emoji: '❓' },
  { id: 'persuader', name: 'Rational Persuasion Specialist', emoji: '🎯' },
  { id: 'educator', name: 'Education Specialist', emoji: '📚' },
  { id: 'planner', name: 'Professional Planning Specialist', emoji: '📋' },
  { id: 'team-composer', name: 'Agent Team Composition Specialist', emoji: '👥' },
  { id: 'promoter', name: 'Promotion Specialist', emoji: '📢' },
  { id: 'uploader', name: 'Uploader', emoji: '⬆️' },
  { id: 'backend-dev', name: 'Backend Developer', emoji: '⚙️' },
  { id: 'frontend-dev', name: 'Frontend Developer', emoji: '🎨' },
  { id: 'designer', name: 'Professional Designer', emoji: '🖌️' },
  { id: 'code-reviewer', name: 'Code Reviewer', emoji: '👀' },
  { id: 'doc-writer', name: 'Documentation Specialist', emoji: '📝' },
  { id: 'automator', name: 'Automation Specialist', emoji: '🤖' },
  { id: 'prompt-engineer', name: 'Prompt Engineer', emoji: '💬' },
  { id: 'ai-illustrator', name: 'AI Illustration Generation Specialist', emoji: '🎭' },
  { id: 'program-tester', name: 'Program Testing Specialist', emoji: '🧪' },
  { id: 'user-tester', name: 'General User Testing Specialist', emoji: '👤' },
  { id: 'security-checker', name: 'Security Check Specialist', emoji: '🛡️' },
  { id: 'vuln-finder', name: 'Vulnerability Discovery Specialist', emoji: '🔓' },
  { id: 'pentester', name: 'Penetration Testing Specialist', emoji: '💀' },
  { id: 'fact-bomber', name: 'Fact Check Specialist', emoji: '💣' },
  { id: 'roaster', name: 'Blunt Critic', emoji: '🔥' },
  { id: 'critic', name: 'Critic', emoji: '🧐' },
  { id: 'negativist', name: 'Negative Agent', emoji: '👎' },
  { id: 'praiser', name: 'Praise Specialist', emoji: '👏' },
  { id: 'loophole-finder', name: 'Loophole Discovery Specialist', emoji: '🕳️' },
  { id: 'threatener', name: 'Pressure Specialist', emoji: '⚡' },
  { id: 'dirty-worker', name: 'Dirty Worker', emoji: '🪠' },
];

/**
 * Default agent when no specific agent is detected
 */
export const DEFAULT_AGENT: AgentInfo = { id: 'base', name: 'Base', emoji: '🏠' };

/**
 * Get agent by ID
 */
export function getAgentById(id: string): AgentInfo | undefined {
  return AGENTS.find(a => a.id === id);
}

/**
 * Get agent by emoji
 */
export function getAgentByEmoji(emoji: string): AgentInfo | undefined {
  return AGENTS.find(a => a.emoji === emoji);
}

/**
 * Try to extract agent from message text
 * TMC agents typically prefix their messages with "emoji Name: "
 */
export function extractAgentFromText(text: string): AgentInfo | undefined {
  // Try to match "emoji Name:" pattern at start of text
  const match = text.match(/^([\p{Emoji}])\s+([^:]+):/u);
  if (match) {
    const emoji = match[1];
    const agent = getAgentByEmoji(emoji);
    if (agent) {
      return agent;
    }
  }
  
  // Try to match just emoji at start
  const emojiMatch = text.match(/^([\p{Emoji}])/u);
  if (emojiMatch) {
    const agent = getAgentByEmoji(emojiMatch[1]);
    if (agent) {
      return agent;
    }
  }
  
  return undefined;
}

/**
 * Convert emoji to Twemoji CDN URL for avatar
 */
export function getEmojiAvatarUrl(emoji: string): string {
  try {
    const codePoints = [...emoji]
      .map(char => char.codePointAt(0)?.toString(16).toLowerCase())
      .filter(Boolean)
      .join('-');
    
    if (codePoints) {
      return `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/${codePoints}.png`;
    }
  } catch {
    // Fall through to placeholder
  }
  
  return 'https://cdn.discordapp.com/embed/avatars/0.png';
}
