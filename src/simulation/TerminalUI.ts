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
    console.log(chalk.yellow('\n👋 Exiting Too Many Claw simulation. Goodbye!\n'));
  }

  private printWelcome(): void {
    console.log(chalk.cyan(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🦀 Too Many Claw - Terminal Simulation                   ║
║                                                            ║
║   35 AI agents collaborating together                      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`));
  }

  private printHelp(): void {
    console.log(chalk.gray(`
Commands:
  /help          - Show this help
  /status        - List active agents
  /agents        - List all agents
  /summon @agent - Summon an agent
  /dismiss @agent - Dismiss an agent
  /clear         - Clear screen
  /quit          - Exit

Include @agent-id in your message to summon that agent.
Example: @searcher Find the latest React information
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
      this.rl.question(chalk.cyan('👤 You > '), (answer) => {
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
        console.log(chalk.red(`Unknown command: ${command}`));
        console.log(chalk.gray('Use /help to see available commands.'));
    }
  }

  private printStatus(): void {
    const status = this.orchestrator.getStatus();
    
    console.log(chalk.cyan('\n┌─────────────────────────────────────┐'));
    console.log(chalk.cyan('│           🎭 Agent Status            │'));
    console.log(chalk.cyan('├─────────────────────────────────────┤'));
    console.log(chalk.cyan('│') + chalk.white(`  Active: ${status.active}  |  Dormant: ${status.dormant}`).padEnd(36) + chalk.cyan('│'));
    console.log(chalk.cyan('├─────────────────────────────────────┤'));

    if (status.activeIds.length === 0) {
      console.log(chalk.cyan('│') + chalk.gray('  (No active agents)').padEnd(36) + chalk.cyan('│'));
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
    console.log(chalk.cyan('│              🎭 All Agents                       │'));
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
      console.log(chalk.red('Usage: /summon @agent-id'));
      return;
    }

    const agentId = args[0].replace('@', '');
    const agent = getAgentById(agentId);

    if (!agent) {
      console.log(chalk.red(`Unknown agent: ${agentId}`));
      return;
    }

    if (this.orchestrator.isAgentActive(agentId)) {
      console.log(chalk.yellow(`${agent.emoji} ${agent.name} is already active.`));
      return;
    }

    await this.orchestrator.summonAgent(agentId, 'Summoned by user');
  }

  private async handleDismiss(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log(chalk.red('Usage: /dismiss @agent-id'));
      return;
    }

    const agentId = args[0].replace('@', '');
    const agent = getAgentById(agentId);

    if (!agent) {
      console.log(chalk.red(`Unknown agent: ${agentId}`));
      return;
    }

    if (agent.alwaysActive) {
      console.log(chalk.red(`${agent.emoji} ${agent.name} is always active and cannot be dismissed.`));
      return;
    }

    if (!this.orchestrator.isAgentActive(agentId)) {
      console.log(chalk.yellow(`${agent.emoji} ${agent.name} is already dormant.`));
      return;
    }

    await this.orchestrator.dismissAgent(agentId, 'Dismissed by user');
  }
}
