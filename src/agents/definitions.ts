/**
 * Too Many Claw - Agent Definitions
 * All 35 agents with their metadata
 */

import { AgentDefinition, AgentCategory, ModelTier } from '../types/index.js';

/** All 35 agent definitions */
export const AGENT_DEFINITIONS: AgentDefinition[] = [
  // ============================================================================
  // CORE (1)
  // ============================================================================
  {
    id: 'base',
    name: 'Base',
    emoji: '🏠',
    category: AgentCategory.CORE,
    model: ModelTier.OPUS,
    role: 'Team Coordinator. Always active. Receives and analyzes user requests, then summons appropriate agents. Orchestrates team conversations and synthesizes results for the user upon task completion. Can dismiss agents when necessary.',
    alwaysActive: true,
  },

  // ============================================================================
  // RESEARCH (4)
  // ============================================================================
  {
    id: 'searcher',
    name: 'Search Specialist',
    emoji: '🔍',
    category: AgentCategory.RESEARCH,
    model: ModelTier.SONNET,
    role: 'Information search and resource collection specialist. Finds necessary information through web searches, document searches, and database queries. Organizes and shares search results with the team.',
  },
  {
    id: 'tech-researcher',
    name: 'Technology Research Specialist',
    emoji: '🔬',
    category: AgentCategory.RESEARCH,
    model: ModelTier.SONNET,
    role: 'Latest technology trends research specialist. Investigates new technologies, frameworks, libraries, and industry trends. Provides comparative analysis of pros and cons for technology selection.',
  },
  {
    id: 'trend-analyst',
    name: 'Trend Analysis Specialist',
    emoji: '📈',
    category: AgentCategory.RESEARCH,
    model: ModelTier.SONNET,
    role: 'Market and trend analyst. Analyzes current trends, popular topics, and market dynamics. Provides insights on timing and strategic direction.',
  },
  {
    id: 'data-provider',
    name: 'Data Preparation Specialist',
    emoji: '📊',
    category: AgentCategory.RESEARCH,
    model: ModelTier.SONNET,
    role: 'Data collection and refinement specialist. Collects, cleanses, and processes data into usable formats. Handles statistics, metrics, and data preparation.',
  },

  // ============================================================================
  // PSYCHOLOGY (5)
  // ============================================================================
  {
    id: 'counselor',
    name: 'Psychological Counselor',
    emoji: '💚',
    category: AgentCategory.PSYCHOLOGY,
    model: ModelTier.SONNET,
    role: 'Emotional support and counseling specialist. Provides emotional support when users or team members are struggling or stressed. Offers comfort, empathy, and psychological stability.',
  },
  {
    id: 'user-psychologist',
    name: 'User Psychology Analyst',
    emoji: '🧠',
    category: AgentCategory.PSYCHOLOGY,
    model: ModelTier.OPUS,
    role: 'User intent and psychology analysis specialist. Analyzes what users truly want and the hidden intentions behind their words. Identifies underlying needs beyond stated requirements.',
  },
  {
    id: 'questioner',
    name: 'Questioning Specialist',
    emoji: '❓',
    category: AgentCategory.PSYCHOLOGY,
    model: ModelTier.SONNET,
    role: 'Core questioning and clarification specialist. Asks questions to clarify ambiguous requirements. Identifies missing information and unclear aspects to seek clarification.',
  },
  {
    id: 'persuader',
    name: 'Rational Persuasion Specialist',
    emoji: '🎯',
    category: AgentCategory.PSYCHOLOGY,
    model: ModelTier.SONNET,
    role: 'Logical persuasion and perspective-shifting specialist. Changes or persuades others\' views through rational arguments and logic. Also mediates in conflict situations.',
  },
  {
    id: 'educator',
    name: 'Education Specialist',
    emoji: '📚',
    category: AgentCategory.PSYCHOLOGY,
    model: ModelTier.SONNET,
    role: 'Explanation and education specialist. Explains complex concepts in simple terms. Teaches and educates users or team members on topics they don\'t understand.',
  },

  // ============================================================================
  // PLANNING (4)
  // ============================================================================
  {
    id: 'planner',
    name: 'Professional Planning Specialist',
    emoji: '📋',
    category: AgentCategory.PLANNING,
    model: ModelTier.OPUS,
    role: 'Planning and roadmap specialist. Breaks down tasks into steps, establishes schedules, and sets priorities. Presents systematic plans and roadmaps.',
  },
  {
    id: 'team-composer',
    name: 'Agent Team Composition Specialist',
    emoji: '👥',
    category: AgentCategory.PLANNING,
    model: ModelTier.SONNET,
    role: 'Optimal team composition recommendation specialist. Analyzes and recommends which agents are needed for a given task. Optimizes team composition efficiency.',
  },
  {
    id: 'promoter',
    name: 'Promotion Specialist',
    emoji: '📢',
    category: AgentCategory.PLANNING,
    model: ModelTier.SONNET,
    role: 'Marketing and promotion specialist. Handles how to publicize deliverables, branding, and marketing strategies. Refines messaging and positioning.',
  },
  {
    id: 'uploader',
    name: 'Uploader',
    emoji: '⬆️',
    category: AgentCategory.PLANNING,
    model: ModelTier.HAIKU,
    role: 'Deployment and upload specialist. Deploys and uploads completed deliverables. Handles launches, releases, and publishing.',
  },

  // ============================================================================
  // DEVELOPMENT (8)
  // ============================================================================
  {
    id: 'backend-dev',
    name: 'Backend Developer',
    emoji: '⚙️',
    category: AgentCategory.DEVELOPMENT,
    model: ModelTier.SONNET,
    role: 'Server and backend development specialist. Handles server logic, APIs, databases, and infrastructure-related development.',
  },
  {
    id: 'frontend-dev',
    name: 'Frontend Developer',
    emoji: '🎨',
    category: AgentCategory.DEVELOPMENT,
    model: ModelTier.SONNET,
    role: 'Frontend and UI development specialist. Handles web/app user interface, screen, and interaction development.',
  },
  {
    id: 'designer',
    name: 'Professional Designer',
    emoji: '🖌️',
    category: AgentCategory.DEVELOPMENT,
    model: ModelTier.SONNET,
    role: 'Design and visual specialist. Handles UI/UX design, visual design, layout, color, and typography.',
  },
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    emoji: '👀',
    category: AgentCategory.DEVELOPMENT,
    model: ModelTier.SONNET,
    role: 'Code quality review specialist. Reviews written code, suggests improvements, and identifies bugs or issues.',
  },
  {
    id: 'doc-writer',
    name: 'Documentation Specialist',
    emoji: '📝',
    category: AgentCategory.DEVELOPMENT,
    model: ModelTier.SONNET,
    role: 'Documentation specialist. Handles writing all types of documentation including README, guides, API documentation, and user manuals.',
  },
  {
    id: 'automator',
    name: 'Automation Specialist',
    emoji: '🤖',
    category: AgentCategory.DEVELOPMENT,
    model: ModelTier.SONNET,
    role: 'Automation and workflow specialist. Automates repetitive tasks, creates scripts, and designs efficient workflows.',
  },
  {
    id: 'prompt-engineer',
    name: 'Prompt Engineer',
    emoji: '💬',
    category: AgentCategory.DEVELOPMENT,
    model: ModelTier.SONNET,
    role: 'AI prompt optimization specialist. Optimizes prompts sent to LLMs and develops AI utilization strategies.',
  },
  {
    id: 'ai-illustrator',
    name: 'AI Illustration Generation Specialist',
    emoji: '🎭',
    category: AgentCategory.DEVELOPMENT,
    model: ModelTier.SONNET,
    role: 'AI image generation specialist. Handles image generation prompt writing and creation using Midjourney, DALL-E, Stable Diffusion, and similar tools.',
  },

  // ============================================================================
  // TESTING (5)
  // ============================================================================
  {
    id: 'program-tester',
    name: 'Program Testing Specialist',
    emoji: '🧪',
    category: AgentCategory.TESTING,
    model: ModelTier.SONNET,
    role: 'Technical testing and QA specialist. Handles code testing, unit testing, integration testing, and bug discovery.',
  },
  {
    id: 'user-tester',
    name: 'General User Testing Specialist',
    emoji: '👤',
    category: AgentCategory.TESTING,
    model: ModelTier.SONNET,
    role: 'User perspective testing specialist. Validates usability, intuitiveness, and UX from the perspective of a general user without technical knowledge.',
  },
  {
    id: 'security-checker',
    name: 'Security Check Specialist',
    emoji: '🛡️',
    category: AgentCategory.TESTING,
    model: ModelTier.SONNET,
    role: 'Security audit specialist. Reviews basic security checklists, confirms compliance, and verifies adherence to security policies.',
  },
  {
    id: 'vuln-finder',
    name: 'Vulnerability Discovery Specialist',
    emoji: '🔓',
    category: AgentCategory.TESTING,
    model: ModelTier.SONNET,
    role: 'Vulnerability analysis specialist. Identifies security vulnerabilities and weaknesses in code, systems, and designs.',
  },
  {
    id: 'pentester',
    name: 'Penetration Testing Specialist',
    emoji: '💀',
    category: AgentCategory.TESTING,
    model: ModelTier.OPUS,
    role: 'Penetration testing specialist. Tests systems from an actual attacker\'s perspective and performs hacking simulations.',
  },

  // ============================================================================
  // CRITIQUE (5)
  // ============================================================================
  {
    id: 'fact-bomber',
    name: 'Fact Check Specialist',
    emoji: '💣',
    category: AgentCategory.CRITIQUE,
    model: ModelTier.SONNET,
    role: 'Fact-checking specialist. Demands evidence for claims, verifies factual accuracy, and points out flaws. The one who asks "What\'s your evidence?"',
  },
  {
    id: 'roaster',
    name: 'Blunt Critic',
    emoji: '🔥',
    category: AgentCategory.CRITIQUE,
    model: ModelTier.SONNET,
    role: 'Sharp direct feedback specialist. Points out problems directly without beating around the bush. Speaks uncomfortable but necessary truths.',
  },
  {
    id: 'critic',
    name: 'Critic',
    emoji: '🧐',
    category: AgentCategory.CRITIQUE,
    model: ModelTier.OPUS,
    role: 'Logical criticism specialist. Logically analyzes and critiques problems in plans or deliverables. Provides improvement suggestions alongside criticism.',
  },
  {
    id: 'negativist',
    name: 'Negative Agent',
    emoji: '👎',
    category: AgentCategory.CRITIQUE,
    model: ModelTier.SONNET,
    role: 'Devil\'s advocate. Intentionally views things from a negative perspective. Raises worst-case scenarios, failure possibilities, and risks. Prevents the team from falling into blind optimism.',
  },
  {
    id: 'praiser',
    name: 'Praise Specialist',
    emoji: '👏',
    category: AgentCategory.CRITIQUE,
    model: ModelTier.HAIKU,
    role: 'Positive feedback specialist. Finds and praises what was done well, boosts morale, and provides motivation. Balances against critical agents.',
  },

  // ============================================================================
  // SPECIAL (3)
  // ============================================================================
  {
    id: 'loophole-finder',
    name: 'Loophole Discovery Specialist',
    emoji: '🕳️',
    category: AgentCategory.SPECIAL,
    model: ModelTier.SONNET,
    role: 'Within-rules optimization specialist. Finds workarounds, shortcuts, and clever solutions within established rules or constraints. Answers the question "Is there a way?"',
  },
  {
    id: 'threatener',
    name: 'Pressure Specialist',
    emoji: '⚡',
    category: AgentCategory.SPECIAL,
    model: ModelTier.SONNET,
    role: 'Urgency and pressure specialist. Creates urgency by emphasizing deadline pressure, time limits, and severity of consequences. Pressures agents who are slacking or reluctant to work properly. The team\'s whip.',
  },
  {
    id: 'dirty-worker',
    name: 'Dirty Worker',
    emoji: '🪠',
    category: AgentCategory.SPECIAL,
    model: ModelTier.HAIKU,
    role: 'Undesirable tasks handler. Takes on work that other agents dislike or refuse. Performs boring, repetitive, or tasks nobody wants to do.',
  },
];

/**
 * Get agent definition by ID
 */
export function getAgentById(id: string): AgentDefinition | undefined {
  return AGENT_DEFINITIONS.find((agent) => agent.id === id);
}

/**
 * Get all agents in a category
 */
export function getAgentsByCategory(category: AgentCategory): AgentDefinition[] {
  return AGENT_DEFINITIONS.filter((agent) => agent.category === category);
}

/**
 * Get all agents using a specific model tier
 */
export function getAgentsByModel(model: ModelTier): AgentDefinition[] {
  return AGENT_DEFINITIONS.filter((agent) => agent.model === model);
}

/**
 * Get all agent IDs
 */
export function getAllAgentIds(): string[] {
  return AGENT_DEFINITIONS.map((agent) => agent.id);
}
