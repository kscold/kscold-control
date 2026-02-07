# kscold-control

맥 미니 인프라 컨트롤 타워 - Claude Code CLI와 Docker 컨테이너 환경을 웹 인터페이스로 통합 관리하는 시스템

## 개요

kscold-control은 Claude Code 터미널 세션과 Docker 컨테이너 오케스트레이션을 중앙에서 제어할 수 있는 풀스택 인프라 관리 플랫폼입니다. 역할 기반 접근 제어와 실시간 WebSocket 통신을 기반으로 구축되었습니다.

## 핵심 기능

### Claude Code 웹 터미널
- 브라우저를 통한 실시간 Claude Code CLI 제어
- 네이티브 슬래시 명령어 지원 (`/help`, `/clear`, `/cd`)
- 영구 세션 히스토리 저장 및 복원 기능
- WebSocket 기반 양방향 통신

### Docker 인프라 관리
- 원클릭 우분투 컨테이너 프로비저닝
- 실시간 리소스 모니터링 (CPU, 메모리, 네트워크, I/O)
- 컨테이너 라이프사이클 관리 (시작, 중지, 삭제)
- 실시간 로그 스트리밍 및 통계

### 보안 및 접근 제어
- 리프레시 토큰 로테이션을 포함한 JWT 기반 인증
- 3단계 권한을 가진 역할 기반 접근 제어 (RBAC)
- 사용자 역할: Admin, Developer, Viewer
- 세밀한 권한 시스템

## 기술 스택

- **프론트엔드**: React 18 + Vite + TypeScript + Tailwind CSS + xterm.js
- **백엔드**: NestJS + TypeORM + Socket.io + Passport JWT
- **데이터베이스**: PostgreSQL 15
- **인프라**: Docker + Dockerode
- **프로세스 관리**: pm2

## 아키텍처

- **모노레포**: Turborepo + Yarn workspaces
- **배포 모델**: 호스트 기반 실행 (Docker 소켓 접근을 위해 백엔드/프론트엔드는 호스트에서 실행)
- **데이터베이스**: 컨테이너화된 PostgreSQL
- **포트 전략**: 단일 포트 배포 (4000번 포트에서 API와 정적 프론트엔드 모두 서빙)

## 설치 및 배포

```bash
# 1. 의존성 설치
cd ~/Desktop/kscold-control
yarn install

# 2. PostgreSQL 데이터베이스 시작
docker compose up -d

# 3. 초기 역할 및 권한으로 데이터베이스 시드
cd apps/backend && yarn seed

# 4. 프론트엔드 빌드
cd ../frontend && yarn build

# 5. 백엔드 빌드
cd ../backend && yarn build

# 6. pm2로 배포
cd ~/Desktop/kscold-control
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

## 개발

```bash
# 모든 워크스페이스를 개발 모드로 실행
yarn dev

# 코드 포맷팅
yarn format

# 린터 실행
yarn lint
```

## 프로젝트 구조

```
kscold-control/
├── apps/
│   ├── backend/          # NestJS API 서버
│   └── frontend/         # React 웹 인터페이스
├── packages/             # 공유 패키지
├── docker-compose.yml    # PostgreSQL 컨테이너
└── ecosystem.config.js   # pm2 설정
```

## 라이선스

MIT

---

**kscold**
