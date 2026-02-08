#!/usr/bin/env node
/**
 * Too Many Claw - CLI Entry Point
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { AGENT_DEFINITIONS } from './agents/definitions.js';
import { registerTmcAgents } from './scripts/postinstall.js';
import { ConfigManager } from './config/ConfigManager.js';

const program = new Command();

program
  .name('tmc')
  .description('Too Many Claw - 35 AI agents collaborating via OpenClaw')
  .version('1.0.40');

// Setup command - register agents to OpenClaw
program
  .command('setup')
  .description('Register TMC agents to OpenClaw configuration')
  .action(async () => {
    console.log(chalk.cyan(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🦀 Too Many Claw - Setup                                 ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`));

    const spinner = ora('Registering agents to OpenClaw...').start();
    const result = await registerTmcAgents();

    if (!result.success) {
      spinner.fail('Failed to register agents');
      console.log(chalk.red(`Error: ${result.error}\n`));
      process.exit(1);
    }

    if (result.newlyAdded.length > 0) {
      spinner.succeed(`Registered ${result.newlyAdded.length} new agent(s)`);
      console.log(chalk.green(`  • New: ${result.newlyAdded.slice(0, 5).join(', ')}${result.newlyAdded.length > 5 ? ` and ${result.newlyAdded.length - 5} more` : ''}`));
      console.log(chalk.gray(`  • Already registered: ${result.alreadyExisted.length} agent(s)`));
    } else {
      spinner.succeed('All agents already registered');
      console.log(chalk.gray(`  ${result.totalAgents} agents configured in OpenClaw`));
    }

    if (result.workspacesCreated > 0) {
      console.log(chalk.green(`  • Created ${result.workspacesCreated} workspace(s)`));
    }

    console.log(chalk.green('\n✨ Setup complete!\n'));
    console.log(chalk.gray('Run `tmc agents` to see all available agents.'));
    console.log(chalk.gray('Run `tmc status` to check registration status.\n'));
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

// Show status
program
  .command('status')
  .description('Show agent registration status')
  .action(() => {
    console.log(chalk.cyan('\n🦀 Too Many Claw - Status\n'));
    
    const config = new ConfigManager();
    
    // OpenClaw config status
    console.log(chalk.white('OpenClaw Configuration:'));
    if (config.hasOpenClawConfig()) {
      console.log(chalk.green('  ✓ openclaw.json found'));
      
      const openclawConfig = config.readOpenClawConfig();
      if (openclawConfig) {
        const agents = openclawConfig.agents as { list?: unknown[] } | undefined;
        const agentCount = agents?.list?.length ?? 0;
        console.log(chalk.green(`  ✓ ${agentCount} agents registered`));
      }
    } else {
      console.log(chalk.yellow('  ○ openclaw.json not found'));
      console.log(chalk.gray('  Run `tmc setup` to register agents'));
    }

    // Agent list
    console.log(chalk.white('\nRegistered Agents:'));
    const categories = new Map<string, typeof AGENT_DEFINITIONS>();
    
    for (const agent of AGENT_DEFINITIONS) {
      if (!categories.has(agent.category)) {
        categories.set(agent.category, []);
      }
      categories.get(agent.category)!.push(agent);
    }

    for (const [category, agents] of categories) {
      console.log(chalk.yellow(`\n  [${category}]`));
      for (const agent of agents) {
        console.log(`    ${agent.emoji} ${agent.name} (${chalk.gray(agent.id)})`);
      }
    }

    console.log(chalk.gray(`\nTotal: ${AGENT_DEFINITIONS.length} agents\n`));
  });

// Reset command
program
  .command('reset')
  .description('Reset TMC configuration')
  .action(() => {
    const config = new ConfigManager();
    config.reset();
    console.log(chalk.green('\n✓ Configuration reset.\n'));
  });

// Uninstall
program
  .command('uninstall')
  .description('Remove Too Many Claw configuration')
  .action(() => {
    console.log(chalk.yellow('\nTo uninstall Too Many Claw:'));
    console.log(chalk.gray('  1. Remove agent workspaces: rm -rf ~/.openclaw/workspace-*'));
    console.log(chalk.gray('  2. Remove skill: rm -rf ~/.openclaw/skills/too-many-claw'));
    console.log(chalk.gray('  3. Uninstall package: npm uninstall -g too-many-claw\n'));
  });

program.parse();
