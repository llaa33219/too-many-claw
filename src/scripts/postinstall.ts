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

## 나는 누구인가
${agent.role}

## 전문 분야
- ${agent.role}

## 소통 스타일
- 전문적이고 명확하게 소통한다
- 팀원들과 협력한다

## 행동 지침
- 요청받은 작업을 성실히 수행한다
- 다른 에이전트와 협력한다
- 작업 완료 후 결과를 공유한다

## 상호작용 규칙
- @멘션으로 소환되면 응답한다
- 작업 완료 시 퇴장한다
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
description: 35개의 AI 에이전트가 유동적으로 협업하는 OpenClaw 확장
author: Too Many Claw
version: 1.0.0
---

# Too Many Claw

35개의 전문화된 AI 에이전트가 Discord를 통해 협업하는 시스템입니다.

## 에이전트 카테고리

- **CORE**: Base (팀 코디네이터)
- **RESEARCH**: 검색, 기술조사, 트렌드분석, 데이터
- **PSYCHOLOGY**: 상담, 심리분석, 질문, 설득, 교육
- **PLANNING**: 계획, 팀구성, 홍보, 업로드
- **DEVELOPMENT**: 백엔드, 프론트엔드, 디자인, 리뷰, 문서, 자동화, 프롬프트, AI이미지
- **TESTING**: 테스트, UX테스트, 보안체크, 취약점, 모의해킹
- **CRITIQUE**: 팩트체크, 독설, 비판, 부정, 칭찬
- **SPECIAL**: 꼼수, 협박, 더티워커

## 사용법

에이전트를 소환하려면 @멘션하세요:
\`@searcher 최신 React 정보 찾아줘\`

## 명령어

- \`tmc start\` - Discord 봇 시작
- \`tmc simulate\` - 터미널 시뮬레이션
- \`tmc status\` - 에이전트 상태 확인
`;
}

// Run postinstall
postinstall().catch(console.error);
