# Too Many Claw

OpenClaw Extension - 35 AI agents collaborating dynamically

## Overview

Too Many Claw is an OpenClaw extension where 35 specialized AI agents collaborate in real-time through Discord. Each agent has unique expertise and personality, dynamically summoned and dismissed based on user requests.

## Installation

```bash
npm install -g too-many-claw
```

During installation, the following is automatically set up:
- 35 workspace directories under `~/.openclaw/`
- SOUL.md files for each workspace
- Agent configuration merged into `openclaw.json`

## Usage

### Interactive Setup
```bash
tmc setup
```

### Discord Bot
```bash
tmc start
```

### Terminal Simulation
```bash
tmc simulate
```

### Agent Status
```bash
tmc status
```

### Agent Directory
```bash
tmc agents
```

## Agent List (35 agents)

### Core
| ID | Name | Role |
|----|------|------|
| `base` | 🏠 Base | Team Coordinator (always active) |

### Research
| ID | Name | Role |
|----|------|------|
| `searcher` | 🔍 Search Specialist | Information search and resource collection |
| `tech-researcher` | 🔬 Technology Research Specialist | Technology trend investigation |
| `trend-analyst` | 📈 Trend Analysis Specialist | Market/trend analysis |
| `data-provider` | 📊 Data Preparation Specialist | Data collection/processing |

### Psychology
| ID | Name | Role |
|----|------|------|
| `counselor` | 💚 Psychological Counselor | Emotional support and counseling |
| `user-psychologist` | 🧠 User Psychology Analyst | User intent analysis |
| `questioner` | ❓ Questioning Specialist | Requirements clarification |
| `persuader` | 🎯 Rational Persuasion Specialist | Logical persuasion/mediation |
| `educator` | 📚 Education Specialist | Concept explanation/teaching |

### Planning
| ID | Name | Role |
|----|------|------|
| `planner` | 📋 Professional Planning Specialist | Planning/roadmaps |
| `team-composer` | 👥 Agent Team Composition Specialist | Optimal team composition |
| `promoter` | 📢 Promotion Specialist | Marketing/branding |
| `uploader` | ⬆️ Uploader | Deployment/release |

### Development
| ID | Name | Role |
|----|------|------|
| `backend-dev` | ⚙️ Backend Developer | Server/API/DB |
| `frontend-dev` | 🎨 Frontend Developer | UI/UX implementation |
| `designer` | 🖌️ Professional Designer | UI/UX design |
| `code-reviewer` | 👀 Code Reviewer | Code quality review |
| `doc-writer` | 📝 Documentation Specialist | Documentation |
| `automator` | 🤖 Automation Specialist | Workflow automation |
| `prompt-engineer` | 💬 Prompt Engineer | AI prompt optimization |
| `ai-illustrator` | 🎭 AI Illustration Generation Specialist | AI image generation |

### Testing/Security
| ID | Name | Role |
|----|------|------|
| `program-tester` | 🧪 Program Testing Specialist | Technical testing/QA |
| `user-tester` | 👤 General User Testing Specialist | Usability verification |
| `security-checker` | 🛡️ Security Check Specialist | Security checklist |
| `vuln-finder` | 🔓 Vulnerability Discovery Specialist | Vulnerability analysis |
| `pentester` | 💀 Penetration Testing Specialist | Penetration testing |

### Critique
| ID | Name | Role |
|----|------|------|
| `fact-bomber` | 💣 Fact Check Specialist | Fact checking |
| `roaster` | 🔥 Blunt Critic | Direct criticism |
| `critic` | 🧐 Critic | Logical criticism |
| `negativist` | 👎 Negative Agent | Risk analysis |
| `praiser` | 👏 Praise Specialist | Motivation/encouragement |

### Special Roles
| ID | Name | Role |
|----|------|------|
| `loophole-finder` | 🕳️ Loophole Discovery Specialist | Optimization within rules |
| `threatener` | ⚡ Pressure Specialist | Deadline pressure |
| `dirty-worker` | 🪠 Dirty Worker | Undesirable tasks |

## Model Distribution

| Model | Agents |
|-------|--------|
| claude-opus-4-5 | base, user-psychologist, planner, pentester, critic |
| claude-sonnet-4-5 | Most operational agents (27) |
| claude-haiku-4-5 | uploader, praiser, dirty-worker |

## Communication

### Summoning
- Summon agents with @mention
- Base or active agents can summon others
- Users can also summon directly

### Exit
- Voluntary exit: Declare `(exit)` when work is complete
- Command exit: Base commands `@agent-name exit`
- Handoff exit: Exit while handing work to another agent

### Message Format
```
Entry: "🔬 Tech Researcher (entering) Got it, I'll investigate."
Exit: "🔬 Tech Researcher Investigation complete. (exiting)"
```

## Discord Channel Structure

```
#chat      - Main conversation channel
#status    - Agent entry/exit logs
Threads    - Complex task separation
```

## License

Apache 2.0
