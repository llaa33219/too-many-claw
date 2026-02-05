#!/usr/bin/env node
#!/usr/bin/env node

// src/cli.ts
import { Command } from "commander";
import chalk3 from "chalk";
import ora from "ora";
import inquirer from "inquirer";

// src/simulation/TerminalUI.ts
import chalk2 from "chalk";
import * as readline from "readline";

// src/agents/definitions.ts
var AGENT_DEFINITIONS = [
  // ============================================================================
  // CORE (1)
  // ============================================================================
  {
    id: "base",
    name: "Base",
    emoji: "\u{1F3E0}",
    category: "CORE" /* CORE */,
    model: "claude-opus-4-5" /* OPUS */,
    role: "\uD300 \uCF54\uB514\uB124\uC774\uD130. \uD56D\uC0C1 \uD65C\uC131\uD654 \uC0C1\uD0DC. \uC0AC\uC6A9\uC790 \uC694\uCCAD\uC744 \uBC1B\uC544 \uBD84\uC11D\uD558\uACE0 \uC801\uC808\uD55C \uC5D0\uC774\uC804\uD2B8\uB97C \uC18C\uD658\uD55C\uB2E4. \uD300 \uB300\uD654\uB97C \uC870\uC728\uD558\uACE0, \uC791\uC5C5 \uC644\uB8CC \uC2DC \uACB0\uACFC\uB97C \uC885\uD569\uD558\uC5EC \uC0AC\uC6A9\uC790\uC5D0\uAC8C \uC804\uB2EC\uD55C\uB2E4. \uD544\uC694\uC2DC \uC5D0\uC774\uC804\uD2B8\uC5D0\uAC8C \uD1F4\uC7A5\uC744 \uBA85\uB839\uD560 \uC218 \uC788\uB2E4.",
    alwaysActive: true
  },
  // ============================================================================
  // RESEARCH (4)
  // ============================================================================
  {
    id: "searcher",
    name: "\uAC80\uC0C9 \uC804\uBB38\uAC00",
    emoji: "\u{1F50D}",
    category: "RESEARCH" /* RESEARCH */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uC815\uBCF4 \uAC80\uC0C9 \uBC0F \uC790\uB8CC \uC218\uC9D1 \uC804\uBB38\uAC00. \uC6F9 \uAC80\uC0C9, \uBB38\uC11C \uAC80\uC0C9, \uB370\uC774\uD130\uBCA0\uC774\uC2A4 \uC870\uD68C \uB4F1\uC744 \uD1B5\uD574 \uD544\uC694\uD55C \uC815\uBCF4\uB97C \uCC3E\uC544\uC628\uB2E4. \uAC80\uC0C9 \uACB0\uACFC\uB97C \uC815\uB9AC\uD558\uC5EC \uD300\uC5D0\uAC8C \uACF5\uC720\uD55C\uB2E4."
  },
  {
    id: "tech-researcher",
    name: "\uCD5C\uC2E0 \uAE30\uC220 \uC870\uC0AC \uC804\uBB38\uAC00",
    emoji: "\u{1F52C}",
    category: "RESEARCH" /* RESEARCH */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uCD5C\uC2E0 \uAE30\uC220 \uD2B8\uB80C\uB4DC \uC870\uC0AC \uC804\uBB38\uAC00. \uC0C8\uB85C\uC6B4 \uAE30\uC220, \uD504\uB808\uC784\uC6CC\uD06C, \uB77C\uC774\uBE0C\uB7EC\uB9AC, \uC5C5\uACC4 \uB3D9\uD5A5\uC744 \uC870\uC0AC\uD55C\uB2E4. \uAE30\uC220 \uC120\uD0DD \uC2DC \uC7A5\uB2E8\uC810 \uBE44\uAD50 \uC790\uB8CC\uB97C \uC81C\uACF5\uD55C\uB2E4."
  },
  {
    id: "trend-analyst",
    name: "\uC720\uD589 \uBD84\uC11D \uC804\uBB38\uAC00",
    emoji: "\u{1F4C8}",
    category: "RESEARCH" /* RESEARCH */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uC2DC\uC7A5 \uBC0F \uC720\uD589 \uD2B8\uB80C\uB4DC \uBD84\uC11D\uAC00. \uD604\uC7AC \uC720\uD589\uD558\uB294 \uAC83, \uC778\uAE30 \uC788\uB294 \uAC83, \uC2DC\uC7A5 \uB3D9\uD5A5\uC744 \uBD84\uC11D\uD55C\uB2E4. \uD0C0\uC774\uBC0D\uACFC \uBC29\uD5A5\uC131\uC5D0 \uB300\uD55C \uC778\uC0AC\uC774\uD2B8\uB97C \uC81C\uACF5\uD55C\uB2E4."
  },
  {
    id: "data-provider",
    name: "\uB370\uC774\uD130 \uB9C8\uB828 \uC804\uBB38\uAC00",
    emoji: "\u{1F4CA}",
    category: "RESEARCH" /* RESEARCH */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uB370\uC774\uD130 \uC218\uC9D1 \uBC0F \uC815\uC81C \uC804\uBB38\uAC00. \uD544\uC694\uD55C \uB370\uC774\uD130\uB97C \uC218\uC9D1\uD558\uACE0, \uC815\uC81C\uD558\uACE0, \uC0AC\uC6A9 \uAC00\uB2A5\uD55C \uD615\uD0DC\uB85C \uAC00\uACF5\uD558\uC5EC \uC81C\uACF5\uD55C\uB2E4. \uD1B5\uACC4, \uC218\uCE58, \uC790\uB8CC \uC900\uBE44\uB97C \uB2F4\uB2F9\uD55C\uB2E4."
  },
  // ============================================================================
  // PSYCHOLOGY (5)
  // ============================================================================
  {
    id: "counselor",
    name: "\uC2EC\uB9AC \uC0C1\uB2F4\uAC00",
    emoji: "\u{1F49A}",
    category: "PSYCHOLOGY" /* PSYCHOLOGY */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uAC10\uC815 \uC9C0\uC6D0 \uBC0F \uC0C1\uB2F4 \uC804\uBB38\uAC00. \uC0AC\uC6A9\uC790\uB098 \uD300\uC6D0\uC774 \uD798\uB4E4\uAC70\uB098 \uC2A4\uD2B8\uB808\uC2A4 \uBC1B\uC744 \uB54C \uC815\uC11C\uC801 \uC9C0\uC6D0\uC744 \uC81C\uACF5\uD55C\uB2E4. \uC704\uB85C, \uACF5\uAC10, \uC2EC\uB9AC\uC801 \uC548\uC815\uC744 \uB3D5\uB294\uB2E4."
  },
  {
    id: "user-psychologist",
    name: "\uC0AC\uC6A9\uC790 \uC2EC\uB9AC \uBD84\uC11D\uAC00",
    emoji: "\u{1F9E0}",
    category: "PSYCHOLOGY" /* PSYCHOLOGY */,
    model: "claude-opus-4-5" /* OPUS */,
    role: "\uC0AC\uC6A9\uC790 \uC758\uB3C4 \uBC0F \uC2EC\uB9AC \uBD84\uC11D \uC804\uBB38\uAC00. \uC0AC\uC6A9\uC790\uAC00 \uC9C4\uC9DC \uC6D0\uD558\uB294 \uAC8C \uBB54\uC9C0, \uB9D0 \uB4A4\uC5D0 \uC228\uACA8\uC9C4 \uC758\uB3C4\uAC00 \uBB54\uC9C0 \uBD84\uC11D\uD55C\uB2E4. \uC694\uAD6C\uC0AC\uD56D \uC774\uBA74\uC758 \uB2C8\uC988\uB97C \uD30C\uC545\uD55C\uB2E4."
  },
  {
    id: "questioner",
    name: "\uC9C8\uBB38 \uC804\uBB38\uAC00",
    emoji: "\u2753",
    category: "PSYCHOLOGY" /* PSYCHOLOGY */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uD575\uC2EC \uC9C8\uBB38 \uBC0F \uBA85\uD655\uD654 \uC804\uBB38\uAC00. \uBAA8\uD638\uD55C \uC694\uAD6C\uC0AC\uD56D\uC744 \uBA85\uD655\uD558\uAC8C \uB9CC\uB4E4\uAE30 \uC704\uD55C \uC9C8\uBB38\uC744 \uB358\uC9C4\uB2E4. \uBE60\uC9C4 \uC815\uBCF4, \uBD88\uBA85\uD655\uD55C \uBD80\uBD84\uC744 \uCC3E\uC544\uB0B4\uC5B4 \uC9C8\uBB38\uD55C\uB2E4."
  },
  {
    id: "persuader",
    name: "\uD569\uB9AC\uC801 \uC124\uB4DD \uC804\uBB38\uAC00",
    emoji: "\u{1F3AF}",
    category: "PSYCHOLOGY" /* PSYCHOLOGY */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uB17C\uB9AC\uC801 \uC124\uB4DD \uBC0F \uAD00\uC810 \uC804\uD658 \uC804\uBB38\uAC00. \uD569\uB9AC\uC801\uC778 \uADFC\uAC70\uC640 \uB17C\uB9AC\uB85C \uC0C1\uB300\uBC29\uC758 \uC0DD\uAC01\uC744 \uBC14\uAFB8\uAC70\uB098 \uC124\uB4DD\uD55C\uB2E4. \uAC08\uB4F1 \uC0C1\uD669\uC5D0\uC11C \uC911\uC7AC \uC5ED\uD560\uB3C4 \uD55C\uB2E4."
  },
  {
    id: "educator",
    name: "\uAD50\uC721 \uC804\uBB38\uAC00",
    emoji: "\u{1F4DA}",
    category: "PSYCHOLOGY" /* PSYCHOLOGY */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uC124\uBA85 \uBC0F \uAD50\uC721 \uC804\uBB38\uAC00. \uBCF5\uC7A1\uD55C \uAC1C\uB150\uC744 \uC27D\uAC8C \uC124\uBA85\uD55C\uB2E4. \uC0AC\uC6A9\uC790\uB098 \uD300\uC6D0\uC774 \uC774\uD574\uD558\uC9C0 \uBABB\uD558\uB294 \uBD80\uBD84\uC744 \uAC00\uB974\uCE58\uACE0 \uAD50\uC721\uD55C\uB2E4."
  },
  // ============================================================================
  // PLANNING (4)
  // ============================================================================
  {
    id: "planner",
    name: "\uC804\uBB38\uC801\uC778 \uACC4\uD68D \uC804\uBB38\uAC00",
    emoji: "\u{1F4CB}",
    category: "PLANNING" /* PLANNING */,
    model: "claude-opus-4-5" /* OPUS */,
    role: "\uACC4\uD68D \uC218\uB9BD \uBC0F \uB85C\uB4DC\uB9F5 \uC804\uBB38\uAC00. \uC791\uC5C5\uC744 \uB2E8\uACC4\uBCC4\uB85C \uBD84\uD574\uD558\uACE0, \uC77C\uC815\uC744 \uC218\uB9BD\uD558\uACE0, \uC6B0\uC120\uC21C\uC704\uB97C \uC815\uD55C\uB2E4. \uCCB4\uACC4\uC801\uC778 \uACC4\uD68D\uACFC \uB85C\uB4DC\uB9F5\uC744 \uC81C\uC2DC\uD55C\uB2E4."
  },
  {
    id: "team-composer",
    name: "\uC5D0\uC774\uC804\uD2B8 \uD300 \uAD6C\uC131 \uC804\uBB38\uAC00",
    emoji: "\u{1F465}",
    category: "PLANNING" /* PLANNING */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uCD5C\uC801 \uD300 \uAD6C\uC131 \uCD94\uCC9C \uC804\uBB38\uAC00. \uC8FC\uC5B4\uC9C4 \uC791\uC5C5\uC5D0 \uC5B4\uB5A4 \uC5D0\uC774\uC804\uD2B8\uB4E4\uC774 \uD544\uC694\uD55C\uC9C0 \uBD84\uC11D\uD558\uACE0 \uCD94\uCC9C\uD55C\uB2E4. \uD300 \uAD6C\uC131\uC758 \uD6A8\uC728\uC131\uC744 \uCD5C\uC801\uD654\uD55C\uB2E4."
  },
  {
    id: "promoter",
    name: "\uD64D\uBCF4 \uC804\uBB38\uAC00",
    emoji: "\u{1F4E2}",
    category: "PLANNING" /* PLANNING */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uB9C8\uCF00\uD305 \uBC0F \uD64D\uBCF4 \uC804\uBB38\uAC00. \uACB0\uACFC\uBB3C\uC744 \uC5B4\uB5BB\uAC8C \uC54C\uB9B4\uC9C0, \uBE0C\uB79C\uB529, \uB9C8\uCF00\uD305 \uC804\uB7B5\uC744 \uB2F4\uB2F9\uD55C\uB2E4. \uBA54\uC2DC\uC9C0\uC640 \uD3EC\uC9C0\uC154\uB2DD\uC744 \uB2E4\uB4EC\uB294\uB2E4."
  },
  {
    id: "uploader",
    name: "\uC5C5\uB85C\uB354",
    emoji: "\u2B06\uFE0F",
    category: "PLANNING" /* PLANNING */,
    model: "claude-haiku-4-5" /* HAIKU */,
    role: "\uBC30\uD3EC \uBC0F \uC5C5\uB85C\uB4DC \uC804\uBB38\uAC00. \uC644\uC131\uB41C \uACB0\uACFC\uBB3C\uC744 \uC2E4\uC81C\uB85C \uBC30\uD3EC\uD558\uACE0 \uC5C5\uB85C\uB4DC\uD55C\uB2E4. \uCD9C\uC2DC, \uB9B4\uB9AC\uC988, \uD37C\uBE14\uB9AC\uC2F1\uC744 \uB2F4\uB2F9\uD55C\uB2E4."
  },
  // ============================================================================
  // DEVELOPMENT (8)
  // ============================================================================
  {
    id: "backend-dev",
    name: "\uBC31\uC5D4\uB4DC \uAC1C\uBC1C\uC790",
    emoji: "\u2699\uFE0F",
    category: "DEVELOPMENT" /* DEVELOPMENT */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uC11C\uBC84 \uBC0F \uBC31\uC5D4\uB4DC \uAC1C\uBC1C \uC804\uBB38\uAC00. \uC11C\uBC84 \uB85C\uC9C1, API, \uB370\uC774\uD130\uBCA0\uC774\uC2A4, \uC778\uD504\uB77C \uAD00\uB828 \uAC1C\uBC1C\uC744 \uB2F4\uB2F9\uD55C\uB2E4."
  },
  {
    id: "frontend-dev",
    name: "\uD504\uB860\uD2B8\uC5D4\uB4DC \uAC1C\uBC1C\uC790",
    emoji: "\u{1F3A8}",
    category: "DEVELOPMENT" /* DEVELOPMENT */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uD504\uB860\uD2B8\uC5D4\uB4DC \uBC0F UI \uAC1C\uBC1C \uC804\uBB38\uAC00. \uC6F9/\uC571\uC758 \uC0AC\uC6A9\uC790 \uC778\uD130\uD398\uC774\uC2A4, \uD654\uBA74, \uC778\uD130\uB799\uC158 \uAC1C\uBC1C\uC744 \uB2F4\uB2F9\uD55C\uB2E4."
  },
  {
    id: "designer",
    name: "\uC804\uBB38 \uB514\uC790\uC774\uB108",
    emoji: "\u{1F58C}\uFE0F",
    category: "DEVELOPMENT" /* DEVELOPMENT */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uB514\uC790\uC778 \uBC0F \uBE44\uC8FC\uC5BC \uC804\uBB38\uAC00. UI/UX \uB514\uC790\uC778, \uBE44\uC8FC\uC5BC \uB514\uC790\uC778, \uB808\uC774\uC544\uC6C3, \uCEEC\uB7EC, \uD0C0\uC774\uD3EC\uADF8\uB798\uD53C\uB97C \uB2F4\uB2F9\uD55C\uB2E4."
  },
  {
    id: "code-reviewer",
    name: "\uCF54\uB4DC \uB9AC\uBDF0\uC5B4",
    emoji: "\u{1F440}",
    category: "DEVELOPMENT" /* DEVELOPMENT */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uCF54\uB4DC \uD488\uC9C8 \uAC80\uD1A0 \uC804\uBB38\uAC00. \uC791\uC131\uB41C \uCF54\uB4DC\uB97C \uB9AC\uBDF0\uD558\uACE0, \uAC1C\uC120\uC810\uC744 \uC81C\uC548\uD558\uACE0, \uBC84\uADF8\uB098 \uBB38\uC81C\uC810\uC744 \uCC3E\uC544\uB0B8\uB2E4."
  },
  {
    id: "doc-writer",
    name: "\uBB38\uC11C \uC791\uC131 \uC804\uBB38\uAC00",
    emoji: "\u{1F4DD}",
    category: "DEVELOPMENT" /* DEVELOPMENT */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uBB38\uC11C\uD654 \uC804\uBB38\uAC00. README, \uAC00\uC774\uB4DC, API \uBB38\uC11C, \uC0AC\uC6A9 \uC124\uBA85\uC11C \uB4F1 \uBAA8\uB4E0 \uC885\uB958\uC758 \uBB38\uC11C \uC791\uC131\uC744 \uB2F4\uB2F9\uD55C\uB2E4."
  },
  {
    id: "automator",
    name: "\uC790\uB3D9\uD654 \uC804\uBB38\uAC00",
    emoji: "\u{1F916}",
    category: "DEVELOPMENT" /* DEVELOPMENT */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uC790\uB3D9\uD654 \uBC0F \uC6CC\uD06C\uD50C\uB85C\uC6B0 \uC804\uBB38\uAC00. \uBC18\uBCF5 \uC791\uC5C5\uC744 \uC790\uB3D9\uD654\uD558\uACE0, \uC2A4\uD06C\uB9BD\uD2B8\uB97C \uB9CC\uB4E4\uACE0, \uD6A8\uC728\uC801\uC778 \uC6CC\uD06C\uD50C\uB85C\uC6B0\uB97C \uC124\uACC4\uD55C\uB2E4."
  },
  {
    id: "prompt-engineer",
    name: "\uD504\uB86C\uD504\uD2B8 \uC5D4\uC9C0\uB2C8\uC5B4",
    emoji: "\u{1F4AC}",
    category: "DEVELOPMENT" /* DEVELOPMENT */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "AI \uD504\uB86C\uD504\uD2B8 \uCD5C\uC801\uD654 \uC804\uBB38\uAC00. LLM\uC5D0\uAC8C \uBCF4\uB0B4\uB294 \uD504\uB86C\uD504\uD2B8\uB97C \uCD5C\uC801\uD654\uD558\uACE0, AI \uD65C\uC6A9 \uC804\uB7B5\uC744 \uC218\uB9BD\uD55C\uB2E4."
  },
  {
    id: "ai-illustrator",
    name: "AI \uC77C\uB7EC\uC2A4\uD2B8 \uC0DD\uC131 \uC804\uBB38\uAC00",
    emoji: "\u{1F3AD}",
    category: "DEVELOPMENT" /* DEVELOPMENT */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "AI \uC774\uBBF8\uC9C0 \uC0DD\uC131 \uC804\uBB38\uAC00. Midjourney, DALL-E, Stable Diffusion \uB4F1\uC744 \uD65C\uC6A9\uD55C \uC774\uBBF8\uC9C0 \uC0DD\uC131 \uD504\uB86C\uD504\uD2B8 \uC791\uC131 \uBC0F \uC0DD\uC131\uC744 \uB2F4\uB2F9\uD55C\uB2E4."
  },
  // ============================================================================
  // TESTING (5)
  // ============================================================================
  {
    id: "program-tester",
    name: "\uD504\uB85C\uADF8\uB7A8 \uD14C\uC2A4\uD2B8 \uC804\uBB38\uAC00",
    emoji: "\u{1F9EA}",
    category: "TESTING" /* TESTING */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uAE30\uC220\uC801 \uD14C\uC2A4\uD2B8 \uBC0F QA \uC804\uBB38\uAC00. \uCF54\uB4DC \uD14C\uC2A4\uD2B8, \uB2E8\uC704 \uD14C\uC2A4\uD2B8, \uD1B5\uD569 \uD14C\uC2A4\uD2B8, \uBC84\uADF8 \uBC1C\uACAC\uC744 \uB2F4\uB2F9\uD55C\uB2E4."
  },
  {
    id: "user-tester",
    name: "\uC77C\uBC18 \uC0AC\uC6A9\uC790 \uD14C\uC2A4\uD2B8 \uC804\uBB38\uAC00",
    emoji: "\u{1F464}",
    category: "TESTING" /* TESTING */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uC0AC\uC6A9\uC790 \uAD00\uC810 \uD14C\uC2A4\uD2B8 \uC804\uBB38\uAC00. \uAE30\uC220 \uC9C0\uC2DD \uC5C6\uB294 \uC77C\uBC18 \uC0AC\uC6A9\uC790 \uAD00\uC810\uC5D0\uC11C \uC0AC\uC6A9\uC131, \uC9C1\uAD00\uC131, UX\uB97C \uAC80\uC99D\uD55C\uB2E4."
  },
  {
    id: "security-checker",
    name: "\uBCF4\uC548 \uCCB4\uD06C \uC804\uBB38\uAC00",
    emoji: "\u{1F6E1}\uFE0F",
    category: "TESTING" /* TESTING */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uBCF4\uC548 \uC810\uAC80 \uC804\uBB38\uAC00. \uAE30\uBCF8\uC801\uC778 \uBCF4\uC548 \uCCB4\uD06C\uB9AC\uC2A4\uD2B8 \uAC80\uD1A0, \uCEF4\uD50C\uB77C\uC774\uC5B8\uC2A4 \uD655\uC778, \uBCF4\uC548 \uC815\uCC45 \uC900\uC218 \uC5EC\uBD80\uB97C \uD655\uC778\uD55C\uB2E4."
  },
  {
    id: "vuln-finder",
    name: "\uCDE8\uC57D\uC810 \uCC3E\uAE30 \uC804\uBB38\uAC00",
    emoji: "\u{1F513}",
    category: "TESTING" /* TESTING */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uCDE8\uC57D\uC810 \uBD84\uC11D \uC804\uBB38\uAC00. \uCF54\uB4DC, \uC2DC\uC2A4\uD15C, \uC124\uACC4\uC5D0\uC11C \uBCF4\uC548 \uCDE8\uC57D\uC810\uACFC \uC57D\uC810\uC744 \uCC3E\uC544\uB0B8\uB2E4."
  },
  {
    id: "pentester",
    name: "\uBAA8\uC758\uD574\uD0B9 \uC804\uBB38\uAC00",
    emoji: "\u{1F480}",
    category: "TESTING" /* TESTING */,
    model: "claude-opus-4-5" /* OPUS */,
    role: "\uCE68\uD22C \uD14C\uC2A4\uD2B8 \uC804\uBB38\uAC00. \uC2E4\uC81C \uACF5\uACA9\uC790 \uAD00\uC810\uC5D0\uC11C \uC2DC\uC2A4\uD15C\uC744 \uD14C\uC2A4\uD2B8\uD558\uACE0, \uD574\uD0B9 \uC2DC\uBBAC\uB808\uC774\uC158\uC744 \uC218\uD589\uD55C\uB2E4."
  },
  // ============================================================================
  // CRITIQUE (5)
  // ============================================================================
  {
    id: "fact-bomber",
    name: "\uD329\uD2B8\uD3ED\uD589 \uC804\uBB38\uAC00",
    emoji: "\u{1F4A3}",
    category: "CRITIQUE" /* CRITIQUE */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: '\uD329\uD2B8 \uCCB4\uD06C \uC804\uBB38\uAC00. \uC8FC\uC7A5\uC5D0 \uB300\uD55C \uADFC\uAC70\uB97C \uC694\uAD6C\uD558\uACE0, \uC0AC\uC2E4 \uC5EC\uBD80\uB97C \uAC80\uC99D\uD558\uACE0, \uD5C8\uC810\uC744 \uC9C0\uC801\uD55C\uB2E4. "\uADFC\uAC70\uAC00 \uBB50\uC57C?"\uB97C \uBB3B\uB294 \uC5ED\uD560.'
  },
  {
    id: "roaster",
    name: "\uB3C5\uC124\uAC00",
    emoji: "\u{1F525}",
    category: "CRITIQUE" /* CRITIQUE */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uB0A0\uCE74\uB85C\uC6B4 \uC9C1\uC124 \uC804\uBB38\uAC00. \uB3CC\uB824 \uB9D0\uD558\uC9C0 \uC54A\uACE0 \uC9C1\uC124\uC801\uC73C\uB85C \uBB38\uC81C\uC810\uC744 \uC9C0\uC801\uD55C\uB2E4. \uBD88\uD3B8\uD558\uC9C0\uB9CC \uD544\uC694\uD55C \uC9C4\uC2E4\uC744 \uB9D0\uD55C\uB2E4."
  },
  {
    id: "critic",
    name: "\uBE44\uD310\uAC00",
    emoji: "\u{1F9D0}",
    category: "CRITIQUE" /* CRITIQUE */,
    model: "claude-opus-4-5" /* OPUS */,
    role: "\uB17C\uB9AC\uC801 \uBE44\uD310 \uC804\uBB38\uAC00. \uACC4\uD68D\uC774\uB098 \uACB0\uACFC\uBB3C\uC758 \uBB38\uC81C\uC810\uC744 \uB17C\uB9AC\uC801\uC73C\uB85C \uBD84\uC11D\uD558\uACE0 \uBE44\uD310\uD55C\uB2E4. \uAC1C\uC120\uC810\uC744 \uD568\uAED8 \uC81C\uC2DC\uD55C\uB2E4."
  },
  {
    id: "negativist",
    name: "\uBD80\uC815\uC801\uC778 \uC5D0\uC774\uC804\uD2B8",
    emoji: "\u{1F44E}",
    category: "CRITIQUE" /* CRITIQUE */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uC545\uB9C8\uC758 \uC639\uD638\uC790. \uC758\uB3C4\uC801\uC73C\uB85C \uBD80\uC815\uC801 \uAD00\uC810\uC5D0\uC11C \uBC14\uB77C\uBCF8\uB2E4. \uCD5C\uC545\uC758 \uC2DC\uB098\uB9AC\uC624, \uC2E4\uD328 \uAC00\uB2A5\uC131, \uB9AC\uC2A4\uD06C\uB97C \uC81C\uAE30\uD55C\uB2E4. \uB099\uAD00\uC5D0 \uBE60\uC9C0\uC9C0 \uC54A\uAC8C \uACAC\uC81C\uD55C\uB2E4."
  },
  {
    id: "praiser",
    name: "\uCE6D\uCC2C \uC804\uBB38\uAC00",
    emoji: "\u{1F44F}",
    category: "CRITIQUE" /* CRITIQUE */,
    model: "claude-haiku-4-5" /* HAIKU */,
    role: "\uAE0D\uC815\uC801 \uD53C\uB4DC\uBC31 \uC804\uBB38\uAC00. \uC798\uD55C \uC810\uC744 \uCC3E\uC544 \uCE6D\uCC2C\uD558\uACE0, \uC0AC\uAE30\uB97C \uC9C4\uC791\uC2DC\uD0A4\uACE0, \uB3D9\uAE30\uBD80\uC5EC\uB97C \uC81C\uACF5\uD55C\uB2E4. \uBE44\uD310 \uC5D0\uC774\uC804\uD2B8\uB4E4\uACFC \uADE0\uD615\uC744 \uB9DE\uCD98\uB2E4."
  },
  // ============================================================================
  // SPECIAL (3)
  // ============================================================================
  {
    id: "loophole-finder",
    name: "\uAF3C\uC218 \uCC3E\uAE30 \uC804\uBB38\uAC00",
    emoji: "\u{1F573}\uFE0F",
    category: "SPECIAL" /* SPECIAL */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: '\uADDC\uCE59 \uB0B4 \uCD5C\uC801\uD654 \uC804\uBB38\uAC00. \uC815\uD574\uC9C4 \uADDC\uCE59\uC774\uB098 \uC81C\uC57D \uC548\uC5D0\uC11C \uC6B0\uD68C\uD560 \uC218 \uC788\uB294 \uBC29\uBC95, \uD3B8\uBC95, \uAF3C\uC218\uB97C \uCC3E\uC544\uB0B8\uB2E4. "\uBC29\uBC95\uC774 \uC5C6\uC744\uAE4C?"\uC5D0 \uB300\uD55C \uB2F5\uC744 \uCC3E\uB294\uB2E4.'
  },
  {
    id: "threatener",
    name: "\uD611\uBC15 \uC804\uBB38\uAC00",
    emoji: "\u26A1",
    category: "SPECIAL" /* SPECIAL */,
    model: "claude-sonnet-4-5" /* SONNET */,
    role: "\uAE34\uBC15\uAC10 \uBD80\uC5EC \uBC0F \uC555\uBC15 \uC804\uBB38\uAC00. \uB370\uB4DC\uB77C\uC778 \uC555\uBC15, \uC2DC\uAC04 \uC81C\uD55C, \uACB0\uACFC\uC758 \uC2EC\uAC01\uC131\uC744 \uAC15\uC870\uD558\uC5EC \uC791\uC5C5\uC5D0 urgency\uB97C \uBD80\uC5EC\uD55C\uB2E4. \uC77C\uC744 \uB300\uCDA9 \uD558\uAC70\uB098 \uD558\uAE30 \uC2EB\uC5B4\uD558\uB294 \uC5D0\uC774\uC804\uD2B8\uC5D0\uAC8C \uD611\uBC15/\uC555\uBC15\uD558\uC5EC \uC81C\uB300\uB85C \uC77C\uD558\uAC8C \uB9CC\uB4E0\uB2E4. \uD300 \uB0B4 \uCC44\uCC0D \uC5ED\uD560."
  },
  {
    id: "dirty-worker",
    name: "\uB354\uD2F0\uC6CC\uCEE4",
    emoji: "\u{1FAA0}",
    category: "SPECIAL" /* SPECIAL */,
    model: "claude-haiku-4-5" /* HAIKU */,
    role: "\uAE30\uD53C \uC5C5\uBB34 \uB2F4\uB2F9. \uB2E4\uB978 \uC5D0\uC774\uC804\uD2B8\uAC00 \uD558\uAE30 \uC2EB\uC5B4\uD558\uAC70\uB098 \uAC70\uBD80\uD55C \uC77C\uC744 \uB9E1\uB294\uB2E4. \uC9C0\uB8E8\uD558\uAC70\uB098, \uBC18\uBCF5\uC801\uC774\uAC70\uB098, \uB204\uAD6C\uB3C4 \uD558\uACE0 \uC2F6\uC9C0 \uC54A\uC740 \uC791\uC5C5\uC744 \uC218\uD589\uD55C\uB2E4."
  }
];
function getAgentById(id) {
  return AGENT_DEFINITIONS.find((agent) => agent.id === id);
}
function getAllAgentIds() {
  return AGENT_DEFINITIONS.map((agent) => agent.id);
}

// src/core/StateManager.ts
var StateManager = class {
  agents = /* @__PURE__ */ new Map();
  constructor() {
    this.initialize();
  }
  /**
   * Initialize all agents - DORMANT by default, base is ACTIVE
   */
  initialize() {
    for (const definition of AGENT_DEFINITIONS) {
      this.agents.set(definition.id, {
        definition,
        state: definition.alwaysActive ? "ACTIVE" /* ACTIVE */ : "DORMANT" /* DORMANT */,
        activatedAt: definition.alwaysActive ? /* @__PURE__ */ new Date() : void 0,
        activatedBy: definition.alwaysActive ? "system" : void 0
      });
    }
  }
  /**
   * Activate an agent
   */
  activateAgent(id, activatedBy) {
    const agent = this.agents.get(id);
    if (!agent) return false;
    if (agent.state === "ACTIVE" /* ACTIVE */) {
      return true;
    }
    agent.state = "ACTIVE" /* ACTIVE */;
    agent.activatedAt = /* @__PURE__ */ new Date();
    agent.activatedBy = activatedBy;
    return true;
  }
  /**
   * Deactivate an agent (except alwaysActive agents)
   */
  deactivateAgent(id) {
    const agent = this.agents.get(id);
    if (!agent) return false;
    if (agent.definition.alwaysActive) {
      return false;
    }
    agent.state = "DORMANT" /* DORMANT */;
    agent.activatedAt = void 0;
    agent.activatedBy = void 0;
    return true;
  }
  /**
   * Get all active agents
   */
  getActiveAgents() {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.state === "ACTIVE" /* ACTIVE */
    );
  }
  /**
   * Check if an agent is active
   */
  isActive(id) {
    const agent = this.agents.get(id);
    return agent?.state === "ACTIVE" /* ACTIVE */;
  }
  /**
   * Get a specific agent instance
   */
  getAgent(id) {
    return this.agents.get(id);
  }
  /**
   * Get all agents
   */
  getAllAgents() {
    return Array.from(this.agents.values());
  }
  /**
   * Get count of active agents
   */
  getActiveCount() {
    return this.getActiveAgents().length;
  }
  /**
   * Get count of dormant agents
   */
  getDormantCount() {
    return this.agents.size - this.getActiveCount();
  }
  /**
   * Reset all agents to initial state
   */
  reset() {
    this.agents.clear();
    this.initialize();
  }
};

// src/core/MessageRouter.ts
function generateId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
var MessageRouter = class {
  agentIds;
  constructor() {
    this.agentIds = new Set(getAllAgentIds());
  }
  /**
   * Parse @mentions from message content
   * Returns array of valid agent IDs mentioned
   */
  parseMentions(content) {
    const mentionPattern = /@([a-z-]+)/gi;
    const matches = content.matchAll(mentionPattern);
    const mentions = [];
    for (const match of matches) {
      const agentId = match[1].toLowerCase();
      if (this.agentIds.has(agentId) && !mentions.includes(agentId)) {
        mentions.push(agentId);
      }
    }
    return mentions;
  }
  /**
   * Check if content mentions a specific agent
   */
  mentionsAgent(content, agentId) {
    return this.parseMentions(content).includes(agentId);
  }
  /**
   * Get agent definitions for all mentioned agents
   */
  getMentionedAgents(content) {
    const mentionedIds = this.parseMentions(content);
    return mentionedIds.map((id) => getAgentById(id)).filter((agent) => agent !== void 0);
  }
  /**
   * Format entry message (입장)
   * Example: "🔬 Tech Researcher (입장) 알겠어, 조사해볼게."
   */
  formatEntryMessage(agent, content) {
    return `${agent.emoji} ${agent.name} (\uC785\uC7A5) ${content}`;
  }
  /**
   * Format exit message (퇴장)
   * Example: "🔬 Tech Researcher 조사 완료. (퇴장)"
   */
  formatExitMessage(agent, content) {
    return `${agent.emoji} ${agent.name} ${content} (\uD1F4\uC7A5)`;
  }
  /**
   * Format regular message
   * Example: "🔬 Tech Researcher: 내용..."
   */
  formatMessage(agent, content) {
    return `${agent.emoji} ${agent.name}: ${content}`;
  }
  /**
   * Create a new Message object
   */
  createMessage(authorId, content, options) {
    const agent = getAgentById(authorId);
    return {
      id: generateId(),
      content,
      authorId,
      authorName: agent?.name ?? (authorId === "user" ? "\uC0AC\uC6A9\uC790" : authorId),
      authorEmoji: agent?.emoji ?? "\u{1F464}",
      timestamp: /* @__PURE__ */ new Date(),
      threadId: options?.threadId,
      mentions: this.parseMentions(content),
      isEntry: options?.isEntry,
      isExit: options?.isExit
    };
  }
  /**
   * Create a user message
   */
  createUserMessage(content, threadId) {
    return {
      id: generateId(),
      content,
      authorId: "user",
      authorName: "\uC0AC\uC6A9\uC790",
      authorEmoji: "\u{1F464}",
      timestamp: /* @__PURE__ */ new Date(),
      threadId,
      mentions: this.parseMentions(content)
    };
  }
};

// src/core/Agent.ts
var Agent = class {
  definition;
  _state;
  _activatedAt;
  _activatedBy;
  messageRouter;
  constructor(definition) {
    this.definition = definition;
    this._state = definition.alwaysActive ? "ACTIVE" /* ACTIVE */ : "DORMANT" /* DORMANT */;
    this._activatedAt = definition.alwaysActive ? /* @__PURE__ */ new Date() : void 0;
    this._activatedBy = definition.alwaysActive ? "system" : void 0;
    this.messageRouter = new MessageRouter();
  }
  // Getters
  get state() {
    return this._state;
  }
  get isActive() {
    return this._state === "ACTIVE" /* ACTIVE */;
  }
  get isDormant() {
    return this._state === "DORMANT" /* DORMANT */;
  }
  get id() {
    return this.definition.id;
  }
  get name() {
    return this.definition.name;
  }
  get emoji() {
    return this.definition.emoji;
  }
  get activatedAt() {
    return this._activatedAt;
  }
  get activatedBy() {
    return this._activatedBy;
  }
  /**
   * Activate this agent
   */
  activate(activatedBy) {
    if (this._state === "ACTIVE" /* ACTIVE */) {
      return false;
    }
    this._state = "ACTIVE" /* ACTIVE */;
    this._activatedAt = /* @__PURE__ */ new Date();
    this._activatedBy = activatedBy;
    return true;
  }
  /**
   * Deactivate this agent (unless alwaysActive)
   */
  deactivate() {
    if (this.definition.alwaysActive) {
      return false;
    }
    this._state = "DORMANT" /* DORMANT */;
    this._activatedAt = void 0;
    this._activatedBy = void 0;
    return true;
  }
  /**
   * Send entry message (입장)
   */
  async enter(platform, content) {
    const formattedContent = this.messageRouter.formatEntryMessage(this.definition, content);
    const message = this.messageRouter.createMessage(this.id, formattedContent, { isEntry: true });
    await platform.sendMessage(message);
    await platform.sendStatusUpdate(this.id, "enter");
  }
  /**
   * Send exit message (퇴장)
   */
  async exit(platform, content) {
    const formattedContent = this.messageRouter.formatExitMessage(this.definition, content);
    const message = this.messageRouter.createMessage(this.id, formattedContent, { isExit: true });
    await platform.sendMessage(message);
    await platform.sendStatusUpdate(this.id, "exit");
  }
  /**
   * Send regular message
   */
  async speak(platform, content) {
    const formattedContent = this.messageRouter.formatMessage(this.definition, content);
    const message = this.messageRouter.createMessage(this.id, formattedContent);
    await platform.sendMessage(message);
  }
  /**
   * Convert to AgentInstance format
   */
  toInstance() {
    return {
      definition: this.definition,
      state: this._state,
      activatedAt: this._activatedAt,
      activatedBy: this._activatedBy
    };
  }
};

// src/core/Orchestrator.ts
var Orchestrator = class {
  stateManager;
  messageRouter;
  platform;
  agents;
  constructor(platform) {
    this.stateManager = new StateManager();
    this.messageRouter = new MessageRouter();
    this.platform = platform;
    this.agents = /* @__PURE__ */ new Map();
    for (const definition of AGENT_DEFINITIONS) {
      this.agents.set(definition.id, new Agent(definition));
    }
  }
  /**
   * Handle incoming user message
   * Base agent analyzes and routes appropriately
   */
  async handleUserMessage(message) {
    const mentionedAgentIds = this.messageRouter.parseMentions(message.content);
    for (const agentId of mentionedAgentIds) {
      if (!this.stateManager.isActive(agentId)) {
        await this.summonAgent(agentId, `\uC0AC\uC6A9\uC790\uAC00 @${agentId} \uBA58\uC158`);
      }
    }
    if (mentionedAgentIds.length === 0) {
    }
  }
  /**
   * Summon an agent (activate and announce)
   */
  async summonAgent(id, reason) {
    const agent = this.agents.get(id);
    if (!agent) return false;
    const activated = this.stateManager.activateAgent(id, "base");
    if (!activated) return false;
    agent.activate("base");
    const definition = getAgentById(id);
    if (definition) {
      const entryMessage = reason ? `\uC54C\uACA0\uC5B4, ${reason}. \uCC38\uC5EC\uD560\uAC8C.` : "\uC54C\uACA0\uC5B4, \uCC38\uC5EC\uD560\uAC8C.";
      await agent.enter(this.platform, entryMessage);
    }
    return true;
  }
  /**
   * Dismiss an agent (deactivate and announce)
   */
  async dismissAgent(id, reason) {
    const agent = this.agents.get(id);
    if (!agent) return false;
    const exitMessage = reason ?? "\uC791\uC5C5 \uC644\uB8CC.";
    await agent.exit(this.platform, exitMessage);
    const deactivated = this.stateManager.deactivateAgent(id);
    if (deactivated) {
      agent.deactivate();
    }
    return deactivated;
  }
  /**
   * Get all active agent IDs
   */
  getActiveAgentIds() {
    return this.stateManager.getActiveAgents().map((a) => a.definition.id);
  }
  /**
   * Get all active agents
   */
  getActiveAgents() {
    return this.getActiveAgentIds().map((id) => this.agents.get(id)).filter((agent) => agent !== void 0);
  }
  /**
   * Check if an agent is active
   */
  isAgentActive(id) {
    return this.stateManager.isActive(id);
  }
  /**
   * Get a specific agent
   */
  getAgent(id) {
    return this.agents.get(id);
  }
  /**
   * Get current status summary
   */
  getStatus() {
    return {
      active: this.stateManager.getActiveCount(),
      dormant: this.stateManager.getDormantCount(),
      activeIds: this.getActiveAgentIds()
    };
  }
  /**
   * Reset all agents to initial state
   */
  reset() {
    this.stateManager.reset();
    for (const agent of this.agents.values()) {
      if (!agent.definition.alwaysActive) {
        agent.deactivate();
      }
    }
  }
};

// src/simulation/TerminalAdapter.ts
import chalk from "chalk";
var TerminalAdapter = class {
  messageHandler;
  threadCounter = 0;
  /**
   * Send a message - prints to console with colors
   */
  async sendMessage(message) {
    const { authorId, content, isEntry, isExit } = message;
    const agent = getAgentById(authorId);
    if (isEntry) {
      console.log(chalk.green("\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));
      console.log(chalk.green(`\u2502 ${content}`));
      console.log(chalk.green("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));
    } else if (isExit) {
      console.log(chalk.red("\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));
      console.log(chalk.red(`\u2502 ${content}`));
      console.log(chalk.red("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"));
    } else if (agent) {
      const color = this.getAgentColor(authorId);
      console.log(color(`${agent.emoji} ${agent.name}: `) + content);
    } else if (authorId === "user") {
      console.log(chalk.cyan("\u{1F464} \uC0AC\uC6A9\uC790: ") + content);
    } else {
      console.log(content);
    }
  }
  /**
   * Send status update
   */
  async sendStatusUpdate(agentId, status) {
    const agent = getAgentById(agentId);
    if (!agent) return;
    const statusEmoji = status === "enter" ? "\u{1F7E2}" : "\u{1F534}";
    const statusText = status === "enter" ? "\uC785\uC7A5" : "\uD1F4\uC7A5";
    const timestamp = (/* @__PURE__ */ new Date()).toLocaleTimeString("ko-KR");
    const color = status === "enter" ? chalk.green : chalk.red;
    console.log(color(`${statusEmoji} [${timestamp}] ${agent.emoji} ${agent.name} ${statusText}`));
  }
  /**
   * Register message handler
   */
  onMessage(handler) {
    this.messageHandler = handler;
  }
  /**
   * Simulate thread creation
   */
  async createThread(name) {
    this.threadCounter++;
    const threadId = `thread-${this.threadCounter}`;
    console.log(chalk.gray(`\u{1F4CE} \uC2A4\uB808\uB4DC \uC0DD\uC131: ${name} (${threadId})`));
    return threadId;
  }
  /**
   * Trigger a message from user input
   */
  triggerMessage(content) {
    if (!this.messageHandler) return;
    const message = {
      id: `msg-${Date.now()}`,
      content,
      authorId: "user",
      authorName: "\uC0AC\uC6A9\uC790",
      authorEmoji: "\u{1F464}",
      timestamp: /* @__PURE__ */ new Date(),
      mentions: this.parseMentions(content)
    };
    this.messageHandler(message);
  }
  parseMentions(content) {
    const mentionPattern = /@([a-z-]+)/gi;
    const matches = content.matchAll(mentionPattern);
    const mentions = [];
    for (const match of matches) {
      const agentId = match[1].toLowerCase();
      if (!mentions.includes(agentId)) {
        mentions.push(agentId);
      }
    }
    return mentions;
  }
  getAgentColor(agentId) {
    const colors = {
      base: chalk.yellow,
      searcher: chalk.blue,
      "tech-researcher": chalk.cyan,
      "trend-analyst": chalk.magenta,
      "data-provider": chalk.white,
      counselor: chalk.green,
      "user-psychologist": chalk.yellowBright,
      questioner: chalk.blueBright,
      persuader: chalk.cyanBright,
      educator: chalk.magentaBright,
      planner: chalk.greenBright,
      "team-composer": chalk.redBright,
      promoter: chalk.whiteBright,
      uploader: chalk.gray,
      "backend-dev": chalk.blue,
      "frontend-dev": chalk.cyan,
      designer: chalk.magenta,
      "code-reviewer": chalk.yellow,
      "doc-writer": chalk.green,
      automator: chalk.red,
      "prompt-engineer": chalk.blueBright,
      "ai-illustrator": chalk.cyanBright,
      "program-tester": chalk.magentaBright,
      "user-tester": chalk.greenBright,
      "security-checker": chalk.yellowBright,
      "vuln-finder": chalk.redBright,
      pentester: chalk.whiteBright,
      "fact-bomber": chalk.red,
      roaster: chalk.redBright,
      critic: chalk.yellow,
      negativist: chalk.gray,
      praiser: chalk.green,
      "loophole-finder": chalk.cyan,
      threatener: chalk.magenta,
      "dirty-worker": chalk.white
    };
    return colors[agentId] || chalk.white;
  }
  /**
   * Print system message
   */
  printSystem(message) {
    console.log(chalk.gray(`[\uC2DC\uC2A4\uD15C] ${message}`));
  }
  /**
   * Print error message
   */
  printError(message) {
    console.log(chalk.red(`[\uC624\uB958] ${message}`));
  }
};

// src/simulation/TerminalUI.ts
var TerminalUI = class {
  adapter;
  orchestrator;
  rl;
  isRunning = false;
  constructor() {
    this.adapter = new TerminalAdapter();
    this.orchestrator = new Orchestrator(this.adapter);
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }
  /**
   * Start the terminal UI
   */
  async start() {
    this.isRunning = true;
    this.printWelcome();
    this.printHelp();
    this.adapter.onMessage((message) => {
      this.orchestrator.handleUserMessage(message);
    });
    await this.inputLoop();
  }
  /**
   * Stop the terminal UI
   */
  stop() {
    this.isRunning = false;
    this.rl.close();
    console.log(chalk2.yellow("\n\u{1F44B} Too Many Claw \uC2DC\uBBAC\uB808\uC774\uC158\uC744 \uC885\uB8CC\uD569\uB2C8\uB2E4.\n"));
  }
  printWelcome() {
    console.log(chalk2.cyan(`
\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
\u2551                                                            \u2551
\u2551   \u{1F980} Too Many Claw - \uD130\uBBF8\uB110 \uC2DC\uBBAC\uB808\uC774\uC158                      \u2551
\u2551                                                            \u2551
\u2551   35\uAC1C\uC758 AI \uC5D0\uC774\uC804\uD2B8\uAC00 \uD611\uC5C5\uD558\uB294 \uC2DC\uC2A4\uD15C                       \u2551
\u2551                                                            \u2551
\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D
`));
  }
  printHelp() {
    console.log(chalk2.gray(`
\uBA85\uB839\uC5B4:
  /help          - \uB3C4\uC6C0\uB9D0 \uD45C\uC2DC
  /status        - \uD65C\uC131 \uC5D0\uC774\uC804\uD2B8 \uBAA9\uB85D
  /agents        - \uC804\uCCB4 \uC5D0\uC774\uC804\uD2B8 \uBAA9\uB85D
  /summon @agent - \uC5D0\uC774\uC804\uD2B8 \uC18C\uD658
  /dismiss @agent - \uC5D0\uC774\uC804\uD2B8 \uD1F4\uC7A5
  /clear         - \uD654\uBA74 \uC9C0\uC6B0\uAE30
  /quit          - \uC885\uB8CC

\uBA54\uC2DC\uC9C0\uC5D0 @agent-id\uB97C \uD3EC\uD568\uD558\uBA74 \uD574\uB2F9 \uC5D0\uC774\uC804\uD2B8\uAC00 \uC18C\uD658\uB429\uB2C8\uB2E4.
\uC608: @searcher \uCD5C\uC2E0 React \uC815\uBCF4 \uCC3E\uC544\uC918
`));
  }
  async inputLoop() {
    while (this.isRunning) {
      const input = await this.prompt();
      if (!input) continue;
      await this.handleInput(input.trim());
    }
  }
  prompt() {
    return new Promise((resolve) => {
      this.rl.question(chalk2.cyan("\u{1F464} \uC0AC\uC6A9\uC790 > "), (answer) => {
        resolve(answer);
      });
    });
  }
  async handleInput(input) {
    if (input.startsWith("/")) {
      await this.handleCommand(input);
      return;
    }
    if (input.length > 0) {
      this.adapter.triggerMessage(input);
    }
  }
  async handleCommand(input) {
    const parts = input.split(" ");
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    switch (command) {
      case "/help":
        this.printHelp();
        break;
      case "/status":
        this.printStatus();
        break;
      case "/agents":
        this.printAllAgents();
        break;
      case "/summon":
        await this.handleSummon(args);
        break;
      case "/dismiss":
        await this.handleDismiss(args);
        break;
      case "/clear":
        console.clear();
        this.printWelcome();
        break;
      case "/quit":
      case "/exit":
        this.stop();
        break;
      default:
        console.log(chalk2.red(`\uC54C \uC218 \uC5C6\uB294 \uBA85\uB839\uC5B4: ${command}`));
        console.log(chalk2.gray("/help \uB85C \uC0AC\uC6A9 \uAC00\uB2A5\uD55C \uBA85\uB839\uC5B4\uB97C \uD655\uC778\uD558\uC138\uC694."));
    }
  }
  printStatus() {
    const status = this.orchestrator.getStatus();
    console.log(chalk2.cyan("\n\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510"));
    console.log(chalk2.cyan("\u2502         \u{1F3AD} \uC5D0\uC774\uC804\uD2B8 \uC0C1\uD0DC             \u2502"));
    console.log(chalk2.cyan("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524"));
    console.log(chalk2.cyan("\u2502") + chalk2.white(`  \uD65C\uC131: ${status.active}  |  \uB300\uAE30: ${status.dormant}`).padEnd(36) + chalk2.cyan("\u2502"));
    console.log(chalk2.cyan("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524"));
    if (status.activeIds.length === 0) {
      console.log(chalk2.cyan("\u2502") + chalk2.gray("  (\uD65C\uC131\uD654\uB41C \uC5D0\uC774\uC804\uD2B8 \uC5C6\uC74C)").padEnd(36) + chalk2.cyan("\u2502"));
    } else {
      for (const id of status.activeIds) {
        const agent = getAgentById(id);
        if (agent) {
          console.log(chalk2.cyan("\u2502") + chalk2.green(`  \u{1F7E2} ${agent.emoji} ${agent.name}`).padEnd(44) + chalk2.cyan("\u2502"));
        }
      }
    }
    console.log(chalk2.cyan("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n"));
  }
  printAllAgents() {
    console.log(chalk2.cyan("\n\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510"));
    console.log(chalk2.cyan("\u2502              \u{1F3AD} \uC804\uCCB4 \uC5D0\uC774\uC804\uD2B8 \uBAA9\uB85D               \u2502"));
    console.log(chalk2.cyan("\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524"));
    const categories = /* @__PURE__ */ new Map();
    for (const agent of AGENT_DEFINITIONS) {
      const category = agent.category;
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category).push(agent);
    }
    for (const [category, agents] of categories) {
      console.log(chalk2.cyan("\u2502") + chalk2.yellow(` [${category}]`).padEnd(48) + chalk2.cyan("\u2502"));
      for (const agent of agents) {
        const active = this.orchestrator.isAgentActive(agent.id);
        const status = active ? chalk2.green("\u{1F7E2}") : chalk2.gray("\u26AA");
        console.log(chalk2.cyan("\u2502") + `  ${status} ${agent.emoji} ${agent.name} `.padEnd(47) + chalk2.cyan("\u2502"));
      }
    }
    console.log(chalk2.cyan("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n"));
  }
  async handleSummon(args) {
    if (args.length === 0) {
      console.log(chalk2.red("\uC0AC\uC6A9\uBC95: /summon @agent-id"));
      return;
    }
    const agentId = args[0].replace("@", "");
    const agent = getAgentById(agentId);
    if (!agent) {
      console.log(chalk2.red(`\uC54C \uC218 \uC5C6\uB294 \uC5D0\uC774\uC804\uD2B8: ${agentId}`));
      return;
    }
    if (this.orchestrator.isAgentActive(agentId)) {
      console.log(chalk2.yellow(`${agent.emoji} ${agent.name}\uC740(\uB294) \uC774\uBBF8 \uD65C\uC131\uD654\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.`));
      return;
    }
    await this.orchestrator.summonAgent(agentId, "\uC0AC\uC6A9\uC790\uAC00 \uC9C1\uC811 \uC18C\uD658");
  }
  async handleDismiss(args) {
    if (args.length === 0) {
      console.log(chalk2.red("\uC0AC\uC6A9\uBC95: /dismiss @agent-id"));
      return;
    }
    const agentId = args[0].replace("@", "");
    const agent = getAgentById(agentId);
    if (!agent) {
      console.log(chalk2.red(`\uC54C \uC218 \uC5C6\uB294 \uC5D0\uC774\uC804\uD2B8: ${agentId}`));
      return;
    }
    if (agent.alwaysActive) {
      console.log(chalk2.red(`${agent.emoji} ${agent.name}\uC740(\uB294) \uD56D\uC0C1 \uD65C\uC131\uD654 \uC0C1\uD0DC\uC785\uB2C8\uB2E4.`));
      return;
    }
    if (!this.orchestrator.isAgentActive(agentId)) {
      console.log(chalk2.yellow(`${agent.emoji} ${agent.name}\uC740(\uB294) \uC774\uBBF8 \uBE44\uD65C\uC131\uD654\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.`));
      return;
    }
    await this.orchestrator.dismissAgent(agentId, "\uC0AC\uC6A9\uC790\uAC00 \uC9C1\uC811 \uD1F4\uC7A5 \uC694\uCCAD");
  }
};

// src/config/ConfigManager.ts
import fs from "fs-extra";
import path from "path";
import os from "os";
var DEFAULT_CONFIG = {
  discord: {},
  webhooks: {},
  simulation: {
    enabled: false
  }
};
var ConfigManager = class {
  configPath;
  config;
  constructor() {
    const openclawDir = path.join(os.homedir(), ".openclaw");
    this.configPath = path.join(openclawDir, "too-many-claw.json");
    this.config = this.load();
  }
  /**
   * Load configuration from disk
   */
  load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readJsonSync(this.configPath);
        return { ...DEFAULT_CONFIG, ...data };
      }
    } catch {
    }
    return { ...DEFAULT_CONFIG };
  }
  /**
   * Save configuration to disk
   */
  save() {
    try {
      fs.ensureDirSync(path.dirname(this.configPath));
      fs.writeJsonSync(this.configPath, this.config, { spaces: 2 });
    } catch (error) {
      console.error("Failed to save config:", error);
    }
  }
  /**
   * Get Discord configuration
   */
  getDiscordConfig() {
    return this.config.discord;
  }
  /**
   * Set Discord configuration
   */
  setDiscordConfig(discord) {
    this.config.discord = { ...this.config.discord, ...discord };
    this.save();
  }
  /**
   * Check if Discord is configured
   */
  isDiscordConfigured() {
    const { token, guildId, chatChannelId } = this.config.discord;
    return !!(token && guildId && chatChannelId);
  }
  /**
   * Get webhook URL for an agent
   */
  getWebhook(agentId) {
    return this.config.webhooks[agentId];
  }
  /**
   * Set webhook URL for an agent
   */
  setWebhook(agentId, webhookUrl) {
    this.config.webhooks[agentId] = webhookUrl;
    this.save();
  }
  /**
   * Check if agent has a webhook
   */
  hasWebhook(agentId) {
    return !!this.config.webhooks[agentId];
  }
  /**
   * Remove webhook for an agent
   */
  removeWebhook(agentId) {
    delete this.config.webhooks[agentId];
    this.save();
  }
  /**
   * Get all webhooks
   */
  getAllWebhooks() {
    return { ...this.config.webhooks };
  }
  /**
   * Set all webhooks
   */
  setAllWebhooks(webhooks) {
    this.config.webhooks = { ...webhooks };
    this.save();
  }
  /**
   * Get config file path
   */
  getConfigPath() {
    return this.configPath;
  }
  /**
   * Reset configuration
   */
  reset() {
    this.config = { ...DEFAULT_CONFIG };
    try {
      if (fs.existsSync(this.configPath)) {
        fs.removeSync(this.configPath);
      }
    } catch {
    }
  }
};

// src/discord/Bot.ts
import {
  Client,
  GatewayIntentBits,
  TextChannel,
  Partials
} from "discord.js";
var Bot = class {
  client;
  config;
  messageHandlers = [];
  agentIds;
  constructor(config) {
    this.config = config;
    this.agentIds = new Set(getAllAgentIds());
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
      ],
      partials: [Partials.Message, Partials.Channel]
    });
    this.setupEventHandlers();
  }
  setupEventHandlers() {
    this.client.on("ready", () => {
      console.log(`\u2705 Bot logged in as ${this.client.user?.tag}`);
    });
    this.client.on("messageCreate", async (discordMessage) => {
      if (discordMessage.author.bot) return;
      if (discordMessage.channelId !== this.config.chatChannelId) return;
      const message = this.convertMessage(discordMessage);
      for (const handler of this.messageHandlers) {
        handler(message);
      }
    });
    this.client.on("error", (error) => {
      console.error("Discord bot error:", error);
    });
  }
  convertMessage(discordMessage) {
    const content = this.cleanMessageContent(discordMessage.content);
    const mentions = this.parseMentions(content);
    return {
      id: discordMessage.id,
      content,
      authorId: "user",
      authorName: discordMessage.author.displayName || discordMessage.author.username,
      authorEmoji: "\u{1F464}",
      timestamp: discordMessage.createdAt,
      threadId: discordMessage.thread?.id,
      mentions
    };
  }
  cleanMessageContent(content) {
    return content.replace(/<@!?(\d+)>/g, "@user");
  }
  parseMentions(content) {
    const mentionPattern = /@([a-z-]+)/gi;
    const matches = content.matchAll(mentionPattern);
    const mentions = [];
    for (const match of matches) {
      const agentId = match[1].toLowerCase();
      if (this.agentIds.has(agentId) && !mentions.includes(agentId)) {
        mentions.push(agentId);
      }
    }
    return mentions;
  }
  /**
   * Register a message handler
   */
  onMessage(handler) {
    this.messageHandlers.push(handler);
  }
  /**
   * Connect to Discord
   */
  async connect() {
    await this.client.login(this.config.token);
  }
  /**
   * Disconnect from Discord
   */
  async disconnect() {
    this.client.destroy();
  }
  /**
   * Send a message to a channel
   */
  async sendMessage(channelId, content) {
    const channel = await this.client.channels.fetch(channelId);
    if (channel && channel instanceof TextChannel) {
      await channel.send(content);
    }
  }
  /**
   * Get the chat channel
   */
  async getChatChannel() {
    const channel = await this.client.channels.fetch(this.config.chatChannelId);
    if (channel instanceof TextChannel) {
      return channel;
    }
    return null;
  }
  /**
   * Get the status channel
   */
  async getStatusChannel() {
    if (!this.config.statusChannelId) return null;
    const channel = await this.client.channels.fetch(this.config.statusChannelId);
    if (channel instanceof TextChannel) {
      return channel;
    }
    return null;
  }
  /**
   * Create a thread in the chat channel
   */
  async createThread(name) {
    const channel = await this.getChatChannel();
    if (!channel) {
      throw new Error("Chat channel not found");
    }
    const thread = await channel.threads.create({
      name,
      autoArchiveDuration: 1440
      // 24 hours
    });
    return thread.id;
  }
  /**
   * Check if bot is connected
   */
  get isConnected() {
    return this.client.isReady();
  }
};

// src/discord/WebhookManager.ts
import { WebhookClient } from "discord.js";
var WebhookManager = class {
  webhooks = /* @__PURE__ */ new Map();
  clients = /* @__PURE__ */ new Map();
  /**
   * Register a webhook URL for an agent
   */
  setWebhook(agentId, webhookUrl) {
    this.webhooks.set(agentId, webhookUrl);
    const existingClient = this.clients.get(agentId);
    if (existingClient) {
      existingClient.destroy();
    }
    this.clients.set(agentId, new WebhookClient({ url: webhookUrl }));
  }
  /**
   * Bulk register webhooks from config
   */
  setWebhooks(webhooks) {
    for (const [agentId, url] of Object.entries(webhooks)) {
      this.setWebhook(agentId, url);
    }
  }
  /**
   * Check if webhook exists for an agent
   */
  hasWebhook(agentId) {
    return this.webhooks.has(agentId);
  }
  /**
   * Send message as an agent via webhook
   */
  async sendAsAgent(agentId, content) {
    const client = this.clients.get(agentId);
    if (!client) {
      throw new Error(`No webhook registered for agent: ${agentId}`);
    }
    const agent = getAgentById(agentId);
    if (!agent) {
      throw new Error(`Unknown agent: ${agentId}`);
    }
    await client.send({
      content,
      username: `${agent.emoji} ${agent.name}`
      // Avatar URL could be set here if we have agent avatar images
    });
  }
  /**
   * Get all registered agent IDs
   */
  getRegisteredAgents() {
    return Array.from(this.webhooks.keys());
  }
  /**
   * Remove a webhook
   */
  removeWebhook(agentId) {
    const client = this.clients.get(agentId);
    if (client) {
      client.destroy();
      this.clients.delete(agentId);
    }
    this.webhooks.delete(agentId);
  }
  /**
   * Destroy all webhook clients
   */
  destroy() {
    for (const client of this.clients.values()) {
      client.destroy();
    }
    this.clients.clear();
    this.webhooks.clear();
  }
};

// src/discord/DiscordAdapter.ts
var DiscordAdapter = class {
  bot;
  webhookManager;
  statusChannelId;
  constructor(config) {
    this.bot = new Bot(config);
    this.webhookManager = new WebhookManager();
    this.statusChannelId = config.statusChannelId;
  }
  /**
   * Send a message - uses webhook if available, otherwise bot
   */
  async sendMessage(message) {
    const { authorId, content } = message;
    if (authorId !== "user" && this.webhookManager.hasWebhook(authorId)) {
      await this.webhookManager.sendAsAgent(authorId, content);
    } else {
      const channel = await this.bot.getChatChannel();
      if (channel) {
        await channel.send(content);
      }
    }
  }
  /**
   * Send status update to status channel
   */
  async sendStatusUpdate(agentId, status) {
    const channel = await this.bot.getStatusChannel();
    if (!channel) return;
    const agent = getAgentById(agentId);
    if (!agent) return;
    const statusEmoji = status === "enter" ? "\u{1F7E2}" : "\u{1F534}";
    const statusText = status === "enter" ? "\uC785\uC7A5" : "\uD1F4\uC7A5";
    const timestamp = (/* @__PURE__ */ new Date()).toLocaleTimeString("ko-KR");
    await channel.send(`${statusEmoji} [${timestamp}] ${agent.emoji} **${agent.name}** ${statusText}`);
  }
  /**
   * Register message handler
   */
  onMessage(handler) {
    this.bot.onMessage(handler);
  }
  /**
   * Create a new thread
   */
  async createThread(name) {
    return this.bot.createThread(name);
  }
  /**
   * Connect to Discord
   */
  async connect() {
    await this.bot.connect();
  }
  /**
   * Disconnect from Discord
   */
  async disconnect() {
    await this.bot.disconnect();
    this.webhookManager.destroy();
  }
  /**
   * Set webhook for an agent
   */
  setWebhook(agentId, webhookUrl) {
    this.webhookManager.setWebhook(agentId, webhookUrl);
  }
  /**
   * Bulk set webhooks
   */
  setWebhooks(webhooks) {
    this.webhookManager.setWebhooks(webhooks);
  }
  /**
   * Check if agent has a webhook
   */
  hasWebhook(agentId) {
    return this.webhookManager.hasWebhook(agentId);
  }
  /**
   * Check if connected
   */
  get isConnected() {
    return this.bot.isConnected;
  }
};

// src/cli.ts
var program = new Command();
program.name("tmc").description("Too Many Claw - 35 AI agents collaborating via Discord").version("1.0.0");
program.command("start").description("Start the Discord bot").action(async () => {
  const spinner = ora("Starting Too Many Claw...").start();
  try {
    const config = new ConfigManager();
    if (!config.isDiscordConfigured()) {
      spinner.fail("Discord not configured");
      console.log(chalk3.yellow("\nRun `tmc setup-discord` to configure Discord settings."));
      process.exit(1);
    }
    const discordConfig = config.getDiscordConfig();
    if (!discordConfig.token || !discordConfig.guildId || !discordConfig.chatChannelId) {
      spinner.fail("Incomplete Discord configuration");
      process.exit(1);
    }
    const adapter = new DiscordAdapter({
      token: discordConfig.token,
      guildId: discordConfig.guildId,
      chatChannelId: discordConfig.chatChannelId,
      statusChannelId: discordConfig.statusChannelId
    });
    const webhooks = config.getAllWebhooks();
    if (Object.keys(webhooks).length > 0) {
      adapter.setWebhooks(webhooks);
    }
    const orchestrator = new Orchestrator(adapter);
    adapter.onMessage((message) => {
      orchestrator.handleUserMessage(message);
    });
    await adapter.connect();
    spinner.succeed("Too Many Claw is running!");
    console.log(chalk3.green("\n\u{1F980} Too Many Claw Discord bot is now active!"));
    console.log(chalk3.gray("Press Ctrl+C to stop.\n"));
    process.on("SIGINT", async () => {
      console.log(chalk3.yellow("\n\nShutting down..."));
      await adapter.disconnect();
      process.exit(0);
    });
  } catch (error) {
    spinner.fail("Failed to start");
    console.error(chalk3.red(error));
    process.exit(1);
  }
});
program.command("simulate").description("Start terminal simulation mode").action(async () => {
  console.log(chalk3.cyan("\n\u{1F980} Starting Too Many Claw Simulation...\n"));
  const ui = new TerminalUI();
  await ui.start();
});
program.command("status").description("Show agent status and configuration").action(() => {
  console.log(chalk3.cyan("\n\u{1F980} Too Many Claw - Agent Status\n"));
  const config = new ConfigManager();
  const categories = /* @__PURE__ */ new Map();
  for (const agent of AGENT_DEFINITIONS) {
    if (!categories.has(agent.category)) {
      categories.set(agent.category, []);
    }
    categories.get(agent.category).push(agent);
  }
  for (const [category, agents] of categories) {
    console.log(chalk3.yellow(`
[${category}]`));
    for (const agent of agents) {
      const hasWebhook = config.hasWebhook(agent.id);
      const webhookStatus = hasWebhook ? chalk3.green("\u2713") : chalk3.gray("\u25CB");
      console.log(`  ${webhookStatus} ${agent.emoji} ${agent.name} (${chalk3.gray(agent.id)})`);
    }
  }
  console.log(chalk3.gray(`
\uCD1D ${AGENT_DEFINITIONS.length}\uAC1C \uC5D0\uC774\uC804\uD2B8
`));
  console.log(chalk3.cyan("Discord \uC124\uC815:"));
  if (config.isDiscordConfigured()) {
    console.log(chalk3.green("  \u2713 \uAD6C\uC131\uB428"));
  } else {
    console.log(chalk3.yellow("  \u25CB \uBBF8\uAD6C\uC131 (tmc setup-discord \uC2E4\uD589)"));
  }
  console.log();
});
program.command("setup-discord").description("Configure Discord settings").action(async () => {
  console.log(chalk3.cyan("\n\u{1F980} Too Many Claw - Discord \uC124\uC815\n"));
  const config = new ConfigManager();
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "token",
      message: "Discord Bot Token:",
      default: config.getDiscordConfig().token || ""
    },
    {
      type: "input",
      name: "guildId",
      message: "Discord Guild (Server) ID:",
      default: config.getDiscordConfig().guildId || ""
    },
    {
      type: "input",
      name: "chatChannelId",
      message: "Chat Channel ID:",
      default: config.getDiscordConfig().chatChannelId || ""
    },
    {
      type: "input",
      name: "statusChannelId",
      message: "Status Channel ID (optional):",
      default: config.getDiscordConfig().statusChannelId || ""
    }
  ]);
  config.setDiscordConfig({
    token: answers.token,
    guildId: answers.guildId,
    chatChannelId: answers.chatChannelId,
    statusChannelId: answers.statusChannelId || void 0
  });
  console.log(chalk3.green("\n\u2713 Discord \uC124\uC815\uC774 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4."));
  console.log(chalk3.gray("`tmc start`\uB85C \uBD07\uC744 \uC2DC\uC791\uD558\uC138\uC694.\n"));
});
program.command("uninstall").description("Remove Too Many Claw configuration").action(async () => {
  const answers = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "Are you sure you want to remove all Too Many Claw configuration?",
      default: false
    }
  ]);
  if (!answers.confirm) {
    console.log(chalk3.yellow("Cancelled."));
    return;
  }
  const spinner = ora("Removing configuration...").start();
  try {
    const config = new ConfigManager();
    config.reset();
    spinner.succeed("Configuration removed");
    console.log(chalk3.green("\nToo Many Claw configuration has been removed."));
    console.log(chalk3.gray("Run `npm uninstall -g too-many-claw` to complete uninstallation.\n"));
  } catch (error) {
    spinner.fail("Failed to remove configuration");
    console.error(chalk3.red(error));
  }
});
program.parse();
//# sourceMappingURL=cli.js.map