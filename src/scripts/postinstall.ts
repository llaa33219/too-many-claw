#!/usr/bin/env node
/**
 * Too Many Claw - Postinstall Script
 * Automatically sets up configuration after npm install
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { AGENT_DEFINITIONS } from '../agents/definitions.js';
import { getSoulTemplate } from '../agents/souls/index.js';

const OPENCLAW_DIR = path.join(os.homedir(), '.openclaw');

/**
 * Result of agent registration
 */
export interface AgentRegistrationResult {
  success: boolean;
  totalAgents: number;
  newlyAdded: string[];
  alreadyExisted: string[];
  workspacesCreated: number;
  error?: string;
}

async function postinstall(): Promise<void> {
  console.log('🦀 Too Many Claw - Setting up...\n');

  const result = await registerTmcAgents();

  if (!result.success) {
    console.error('Setup failed:', result.error);
    process.exit(1);
  }

  console.log('✓ Created ~/.openclaw directory');
  console.log(`✓ Created ${result.totalAgents} workspace directories`);
  
  if (result.newlyAdded.length > 0) {
    console.log(`✓ Added ${result.newlyAdded.length} agents to openclaw.json`);
  } else {
    console.log('✓ All agents already registered in openclaw.json');
  }
  
  console.log('✓ Created SKILL.md');

  console.log('\n🦀 Too Many Claw setup complete!');
  console.log('\nNext steps:');
  console.log('  1. Run `tmc setup` to register agents');
  console.log('  2. Run `tmc agents` to list all agents\n');
}

function generateBasicSoul(agent: typeof AGENT_DEFINITIONS[0]): string {
  return `# ${agent.emoji} ${agent.name}

## Who I Am
${agent.role}

## Expertise
- ${agent.role}

## Communication Style
- Communicate professionally and clearly
- Collaborate with team members

## Behavioral Guidelines
- Diligently perform requested tasks
- Cooperate with other agents
- Share results after completing work

## Interaction Rules
- Respond when summoned via @mention
- Exit when work is complete
`;
}

/**
 * Merge TMC agents into OpenClaw configuration
 */
async function mergeOpenclawConfig(configPath: string): Promise<{ newlyAdded: string[]; alreadyExisted: string[] }> {
  let config: Record<string, unknown> = {};
  const newlyAdded: string[] = [];
  const alreadyExisted: string[] = [];

  // Backup existing config
  if (await fs.pathExists(configPath)) {
    config = await fs.readJson(configPath);
    const backupPath = configPath + '.backup';
    await fs.copy(configPath, backupPath);
  }

  // Ensure structure
  if (!config.tools) {
    config.tools = {};
  }
  
  // Always update agentToAgent.allow to include all TMC agents
  (config.tools as Record<string, unknown>).agentToAgent = {
    enabled: ((config.tools as Record<string, unknown>).agentToAgent as Record<string, unknown>)?.enabled ?? true,
    allow: AGENT_DEFINITIONS.map(a => a.id),
  };

  if (!config.agents) {
    config.agents = { list: [] };
  }

  const agentList = (config.agents as Record<string, unknown[]>).list || [];
  const existingIds = new Set(agentList.map((a: unknown) => (a as Record<string, string>).id));

  // Add missing agents
  for (const agent of AGENT_DEFINITIONS) {
    if (!existingIds.has(agent.id)) {
      agentList.push({
        id: agent.id,
        name: `${agent.emoji} ${agent.name}`,
        model: agent.model,
        workspace: `~/.openclaw/workspace-${agent.id}`,
        subagents: {
          allowAgents: ['*'],
        },
      });
      newlyAdded.push(agent.id);
    } else {
      alreadyExisted.push(agent.id);
    }
  }

  (config.agents as Record<string, unknown>).list = agentList;

  await fs.writeJson(configPath, config, { spaces: 2 });
  
  return { newlyAdded, alreadyExisted };
}

/**
 * Register TMC agents to OpenClaw configuration
 * Creates workspace directories and adds agents to openclaw.json
 */
export async function registerTmcAgents(): Promise<AgentRegistrationResult> {
  const result: AgentRegistrationResult = {
    success: false,
    totalAgents: AGENT_DEFINITIONS.length,
    newlyAdded: [],
    alreadyExisted: [],
    workspacesCreated: 0,
  };

  try {
    // 1. Ensure ~/.openclaw directory exists
    await fs.ensureDir(OPENCLAW_DIR);

    // 2. Create workspace directories with SOUL.md
    for (const agent of AGENT_DEFINITIONS) {
      const workspacePath = path.join(OPENCLAW_DIR, `workspace-${agent.id}`);
      const existed = await fs.pathExists(workspacePath);
      await fs.ensureDir(workspacePath);

      const soulPath = path.join(workspacePath, 'SOUL.md');
      const soulContent = getSoulTemplate(agent.id) || generateBasicSoul(agent);
      await fs.writeFile(soulPath, soulContent, 'utf-8');
      if (!existed) {
        result.workspacesCreated++;
      }
    }

    // 3. Merge agents into openclaw.json
    const openclawPath = path.join(OPENCLAW_DIR, 'openclaw.json');
    const mergeResult = await mergeOpenclawConfig(openclawPath);
    result.newlyAdded = mergeResult.newlyAdded;
    result.alreadyExisted = mergeResult.alreadyExisted;

    // 4. Create SKILL.md
    const skillPath = path.join(OPENCLAW_DIR, 'skills', 'too-many-claw', 'SKILL.md');
    await fs.ensureDir(path.dirname(skillPath));
    await fs.writeFile(skillPath, generateSkillMd(), 'utf-8');

    result.success = true;
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
  }

  return result;
}

function generateSkillMd(): string {
  return `---
name: too-many-claw
description: OpenClaw extension with 35 AI agents that collaborate dynamically
author: Too Many Claw
version: 1.0.0
---

# Too Many Claw

35 specialized AI agents collaborating through OpenClaw.

## Agent Categories

- **CORE**: Base (Team Coordinator)
- **RESEARCH**: Search, Tech Research, Trend Analysis, Data
- **PSYCHOLOGY**: Counseling, User Psychology, Questions, Persuasion, Education
- **PLANNING**: Planning, Team Composition, Promotion, Upload
- **DEVELOPMENT**: Backend, Frontend, Design, Review, Docs, Automation, Prompts, AI Images
- **TESTING**: Testing, UX Testing, Security Check, Vulnerabilities, Pentesting
- **CRITIQUE**: Fact Check, Blunt Critic, Critic, Negative, Praise
- **SPECIAL**: Loopholes, Pressure, Dirty Worker

## Usage

Summon an agent with @mention:
\`@searcher Find the latest React information\`

## Commands

- \`tmc setup\` - Register agents to OpenClaw
- \`tmc agents\` - List all agents
- \`tmc status\` - Check agent status
`;
}

// Run postinstall
postinstall().catch(console.error);
