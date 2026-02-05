#!/usr/bin/env node
/**
 * Too Many Claw - CLI Entry Point
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { TerminalUI } from './simulation/TerminalUI.js';
import { ConfigManager } from './config/ConfigManager.js';
import { AGENT_DEFINITIONS } from './agents/definitions.js';
import { DiscordAdapter } from './discord/DiscordAdapter.js';
import { Orchestrator } from './core/Orchestrator.js';
import { AgentCategory } from './types/index.js';
import { OpenClawDaemon } from './daemon/index.js';

// ============================================
// Daemon PID File Management
// ============================================

const PID_FILE_PATH = path.join(os.homedir(), '.openclaw', 'tmc-daemon.pid');
const SYSTEMD_SERVICE_PATH = '/etc/systemd/system/tmc-daemon.service';

/**
 * Get the path to the TMC executable
 */
function getTmcBinaryPath(): string {
  // Try to find the tmc binary
  try {
    const npmGlobalBin = execSync('npm bin -g', { encoding: 'utf8' }).trim();
    const tmcPath = path.join(npmGlobalBin, 'tmc');
    if (fs.existsSync(tmcPath)) {
      return tmcPath;
    }
  } catch {
    // Ignore
  }
  
  // Fallback to which command
  try {
    return execSync('which tmc', { encoding: 'utf8' }).trim();
  } catch {
    // Fallback to process.argv[1] (current script)
    return process.argv[1];
  }
}

/**
 * Write PID to file
 */
function writePidFile(pid: number): void {
  const dir = path.dirname(PID_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(PID_FILE_PATH, pid.toString(), 'utf8');
}

/**
 * Read PID from file
 */
function readPidFile(): number | null {
  try {
    if (fs.existsSync(PID_FILE_PATH)) {
      const pid = parseInt(fs.readFileSync(PID_FILE_PATH, 'utf8').trim(), 10);
      return isNaN(pid) ? null : pid;
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Remove PID file
 */
function removePidFile(): void {
  try {
    if (fs.existsSync(PID_FILE_PATH)) {
      fs.unlinkSync(PID_FILE_PATH);
    }
  } catch {
    // Ignore
  }
}

/**
 * Check if a process is running by PID
 */
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get daemon status
 */
function getDaemonStatus(): { running: boolean; pid: number | null; systemdInstalled: boolean; systemdActive: boolean } {
  const pid = readPidFile();
  const running = pid !== null && isProcessRunning(pid);
  
  let systemdInstalled = false;
  let systemdActive = false;
  
  try {
    systemdInstalled = fs.existsSync(SYSTEMD_SERVICE_PATH);
    if (systemdInstalled) {
      const status = execSync('systemctl is-active tmc-daemon 2>/dev/null || true', { encoding: 'utf8' }).trim();
      systemdActive = status === 'active';
    }
  } catch {
    // Ignore
  }
  
  return { running, pid, systemdInstalled, systemdActive };
}

/**
 * Generate systemd service file content
 */
function generateSystemdService(): string {
  const tmcPath = getTmcBinaryPath();
  const nodePath = process.execPath;
  const user = os.userInfo().username;
  const homeDir = os.homedir();
  
  return `[Unit]
Description=Too Many Claw - OpenClaw Webhook Daemon
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=${user}
WorkingDirectory=${homeDir}
ExecStart=${nodePath} ${tmcPath} daemon run
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=HOME=${homeDir}

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=tmc-daemon

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=${homeDir}/.openclaw
PrivateTmp=true

[Install]
WantedBy=multi-user.target
`;
}

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
const daemonCommand = program
  .command('daemon')
  .description('Manage the TMC daemon for auto-forwarding agent messages via webhooks');

// tmc daemon run (or just tmc daemon with --detach)
daemonCommand
  .command('run', { isDefault: true })
  .description('Run daemon mode to auto-connect to OpenClaw and forward agent messages')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--url <url>', 'OpenClaw Gateway URL', 'ws://127.0.0.1:18789')
  .option('-d, --detach', 'Run daemon in background')
  .action(async (options) => {
    // Handle detach mode - fork to background
    if (options.detach) {
      const status = getDaemonStatus();
      
      if (status.running) {
        console.log(chalk.yellow(`\n⚠ Daemon is already running (PID: ${status.pid})\n`));
        console.log(chalk.gray('Use `tmc daemon stop` to stop the running daemon.\n'));
        process.exit(1);
      }
      
      console.log(chalk.cyan('\n🦀 Starting TMC daemon in background...\n'));
      
      // Build args for child process (remove --detach)
      const args = ['daemon', 'run'];
      if (options.verbose) args.push('--verbose');
      if (options.url !== 'ws://127.0.0.1:18789') args.push('--url', options.url);
      
      const tmcPath = getTmcBinaryPath();
      const child = spawn(process.execPath, [tmcPath, ...args], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, TMC_DAEMON_CHILD: '1' },
      });
      
      child.unref();
      
      if (child.pid) {
        writePidFile(child.pid);
        console.log(chalk.green(`✓ Daemon started in background (PID: ${child.pid})`));
        console.log(chalk.gray(`\nPID file: ${PID_FILE_PATH}`));
        console.log(chalk.gray('\nUseful commands:'));
        console.log(chalk.white('  tmc daemon status') + chalk.gray(' - Check daemon status'));
        console.log(chalk.white('  tmc daemon stop') + chalk.gray('   - Stop the daemon'));
        console.log(chalk.white('  tmc daemon logs') + chalk.gray('   - View daemon logs (if using systemd)\n'));
      } else {
        console.log(chalk.red('✗ Failed to start daemon in background\n'));
        process.exit(1);
      }
      
      process.exit(0);
    }
    
    // Normal foreground mode
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

    // If running as daemon child, write PID file
    if (process.env.TMC_DAEMON_CHILD === '1') {
      writePidFile(process.pid);
    }

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
      if (process.env.TMC_DAEMON_CHILD !== '1') {
        console.log(chalk.gray('  Press Ctrl+C to stop.\n'));
      } else {
        console.log(chalk.gray('  Running in background mode.\n'));
      }

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
      removePidFile();
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
      removePidFile();
      process.exit(1);
    }
  });

// tmc daemon stop
daemonCommand
  .command('stop')
  .description('Stop the running daemon')
  .action(() => {
    console.log(chalk.cyan('\n🦀 Stopping TMC daemon...\n'));
    
    const status = getDaemonStatus();
    
    if (status.systemdActive) {
      console.log(chalk.gray('Daemon is running as systemd service. Stopping via systemctl...\n'));
      try {
        execSync('sudo systemctl stop tmc-daemon', { stdio: 'inherit' });
        console.log(chalk.green('✓ Daemon service stopped\n'));
      } catch {
        console.log(chalk.red('✗ Failed to stop daemon service.'));
        console.log(chalk.gray('  Try running: sudo systemctl stop tmc-daemon\n'));
      }
      return;
    }
    
    if (!status.running || !status.pid) {
      console.log(chalk.yellow('⚠ Daemon is not running\n'));
      removePidFile();
      return;
    }
    
    try {
      process.kill(status.pid, 'SIGTERM');
      console.log(chalk.green(`✓ Sent stop signal to daemon (PID: ${status.pid})`));
      
      // Wait a moment and check if it stopped
      setTimeout(() => {
        if (isProcessRunning(status.pid!)) {
          console.log(chalk.yellow('  Daemon is still shutting down...'));
        } else {
          console.log(chalk.green('  Daemon stopped successfully\n'));
          removePidFile();
        }
      }, 1000);
    } catch (error) {
      console.log(chalk.red(`✗ Failed to stop daemon: ${error instanceof Error ? error.message : 'Unknown error'}`));
      removePidFile();
    }
  });

// tmc daemon status
daemonCommand
  .command('status')
  .description('Show daemon status')
  .action(() => {
    console.log(chalk.cyan('\n🦀 TMC Daemon Status\n'));
    
    const status = getDaemonStatus();
    
    console.log(chalk.yellow('━━━ Process Status ━━━\n'));
    
    if (status.running && status.pid) {
      console.log(chalk.green(`  ✓ Daemon is running (PID: ${status.pid})`));
    } else if (status.pid) {
      console.log(chalk.red(`  ✗ Daemon is not running (stale PID file: ${status.pid})`));
      console.log(chalk.gray('    Cleaning up stale PID file...'));
      removePidFile();
    } else {
      console.log(chalk.gray('  ○ Daemon is not running'));
    }
    
    console.log(chalk.yellow('\n━━━ Systemd Service ━━━\n'));
    
    if (status.systemdInstalled) {
      console.log(chalk.green('  ✓ Service installed'));
      if (status.systemdActive) {
        console.log(chalk.green('  ✓ Service is active'));
      } else {
        console.log(chalk.yellow('  ○ Service is not active'));
      }
      
      // Show more details from systemctl
      try {
        const serviceStatus = execSync('systemctl status tmc-daemon --no-pager 2>&1 | head -10', { encoding: 'utf8' });
        console.log(chalk.gray('\n  Service details:'));
        serviceStatus.split('\n').forEach(line => {
          console.log(chalk.gray(`    ${line}`));
        });
      } catch {
        // Ignore
      }
    } else {
      console.log(chalk.gray('  ○ Service not installed'));
      console.log(chalk.gray('    Run `tmc daemon install` to install as systemd service'));
    }
    
    console.log(chalk.yellow('\n━━━ Quick Actions ━━━\n'));
    
    if (status.running || status.systemdActive) {
      console.log(chalk.white('  tmc daemon stop') + chalk.gray('    - Stop the daemon'));
    } else {
      console.log(chalk.white('  tmc daemon run') + chalk.gray('     - Start in foreground'));
      console.log(chalk.white('  tmc daemon run -d') + chalk.gray(' - Start in background'));
    }
    
    if (status.systemdInstalled) {
      console.log(chalk.white('  tmc daemon logs') + chalk.gray('    - View logs'));
      console.log(chalk.white('  tmc daemon uninstall') + chalk.gray(' - Remove systemd service'));
    } else {
      console.log(chalk.white('  tmc daemon install') + chalk.gray(' - Install as systemd service'));
    }
    
    console.log();
  });

// tmc daemon install
daemonCommand
  .command('install')
  .description('Install daemon as systemd service (requires sudo)')
  .action(async () => {
    console.log(chalk.cyan('\n🦀 Installing TMC daemon as systemd service...\n'));
    
    // Check if already installed
    if (fs.existsSync(SYSTEMD_SERVICE_PATH)) {
      console.log(chalk.yellow('⚠ Systemd service already installed.'));
      
      const { reinstall } = await inquirer.prompt([{
        type: 'confirm',
        name: 'reinstall',
        message: 'Would you like to reinstall/update the service?',
        default: false,
      }]);
      
      if (!reinstall) {
        console.log(chalk.gray('\nInstallation cancelled.\n'));
        return;
      }
    }
    
    // Check if running as root (needed for systemd)
    if (process.getuid && process.getuid() !== 0) {
      console.log(chalk.yellow('⚠ This command requires sudo privileges.\n'));
      console.log(chalk.gray('The following commands will be run with sudo:'));
      console.log(chalk.gray('  1. Write service file to /etc/systemd/system/'));
      console.log(chalk.gray('  2. Reload systemd daemon'));
      console.log(chalk.gray('  3. Enable and start the service\n'));
      
      const { proceed } = await inquirer.prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'Continue with installation?',
        default: true,
      }]);
      
      if (!proceed) {
        console.log(chalk.yellow('\nInstallation cancelled.\n'));
        return;
      }
    }
    
    // Generate service file
    const serviceContent = generateSystemdService();
    
    // Write to temp file first
    const tempPath = path.join(os.tmpdir(), 'tmc-daemon.service');
    fs.writeFileSync(tempPath, serviceContent, 'utf8');
    
    console.log(chalk.gray('Generated service file:\n'));
    console.log(chalk.gray('─'.repeat(50)));
    serviceContent.split('\n').forEach(line => {
      console.log(chalk.gray(`  ${line}`));
    });
    console.log(chalk.gray('─'.repeat(50)));
    console.log();
    
    try {
      // Install service file
      const installSpinner = ora('Installing service file...').start();
      execSync(`sudo cp ${tempPath} ${SYSTEMD_SERVICE_PATH}`, { stdio: 'pipe' });
      execSync(`sudo chmod 644 ${SYSTEMD_SERVICE_PATH}`, { stdio: 'pipe' });
      installSpinner.succeed('Service file installed');
      
      // Reload systemd
      const reloadSpinner = ora('Reloading systemd...').start();
      execSync('sudo systemctl daemon-reload', { stdio: 'pipe' });
      reloadSpinner.succeed('Systemd reloaded');
      
      // Enable service
      const enableSpinner = ora('Enabling service...').start();
      execSync('sudo systemctl enable tmc-daemon', { stdio: 'pipe' });
      enableSpinner.succeed('Service enabled (will start on boot)');
      
      // Ask to start now
      const { startNow } = await inquirer.prompt([{
        type: 'confirm',
        name: 'startNow',
        message: 'Start the daemon service now?',
        default: true,
      }]);
      
      if (startNow) {
        const startSpinner = ora('Starting service...').start();
        execSync('sudo systemctl start tmc-daemon', { stdio: 'pipe' });
        startSpinner.succeed('Service started');
      }
      
      console.log(chalk.green('\n✓ TMC daemon installed as systemd service!\n'));
      console.log(chalk.gray('Useful commands:'));
      console.log(chalk.white('  tmc daemon status') + chalk.gray('      - Check daemon status'));
      console.log(chalk.white('  tmc daemon logs') + chalk.gray('        - View daemon logs'));
      console.log(chalk.white('  sudo systemctl restart tmc-daemon') + chalk.gray(' - Restart daemon'));
      console.log(chalk.white('  tmc daemon uninstall') + chalk.gray('   - Remove systemd service\n'));
      
    } catch (error) {
      console.log(chalk.red(`\n✗ Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      console.log(chalk.gray('\nYou may need to run with sudo or check permissions.\n'));
      process.exit(1);
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // Ignore
      }
    }
  });

// tmc daemon uninstall
daemonCommand
  .command('uninstall')
  .description('Uninstall daemon systemd service (requires sudo)')
  .action(async () => {
    console.log(chalk.cyan('\n🦀 Uninstalling TMC daemon systemd service...\n'));
    
    if (!fs.existsSync(SYSTEMD_SERVICE_PATH)) {
      console.log(chalk.yellow('⚠ Systemd service is not installed.\n'));
      return;
    }
    
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to remove the TMC daemon service?',
      default: false,
    }]);
    
    if (!confirm) {
      console.log(chalk.yellow('\nUninstallation cancelled.\n'));
      return;
    }
    
    try {
      // Stop service if running
      const stopSpinner = ora('Stopping service...').start();
      try {
        execSync('sudo systemctl stop tmc-daemon 2>/dev/null', { stdio: 'pipe' });
        stopSpinner.succeed('Service stopped');
      } catch {
        stopSpinner.info('Service was not running');
      }
      
      // Disable service
      const disableSpinner = ora('Disabling service...').start();
      try {
        execSync('sudo systemctl disable tmc-daemon 2>/dev/null', { stdio: 'pipe' });
        disableSpinner.succeed('Service disabled');
      } catch {
        disableSpinner.info('Service was not enabled');
      }
      
      // Remove service file
      const removeSpinner = ora('Removing service file...').start();
      execSync(`sudo rm -f ${SYSTEMD_SERVICE_PATH}`, { stdio: 'pipe' });
      removeSpinner.succeed('Service file removed');
      
      // Reload systemd
      const reloadSpinner = ora('Reloading systemd...').start();
      execSync('sudo systemctl daemon-reload', { stdio: 'pipe' });
      reloadSpinner.succeed('Systemd reloaded');
      
      console.log(chalk.green('\n✓ TMC daemon service uninstalled successfully!\n'));
      console.log(chalk.gray('You can still run the daemon manually with:'));
      console.log(chalk.white('  tmc daemon run') + chalk.gray('     - Run in foreground'));
      console.log(chalk.white('  tmc daemon run -d') + chalk.gray(' - Run in background\n'));
      
    } catch (error) {
      console.log(chalk.red(`\n✗ Uninstallation failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      console.log(chalk.gray('\nYou may need to run with sudo or check permissions.\n'));
      process.exit(1);
    }
  });

// tmc daemon logs
daemonCommand
  .command('logs')
  .description('View daemon logs (systemd journalctl)')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .action((options) => {
    const status = getDaemonStatus();
    
    if (!status.systemdInstalled) {
      console.log(chalk.yellow('\n⚠ Systemd service is not installed.'));
      console.log(chalk.gray('Logs are only available when running as systemd service.'));
      console.log(chalk.gray('\nRun `tmc daemon install` to install as systemd service.\n'));
      return;
    }
    
    const args = ['journalctl', '-u', 'tmc-daemon', '--no-pager'];
    if (options.follow) {
      args.push('-f');
    } else {
      args.push('-n', options.lines);
    }
    
    console.log(chalk.cyan(`\n🦀 TMC Daemon Logs (last ${options.lines} lines)\n`));
    console.log(chalk.gray('─'.repeat(60)));
    
    try {
      const child = spawn(args[0], args.slice(1), {
        stdio: 'inherit',
      });
      
      child.on('error', (error) => {
        console.log(chalk.red(`\n✗ Failed to read logs: ${error.message}\n`));
      });
    } catch (error) {
      console.log(chalk.red(`\n✗ Failed to read logs: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
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

// Repair command for fixing configuration issues
program
  .command('repair')
  .description('Diagnose and repair TMC configuration issues')
  .option('--check', 'Dry run - only show what would be fixed without making changes')
  .option('--force', 'Skip confirmation prompts')
  .option('--restore', 'Restore configuration from a backup')
  .action(async (options) => {
    console.log(chalk.cyan(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🔧 Too Many Claw - Configuration Repair                  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`));

    const config = new ConfigManager();

    // Handle --restore option
    if (options.restore) {
      await handleBackupRestore(config);
      return;
    }

    // Generate repair report
    console.log(chalk.yellow('━━━ Configuration Health Check ━━━\n'));

    const report = config.getRepairReport();
    const validationErrors = config.validateConfig();

    // Display config file status
    console.log(chalk.white('Config file:'));
    if (!report.configFileExists) {
      console.log(chalk.gray('  ○ Not found (will be created on first use)'));
    } else if (report.configFileCorrupted) {
      console.log(chalk.red('  ✗ CORRUPTED - Invalid JSON'));
    } else {
      console.log(chalk.green('  ✓ Valid'));
    }

    // Display Discord settings status
    console.log(chalk.white('\nDiscord configuration:'));
    const discordConfig = config.getDiscordConfig();
    if (discordConfig.token) {
      console.log(chalk.green('  ✓ Token configured'));
    } else {
      console.log(chalk.yellow('  ○ Token not set'));
    }
    if (discordConfig.guildId) {
      console.log(chalk.green(`  ✓ Guild ID: ${discordConfig.guildId}`));
    } else {
      console.log(chalk.yellow('  ○ Guild ID not set'));
    }
    if (discordConfig.chatChannelId) {
      console.log(chalk.green(`  ✓ Chat Channel: ${discordConfig.chatChannelId}`));
    } else {
      console.log(chalk.yellow('  ○ Chat Channel not set'));
    }

    // Display webhook status
    const webhooks = config.getAllWebhooks();
    const webhookCount = Object.keys(webhooks).length;
    console.log(chalk.white('\nWebhooks:'));
    console.log(chalk.gray(`  • ${webhookCount} webhook(s) configured`));
    
    if (report.invalidWebhooks.length > 0) {
      console.log(chalk.red(`  ✗ ${report.invalidWebhooks.length} invalid webhook(s) found:`));
      report.invalidWebhooks.forEach(agentId => {
        console.log(chalk.red(`    - ${agentId}`));
      });
    } else if (webhookCount > 0) {
      console.log(chalk.green('  ✓ All webhooks valid'));
    }

    // Display validation errors
    if (validationErrors.length > 0) {
      console.log(chalk.white('\nValidation issues:'));
      validationErrors.forEach(err => {
        const icon = err.severity === 'error' ? chalk.red('✗') : chalk.yellow('⚠');
        console.log(`  ${icon} ${err.field}: ${err.message}`);
      });
    }

    // Display OpenClaw sync opportunity
    if (report.canImportFromOpenClaw) {
      console.log(chalk.white('\nOpenClaw integration:'));
      console.log(chalk.green('  ✓ OpenClaw Discord settings available'));
      console.log(chalk.gray(`    Available: ${report.openClawSettings.join(', ')}`));
    }

    // Summary
    console.log(chalk.yellow('\n━━━ Summary ━━━\n'));

    const issues: string[] = [];
    if (report.configFileCorrupted) issues.push('Corrupted config file');
    if (report.invalidWebhooks.length > 0) issues.push(`${report.invalidWebhooks.length} invalid webhook(s)`);
    if (report.missingFields.length > 0 && report.canImportFromOpenClaw) {
      issues.push(`Missing fields that can be imported from OpenClaw`);
    }

    if (issues.length === 0) {
      console.log(chalk.green('✓ No issues found! Configuration is healthy.\n'));
      return;
    }

    console.log(chalk.yellow(`Found ${issues.length} issue(s) that can be repaired:`));
    issues.forEach((issue, i) => {
      console.log(chalk.yellow(`  ${i + 1}. ${issue}`));
    });

    // Dry run mode
    if (options.check) {
      console.log(chalk.cyan('\n[Dry run mode - no changes made]'));
      console.log(chalk.gray('Run without --check to apply repairs.\n'));
      return;
    }

    // Confirmation
    if (!options.force) {
      console.log();
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Would you like to repair these issues?',
          default: true,
        },
      ]);

      if (!confirm) {
        console.log(chalk.yellow('\nRepair cancelled.\n'));
        return;
      }
    }

    // Create backup before repair
    const backupSpinner = ora('Creating backup...').start();
    const backupPath = config.backupConfig();
    if (backupPath) {
      backupSpinner.succeed(`Backup created: ${backupPath}`);
    } else {
      backupSpinner.info('No existing config to backup');
    }

    // Run repair
    const repairSpinner = ora('Repairing configuration...').start();
    const result = config.repairConfig();
    repairSpinner.succeed('Repair complete');

    // Show results
    console.log(chalk.yellow('\n━━━ Repair Results ━━━\n'));

    if (result.configRebuilt) {
      console.log(chalk.green('  ✓ Config file rebuilt from defaults'));
    }

    if (result.webhooksRemoved > 0) {
      console.log(chalk.green(`  ✓ Removed ${result.webhooksRemoved} invalid webhook(s)`));
    }

    if (result.openClawImported) {
      console.log(chalk.green('  ✓ Imported from OpenClaw:'));
      result.importedFields.forEach(field => {
        console.log(chalk.gray(`    - ${field}`));
      });
    }

    if (!result.configRebuilt && result.webhooksRemoved === 0 && !result.openClawImported) {
      console.log(chalk.gray('  No repairs were necessary.'));
    }

    // Final status
    console.log();
    if (config.isDiscordConfigured()) {
      console.log(chalk.green('✓ Discord is now fully configured!'));
      console.log(chalk.gray('  Run `tmc start` to start the bot.\n'));
    } else {
      console.log(chalk.yellow('⚠ Discord is not fully configured.'));
      console.log(chalk.gray('  Run `tmc setup` to complete configuration.\n'));
    }
  });

/**
 * Handle backup restoration flow
 */
async function handleBackupRestore(config: ConfigManager): Promise<void> {
  console.log(chalk.yellow('━━━ Restore from Backup ━━━\n'));

  const backups = config.listBackups();

  if (backups.length === 0) {
    console.log(chalk.yellow('No backups found.\n'));
    console.log(chalk.gray('Backups are created automatically when running `tmc repair`.'));
    console.log(chalk.gray(`Backup location: ~/.openclaw/\n`));
    return;
  }

  console.log(chalk.white(`Found ${backups.length} backup(s):\n`));

  // Create choices from backups
  const choices = backups.map((backupPath, index) => {
    const filename = backupPath.split('/').pop() || backupPath;
    // Extract timestamp from filename
    const match = filename.match(/backup-(.+)\.json$/);
    const timestamp = match ? match[1].replace(/-/g, ':').replace('T', ' ') : 'Unknown';
    return {
      name: `${index + 1}. ${filename} (${timestamp})`,
      value: backupPath,
    };
  });

  choices.push({ name: 'Cancel', value: '' });

  const { selectedBackup } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedBackup',
      message: 'Select a backup to restore:',
      choices,
    },
  ]);

  if (!selectedBackup) {
    console.log(chalk.yellow('\nRestore cancelled.\n'));
    return;
  }

  // Confirm restoration
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: chalk.yellow('This will overwrite your current configuration. Continue?'),
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(chalk.yellow('\nRestore cancelled.\n'));
    return;
  }

  // Create backup of current config before restoring
  const currentBackup = config.backupConfig();
  if (currentBackup) {
    console.log(chalk.gray(`\nCurrent config backed up to: ${currentBackup}`));
  }

  // Restore
  const spinner = ora('Restoring configuration...').start();
  const success = config.restoreFromBackup(selectedBackup);

  if (success) {
    spinner.succeed('Configuration restored successfully!');
    console.log(chalk.green('\n✓ Your configuration has been restored from the backup.\n'));
  } else {
    spinner.fail('Failed to restore configuration');
    console.log(chalk.red('\nThe backup file may be corrupted or inaccessible.\n'));
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
