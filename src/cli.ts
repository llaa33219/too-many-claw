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
import { OpenClawDaemon } from './daemon/index.js';

const program = new Command();

program
  .name('tmc')
  .description('Too Many Claw - 35 AI agents collaborating via Discord')
  .version('1.0.4');

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

    // Check for OpenClaw Discord configuration
    await checkAndImportOpenClaw(config);

    // Build menu choices (conditionally include OpenClaw option)
    const menuChoices = [
      { name: '🔧 Full Setup (Recommended for first time)', value: 'full' },
      { name: '🤖 Discord Bot Settings', value: 'discord' },
      { name: '🔗 Webhook Configuration', value: 'webhooks' },
      ...(config.hasOpenClawConfig() ? [{ name: '📥 Import from OpenClaw', value: 'openclaw' }] : []),
      { name: '📊 View Current Configuration', value: 'view' },
      { name: '🗑️  Reset Configuration', value: 'reset' },
      { name: '❌ Exit', value: 'exit' },
    ];

    // Main menu
    const { setupType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'setupType',
        message: 'What would you like to configure?',
        choices: menuChoices,
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
      case 'openclaw':
        await importFromOpenClawManual(config);
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

/**
 * Check for OpenClaw config and offer to import at setup start
 */
async function checkAndImportOpenClaw(config: ConfigManager): Promise<boolean> {
  if (!config.hasOpenClawDiscordConfig()) {
    return false;
  }

  // OpenClaw Discord config detected!
  console.log(chalk.green('┌─────────────────────────────────────────────────────────────┐'));
  console.log(chalk.green('│  ✨ OpenClaw Discord configuration detected!                │'));
  console.log(chalk.green('└─────────────────────────────────────────────────────────────┘'));

  const openclawDiscord = config.getOpenClawDiscordConfig();
  if (!openclawDiscord) return false;

  // Get detailed import summary
  const summary = config.getOpenClawImportSummary();
  const extracted = summary.extracted;

  // Show what can be imported
  console.log(chalk.white('\nThe following settings can be imported:\n'));
  
  if (extracted?.token) {
    const maskedToken = extracted.token.substring(0, 10) + '...' + extracted.token.slice(-4);
    console.log(chalk.gray(`  • Bot Token: ${maskedToken}`));
  }
  if (extracted?.guildId) {
    console.log(chalk.gray(`  • Server (Guild) ID: ${extracted.guildId}`));
  }
  if (extracted?.chatChannelId) {
    console.log(chalk.gray(`  • Chat Channel: ${extracted.chatChannelId}`));
  }
  if (extracted?.statusChannelId) {
    console.log(chalk.gray(`  • Status Channel: ${extracted.statusChannelId}`));
  }
  if (extracted?.allowedChannels && extracted.allowedChannels.length > 0) {
    console.log(chalk.gray(`  • All Allowed Channels: ${extracted.allowedChannels.length} channel(s)`));
    extracted.allowedChannels.forEach((ch) => {
      console.log(chalk.gray(`      - ${ch}`));
    });
  }
  console.log();

  const { shouldImport } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'shouldImport',
      message: 'Would you like to import these settings from OpenClaw?',
      default: true,
    },
  ]);

  if (!shouldImport) {
    console.log(chalk.gray('\nSkipped OpenClaw import.\n'));
    return false;
  }

  // Perform import
  const result = config.importFromOpenClaw();

  if (result.success) {
    console.log(chalk.green('\n✓ Import successful!\n'));
    console.log(chalk.white('Imported settings:'));
    if (result.imported.token) {
      console.log(chalk.green('  ✓ Bot Token'));
    }
    if (result.imported.guildId) {
      console.log(chalk.green(`  ✓ Server (Guild) ID: ${result.imported.guildId}`));
    }
    if (result.imported.chatChannelId) {
      console.log(chalk.green(`  ✓ Chat Channel: ${result.imported.chatChannelId}`));
    }
    if (result.imported.statusChannelId) {
      console.log(chalk.green(`  ✓ Status Channel: ${result.imported.statusChannelId}`));
    }
    console.log();

    // Check what's still needed
    const currentConfig = config.getDiscordConfig();
    const missing: string[] = [];
    if (!currentConfig.guildId) missing.push('Server (Guild) ID');
    if (!currentConfig.chatChannelId) missing.push('Chat Channel ID');

    if (missing.length > 0) {
      console.log(chalk.yellow('⚠ The following settings still need to be configured:'));
      missing.forEach(m => console.log(chalk.yellow(`  • ${m}`)));
      console.log();
    }
  } else {
    console.log(chalk.yellow(`\n⚠ ${result.message}\n`));
  }

  return result.success;
}

/**
 * Manual import from OpenClaw (menu option)
 */
async function importFromOpenClawManual(config: ConfigManager): Promise<void> {
  console.log(chalk.cyan('\n📥 Import from OpenClaw\n'));

  if (!config.hasOpenClawConfig()) {
    console.log(chalk.yellow('OpenClaw configuration file not found.'));
    console.log(chalk.gray(`Expected location: ${config.getOpenClawConfigPath()}`));
    console.log(chalk.gray('\nMake sure OpenClaw is installed and configured.\n'));
    return;
  }

  if (!config.hasOpenClawDiscordConfig()) {
    console.log(chalk.yellow('OpenClaw is installed but has no Discord configuration.'));
    console.log(chalk.gray('\nPlease configure Discord in OpenClaw first, then try again.\n'));
    return;
  }

  await checkAndImportOpenClaw(config);
}

async function runFullSetup(config: ConfigManager): Promise<void> {
  // Check if Discord is already configured (possibly from OpenClaw import)
  const currentDiscord = config.getDiscordConfig();
  const hasToken = !!currentDiscord.token;
  const hasGuild = !!currentDiscord.guildId;
  const hasChatChannel = !!currentDiscord.chatChannelId;

  if (hasToken && hasGuild && hasChatChannel) {
    console.log(chalk.green('\n✓ Discord is already configured!\n'));
    const { reconfigure } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'reconfigure',
        message: 'Would you like to reconfigure Discord settings?',
        default: false,
      },
    ]);

    if (!reconfigure) {
      console.log(chalk.cyan('\n📋 Step 1/3: Discord Bot Configuration - Skipped\n'));
    } else {
      console.log(chalk.cyan('\n📋 Step 1/3: Discord Bot Configuration\n'));
      await runDiscordSetup(config);
    }
  } else {
    console.log(chalk.cyan('\n📋 Step 1/3: Discord Bot Configuration\n'));
    
    if (hasToken) {
      console.log(chalk.green('✓ Bot token already configured (imported from OpenClaw)\n'));
    } else {
      console.log(chalk.gray('To use Too Many Claw, you need a Discord bot. Here\'s how to get one:'));
      console.log(chalk.gray('  1. Go to https://discord.com/developers/applications'));
      console.log(chalk.gray('  2. Create a new application'));
      console.log(chalk.gray('  3. Go to the "Bot" tab and create a bot'));
      console.log(chalk.gray('  4. Copy the bot token'));
      console.log(chalk.gray('  5. Enable "Message Content Intent" in the Bot settings'));
      console.log(chalk.gray('  6. Invite the bot to your server with appropriate permissions\n'));
    }

    await runDiscordSetup(config);
  }

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

  // Show which fields are pre-filled
  if (currentDiscord.token || currentDiscord.guildId || currentDiscord.chatChannelId) {
    console.log(chalk.gray('Pre-filled values (press Enter to keep, or type new value):\n'));
    if (currentDiscord.token) {
      console.log(chalk.gray(`  • Token: ${currentDiscord.token.substring(0, 10)}...`));
    }
    if (currentDiscord.guildId) {
      console.log(chalk.gray(`  • Guild ID: ${currentDiscord.guildId}`));
    }
    if (currentDiscord.chatChannelId) {
      console.log(chalk.gray(`  • Chat Channel: ${currentDiscord.chatChannelId}`));
    }
    console.log();
  }

  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'token',
      message: currentDiscord.token ? 'Discord Bot Token (press Enter to keep current):' : 'Discord Bot Token:',
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
      message: currentDiscord.guildId ? 'Discord Server (Guild) ID (press Enter to keep current):' : 'Discord Server (Guild) ID:',
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
      message: currentDiscord.chatChannelId ? 'Chat Channel ID (press Enter to keep current):' : 'Chat Channel ID (main conversation channel):',
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
  const discordConfig = config.getDiscordConfig();
  const hasDiscordConfig = !!(discordConfig.token && discordConfig.chatChannelId);

  // Build choices - auto-create only available if Discord is configured
  const choices = [
    ...(hasDiscordConfig ? [{ name: '🤖 Auto-create webhooks (requires bot connection)', value: 'auto' }] : []),
    { name: '📝 Use a single webhook for all agents', value: 'single' },
    { name: '📁 Configure webhooks per category', value: 'category' },
    { name: '🔧 Configure webhooks per agent', value: 'individual' },
    { name: '⏭️  Skip webhook configuration', value: 'skip' },
  ];

  if (!hasDiscordConfig) {
    console.log(chalk.yellow('\n⚠ Auto-create webhooks requires Discord to be configured first.'));
    console.log(chalk.gray('  Run Discord setup to enable this feature.\n'));
  }

  console.log(chalk.gray('\nWebhooks allow each agent to have a unique name and avatar in Discord.'));
  console.log(chalk.gray('You can create them automatically or manually.\n'));

  const { webhookMode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'webhookMode',
      message: 'How would you like to configure webhooks?',
      choices,
    },
  ]);

  if (webhookMode === 'skip') {
    return;
  }

  if (webhookMode === 'auto') {
    await runAutoWebhookSetup(config);
    return;
  }

  // Manual setup instructions
  console.log(chalk.gray('\nTo create a webhook manually:'));
  console.log(chalk.gray('  1. Go to your Discord channel settings'));
  console.log(chalk.gray('  2. Click "Integrations" → "Webhooks"'));
  console.log(chalk.gray('  3. Create a new webhook and copy its URL\n'));

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

/**
 * Auto-create webhooks by connecting to Discord and creating them programmatically
 */
async function runAutoWebhookSetup(config: ConfigManager): Promise<void> {
  console.log(chalk.cyan('\n🤖 Auto-Create Webhooks\n'));
  console.log(chalk.gray('This will connect to Discord and automatically create webhooks for all 35 agents.'));
  console.log(chalk.gray('The bot needs MANAGE_WEBHOOKS permission in the target channel.\n'));

  const discordConfig = config.getDiscordConfig();

  // Validate Discord config
  if (!discordConfig.token) {
    console.log(chalk.red('❌ Discord bot token not configured.'));
    console.log(chalk.gray('Run `tmc setup` to configure Discord settings first.\n'));
    return;
  }

  if (!discordConfig.chatChannelId) {
    console.log(chalk.red('❌ Chat channel not configured.'));
    console.log(chalk.gray('Run `tmc setup` to configure Discord settings first.\n'));
    return;
  }

  // Warn about Discord's webhook limit
  console.log(chalk.yellow('⚠ Important: Discord limits webhooks to 15 per channel.'));
  console.log(chalk.gray(`  You have ${AGENT_DEFINITIONS.length} agents, so some will share webhooks or fail to create.`));
  console.log(chalk.gray('  Consider using multiple channels or a single shared webhook if this is an issue.\n'));

  // Confirm before proceeding
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Create webhooks for all ${AGENT_DEFINITIONS.length} agents in channel ${discordConfig.chatChannelId}?`,
      default: true,
    },
  ]);

  if (!confirm) {
    console.log(chalk.yellow('\nWebhook creation cancelled.\n'));
    return;
  }

  // Connect to Discord
  const connectSpinner = ora('Connecting to Discord...').start();

  let adapter: DiscordAdapter;
  try {
    adapter = new DiscordAdapter({
      token: discordConfig.token,
      guildId: discordConfig.guildId || '0', // Placeholder, will be auto-detected
      chatChannelId: discordConfig.chatChannelId,
      statusChannelId: discordConfig.statusChannelId,
    });

    await adapter.connect();
    connectSpinner.succeed('Connected to Discord');

    // Wait for bot to fully initialize (ready event)
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
    connectSpinner.fail('Failed to connect to Discord');
    console.log(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
    console.log(chalk.gray('\nMake sure your bot token is valid and the bot is invited to your server.\n'));
    return;
  }

  try {
    // Auto-detect guildId if not set
    if (!discordConfig.guildId) {
      const detectSpinner = ora('Detecting server (guild) ID...').start();
      const detectedGuildId = await adapter.detectGuildId();
      
      if (detectedGuildId) {
        config.updateGuildId(detectedGuildId);
        detectSpinner.succeed(`Detected server ID: ${detectedGuildId}`);
      } else {
        detectSpinner.warn('Could not auto-detect server ID (bot may not be in any servers)');
      }
    }

    // Check webhook permissions
    const permSpinner = ora('Checking webhook permissions...').start();
    const hasPermission = await adapter.hasWebhookPermission(discordConfig.chatChannelId);

    if (!hasPermission) {
      permSpinner.fail('Bot lacks MANAGE_WEBHOOKS permission');
      console.log(chalk.red('\n❌ The bot does not have permission to manage webhooks in this channel.'));
      console.log(chalk.gray('\nTo fix this:'));
      console.log(chalk.gray('  1. Go to your Discord server settings'));
      console.log(chalk.gray('  2. Navigate to Roles or Channel Permissions'));
      console.log(chalk.gray('  3. Grant the bot "Manage Webhooks" permission'));
      console.log(chalk.gray('  4. Try again\n'));
      await adapter.disconnect();
      return;
    }
    permSpinner.succeed('Bot has webhook permissions');

    // Create webhooks with progress
    console.log(chalk.cyan(`\nCreating webhooks for ${AGENT_DEFINITIONS.length} agents...\n`));

    const progressSpinner = ora('Starting webhook creation...').start();

    const webhooks = await adapter.autoCreateWebhooks(
      discordConfig.chatChannelId,
      (current, total, agentName) => {
        progressSpinner.text = `Creating webhooks... (${current}/${total}) ${agentName}`;
      }
    );

    progressSpinner.succeed(`Created webhooks for ${Object.keys(webhooks).length} agents`);

    // Save webhooks to config (batch save for efficiency)
    const saveSpinner = ora('Saving webhook configuration...').start();
    const existingWebhooks = config.getAllWebhooks();
    config.setAllWebhooks({ ...existingWebhooks, ...webhooks });
    saveSpinner.succeed('Webhook configuration saved');

    // Summary
    console.log(chalk.green(`\n✅ Successfully configured ${Object.keys(webhooks).length} webhooks!\n`));

    // Check for any missing
    const missingCount = AGENT_DEFINITIONS.length - Object.keys(webhooks).length;
    if (missingCount > 0) {
      console.log(chalk.yellow(`⚠ ${missingCount} webhook(s) could not be created.`));
      console.log(chalk.gray('  Possible reasons:'));
      console.log(chalk.gray('  • Discord\'s 15 webhook per channel limit reached'));
      console.log(chalk.gray('  • Rate limiting from Discord API'));
      console.log(chalk.gray('  • Webhook already exists with the same name'));
      console.log(chalk.gray('\n  Consider using multiple channels or a shared webhook for remaining agents.\n'));
    }

  } finally {
    // Always disconnect
    const disconnectSpinner = ora('Disconnecting from Discord...').start();
    await adapter.disconnect();
    disconnectSpinner.succeed('Disconnected from Discord');
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

// Debug command for diagnosing OpenClaw config issues
program
  .command('debug')
  .description('Debug OpenClaw configuration detection')
  .option('--raw', 'Show raw config (WARNING: may expose sensitive data)')
  .action((options) => {
    console.log(chalk.cyan('\n🔍 Too Many Claw - Debug Information\n'));
    
    const config = new ConfigManager();
    
    // 1. OpenClaw config file info
    console.log(chalk.yellow('━━━ OpenClaw Configuration ━━━\n'));
    const openclawPath = config.getOpenClawConfigPath();
    console.log(chalk.white('Config file path:'));
    console.log(chalk.gray(`  ${openclawPath}`));
    console.log(chalk.white('File exists:'), config.hasOpenClawConfig() ? chalk.green('Yes') : chalk.red('No'));
    
    if (config.hasOpenClawConfig()) {
      // 2. Raw config structure
      const rawConfig = config.getOpenClawRawConfig();
      
      if (rawConfig) {
        console.log(chalk.white('\nTop-level keys:'));
        const topKeys = Object.keys(rawConfig);
        topKeys.forEach(key => {
          const value = rawConfig[key];
          const valueType = Array.isArray(value) ? 'array' : typeof value;
          const subKeys = valueType === 'object' && value ? Object.keys(value as object) : [];
          console.log(chalk.gray(`  • ${key} (${valueType})${subKeys.length > 0 ? ': ' + subKeys.join(', ') : ''}`));
        });
        
        // Check specific Discord-related paths
        console.log(chalk.white('\nDiscord config paths checked:'));
        const paths = [
          { path: 'gateway.discord', value: (rawConfig as any)?.gateway?.discord },
          { path: 'channels.discord', value: (rawConfig as any)?.channels?.discord },
          { path: 'discord', value: (rawConfig as any)?.discord },
          { path: 'providers.discord', value: (rawConfig as any)?.providers?.discord },
        ];
        
        paths.forEach(({ path, value }) => {
          if (value) {
            const keys = typeof value === 'object' ? Object.keys(value) : [];
            console.log(chalk.green(`  ✓ ${path}`) + chalk.gray(` (keys: ${keys.join(', ') || 'none'})`));
          } else {
            console.log(chalk.gray(`  ○ ${path} - not found`));
          }
        });
        
        // Show guilds structure if present
        const guilds = (rawConfig as any)?.channels?.discord?.guilds;
        if (guilds && typeof guilds === 'object') {
          console.log(chalk.white('\nGuilds found in channels.discord.guilds:'));
          const guildIds = Object.keys(guilds);
          guildIds.forEach(guildId => {
            const guildConfig = guilds[guildId];
            const channelKeys = guildConfig?.channels ? Object.keys(guildConfig.channels) : [];
            console.log(chalk.green(`  ✓ Guild: ${guildId}`));
            if (channelKeys.length > 0) {
              console.log(chalk.gray(`    Channels: ${channelKeys.join(', ')}`));
            }
          });
        }
        
        // Show raw config if requested (with warning)
        if (options.raw) {
          console.log(chalk.yellow('\n⚠ Raw OpenClaw config (may contain sensitive data):'));
          console.log(chalk.gray(JSON.stringify(rawConfig, null, 2)));
        }
      }
    }
    
    // 3. What TMC is extracting
    console.log(chalk.yellow('\n━━━ TMC OpenClaw Detection ━━━\n'));
    console.log(chalk.white('hasOpenClawConfig():'), config.hasOpenClawConfig() ? chalk.green('true') : chalk.red('false'));
    console.log(chalk.white('hasOpenClawDiscordConfig():'), config.hasOpenClawDiscordConfig() ? chalk.green('true') : chalk.red('false'));
    
    const extracted = config.extractOpenClawDiscordSettings();
    if (extracted) {
      console.log(chalk.white('\nExtracted Discord settings:'));
      if (extracted.token) {
        const masked = extracted.token.substring(0, 10) + '...' + extracted.token.slice(-4);
        console.log(chalk.green(`  ✓ token: ${masked}`));
      } else {
        console.log(chalk.gray('  ○ token: not found'));
      }
      console.log(extracted.guildId ? chalk.green(`  ✓ guildId: ${extracted.guildId}`) : chalk.gray('  ○ guildId: not found'));
      console.log(extracted.chatChannelId ? chalk.green(`  ✓ chatChannelId: ${extracted.chatChannelId}`) : chalk.gray('  ○ chatChannelId: not found'));
      console.log(extracted.statusChannelId ? chalk.green(`  ✓ statusChannelId: ${extracted.statusChannelId}`) : chalk.gray('  ○ statusChannelId: not found'));
      if (extracted.allowedChannels && extracted.allowedChannels.length > 0) {
        console.log(chalk.green(`  ✓ allowedChannels: ${extracted.allowedChannels.join(', ')}`));
      }
    } else {
      console.log(chalk.gray('\nNo Discord settings could be extracted from OpenClaw config.'));
    }
    
    // 4. Current TMC config
    console.log(chalk.yellow('\n━━━ Current TMC Configuration ━━━\n'));
    const tmcConfig = config.getDiscordConfig();
    const webhooks = config.getAllWebhooks();
    
    console.log(chalk.white('Discord settings:'));
    if (tmcConfig.token) {
      const masked = tmcConfig.token.substring(0, 10) + '...' + tmcConfig.token.slice(-4);
      console.log(chalk.gray(`  • token: ${masked}`));
    } else {
      console.log(chalk.gray('  • token: not set'));
    }
    console.log(chalk.gray(`  • guildId: ${tmcConfig.guildId || 'not set'}`));
    console.log(chalk.gray(`  • chatChannelId: ${tmcConfig.chatChannelId || 'not set'}`));
    console.log(chalk.gray(`  • statusChannelId: ${tmcConfig.statusChannelId || 'not set'}`));
    console.log(chalk.white('\nWebhooks configured:'), Object.keys(webhooks).length);
    console.log(chalk.white('Discord fully configured:'), config.isDiscordConfigured() ? chalk.green('Yes') : chalk.yellow('No'));
    
    console.log(chalk.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
    
    // Helpful tips
    if (!config.hasOpenClawConfig()) {
      console.log(chalk.yellow('💡 Tip: OpenClaw config not found. Make sure OpenClaw is installed and run `openclaw onboard` first.\n'));
    } else if (!config.hasOpenClawDiscordConfig()) {
      console.log(chalk.yellow('💡 Tip: OpenClaw config exists but no Discord token found.'));
      console.log(chalk.gray('   The config structure may be different than expected.'));
      console.log(chalk.gray('   Please share the output above (without --raw) to help diagnose.\n'));
    } else if (!extracted?.token) {
      console.log(chalk.yellow('💡 Tip: Discord config detected but token not extracted.'));
      console.log(chalk.gray('   Check the paths above to see where Discord settings are stored.\n'));
    }
  });

// Daemon mode - auto-connect to OpenClaw and forward messages via webhooks
program
  .command('daemon')
  .description('Run daemon mode to auto-connect to OpenClaw and forward agent messages via webhooks')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--url <url>', 'OpenClaw Gateway URL', 'ws://127.0.0.1:18789')
  .action(async (options) => {
    console.log(chalk.cyan(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🦀 Too Many Claw - Daemon Mode                           ║
║                                                            ║
║   Auto-connects to OpenClaw and forwards agent messages    ║
║   through Discord webhooks                                 ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`));

    const config = new ConfigManager();
    
    // Check if webhooks are configured
    const webhooks = config.getAllWebhooks();
    if (Object.keys(webhooks).length === 0) {
      console.log(chalk.yellow('⚠ No webhooks configured.'));
      console.log(chalk.gray('  Agent messages will not be forwarded to Discord.'));
      console.log(chalk.gray('  Run `tmc setup` to configure webhooks.\n'));
    } else {
      console.log(chalk.green(`✓ ${Object.keys(webhooks).length} webhooks loaded\n`));
    }

    const daemon = new OpenClawDaemon({
      gatewayUrl: options.url,
      verbose: options.verbose || false,
      autoStart: true,
    });

    let statusSpinner = ora('Connecting to OpenClaw Gateway...').start();
    let statsInterval: NodeJS.Timeout | null = null;
    let isShuttingDown = false;

    // Connection event handlers
    daemon.on('connected', () => {
      statusSpinner.succeed('Connected to OpenClaw Gateway');
      console.log(chalk.green('\n🦞 Daemon is now running!'));
      console.log(chalk.gray('  Listening for agent responses...'));
      console.log(chalk.gray('  Press Ctrl+C to stop.\n'));

      // Start periodic stats display
      statsInterval = setInterval(() => {
        const stats = daemon.getStats();
        if (stats.messagesProcessed > 0 || options.verbose) {
          const uptime = formatUptime(stats.uptimeMs);
          console.log(chalk.gray(
            `[Stats] Uptime: ${uptime} | Messages: ${stats.messagesProcessed} processed, ` +
            `${stats.messagesForwarded} forwarded | Errors: ${stats.webhookErrors}`
          ));
        }
      }, 30000); // Every 30 seconds
    });

    daemon.on('disconnected', (reason: string) => {
      if (!isShuttingDown) {
        console.log(chalk.yellow(`\n⚠ Disconnected: ${reason}`));
        statusSpinner = ora('Waiting for OpenClaw Gateway...').start();
      }
    });

    daemon.on('reconnecting', (attempt: number) => {
      statusSpinner.text = `Reconnecting to OpenClaw Gateway... (attempt ${attempt})`;
    });

    daemon.on('openclaw_detected', () => {
      if (options.verbose) {
        console.log(chalk.green('\n✓ OpenClaw process detected'));
      }
    });

    daemon.on('openclaw_lost', () => {
      console.log(chalk.yellow('\n⚠ OpenClaw process no longer detected'));
      console.log(chalk.gray('  Daemon will auto-reconnect when OpenClaw starts.\n'));
      statusSpinner = ora('Waiting for OpenClaw...').start();
    });

    daemon.on('message_forwarded', (agentId: string, content: string) => {
      if (options.verbose) {
        const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;
        console.log(chalk.blue(`  → Forwarded from ${agentId}: ${preview}`));
      }
    });

    daemon.on('error', (error: Error) => {
      if (options.verbose) {
        console.log(chalk.red(`  ✗ Error: ${error.message}`));
      }
    });

    // Graceful shutdown handler
    const shutdown = async () => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      
      // Stop any active spinner before printing
      statusSpinner.stop();

      console.log(chalk.yellow('\n\nShutting down daemon...'));
      
      if (statsInterval) {
        clearInterval(statsInterval);
      }

      // Print final stats
      const stats = daemon.getStats();
      console.log(chalk.cyan('\n━━━ Final Statistics ━━━'));
      console.log(chalk.white(`  Uptime: ${formatUptime(stats.uptimeMs)}`));
      console.log(chalk.white(`  Messages processed: ${stats.messagesProcessed}`));
      console.log(chalk.white(`  Messages forwarded: ${stats.messagesForwarded}`));
      console.log(chalk.white(`  Webhook errors: ${stats.webhookErrors}`));
      console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━\n'));

      await daemon.stop();
      console.log(chalk.green('Daemon stopped. Goodbye! 👋\n'));
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Start the daemon
    try {
      await daemon.start();

      // If we're here and not connected after start, show helpful message
      if (!daemon.isConnected) {
        statusSpinner.warn('OpenClaw Gateway not found');
        console.log(chalk.yellow('\n⚠ Could not connect to OpenClaw Gateway.'));
        console.log(chalk.gray('\nMake sure OpenClaw is running:'));
        console.log(chalk.white('  $ openclaw gateway run\n'));
        console.log(chalk.gray('The daemon will keep trying to connect...'));
        statusSpinner = ora('Waiting for OpenClaw Gateway...').start();
      }
    } catch (error) {
      statusSpinner.fail('Failed to start daemon');
      console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

/**
 * Format uptime in human-readable format
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

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
