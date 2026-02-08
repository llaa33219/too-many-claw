# 🦞 Too Many Claw

> OpenClaw Extension - 35 AI agents collaborating dynamically

[![npm version](https://badge.fury.io/js/too-many-claw.svg)](https://www.npmjs.com/package/too-many-claw)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## ✨ Features

- **35 Specialized Agents** - Development, design, testing, security, psychology counseling, and more
- **OpenClaw Integration** - Auto-registers agents into OpenClaw configuration
- **Workspace Management** - Automatic workspace and SOUL.md creation for each agent
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

### Register Agents
```bash
tmc setup
```

### List All Agents
```bash
tmc agents
```

### Check Agent Status
```bash
tmc status
```

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

## ⚙️ Configuration

### Configuration Files
| File | Description |
|------|-------------|
| `~/.openclaw/openclaw.json` | OpenClaw agent definitions (auto-merged) |
| `~/.openclaw/workspace-{id}/SOUL.md` | Agent personas |

---

## 📋 CLI Reference

| Command | Description |
|---------|-------------|
| `tmc setup` | Register agents to OpenClaw configuration |
| `tmc agents` | List all available agents |
| `tmc agents -c <category>` | Filter agents by category |
| `tmc status` | Show agent registration status |
| `tmc reset` | Reset TMC configuration |
| `tmc uninstall` | Remove Too Many Claw configuration |

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
