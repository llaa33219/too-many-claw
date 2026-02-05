#!/usr/bin/env node
/**
 * Too Many Claw - Postinstall Script
 * Automatically sets up configuration after npm install
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { AGENT_DEFINITIONS } from '../agents/definitions.js';
import { SOUL_TEMPLATES } from '../agents/souls/index.js';

const OPENCLAW_DIR = path.join(os.homedir(), '.openclaw');

async function postinstall(): Promise<void> {
  console.log('🦀 Too Many Claw - Setting up...\n');

  try {
    // 1. Create ~/.openclaw directory
    await fs.ensureDir(OPENCLAW_DIR);
    console.log('✓ Created ~/.openclaw directory');

    // 2. Create 35 workspace directories with SOUL.md
    for (const agent of AGENT_DEFINITIONS) {
      const workspacePath = path.join(OPENCLAW_DIR, `workspace-${agent.id}`);
      await fs.ensureDir(workspacePath);

      const soulPath = path.join(workspacePath, 'SOUL.md');
      if (!await fs.pathExists(soulPath)) {
        const soulContent = SOUL_TEMPLATES[agent.id] || generateBasicSoul(agent);
        await fs.writeFile(soulPath, soulContent, 'utf-8');
      }
    }
    console.log(`✓ Created ${AGENT_DEFINITIONS.length} workspace directories`);

    // 3. Create or merge openclaw.json
    const openclawPath = path.join(OPENCLAW_DIR, 'openclaw.json');
    await mergeOpenclawConfig(openclawPath);
    console.log('✓ Updated openclaw.json');

    // 4. Create SKILL.md
    const skillPath = path.join(OPENCLAW_DIR, 'skills', 'too-many-claw', 'SKILL.md');
    await fs.ensureDir(path.dirname(skillPath));
    await fs.writeFile(skillPath, generateSkillMd(), 'utf-8');
    console.log('✓ Created SKILL.md');

    // 5. Create default config
    const configPath = path.join(OPENCLAW_DIR, 'too-many-claw.json');
    if (!await fs.pathExists(configPath)) {
      await fs.writeJson(configPath, {
        discord: {},
        webhooks: {},
        simulation: { enabled: false },
      }, { spaces: 2 });
      console.log('✓ Created too-many-claw.json');
    }

    console.log('\n🦀 Too Many Claw setup complete!');
    console.log('\nNext steps:');
    console.log('  1. Run `tmc setup-discord` to configure Discord');
    console.log('  2. Run `tmc simulate` to test locally');
    console.log('  3. Run `tmc start` to start the Discord bot\n');

  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
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

async function mergeOpenclawConfig(configPath: string): Promise<void> {
  let config: Record<string, unknown> = {};

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
  if (!(config.tools as Record<string, unknown>).agentToAgent) {
    (config.tools as Record<string, unknown>).agentToAgent = {
      enabled: true,
      allow: AGENT_DEFINITIONS.map(a => a.id),
    };
  }

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
    }
  }

  (config.agents as Record<string, unknown>).list = agentList;

  await fs.writeJson(configPath, config, { spaces: 2 });
}

function generateSkillMd(): string {
  return `---
name: too-many-claw
description: OpenClaw extension with 35 AI agents that collaborate dynamically
author: Too Many Claw
version: 1.0.0
---

# Too Many Claw

35 specialized AI agents collaborating through Discord.

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

- \`tmc start\` - Start Discord bot
- \`tmc simulate\` - Terminal simulation
- \`tmc status\` - Check agent status
`;
}

// Run postinstall
postinstall().catch(console.error);
