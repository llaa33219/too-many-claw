# Too Many Claw

OpenClaw 확장 프로그램 - 35개의 AI 에이전트가 유동적으로 협업하는 시스템

## 개요

Too Many Claw는 OpenClaw의 확장으로, 35개의 전문화된 에이전트가 Discord를 통해 실시간으로 협업합니다. 각 에이전트는 고유한 전문성과 페르소나를 가지며, 사용자의 요청에 따라 동적으로 소환되고 퇴장합니다.

## 설치

```bash
npm install -g too-many-claw
```

설치 시 자동으로:
- `~/.openclaw/` 하위에 35개 workspace 디렉토리 생성
- 각 workspace에 SOUL.md 파일 생성
- `openclaw.json`에 에이전트 설정 병합

## 사용법

### Discord 봇 시작
```bash
tmc start
```

### 터미널 시뮬레이션
```bash
tmc simulate
```

### 에이전트 상태 확인
```bash
tmc status
```

### Discord 설정
```bash
tmc setup-discord
```

## 에이전트 목록 (35개)

### 코어
| ID | 이름 | 역할 |
|----|------|------|
| `base` | 🏠 Base | 팀 코디네이터 (항상 활성) |

### 조사/분석
| ID | 이름 | 역할 |
|----|------|------|
| `searcher` | 🔍 검색 전문가 | 정보 검색 및 자료 수집 |
| `tech-researcher` | 🔬 최신 기술 조사 전문가 | 기술 트렌드 조사 |
| `trend-analyst` | 📈 유행 분석 전문가 | 시장/트렌드 분석 |
| `data-provider` | 📊 데이터 마련 전문가 | 데이터 수집/정제 |

### 심리/소통
| ID | 이름 | 역할 |
|----|------|------|
| `counselor` | 💚 심리 상담가 | 감정 지원 및 상담 |
| `user-psychologist` | 🧠 사용자 심리 분석가 | 사용자 의도 분석 |
| `questioner` | ❓ 질문 전문가 | 요구사항 명확화 |
| `persuader` | 🎯 합리적 설득 전문가 | 논리적 설득/중재 |
| `educator` | 📚 교육 전문가 | 개념 설명/교육 |

### 기획/관리
| ID | 이름 | 역할 |
|----|------|------|
| `planner` | 📋 전문적인 계획 전문가 | 계획 수립/로드맵 |
| `team-composer` | 👥 에이전트 팀 구성 전문가 | 최적 팀 구성 |
| `promoter` | 📢 홍보 전문가 | 마케팅/브랜딩 |
| `uploader` | ⬆️ 업로더 | 배포/릴리즈 |

### 개발
| ID | 이름 | 역할 |
|----|------|------|
| `backend-dev` | ⚙️ 백엔드 개발자 | 서버/API/DB |
| `frontend-dev` | 🎨 프론트엔드 개발자 | UI/UX 구현 |
| `designer` | 🖌️ 전문 디자이너 | UI/UX 디자인 |
| `code-reviewer` | 👀 코드 리뷰어 | 코드 품질 검토 |
| `doc-writer` | 📝 문서 작성 전문가 | 문서화 |
| `automator` | 🤖 자동화 전문가 | 워크플로우 자동화 |
| `prompt-engineer` | 💬 프롬프트 엔지니어 | AI 프롬프트 최적화 |
| `ai-illustrator` | 🎭 AI 일러스트 생성 전문가 | AI 이미지 생성 |

### 테스트/보안
| ID | 이름 | 역할 |
|----|------|------|
| `program-tester` | 🧪 프로그램 테스트 전문가 | 기술 테스트/QA |
| `user-tester` | 👤 일반 사용자 테스트 전문가 | 사용성 검증 |
| `security-checker` | 🛡️ 보안 체크 전문가 | 보안 체크리스트 |
| `vuln-finder` | 🔓 취약점 찾기 전문가 | 취약점 분석 |
| `pentester` | 💀 모의해킹 전문가 | 침투 테스트 |

### 비판/검증
| ID | 이름 | 역할 |
|----|------|------|
| `fact-bomber` | 💣 팩트폭행 전문가 | 팩트 체크 |
| `roaster` | 🔥 독설가 | 직설적 비판 |
| `critic` | 🧐 비판가 | 논리적 비판 |
| `negativist` | 👎 부정적인 에이전트 | 리스크 분석 |
| `praiser` | 👏 칭찬 전문가 | 동기부여/격려 |

### 특수 역할
| ID | 이름 | 역할 |
|----|------|------|
| `loophole-finder` | 🕳️ 꼼수 찾기 전문가 | 규칙 내 최적화 |
| `threatener` | ⚡ 협박 전문가 | 데드라인 압박 |
| `dirty-worker` | 🪠 더티워커 | 기피 업무 담당 |

## 모델 배분

| 모델 | 에이전트 |
|------|----------|
| claude-opus-4-5 | base, user-psychologist, planner, pentester, critic |
| claude-sonnet-4-5 | 대부분의 실무 에이전트 (27개) |
| claude-haiku-4-5 | uploader, praiser, dirty-worker |

## 소통 방식

### 소환
- `@에이전트명` 멘션으로 소환
- Base 또는 활성 에이전트가 소환 가능
- 사용자도 직접 소환 가능

### 퇴장
- 자진 퇴장: 작업 완료 시 `(퇴장)` 선언
- 명령 퇴장: Base가 `@에이전트명 퇴장해` 명령
- 인계 퇴장: 다른 에이전트에게 작업 넘기며 퇴장

### 메시지 포맷
```
입장: "🔬 Tech Researcher (입장) 알겠어, 조사해볼게."
퇴장: "🔬 Tech Researcher 조사 완료. (퇴장)"
```

## Discord 채널 구조

```
#chat      - 메인 대화 채널
#status    - 에이전트 입장/퇴장 로그
스레드      - 복잡한 작업 분리
```

## 라이선스

MIT
