# 🦞 Too Many Claw

> OpenClaw 확장 - 35개의 AI 에이전트가 유동적으로 협업하는 시스템

[![npm version](https://badge.fury.io/js/too-many-claw.svg)](https://www.npmjs.com/package/too-many-claw)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ 특징

- **35개 전문화된 에이전트** - 개발, 디자인, 테스트, 보안, 심리 상담 등 다양한 전문 분야
- **동적 협업** - 필요에 따라 에이전트가 소환되고 퇴장하는 유동적 팀 구성
- **Discord 통합** - 실시간 채팅으로 자연스러운 협업 경험
- **그룹씽크 방지** - 비판/검증 에이전트로 균형 잡힌 의사결정

## 📦 설치

```bash
npm install -g too-many-claw
```

설치 시 자동으로:
- `~/.openclaw/` 하위에 35개 workspace 디렉토리 생성
- 각 workspace에 SOUL.md (에이전트 페르소나) 생성
- `openclaw.json`에 에이전트 설정 병합

## 🚀 사용법

### Discord 봇 시작
```bash
tmc start
```

### 터미널 시뮬레이션 (Discord 없이 테스트)
```bash
tmc simulate
```

### 에이전트 상태 확인
```bash
tmc status
```

### Discord 설정 마법사
```bash
tmc setup-discord
```

### 설정 제거
```bash
tmc uninstall
```

## 👥 에이전트 목록

### 🏠 코어
| ID | 이름 | 모델 | 역할 |
|----|------|------|------|
| `base` | Base | Opus | 팀 코디네이터 (항상 활성) |

### 🔍 조사/분석
| ID | 이름 | 모델 | 역할 |
|----|------|------|------|
| `searcher` | 검색 전문가 | Sonnet | 정보 검색 및 자료 수집 |
| `tech-researcher` | 최신 기술 조사 전문가 | Sonnet | 기술 트렌드 조사 |
| `trend-analyst` | 유행 분석 전문가 | Sonnet | 시장/트렌드 분석 |
| `data-provider` | 데이터 마련 전문가 | Sonnet | 데이터 수집/정제 |

### 💚 심리/소통
| ID | 이름 | 모델 | 역할 |
|----|------|------|------|
| `counselor` | 심리 상담가 | Sonnet | 감정 지원 및 상담 |
| `user-psychologist` | 사용자 심리 분석가 | Opus | 사용자 의도 분석 |
| `questioner` | 질문 전문가 | Sonnet | 요구사항 명확화 |
| `persuader` | 합리적 설득 전문가 | Sonnet | 논리적 설득/중재 |
| `educator` | 교육 전문가 | Sonnet | 개념 설명/교육 |

### 📋 기획/관리
| ID | 이름 | 모델 | 역할 |
|----|------|------|------|
| `planner` | 전문적인 계획 전문가 | Opus | 계획 수립/로드맵 |
| `team-composer` | 에이전트 팀 구성 전문가 | Sonnet | 최적 팀 구성 |
| `promoter` | 홍보 전문가 | Sonnet | 마케팅/브랜딩 |
| `uploader` | 업로더 | Haiku | 배포/릴리즈 |

### ⚙️ 개발
| ID | 이름 | 모델 | 역할 |
|----|------|------|------|
| `backend-dev` | 백엔드 개발자 | Sonnet | 서버/API/DB |
| `frontend-dev` | 프론트엔드 개발자 | Sonnet | UI/UX 구현 |
| `designer` | 전문 디자이너 | Sonnet | UI/UX 디자인 |
| `code-reviewer` | 코드 리뷰어 | Sonnet | 코드 품질 검토 |
| `doc-writer` | 문서 작성 전문가 | Sonnet | 문서화 |
| `automator` | 자동화 전문가 | Sonnet | 워크플로우 자동화 |
| `prompt-engineer` | 프롬프트 엔지니어 | Sonnet | AI 프롬프트 최적화 |
| `ai-illustrator` | AI 일러스트 생성 전문가 | Sonnet | AI 이미지 생성 |

### 🧪 테스트/보안
| ID | 이름 | 모델 | 역할 |
|----|------|------|------|
| `program-tester` | 프로그램 테스트 전문가 | Sonnet | 기술 테스트/QA |
| `user-tester` | 일반 사용자 테스트 전문가 | Sonnet | 사용성 검증 |
| `security-checker` | 보안 체크 전문가 | Sonnet | 보안 체크리스트 |
| `vuln-finder` | 취약점 찾기 전문가 | Sonnet | 취약점 분석 |
| `pentester` | 모의해킹 전문가 | Opus | 침투 테스트 |

### 🧐 비판/검증 (그룹씽크 방지)
| ID | 이름 | 모델 | 역할 |
|----|------|------|------|
| `fact-bomber` | 팩트폭행 전문가 | Sonnet | 팩트 체크 |
| `roaster` | 독설가 | Sonnet | 직설적 비판 |
| `critic` | 비판가 | Opus | 논리적 비판 |
| `negativist` | 부정적인 에이전트 | Sonnet | 리스크 분석 |
| `praiser` | 칭찬 전문가 | Haiku | 동기부여/격려 |

### 🕳️ 특수 역할
| ID | 이름 | 모델 | 역할 |
|----|------|------|------|
| `loophole-finder` | 꼼수 찾기 전문가 | Sonnet | 규칙 내 최적화 |
| `threatener` | 협박 전문가 | Sonnet | 데드라인 압박 |
| `dirty-worker` | 더티워커 | Haiku | 기피 업무 담당 |

## 💬 소통 방식

### 에이전트 소환
```
@searcher 이거 좀 찾아봐
@backend-dev @frontend-dev 같이 협업해서 만들어줘
```

### 에이전트 퇴장
- **자진 퇴장**: 작업 완료 시 `(퇴장)` 선언
- **명령 퇴장**: Base가 `@에이전트명 퇴장해` 명령
- **인계 퇴장**: 다른 에이전트에게 작업 넘기며 퇴장

### 메시지 형식
```
입장: "🔬 Tech Researcher (입장) 알겠어, 조사해볼게."
일반: "🔬 Tech Researcher 조사 결과 정리했어. ..."
퇴장: "🔬 Tech Researcher 조사 완료. (퇴장)"
```

## 📁 Discord 채널 구조

```
#chat      - 메인 대화 채널 (모든 소통)
#status    - 에이전트 입장/퇴장 자동 로그
스레드      - 복잡한 작업 분리
```

## ⚙️ 설정

### 환경 변수
```bash
DISCORD_TOKEN=your_bot_token
DISCORD_GUILD_ID=your_server_id
DISCORD_CHAT_CHANNEL_ID=chat_channel_id
DISCORD_STATUS_CHANNEL_ID=status_channel_id
```

### 설정 파일
- `~/.openclaw/too-many-claw.json` - Discord 설정 및 웹훅 URL
- `~/.openclaw/openclaw.json` - 에이전트 정의 (자동 병합)
- `~/.openclaw/workspace-{id}/SOUL.md` - 에이전트별 페르소나

## 🔧 개발

```bash
# 의존성 설치
npm install

# 개발 모드
npm run dev

# 빌드
npm run build
```

## 🚀 배포 (npm 퍼블리시)

### GitHub Actions 자동 배포

이 프로젝트는 GitHub Actions를 통해 npm에 자동 배포됩니다.

#### 1. npm 토큰 설정

1. [npmjs.com](https://www.npmjs.com/) 에서 Access Token 생성
   - Account → Access Tokens → Generate New Token → Automation
2. GitHub 저장소 Settings → Secrets and variables → Actions
3. `NPM_TOKEN` 이름으로 Secret 추가

#### 2. 배포 트리거

**방법 A: 태그 푸시**
```bash
# 버전 업데이트
npm version patch  # 또는 minor, major

# 태그 푸시 (자동 배포 트리거)
git push --tags
```

**방법 B: GitHub Release 생성**
1. GitHub → Releases → Create a new release
2. 태그 생성 (예: `v1.0.1`)
3. Release 발행 → 자동 배포

#### 3. 워크플로우 파일

- `.github/workflows/ci.yml` - PR/푸시 시 빌드 테스트 (Node 18, 20, 22)
- `.github/workflows/publish.yml` - 태그/릴리스 시 npm 배포

### 수동 배포

```bash
npm run build
npm publish --access public
```

## 📄 라이선스

MIT © 2024
