/**
 * Too Many Claw - Terminal Platform Adapter
 * Implements PlatformAdapter for terminal simulation
 */

import chalk from 'chalk';
import { Message, PlatformAdapter } from '../types/index.js';
import { getAgentById } from '../agents/definitions.js';

export class TerminalAdapter implements PlatformAdapter {
  private messageHandler?: (message: Message) => void;
  private threadCounter = 0;

  /**
   * Send a message - prints to console with colors
   */
  async sendMessage(message: Message): Promise<void> {
    const { authorId, content, isEntry, isExit } = message;
    const agent = getAgentById(authorId);

    if (isEntry) {
      console.log(chalk.green('┌─────────────────────────────────────────'));
      console.log(chalk.green(`│ ${content}`));
      console.log(chalk.green('└─────────────────────────────────────────'));
    } else if (isExit) {
      console.log(chalk.red('┌─────────────────────────────────────────'));
      console.log(chalk.red(`│ ${content}`));
      console.log(chalk.red('└─────────────────────────────────────────'));
    } else if (agent) {
      const color = this.getAgentColor(authorId);
      console.log(color(`${agent.emoji} ${agent.name}: `) + content);
    } else if (authorId === 'user') {
      console.log(chalk.cyan('👤 사용자: ') + content);
    } else {
      console.log(content);
    }
  }

  /**
   * Send status update
   */
  async sendStatusUpdate(agentId: string, status: 'enter' | 'exit'): Promise<void> {
    const agent = getAgentById(agentId);
    if (!agent) return;

    const statusEmoji = status === 'enter' ? '🟢' : '🔴';
    const statusText = status === 'enter' ? '입장' : '퇴장';
    const timestamp = new Date().toLocaleTimeString('ko-KR');
    const color = status === 'enter' ? chalk.green : chalk.red;

    console.log(color(`${statusEmoji} [${timestamp}] ${agent.emoji} ${agent.name} ${statusText}`));
  }

  /**
   * Register message handler
   */
  onMessage(handler: (message: Message) => void): void {
    this.messageHandler = handler;
  }

  /**
   * Simulate thread creation
   */
  async createThread(name: string): Promise<string> {
    this.threadCounter++;
    const threadId = `thread-${this.threadCounter}`;
    console.log(chalk.gray(`📎 스레드 생성: ${name} (${threadId})`));
    return threadId;
  }

  /**
   * Trigger a message from user input
   */
  triggerMessage(content: string): void {
    if (!this.messageHandler) return;

    const message: Message = {
      id: `msg-${Date.now()}`,
      content,
      authorId: 'user',
      authorName: '사용자',
      authorEmoji: '👤',
      timestamp: new Date(),
      mentions: this.parseMentions(content),
    };

    this.messageHandler(message);
  }

  private parseMentions(content: string): string[] {
    const mentionPattern = /@([a-z-]+)/gi;
    const matches = content.matchAll(mentionPattern);
    const mentions: string[] = [];

    for (const match of matches) {
      const agentId = match[1].toLowerCase();
      if (!mentions.includes(agentId)) {
        mentions.push(agentId);
      }
    }

    return mentions;
  }

  private getAgentColor(agentId: string): (text: string) => string {
    const colors: Record<string, (text: string) => string> = {
      base: chalk.yellow,
      searcher: chalk.blue,
      'tech-researcher': chalk.cyan,
      'trend-analyst': chalk.magenta,
      'data-provider': chalk.white,
      counselor: chalk.green,
      'user-psychologist': chalk.yellowBright,
      questioner: chalk.blueBright,
      persuader: chalk.cyanBright,
      educator: chalk.magentaBright,
      planner: chalk.greenBright,
      'team-composer': chalk.redBright,
      promoter: chalk.whiteBright,
      uploader: chalk.gray,
      'backend-dev': chalk.blue,
      'frontend-dev': chalk.cyan,
      designer: chalk.magenta,
      'code-reviewer': chalk.yellow,
      'doc-writer': chalk.green,
      automator: chalk.red,
      'prompt-engineer': chalk.blueBright,
      'ai-illustrator': chalk.cyanBright,
      'program-tester': chalk.magentaBright,
      'user-tester': chalk.greenBright,
      'security-checker': chalk.yellowBright,
      'vuln-finder': chalk.redBright,
      pentester: chalk.whiteBright,
      'fact-bomber': chalk.red,
      roaster: chalk.redBright,
      critic: chalk.yellow,
      negativist: chalk.gray,
      praiser: chalk.green,
      'loophole-finder': chalk.cyan,
      threatener: chalk.magenta,
      'dirty-worker': chalk.white,
    };

    return colors[agentId] || chalk.white;
  }

  /**
   * Print system message
   */
  printSystem(message: string): void {
    console.log(chalk.gray(`[시스템] ${message}`));
  }

  /**
   * Print error message
   */
  printError(message: string): void {
    console.log(chalk.red(`[오류] ${message}`));
  }
}
