# 🦞 Too Many Claw

> OpenClaw Extension - 35 AI agents collaborating dynamically

[![npm version](https://badge.fury.io/js/too-many-claw.svg)](https://www.npmjs.com/package/too-many-claw)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## ✨ Features

- **35 Specialized Agents** - Development, design, testing, security, psychology counseling, and more
- **Dynamic Collaboration** - Agents are summoned and dismissed as needed
- **Discord Integration** - Real-time chat for natural collaboration
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

## 📁 Discord Channel Structure

```
#chat      - Main conversation channel (all communication)
#status    - Automatic agent entry/exit logs
Threads    - For complex task separation
```

## ⚙️ Configuration

### Environment Variables
```bash
DISCORD_TOKEN=your_bot_token
DISCORD_GUILD_ID=your_server_id
DISCORD_CHAT_CHANNEL_ID=chat_channel_id
DISCORD_STATUS_CHANNEL_ID=status_channel_id
```

### Configuration Files
- `~/.openclaw/too-many-claw.json` - Discord settings and webhook URLs
- `~/.openclaw/openclaw.json` - Agent definitions (auto-merged)
- `~/.openclaw/workspace-{id}/SOUL.md` - Agent personas

## 🔧 Development

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build
npm run build
```

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

## 📄 License

Apache 2.0 © 2024
