# 🦞 Too Many Claw

> OpenClaw Extension - 35 AI agents collaborating dynamically via Discord webhooks

[![npm version](https://badge.fury.io/js/too-many-claw.svg)](https://www.npmjs.com/package/too-many-claw)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## ✨ Features

- **35 Specialized Agents** - Development, design, testing, security, psychology counseling, and more
- **Dynamic Collaboration** - Agents are summoned and dismissed as needed
- **Discord Integration** - Real-time chat for natural collaboration via webhooks
- **OpenClaw Bridge** - Auto-forwards agent responses from OpenClaw Gateway to Discord
- **Daemon Mode** - Background service with systemd integration for auto-start
- **Groupthink Prevention** - Critic/verification agents ensure balanced decision-making

## 📦 Installation

```bash
npm install -g too-many-claw
```

During installation, the following is automatically set up:
- 35 workspace directories under `~/.openclaw/`
- SOUL.md files (agent personas) for each workspace
- Agent configuration merged into `openclaw.json`

## 🚀 Quick Start

### Interactive Setup (Recommended)
```bash
tmc setup
```

### Start Discord Bot
```bash
tmc start
```

### Terminal Simulation (No Discord Required)
```bash
tmc simulate
```

### Check Agent Status
```bash
tmc status
```

### List All Agents
```bash
tmc agents
```

---

## 🦞 OpenClaw Bridge (Daemon Mode)

Too Many Claw includes a **daemon mode** that automatically bridges OpenClaw agent responses to Discord via webhooks. When OpenClaw generates an AI response, TMC daemon intercepts it and sends it through the appropriate agent's webhook, giving each agent a unique identity in Discord.

### How It Works

```
┌─────────────┐     WebSocket      ┌───────────────┐    Webhook     ┌─────────┐
│  OpenClaw   │ ──────────────────▶│  TMC Daemon   │ ──────────────▶│ Discord │
│  Gateway    │   ws://127.0.0.1   │               │                │         │
│             │      :18789        │  Agent Router │                │ #chat   │
└─────────────┘                    └───────────────┘                └─────────┘
```

1. **OpenClaw Gateway** runs and handles AI agent conversations
2. **TMC Daemon** connects to the gateway via WebSocket
3. When an agent responds, TMC routes it through the correct webhook
4. **Discord** shows the message with the agent's unique name and emoji

### Starting the Daemon

```bash
# Run in foreground (see all logs)
tmc daemon run

# Run with verbose logging (debug mode)
tmc daemon run --verbose

# Run in background (detached)
tmc daemon run --detach
```

### Daemon Management

```bash
# Check daemon status
tmc daemon status

# Stop running daemon
tmc daemon stop

# View daemon logs (systemd only)
tmc daemon logs
tmc daemon logs --follow    # Live tail
tmc daemon logs --lines 100 # Last 100 lines
```

### Systemd Service (Auto-Start on Boot)

For production use, install TMC as a systemd service that starts automatically on boot:

```bash
# Install as systemd service (requires sudo)
tmc daemon install

# Uninstall systemd service
tmc daemon uninstall
```

After installation, the daemon will:
- Start automatically when your system boots
- Restart automatically if it crashes
- Run in the background with proper logging

**Useful systemctl commands:**
```bash
sudo systemctl status tmc-daemon   # Check status
sudo systemctl restart tmc-daemon  # Restart service
sudo systemctl stop tmc-daemon     # Stop service
journalctl -u tmc-daemon -f        # View logs
```

---

## 🔧 Troubleshooting

### Debug Command

If you're having issues with OpenClaw configuration detection:

```bash
# Show detailed debug information
tmc debug

# Show raw config (WARNING: may expose sensitive data)
tmc debug --raw
```

This shows:
- OpenClaw config file location and structure
- Detected Discord settings (token, guild ID, channel IDs)
- Current TMC configuration status
- What can be imported from OpenClaw

### Repair Command

If your configuration is corrupted or needs fixing:

```bash
# Check configuration health (dry run)
tmc repair --check

# Auto-repair issues
tmc repair

# Force repair without confirmation
tmc repair --force

# Restore from backup
tmc repair --restore
```

Repair can fix:
- Corrupted JSON configuration files
- Invalid webhook URLs
- Missing Discord settings (imports from OpenClaw if available)
- Automatic backup before any changes

---

## 👥 Agent Directory

### 🏠 Core
| ID | Name | Model | Role |
|----|------|-------|------|
| `base` | Base | Opus | Team Coordinator (always active) |

### 🔍 Research
| ID | Name | Model | Role |
|----|------|-------|------|
| `searcher` | Search Specialist | Sonnet | Information search and resource collection |
| `tech-researcher` | Technology Research Specialist | Sonnet | Technology trend investigation |
| `trend-analyst` | Trend Analysis Specialist | Sonnet | Market/trend analysis |
| `data-provider` | Data Preparation Specialist | Sonnet | Data collection/processing |

### 💚 Psychology
| ID | Name | Model | Role |
|----|------|-------|------|
| `counselor` | Psychological Counselor | Sonnet | Emotional support and counseling |
| `user-psychologist` | User Psychology Analyst | Opus | User intent analysis |
| `questioner` | Questioning Specialist | Sonnet | Requirements clarification |
| `persuader` | Rational Persuasion Specialist | Sonnet | Logical persuasion/mediation |
| `educator` | Education Specialist | Sonnet | Concept explanation/teaching |

### 📋 Planning
| ID | Name | Model | Role |
|----|------|-------|------|
| `planner` | Professional Planning Specialist | Opus | Planning/roadmaps |
| `team-composer` | Agent Team Composition Specialist | Sonnet | Optimal team composition |
| `promoter` | Promotion Specialist | Sonnet | Marketing/branding |
| `uploader` | Uploader | Haiku | Deployment/release |

### ⚙️ Development
| ID | Name | Model | Role |
|----|------|-------|------|
| `backend-dev` | Backend Developer | Sonnet | Server/API/DB |
| `frontend-dev` | Frontend Developer | Sonnet | UI/UX implementation |
| `designer` | Professional Designer | Sonnet | UI/UX design |
| `code-reviewer` | Code Reviewer | Sonnet | Code quality review |
| `doc-writer` | Documentation Specialist | Sonnet | Documentation |
| `automator` | Automation Specialist | Sonnet | Workflow automation |
| `prompt-engineer` | Prompt Engineer | Sonnet | AI prompt optimization |
| `ai-illustrator` | AI Illustration Generation Specialist | Sonnet | AI image generation |

### 🧪 Testing/Security
| ID | Name | Model | Role |
|----|------|-------|------|
| `program-tester` | Program Testing Specialist | Sonnet | Technical testing/QA |
| `user-tester` | General User Testing Specialist | Sonnet | Usability verification |
| `security-checker` | Security Check Specialist | Sonnet | Security checklist |
| `vuln-finder` | Vulnerability Discovery Specialist | Sonnet | Vulnerability analysis |
| `pentester` | Penetration Testing Specialist | Opus | Penetration testing |

### 🧐 Critique (Groupthink Prevention)
| ID | Name | Model | Role |
|----|------|-------|------|
| `fact-bomber` | Fact Check Specialist | Sonnet | Fact checking |
| `roaster` | Blunt Critic | Sonnet | Direct criticism |
| `critic` | Critic | Opus | Logical criticism |
| `negativist` | Negative Agent | Sonnet | Risk analysis |
| `praiser` | Praise Specialist | Haiku | Motivation/encouragement |

### 🕳️ Special Roles
| ID | Name | Model | Role |
|----|------|-------|------|
| `loophole-finder` | Loophole Discovery Specialist | Sonnet | Optimization within rules |
| `threatener` | Pressure Specialist | Sonnet | Deadline pressure |
| `dirty-worker` | Dirty Worker | Haiku | Undesirable tasks |

---

## 💬 Communication

### Summoning Agents
```
@searcher Find this for me
@backend-dev @frontend-dev Work together on this
```

### Agent Exit
- **Voluntary Exit**: Agent declares `(exit)` when work is complete
- **Command Exit**: Base commands `@agent-name exit`
- **Handoff Exit**: Exit while handing work to another agent

### Message Format
```
Entry: "🔬 Tech Researcher (entering) Got it, I'll investigate."
Normal: "🔬 Tech Researcher Here are my findings. ..."
Exit: "🔬 Tech Researcher Investigation complete. (exiting)"
```

---

## 📁 Discord Channel Structure

```
#chat      - Main conversation channel (all communication)
#status    - Automatic agent entry/exit logs
Threads    - For complex task separation
```

---

## ⚙️ Configuration

### Environment Variables
```bash
DISCORD_TOKEN=your_bot_token
DISCORD_GUILD_ID=your_server_id
DISCORD_CHAT_CHANNEL_ID=chat_channel_id
DISCORD_STATUS_CHANNEL_ID=status_channel_id
```

### Configuration Files
| File | Description |
|------|-------------|
| `~/.openclaw/too-many-claw.json` | Discord settings and webhook URLs |
| `~/.openclaw/openclaw.json` | OpenClaw agent definitions (auto-merged) |
| `~/.openclaw/workspace-{id}/SOUL.md` | Agent personas |
| `~/.openclaw/tmc-daemon.pid` | Daemon PID file (when running in background) |

### OpenClaw Integration

TMC automatically detects and imports settings from OpenClaw's configuration:

```bash
# Check what can be imported from OpenClaw
tmc debug

# Import during setup
tmc setup
# → "OpenClaw Discord configuration detected! Import?"
```

---

## 📋 CLI Reference

| Command | Description |
|---------|-------------|
| `tmc setup` | Interactive setup wizard |
| `tmc start` | Start Discord bot |
| `tmc simulate` | Terminal simulation mode |
| `tmc status` | Show agent and config status |
| `tmc agents` | List all available agents |
| `tmc daemon run` | Run OpenClaw bridge daemon |
| `tmc daemon run -d` | Run daemon in background |
| `tmc daemon run -v` | Run with verbose logging |
| `tmc daemon stop` | Stop running daemon |
| `tmc daemon status` | Check daemon status |
| `tmc daemon install` | Install systemd service |
| `tmc daemon uninstall` | Remove systemd service |
| `tmc daemon logs` | View systemd logs |
| `tmc repair` | Repair configuration |
| `tmc repair --check` | Check without fixing |
| `tmc repair --restore` | Restore from backup |
| `tmc debug` | Debug OpenClaw detection |
| `tmc uninstall` | Remove TMC configuration |

---

## 🔧 Development

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build
npm run build
```

---

## 🚀 Deployment (npm publish)

### Automatic Deployment via GitHub Actions

This project is automatically deployed to npm via GitHub Actions.

#### 1. npm Token Setup

1. Generate Access Token at [npmjs.com](https://www.npmjs.com/)
   - Account → Access Tokens → Generate New Token → Automation
2. Go to GitHub repository Settings → Secrets and variables → Actions
3. Add Secret named `NPM_TOKEN`

#### 2. Deployment Triggers

**Method A: Tag Push**
```bash
# Update version
npm version patch  # or minor, major

# Push tags (triggers auto-deployment)
git push --tags
```

**Method B: GitHub Release**
1. GitHub → Releases → Create a new release
2. Create tag (e.g., `v1.0.3`)
3. Publish release → Auto-deployment

#### 3. Workflow Files

- `.github/workflows/ci.yml` - Build tests on PR/push (Node 18, 20, 22)
- `.github/workflows/publish.yml` - npm deployment on tag/release

### Manual Deployment

```bash
npm run build
npm publish --access public
```

---

## 📄 License

Apache 2.0 © 2024
