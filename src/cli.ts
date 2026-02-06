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
import { AgentCategory, ModelTier } from './types/index.js';
import { OpenClawDaemon } from './daemon/index.js';
import { registerTmcAgents } from './scripts/postinstall.js';
import { installPlugin as installOpenClawPlugin, isPluginInstalled } from './openclaw-plugin/install.js';

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

// Simplified setup wizard
program
  .command('setup')
  .description('Quick setup for Too Many Claw')
  .action(async () => {
    console.log(chalk.cyan(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🦀 Too Many Claw - Quick Setup                           ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`));

    const config = new ConfigManager();

    // Step 1: Auto-import from OpenClaw
    console.log(chalk.cyan('\n📋 Step 1/4: Discord Configuration\n'));
    
    if (config.hasOpenClawDiscordConfig()) {
      console.log(chalk.green('✓ OpenClaw Discord configuration detected!'));
      const result = config.importFromOpenClaw();
      if (result.success) {
        console.log(chalk.green('✓ Settings imported from OpenClaw'));
        if (result.imported.token) console.log(chalk.gray('  • Bot Token'));
        if (result.imported.guildId) console.log(chalk.gray(`  • Guild ID: ${result.imported.guildId}`));
        if (result.imported.chatChannelId) console.log(chalk.gray(`  • Chat Channel: ${result.imported.chatChannelId}`));
      }
    } else {
      console.log(chalk.yellow('OpenClaw Discord config not found.'));
      console.log(chalk.gray('Please configure Discord settings manually.\n'));
    }

    // Step 2: Verify/configure Discord settings
    const currentDiscord = config.getDiscordConfig();
    const needsToken = !currentDiscord.token;
    const needsGuild = !currentDiscord.guildId;
    const needsChannel = !currentDiscord.chatChannelId;

    if (needsToken || needsGuild || needsChannel) {
      console.log(chalk.yellow('\nSome Discord settings are missing. Please provide:\n'));

      const answers = await inquirer.prompt([
        ...(needsToken ? [{
          type: 'password',
          name: 'token',
          message: 'Discord Bot Token:',
          mask: '*',
          validate: (input: string) => input.length >= 50 ? true : 'Please enter a valid Discord bot token',
        }] : []),
        ...(needsGuild ? [{
          type: 'input',
          name: 'guildId',
          message: 'Discord Server (Guild) ID:',
          validate: (input: string) => /^\d{17,19}$/.test(input) ? true : 'Please enter a valid Discord server ID',
        }] : []),
        ...(needsChannel ? [{
          type: 'input',
          name: 'chatChannelId',
          message: 'Chat Channel ID:',
          validate: (input: string) => /^\d{17,19}$/.test(input) ? true : 'Please enter a valid channel ID',
        }] : []),
      ]);

      config.setDiscordConfig({
        token: answers.token || currentDiscord.token,
        guildId: answers.guildId || currentDiscord.guildId,
        chatChannelId: answers.chatChannelId || currentDiscord.chatChannelId,
        statusChannelId: currentDiscord.statusChannelId,
      });

      console.log(chalk.green('\n✓ Discord settings saved!'));
    } else {
      console.log(chalk.green('\n✓ Discord is already configured!'));
    }

    // Step 2: Auto-create single base webhook
    console.log(chalk.cyan('\n📋 Step 2/4: Webhook Configuration\n'));

    const discordConfig = config.getDiscordConfig();
    
    if (!discordConfig.token || !discordConfig.chatChannelId) {
      console.log(chalk.red('❌ Discord not fully configured. Cannot create webhook.'));
      console.log(chalk.gray('Run `tmc setup` again after configuring Discord.\n'));
      return;
    }

    // Check if base webhook already exists
    if (config.hasBaseWebhook()) {
      console.log(chalk.green('✓ Base webhook already configured!'));
      console.log(chalk.gray(`  All ${AGENT_DEFINITIONS.length} agents use this shared webhook.\n`));
    } else {
      const spinner = ora('Connecting to Discord...').start();

      try {
        const adapter = new DiscordAdapter({
          token: discordConfig.token,
          guildId: discordConfig.guildId || '0',
          chatChannelId: discordConfig.chatChannelId,
          statusChannelId: discordConfig.statusChannelId,
        });

        await adapter.connect();
        await new Promise(resolve => setTimeout(resolve, 1000));
        spinner.succeed('Connected to Discord');

        // Auto-detect guildId if not set
        if (!discordConfig.guildId) {
          const detectedGuildId = await adapter.detectGuildId();
          if (detectedGuildId) {
            config.updateGuildId(detectedGuildId);
            console.log(chalk.green(`✓ Detected server ID: ${detectedGuildId}`));
          }
        }

        // Check webhook permission
        const hasPermission = await adapter.hasWebhookPermission(discordConfig.chatChannelId);
        if (!hasPermission) {
          spinner.fail('Bot lacks MANAGE_WEBHOOKS permission');
          console.log(chalk.red('\n❌ Grant "Manage Webhooks" permission to the bot and try again.\n'));
          await adapter.disconnect();
          return;
        }

        // Create a single base webhook
        const webhookSpinner = ora('Creating base webhook...').start();
        
        // Create webhook with TMC name
        const webhooks = await adapter.autoCreateWebhooksForAgents(
          discordConfig.chatChannelId,
          [{ id: 'tmc-base', name: 'Too Many Claw', emoji: '🦀', category: AgentCategory.CORE, role: 'Base webhook', model: ModelTier.SONNET }]
        );

        if (webhooks['tmc-base']) {
          config.setBaseWebhook(webhooks['tmc-base']);
          webhookSpinner.succeed('Base webhook created!');
          console.log(chalk.green(`  All ${AGENT_DEFINITIONS.length} agents will use this webhook with unique names/avatars.\n`));
        } else {
          webhookSpinner.fail('Failed to create webhook');
          console.log(chalk.yellow('\nYou can manually set a webhook URL with: tmc webhook <URL>\n'));
        }

        await adapter.disconnect();
      } catch (error) {
        spinner.fail('Failed to connect to Discord');
        console.log(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`));
        return;
      }
    }

    // Step 4: Register agents to OpenClaw
    console.log(chalk.cyan('📋 Step 3/4: Agent Registration\n'));
    console.log(chalk.gray('Registering TMC agents to OpenClaw configuration...\n'));

    const agentSpinner = ora('Registering agents...').start();
    const registrationResult = await registerTmcAgents();

    if (!registrationResult.success) {
      agentSpinner.fail('Failed to register agents');
      console.log(chalk.red(`Error: ${registrationResult.error}\n`));
    } else {
      if (registrationResult.newlyAdded.length > 0) {
        agentSpinner.succeed(`Registered ${registrationResult.newlyAdded.length} new agent(s)`);
        console.log(chalk.green(`  • New: ${registrationResult.newlyAdded.slice(0, 5).join(', ')}${registrationResult.newlyAdded.length > 5 ? ` and ${registrationResult.newlyAdded.length - 5} more` : ''}`));
        console.log(chalk.gray(`  • Already registered: ${registrationResult.alreadyExisted.length} agent(s)`));
      } else {
        agentSpinner.succeed('All agents already registered');
        console.log(chalk.gray(`  ${registrationResult.totalAgents} agents configured in OpenClaw`));
      }

      // Show message interception info
      console.log(chalk.green('  ✓ Message interception enabled'));
      console.log(chalk.gray('    TMC daemon will intercept OpenClaw bot messages and resend via webhook'));
      
      // Clean up any invalid OpenClaw config keys
      if (registrationResult.webhookModeConfigured) {
        console.log(chalk.gray('    Cleaned up invalid OpenClaw config keys'));
      }
      
      // Show plugin installation status and configure with webhook URL
      const baseWebhookUrl = config.getBaseWebhook();
      if (registrationResult.pluginInstalled) {
        console.log(chalk.green('  ✓ OpenClaw tmc-webhook plugin installed'));
        // Configure the plugin with webhook URL
        if (baseWebhookUrl) {
          const { configurePlugin } = await import('./openclaw-plugin/install.js');
          await configurePlugin(baseWebhookUrl);
          console.log(chalk.green('  ✓ Plugin configured with webhook URL'));
        }
      } else {
        // Try to install plugin if not already done
        const installed = await isPluginInstalled();
        if (installed) {
          console.log(chalk.gray('  • OpenClaw tmc-webhook plugin already installed'));
        } else {
          const pluginResult = await installOpenClawPlugin();
          if (pluginResult.success) {
            console.log(chalk.green('  ✓ OpenClaw tmc-webhook plugin installed'));
          } else {
            console.log(chalk.yellow('  ⚠ Failed to install OpenClaw plugin'));
          }
        }
        // Configure the plugin with webhook URL regardless
        if (baseWebhookUrl) {
          const { configurePlugin } = await import('./openclaw-plugin/install.js');
          await configurePlugin(baseWebhookUrl);
          console.log(chalk.green('  ✓ Plugin configured with webhook URL'));
        }
      }
      console.log();
    }

    // Step 5: Start daemon?
    console.log(chalk.cyan('📋 Step 4/4: Daemon Setup\n'));
    console.log(chalk.gray('The daemon auto-forwards OpenClaw agent responses to Discord.\n'));

    const { startDaemon } = await inquirer.prompt([{
      type: 'list',
      name: 'startDaemon',
      message: 'Start daemon now?',
      choices: [
        { name: '🚀 Start daemon in background', value: 'background' },
        { name: '📺 Start daemon in foreground (see logs)', value: 'foreground' },
        { name: '⏭️  Skip (start later with `tmc daemon run`)', value: 'skip' },
      ],
    }]);

    console.log(chalk.green('\n✨ Setup Complete!\n'));
    viewConfiguration(config);

    if (startDaemon === 'background') {
      console.log(chalk.cyan('Starting daemon in background...\n'));
      const tmcPath = getTmcBinaryPath();
      const child = spawn(process.execPath, [tmcPath, 'daemon', 'run'], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, TMC_DAEMON_CHILD: '1' },
      });
      child.unref();
      if (child.pid) {
        writePidFile(child.pid);
        console.log(chalk.green(`✓ Daemon started (PID: ${child.pid})`));
        console.log(chalk.gray('  Check status: tmc daemon status'));
        console.log(chalk.gray('  View logs: tmc daemon logs\n'));
      }
    } else if (startDaemon === 'foreground') {
      console.log(chalk.cyan('Starting daemon in foreground...\n'));
      // Spawn daemon as child process with inherited stdio
      const tmcPath = getTmcBinaryPath();
      const child = spawn(process.execPath, [tmcPath, 'daemon', 'run'], {
        stdio: 'inherit',
      });
      child.on('close', (code) => {
        process.exit(code || 0);
      });
      return; // Don't exit, let the child process handle it
    } else {
      console.log(chalk.gray('Run `tmc daemon run` to start the daemon later.\n'));
    }
  });



function viewConfiguration(config: ConfigManager): void {
  console.log(chalk.cyan('\n━━━ Configuration Status ━━━\n'));

  // Discord settings
  const discord = config.getDiscordConfig();
  console.log(chalk.white('Discord:'));
  if (discord.token) {
    console.log(chalk.green(`  ✓ Token: ${discord.token.substring(0, 10)}...`));
  } else {
    console.log(chalk.yellow('  ○ Token: not set'));
  }
  if (discord.guildId) {
    console.log(chalk.green(`  ✓ Guild: ${discord.guildId}`));
  } else {
    console.log(chalk.yellow('  ○ Guild: not set'));
  }
  if (discord.chatChannelId) {
    console.log(chalk.green(`  ✓ Channel: ${discord.chatChannelId}`));
  } else {
    console.log(chalk.yellow('  ○ Channel: not set'));
  }

  // Webhook status
  console.log(chalk.white('\nWebhook:'));
  if (config.hasBaseWebhook()) {
    console.log(chalk.green(`  ✓ Base webhook configured (${AGENT_DEFINITIONS.length} agents)`));
  } else {
    console.log(chalk.yellow('  ○ Not configured'));
  }

  // Daemon status
  console.log(chalk.white('\nDaemon:'));
  const status = getDaemonStatus();
  if (status.running) {
    console.log(chalk.green(`  ✓ Running (PID: ${status.pid})`));
  } else if (status.systemdActive) {
    console.log(chalk.green('  ✓ Running (systemd)'));
  } else {
    console.log(chalk.gray('  ○ Not running'));
  }

  console.log();
}

// Config command to view current config
program
  .command('config')
  .description('View current TMC configuration')
  .action(() => {
    const config = new ConfigManager();
    viewConfiguration(config);
  });

// Reset command
program
  .command('reset')
  .description('Reset all TMC configuration')
  .action(async () => {
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: chalk.red('Are you sure you want to reset all configuration?'),
      default: false,
    }]);

    if (!confirm) {
      console.log(chalk.yellow('\nReset cancelled.\n'));
      return;
    }

    const config = new ConfigManager();
    config.reset();
    console.log(chalk.green('\n✓ Configuration reset.\n'));
  });

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
  .option('--no-intercept', 'Disable message interception (don\'t delete bot messages)')
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
      console.log(chalk.green(`✓ ${Object.keys(webhooks).length} webhooks loaded`));
    }

    // Show message interception status
    const discordConfig = config.getDiscordConfig();
    if (options.intercept !== false && discordConfig.token) {
      console.log(chalk.green('✓ Message interception enabled'));
      console.log(chalk.gray('  Bot messages will be deleted and resent via webhook\n'));
    } else if (options.intercept === false) {
      console.log(chalk.yellow('⚠ Message interception disabled'));
      console.log(chalk.gray('  Bot messages will NOT be replaced with webhook messages\n'));
    } else {
      console.log(chalk.yellow('⚠ Message interception unavailable (no Discord token)'));
      console.log(chalk.gray('  Run `tmc setup` to configure Discord\n'));
    }

    const daemon = new OpenClawDaemon({
      gatewayUrl: options.url,
      verbose: options.verbose || false,
      autoStart: true,
      interceptMessages: options.intercept !== false,
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
    const hasBaseWebhook = config.hasBaseWebhook();
    const agentWebhookCount = Object.keys(webhooks).filter(id => id !== 'base').length;
    
    console.log(chalk.white('\nWebhooks:'));
    if (hasBaseWebhook) {
      console.log(chalk.green('  ✓ Base webhook configured (all agents use shared webhook)'));
    } else {
      console.log(chalk.gray(`  • ${agentWebhookCount} agent-specific webhook(s) configured`));
    }
    
    if (report.invalidWebhooks.length > 0) {
      console.log(chalk.red(`  ✗ ${report.invalidWebhooks.length} invalid webhook(s) found:`));
      report.invalidWebhooks.forEach(agentId => {
        console.log(chalk.red(`    - ${agentId}`));
      });
    } else if (hasBaseWebhook || agentWebhookCount > 0) {
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

// Quick webhook set command (fallback when bot lacks permission)
program
  .command('webhook <url>')
  .description('Manually set a shared webhook URL for all agents')
  .action((url: string) => {
    const config = new ConfigManager();
    
    if (!config.validateWebhook(url)) {
      console.log(chalk.red('\n❌ Invalid Discord webhook URL'));
      console.log(chalk.gray('URL should look like: https://discord.com/api/webhooks/123456789/abcdef...\n'));
      process.exit(1);
    }

    config.setBaseWebhook(url);
    
    console.log(chalk.green('\n✓ Base webhook configured!'));
    console.log(chalk.gray(`  All ${AGENT_DEFINITIONS.length} agents will use this webhook.\n`));
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
