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
import { AgentCategory } from './types/index.js';

const program = new Command();

program
  .name('tmc')
  .description('Too Many Claw - 35 AI agents collaborating via Discord')
  .version('1.0.2');

// Comprehensive setup wizard
program
  .command('setup')
  .description('Interactive setup wizard for Too Many Claw')
  .action(async () => {
    console.log(chalk.cyan(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🦀 Too Many Claw - Setup Wizard                          ║
║                                                            ║
║   This wizard will help you configure your system          ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`));

    const config = new ConfigManager();
    const currentDiscord = config.getDiscordConfig();

    // Step 1: Main menu
    const { setupType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'setupType',
        message: 'What would you like to configure?',
        choices: [
          { name: '🔧 Full Setup (Recommended for first time)', value: 'full' },
          { name: '🤖 Discord Bot Settings', value: 'discord' },
          { name: '🔗 Webhook Configuration', value: 'webhooks' },
          { name: '📊 View Current Configuration', value: 'view' },
          { name: '🗑️  Reset Configuration', value: 'reset' },
          { name: '❌ Exit', value: 'exit' },
        ],
      },
    ]);

    switch (setupType) {
      case 'full':
        await runFullSetup(config);
        break;
      case 'discord':
        await runDiscordSetup(config);
        break;
      case 'webhooks':
        await runWebhookSetup(config);
        break;
      case 'view':
        viewConfiguration(config);
        break;
      case 'reset':
        await resetConfiguration(config);
        break;
      case 'exit':
        console.log(chalk.gray('\nGoodbye! 👋\n'));
        break;
    }
  });

async function runFullSetup(config: ConfigManager): Promise<void> {
  console.log(chalk.cyan('\n📋 Step 1/3: Discord Bot Configuration\n'));
  console.log(chalk.gray('To use Too Many Claw, you need a Discord bot. Here\'s how to get one:'));
  console.log(chalk.gray('  1. Go to https://discord.com/developers/applications'));
  console.log(chalk.gray('  2. Create a new application'));
  console.log(chalk.gray('  3. Go to the "Bot" tab and create a bot'));
  console.log(chalk.gray('  4. Copy the bot token'));
  console.log(chalk.gray('  5. Enable "Message Content Intent" in the Bot settings'));
  console.log(chalk.gray('  6. Invite the bot to your server with appropriate permissions\n'));

  await runDiscordSetup(config);

  console.log(chalk.cyan('\n📋 Step 2/3: Webhook Configuration (Optional)\n'));
  console.log(chalk.gray('Webhooks allow each agent to have a unique name and avatar.'));
  console.log(chalk.gray('Without webhooks, all agents will use the bot\'s identity.\n'));

  const { setupWebhooks } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'setupWebhooks',
      message: 'Would you like to configure webhooks now?',
      default: false,
    },
  ]);

  if (setupWebhooks) {
    await runWebhookSetup(config);
  }

  console.log(chalk.cyan('\n📋 Step 3/3: Verification\n'));
  viewConfiguration(config);

  console.log(chalk.green('\n✨ Setup Complete!\n'));
  console.log(chalk.white('Next steps:'));
  console.log(chalk.gray('  • Run `tmc simulate` to test locally without Discord'));
  console.log(chalk.gray('  • Run `tmc start` to start the Discord bot'));
  console.log(chalk.gray('  • Run `tmc status` to view all agents\n'));
}

async function runDiscordSetup(config: ConfigManager): Promise<void> {
  const currentDiscord = config.getDiscordConfig();

  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'token',
      message: 'Discord Bot Token:',
      default: currentDiscord.token || '',
      mask: '*',
      validate: (input: string) => {
        if (!input || input.length < 50) {
          return 'Please enter a valid Discord bot token';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'guildId',
      message: 'Discord Server (Guild) ID:',
      default: currentDiscord.guildId || '',
      validate: (input: string) => {
        if (!input || !/^\d{17,19}$/.test(input)) {
          return 'Please enter a valid Discord server ID (17-19 digit number)';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'chatChannelId',
      message: 'Chat Channel ID (main conversation channel):',
      default: currentDiscord.chatChannelId || '',
      validate: (input: string) => {
        if (!input || !/^\d{17,19}$/.test(input)) {
          return 'Please enter a valid Discord channel ID (17-19 digit number)';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'statusChannelId',
      message: 'Status Channel ID (optional - for agent join/leave logs):',
      default: currentDiscord.statusChannelId || '',
    },
  ]);

  config.setDiscordConfig({
    token: answers.token,
    guildId: answers.guildId,
    chatChannelId: answers.chatChannelId,
    statusChannelId: answers.statusChannelId || undefined,
  });

  console.log(chalk.green('\n✓ Discord settings saved successfully!'));
}

async function runWebhookSetup(config: ConfigManager): Promise<void> {
  console.log(chalk.gray('\nTo create a webhook:'));
  console.log(chalk.gray('  1. Go to your Discord channel settings'));
  console.log(chalk.gray('  2. Click "Integrations" → "Webhooks"'));
  console.log(chalk.gray('  3. Create a new webhook and copy its URL\n'));

  const { webhookMode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'webhookMode',
      message: 'How would you like to configure webhooks?',
      choices: [
        { name: 'Use a single webhook for all agents', value: 'single' },
        { name: 'Configure webhooks per category', value: 'category' },
        { name: 'Configure webhooks per agent', value: 'individual' },
        { name: 'Skip webhook configuration', value: 'skip' },
      ],
    },
  ]);

  if (webhookMode === 'skip') {
    return;
  }

  if (webhookMode === 'single') {
    const { webhookUrl } = await inquirer.prompt([
      {
        type: 'input',
        name: 'webhookUrl',
        message: 'Enter the webhook URL:',
        validate: (input: string) => {
          if (!input.includes('discord.com/api/webhooks/')) {
            return 'Please enter a valid Discord webhook URL';
          }
          return true;
        },
      },
    ]);

    // Apply to all agents
    for (const agent of AGENT_DEFINITIONS) {
      config.setWebhook(agent.id, webhookUrl);
    }
    console.log(chalk.green(`\n✓ Webhook set for all ${AGENT_DEFINITIONS.length} agents`));
  }

  if (webhookMode === 'category') {
    const categories = [...new Set(AGENT_DEFINITIONS.map(a => a.category))];
    
    for (const category of categories) {
      const categoryAgents = AGENT_DEFINITIONS.filter(a => a.category === category);
      const { webhookUrl } = await inquirer.prompt([
        {
          type: 'input',
          name: 'webhookUrl',
          message: `Webhook URL for ${category} (${categoryAgents.length} agents):`,
          default: '',
        },
      ]);

      if (webhookUrl && webhookUrl.includes('discord.com/api/webhooks/')) {
        for (const agent of categoryAgents) {
          config.setWebhook(agent.id, webhookUrl);
        }
        console.log(chalk.green(`  ✓ Set for ${categoryAgents.length} ${category} agents`));
      } else if (webhookUrl) {
        console.log(chalk.yellow(`  ⚠ Skipped ${category} - invalid URL`));
      }
    }
  }

  if (webhookMode === 'individual') {
    console.log(chalk.gray('\nEnter webhook URLs for individual agents (leave empty to skip):\n'));
    
    const { selectAgents } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectAgents',
        message: 'Select agents to configure:',
        choices: AGENT_DEFINITIONS.map(a => ({
          name: `${a.emoji} ${a.name} (${a.id})`,
          value: a.id,
        })),
        pageSize: 15,
      },
    ]);

    for (const agentId of selectAgents) {
      const agent = AGENT_DEFINITIONS.find(a => a.id === agentId);
      if (!agent) continue;

      const { webhookUrl } = await inquirer.prompt([
        {
          type: 'input',
          name: 'webhookUrl',
          message: `${agent.emoji} ${agent.name}:`,
        },
      ]);

      if (webhookUrl && webhookUrl.includes('discord.com/api/webhooks/')) {
        config.setWebhook(agentId, webhookUrl);
        console.log(chalk.green(`  ✓ Set webhook for ${agent.name}`));
      }
    }
  }
}

function viewConfiguration(config: ConfigManager): void {
  console.log(chalk.cyan('\n┌─────────────────────────────────────────────┐'));
  console.log(chalk.cyan('│        📊 Current Configuration             │'));
  console.log(chalk.cyan('├─────────────────────────────────────────────┤'));

  // Discord settings
  const discord = config.getDiscordConfig();
  const discordStatus = config.isDiscordConfigured() ? chalk.green('✓ Configured') : chalk.yellow('○ Not configured');
  console.log(chalk.cyan('│') + chalk.white(' Discord Bot: ') + discordStatus.padEnd(35) + chalk.cyan('│'));
  
  if (discord.token) {
    console.log(chalk.cyan('│') + chalk.gray(`   Token: ${discord.token.substring(0, 10)}...`).padEnd(44) + chalk.cyan('│'));
  }
  if (discord.guildId) {
    console.log(chalk.cyan('│') + chalk.gray(`   Guild: ${discord.guildId}`).padEnd(44) + chalk.cyan('│'));
  }
  if (discord.chatChannelId) {
    console.log(chalk.cyan('│') + chalk.gray(`   Chat Channel: ${discord.chatChannelId}`).padEnd(44) + chalk.cyan('│'));
  }

  // Webhook stats
  const webhooks = config.getAllWebhooks();
  const webhookCount = Object.keys(webhooks).length;
  console.log(chalk.cyan('│') + chalk.white(` Webhooks: ${webhookCount}/${AGENT_DEFINITIONS.length} agents`).padEnd(44) + chalk.cyan('│'));

  console.log(chalk.cyan('└─────────────────────────────────────────────┘\n'));
}

async function resetConfiguration(config: ConfigManager): Promise<void> {
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: chalk.red('Are you sure you want to reset all configuration?'),
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(chalk.yellow('\nReset cancelled.'));
    return;
  }

  const spinner = ora('Resetting configuration...').start();
  config.reset();
  spinner.succeed('Configuration reset');
  console.log(chalk.green('\nAll configuration has been cleared.'));
}

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
        console.log(chalk.yellow('\nRun `tmc setup` to configure Discord settings.'));
        process.exit(1);
      }

      const discordConfig = config.getDiscordConfig();
      if (!discordConfig.token || !discordConfig.guildId || !discordConfig.chatChannelId) {
        spinner.fail('Incomplete Discord configuration');
        console.log(chalk.yellow('\nRun `tmc setup` to complete Discord configuration.'));
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
  .description('Start terminal simulation mode (no Discord required)')
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
        const activeLabel = agent.alwaysActive ? chalk.cyan(' (always active)') : '';
        console.log(`  ${webhookStatus} ${agent.emoji} ${agent.name} (${chalk.gray(agent.id)})${activeLabel}`);
      }
    }

    console.log(chalk.gray(`\nTotal: ${AGENT_DEFINITIONS.length} agents\n`));
    
    // Show Discord config status
    console.log(chalk.cyan('Discord Configuration:'));
    if (config.isDiscordConfigured()) {
      console.log(chalk.green('  ✓ Configured'));
    } else {
      console.log(chalk.yellow('  ○ Not configured - run `tmc setup`'));
    }
    console.log();
  });

// Legacy setup-discord command (redirects to setup)
program
  .command('setup-discord')
  .description('Configure Discord settings (alias for `tmc setup`)')
  .action(async () => {
    console.log(chalk.cyan('\n🦀 Too Many Claw - Discord Setup\n'));
    
    const config = new ConfigManager();
    await runDiscordSetup(config);
    
    console.log(chalk.gray('\nRun `tmc start` to start the bot.\n'));
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

// List agents command
program
  .command('agents')
  .description('List all available agents')
  .option('-c, --category <category>', 'Filter by category')
  .action((options) => {
    console.log(chalk.cyan('\n🦀 Too Many Claw - Agent Directory\n'));
    
    let agents = AGENT_DEFINITIONS;
    
    if (options.category) {
      agents = agents.filter(a => 
        a.category.toLowerCase().includes(options.category.toLowerCase())
      );
      if (agents.length === 0) {
        console.log(chalk.yellow(`No agents found in category "${options.category}"\n`));
        console.log(chalk.gray('Available categories: CORE, RESEARCH, PSYCHOLOGY, PLANNING, DEVELOPMENT, TESTING, CRITIQUE, SPECIAL'));
        return;
      }
    }

    const categories = new Map<string, typeof AGENT_DEFINITIONS>();
    for (const agent of agents) {
      if (!categories.has(agent.category)) {
        categories.set(agent.category, []);
      }
      categories.get(agent.category)!.push(agent);
    }

    for (const [category, categoryAgents] of categories) {
      console.log(chalk.yellow(`\n━━━ ${category} (${categoryAgents.length}) ━━━`));
      for (const agent of categoryAgents) {
        console.log(`  ${agent.emoji} ${chalk.white(agent.name)}`);
        console.log(chalk.gray(`     ID: ${agent.id} | Model: ${agent.model}`));
        console.log(chalk.gray(`     ${agent.role.substring(0, 60)}...`));
      }
    }

    console.log(chalk.gray(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
    console.log(chalk.white(`Total: ${agents.length} agents\n`));
  });

program.parse();
