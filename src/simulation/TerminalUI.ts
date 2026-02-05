/**
 * Too Many Claw - Terminal UI
 * Interactive terminal interface for simulation
 */

import chalk from 'chalk';
import * as readline from 'readline';
import { Orchestrator } from '../core/Orchestrator.js';
import { TerminalAdapter } from './TerminalAdapter.js';
import { AGENT_DEFINITIONS, getAgentById } from '../agents/definitions.js';

export class TerminalUI {
  private adapter: TerminalAdapter;
  private orchestrator: Orchestrator;
  private rl: readline.Interface;
  private isRunning = false;

  constructor() {
    this.adapter = new TerminalAdapter();
    this.orchestrator = new Orchestrator(this.adapter);
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Start the terminal UI
   */
  async start(): Promise<void> {
    this.isRunning = true;
    this.printWelcome();
    this.printHelp();

    // Set up message handler
    this.adapter.onMessage((message) => {
      this.orchestrator.handleUserMessage(message);
    });

    // Main input loop
    await this.inputLoop();
  }

  /**
   * Stop the terminal UI
   */
  stop(): void {
    this.isRunning = false;
    this.rl.close();
    console.log(chalk.yellow('\n👋 Too Many Claw 시뮬레이션을 종료합니다.\n'));
  }

  private printWelcome(): void {
    console.log(chalk.cyan(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🦀 Too Many Claw - 터미널 시뮬레이션                      ║
║                                                            ║
║   35개의 AI 에이전트가 협업하는 시스템                       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`));
  }

  private printHelp(): void {
    console.log(chalk.gray(`
명령어:
  /help          - 도움말 표시
  /status        - 활성 에이전트 목록
  /agents        - 전체 에이전트 목록
  /summon @agent - 에이전트 소환
  /dismiss @agent - 에이전트 퇴장
  /clear         - 화면 지우기
  /quit          - 종료

메시지에 @agent-id를 포함하면 해당 에이전트가 소환됩니다.
예: @searcher 최신 React 정보 찾아줘
`));
  }

  private async inputLoop(): Promise<void> {
    while (this.isRunning) {
      const input = await this.prompt();
      if (!input) continue;

      await this.handleInput(input.trim());
    }
  }

  private prompt(): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(chalk.cyan('👤 사용자 > '), (answer) => {
        resolve(answer);
      });
    });
  }

  private async handleInput(input: string): Promise<void> {
    // Handle commands
    if (input.startsWith('/')) {
      await this.handleCommand(input);
      return;
    }

    // Handle regular message
    if (input.length > 0) {
      this.adapter.triggerMessage(input);
    }
  }

  private async handleCommand(input: string): Promise<void> {
    const parts = input.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case '/help':
        this.printHelp();
        break;

      case '/status':
        this.printStatus();
        break;

      case '/agents':
        this.printAllAgents();
        break;

      case '/summon':
        await this.handleSummon(args);
        break;

      case '/dismiss':
        await this.handleDismiss(args);
        break;

      case '/clear':
        console.clear();
        this.printWelcome();
        break;

      case '/quit':
      case '/exit':
        this.stop();
        break;

      default:
        console.log(chalk.red(`알 수 없는 명령어: ${command}`));
        console.log(chalk.gray('/help 로 사용 가능한 명령어를 확인하세요.'));
    }
  }

  private printStatus(): void {
    const status = this.orchestrator.getStatus();
    
    console.log(chalk.cyan('\n┌─────────────────────────────────────┐'));
    console.log(chalk.cyan('│         🎭 에이전트 상태             │'));
    console.log(chalk.cyan('├─────────────────────────────────────┤'));
    console.log(chalk.cyan('│') + chalk.white(`  활성: ${status.active}  |  대기: ${status.dormant}`).padEnd(36) + chalk.cyan('│'));
    console.log(chalk.cyan('├─────────────────────────────────────┤'));

    if (status.activeIds.length === 0) {
      console.log(chalk.cyan('│') + chalk.gray('  (활성화된 에이전트 없음)').padEnd(36) + chalk.cyan('│'));
    } else {
      for (const id of status.activeIds) {
        const agent = getAgentById(id);
        if (agent) {
          console.log(chalk.cyan('│') + chalk.green(`  🟢 ${agent.emoji} ${agent.name}`).padEnd(44) + chalk.cyan('│'));
        }
      }
    }

    console.log(chalk.cyan('└─────────────────────────────────────┘\n'));
  }

  private printAllAgents(): void {
    console.log(chalk.cyan('\n┌─────────────────────────────────────────────────┐'));
    console.log(chalk.cyan('│              🎭 전체 에이전트 목록               │'));
    console.log(chalk.cyan('├─────────────────────────────────────────────────┤'));

    const categories = new Map<string, typeof AGENT_DEFINITIONS>();
    for (const agent of AGENT_DEFINITIONS) {
      const category = agent.category;
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(agent);
    }

    for (const [category, agents] of categories) {
      console.log(chalk.cyan('│') + chalk.yellow(` [${category}]`).padEnd(48) + chalk.cyan('│'));
      for (const agent of agents) {
        const active = this.orchestrator.isAgentActive(agent.id);
        const status = active ? chalk.green('🟢') : chalk.gray('⚪');
        console.log(chalk.cyan('│') + `  ${status} ${agent.emoji} ${agent.name} `.padEnd(47) + chalk.cyan('│'));
      }
    }

    console.log(chalk.cyan('└─────────────────────────────────────────────────┘\n'));
  }

  private async handleSummon(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log(chalk.red('사용법: /summon @agent-id'));
      return;
    }

    const agentId = args[0].replace('@', '');
    const agent = getAgentById(agentId);

    if (!agent) {
      console.log(chalk.red(`알 수 없는 에이전트: ${agentId}`));
      return;
    }

    if (this.orchestrator.isAgentActive(agentId)) {
      console.log(chalk.yellow(`${agent.emoji} ${agent.name}은(는) 이미 활성화되어 있습니다.`));
      return;
    }

    await this.orchestrator.summonAgent(agentId, '사용자가 직접 소환');
  }

  private async handleDismiss(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log(chalk.red('사용법: /dismiss @agent-id'));
      return;
    }

    const agentId = args[0].replace('@', '');
    const agent = getAgentById(agentId);

    if (!agent) {
      console.log(chalk.red(`알 수 없는 에이전트: ${agentId}`));
      return;
    }

    if (agent.alwaysActive) {
      console.log(chalk.red(`${agent.emoji} ${agent.name}은(는) 항상 활성화 상태입니다.`));
      return;
    }

    if (!this.orchestrator.isAgentActive(agentId)) {
      console.log(chalk.yellow(`${agent.emoji} ${agent.name}은(는) 이미 비활성화되어 있습니다.`));
      return;
    }

    await this.orchestrator.dismissAgent(agentId, '사용자가 직접 퇴장 요청');
  }
}
