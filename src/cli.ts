#!/usr/bin/env node
/**
 * Too Many Claw - CLI Entry Point
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { TerminalUI } from './simulation/TerminalUI.js';
import { ConfigManager } from './config/ConfigManager.js';
import { AGENT_DEFINITIONS } from './agents/definitions.js';
import { DiscordAdapter } from './discord/DiscordAdapter.js';
import { Orchestrator } from './core/Orchestrator.js';

const program = new Command();

program
  .name('tmc')
  .description('Too Many Claw - 35 AI agents collaborating via Discord')
  .version('1.0.0');

// Start Discord bot
program
  .command('start')
  .description('Start the Discord bot')
  .action(async () => {
    const spinner = ora('Starting Too Many Claw...').start();
    
    try {
      const config = new ConfigManager();
      
      if (!config.isDiscordConfigured()) {
        spinner.fail('Discord not configured');
        console.log(chalk.yellow('\nRun `tmc setup-discord` to configure Discord settings.'));
        process.exit(1);
      }

      const discordConfig = config.getDiscordConfig();
      if (!discordConfig.token || !discordConfig.guildId || !discordConfig.chatChannelId) {
        spinner.fail('Incomplete Discord configuration');
        process.exit(1);
      }

      const adapter = new DiscordAdapter({
        token: discordConfig.token,
        guildId: discordConfig.guildId,
        chatChannelId: discordConfig.chatChannelId,
        statusChannelId: discordConfig.statusChannelId,
      });

      // Set webhooks if configured
      const webhooks = config.getAllWebhooks();
      if (Object.keys(webhooks).length > 0) {
        adapter.setWebhooks(webhooks);
      }

      const orchestrator = new Orchestrator(adapter);

      adapter.onMessage((message) => {
        orchestrator.handleUserMessage(message);
      });

      await adapter.connect();
      spinner.succeed('Too Many Claw is running!');
      
      console.log(chalk.green('\n🦀 Too Many Claw Discord bot is now active!'));
      console.log(chalk.gray('Press Ctrl+C to stop.\n'));

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        console.log(chalk.yellow('\n\nShutting down...'));
        await adapter.disconnect();
        process.exit(0);
      });

    } catch (error) {
      spinner.fail('Failed to start');
      console.error(chalk.red(error));
      process.exit(1);
    }
  });

// Terminal simulation
program
  .command('simulate')
  .description('Start terminal simulation mode')
  .action(async () => {
    console.log(chalk.cyan('\n🦀 Starting Too Many Claw Simulation...\n'));
    
    const ui = new TerminalUI();
    await ui.start();
  });

// Show status
program
  .command('status')
  .description('Show agent status and configuration')
  .action(() => {
    console.log(chalk.cyan('\n🦀 Too Many Claw - Agent Status\n'));
    
    const config = new ConfigManager();
    const categories = new Map<string, typeof AGENT_DEFINITIONS>();
    
    for (const agent of AGENT_DEFINITIONS) {
      if (!categories.has(agent.category)) {
        categories.set(agent.category, []);
      }
      categories.get(agent.category)!.push(agent);
    }

    for (const [category, agents] of categories) {
      console.log(chalk.yellow(`\n[${category}]`));
      for (const agent of agents) {
        const hasWebhook = config.hasWebhook(agent.id);
        const webhookStatus = hasWebhook ? chalk.green('✓') : chalk.gray('○');
        console.log(`  ${webhookStatus} ${agent.emoji} ${agent.name} (${chalk.gray(agent.id)})`);
      }
    }

    console.log(chalk.gray(`\n총 ${AGENT_DEFINITIONS.length}개 에이전트\n`));
    
    // Show Discord config status
    console.log(chalk.cyan('Discord 설정:'));
    if (config.isDiscordConfigured()) {
      console.log(chalk.green('  ✓ 구성됨'));
    } else {
      console.log(chalk.yellow('  ○ 미구성 (tmc setup-discord 실행)'));
    }
    console.log();
  });

// Setup Discord
program
  .command('setup-discord')
  .description('Configure Discord settings')
  .action(async () => {
    console.log(chalk.cyan('\n🦀 Too Many Claw - Discord 설정\n'));
    
    const config = new ConfigManager();
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'token',
        message: 'Discord Bot Token:',
        default: config.getDiscordConfig().token || '',
      },
      {
        type: 'input',
        name: 'guildId',
        message: 'Discord Guild (Server) ID:',
        default: config.getDiscordConfig().guildId || '',
      },
      {
        type: 'input',
        name: 'chatChannelId',
        message: 'Chat Channel ID:',
        default: config.getDiscordConfig().chatChannelId || '',
      },
      {
        type: 'input',
        name: 'statusChannelId',
        message: 'Status Channel ID (optional):',
        default: config.getDiscordConfig().statusChannelId || '',
      },
    ]);

    config.setDiscordConfig({
      token: answers.token,
      guildId: answers.guildId,
      chatChannelId: answers.chatChannelId,
      statusChannelId: answers.statusChannelId || undefined,
    });

    console.log(chalk.green('\n✓ Discord 설정이 저장되었습니다.'));
    console.log(chalk.gray('`tmc start`로 봇을 시작하세요.\n'));
  });

// Uninstall
program
  .command('uninstall')
  .description('Remove Too Many Claw configuration')
  .action(async () => {
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to remove all Too Many Claw configuration?',
        default: false,
      },
    ]);

    if (!answers.confirm) {
      console.log(chalk.yellow('Cancelled.'));
      return;
    }

    const spinner = ora('Removing configuration...').start();
    
    try {
      const config = new ConfigManager();
      config.reset();
      spinner.succeed('Configuration removed');
      console.log(chalk.green('\nToo Many Claw configuration has been removed.'));
      console.log(chalk.gray('Run `npm uninstall -g too-many-claw` to complete uninstallation.\n'));
    } catch (error) {
      spinner.fail('Failed to remove configuration');
      console.error(chalk.red(error));
    }
  });

program.parse();
