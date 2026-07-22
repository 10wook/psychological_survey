# 심리척도 기반 설문·분석 플랫폼

심리학 연구에 특화된 설문 플랫폼입니다. 연구자가 **심리척도**를 등록하고 역문항·하위요인을 설정해 설문을 생성·배포하면, 응답자의 응답을 **자동 채점**하고 관리자에게 **기술통계**와 **원자료 내보내기**를 제공합니다.

일반적인 설문 도구와 달리 **척도를 재사용 단위로 관리**하고, **버전·잠금**으로 과거 응답의 재현 가능성을 보장합니다.

---

## 핵심 기능

- 응답자/연구자/관리자 **역할 기반 인증** (세션 쿠키, bcrypt 해시)
- 개인정보 수집·연구 참여 **동의 이력** 저장 (문서 버전 + 시각)
- **척도 CRUD** + 버전 관리 + 복제 + 게시/잠금
- 문항 CRUD, **역문항** 설정, 하위요인, 필수 응답 일괄 설정, 문항 순서 변경
- 여러 척도를 묶은 **설문 생성**, 고유 URL, **QR 코드**, 종료/잠금
- **문항 무작위 제시**(응답 시작 시 1회 고정, 새로고침·이어하기 시 동일 순서)
- 응답 **자동 저장**(debounce, upsert 멱등), **이어하기**
- 제출 시 서버 재검증 → **역문항/척도/하위요인 자동 채점**(트랜잭션)
- 응답자 **결과 화면**(총점·하위요인·해석·평균 비교·주의 문구)
- 관리자 **모니터링/기술통계**(표본 분산·표준편차, 중앙값 등)
- **CSV/XLSX 내보내기**(Wide/Long, 코드북 시트, 개인정보 옵션, 감사 로그)
- 주요 관리자 액션 **감사 로그**

## 기술 스택

- **Next.js 15**(App Router) · **React 19** · **TypeScript**(strict)
- **Tailwind CSS**
- **Prisma ORM** · **PostgreSQL**(배포는 Supabase 권장)
- **Zod**(입력 검증) · **bcryptjs**(비밀번호) · **qrcode** · **exceljs**
- **Vitest**(단위/통합) · **Playwright**(E2E)

## 폴더 구조

```
prisma/
  schema.prisma        # 도메인 모델 (16개 엔티티)
  seed.ts              # 관리자 + 샘플 척도/설문 seed
src/
  app/
    (auth) login, register, privacy
    surveys/           # 응답자: 내 설문
    s/[publicId]/      # 설문 안내/시작
    respond/[id]/      # 응답 화면(자동저장) + 완료
    result/[id]/       # 응답자 결과
    admin/             # 관리자 콘솔(대시보드/척도/설문/응답/통계)
    api/               # Route Handlers (인증/척도/설문/응답/통계/내보내기)
  lib/
    scoring.ts         # 채점 순수 함수 (테스트됨)
    statistics.ts      # 기술통계 순수 함수 (테스트됨)
    shuffle.ts         # 문항 무작위화 (테스트됨)
    scoreResponse.ts   # DB 채점 파이프라인
    surveyStats.ts     # 설문 모니터링/통계 집계
    export.ts          # CSV/XLSX/코드북 생성
    auth.ts, http.ts, validation.ts, audit.ts, lock.ts ...
tests/
  unit/                # scoring, statistics, shuffle
  integration/         # DB 기반 채점 파이프라인
  e2e/                 # Playwright 핵심 시나리오
```

## 환경 변수

`.env.example` 를 복사해 `.env` 를 만듭니다.

| 변수 | 설명 |
|---|---|
| `DATABASE_URL` | 애플리케이션 런타임용 PostgreSQL 연결 문자열 (Supabase 는 pooler/6543 권장) |
| `DIRECT_URL` | 마이그레이션용 직접 연결 (Supabase 는 5432) |
| `SESSION_SECRET` | 세션 관련 비밀키 (긴 랜덤 문자열) |
| `NEXT_PUBLIC_APP_URL` | 배포 도메인 (QR/배포 URL 생성) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | 초기 관리자 계정 (seed) |

> 실제 비밀번호·비밀키는 저장소에 커밋하지 마세요.

## 로컬 실행 방법

```bash
# 1) 의존성 설치
npm install

# 2) 로컬 PostgreSQL (Docker)
docker compose up -d

# 3) 마이그레이션 + seed
npm run prisma:migrate      # 스키마 반영
npm run db:seed             # 관리자 + 샘플 척도/설문

# 4) 개발 서버
npm run dev                 # http://localhost:3000
```

### 데이터베이스 마이그레이션

```bash
npm run prisma:migrate      # 개발: 마이그레이션 생성/적용
npm run prisma:deploy       # 배포: 기존 마이그레이션 적용
npm run prisma:generate     # Prisma Client 생성
```

### Seed 실행

```bash
npm run db:seed
```

### 테스트 실행

```bash
npm test                    # 단위 + 통합 (Vitest, DB 필요)
npm run test:e2e            # E2E (Playwright, dev 서버 + seed 필요)
npm run typecheck           # 타입 검사
npm run lint                # ESLint
```

## 관리자 계정

seed 로 생성됩니다. 기본값은 `.env` 의 `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (예: `admin@example.com` / `Admin1234!`). **배포 전 반드시 변경**하세요.

## 점수 계산 규칙

- 원점수(raw)와 변환점수(converted)를 모두 저장합니다.
- 역문항: `convertedScore = maxScore + minScore - rawScore` (일반 문항은 원점수와 동일)
- 척도 총점 = 활성·응답 문항의 convertedScore 합계, 평균 = 총점 / 응답 문항 수
- 하위요인 총점/평균도 동일 방식
- 비활성 문항·미응답은 계산에서 제외
- 기술통계는 **완료 응답**만 대상, 표본 기준(**ddof=1**). 값이 1개 이하이면 분산·표준편차는 계산 불가(null)

## 개인정보 처리 원칙

- 계정 정보 / 개인 프로필 / 연구 응답을 **논리적으로 분리** (응답에는 `Participant` 익명 코드 사용)
- 관리자 화면 기본 표시는 **익명 코드**, 개인정보 열람은 권한(`canViewPii`) 있는 관리자만
- 개인정보 포함 내보내기는 별도 권한 + **감사 로그** 기록
- 동의 문구 버전과 동의 시각 저장

## 내보내기 형식

- **Wide**: 응답자당 1행 (문항별 원/변환점수, 척도 총점, 하위요인 점수, 제시 순서 옵션)
- **Long**: 문항 응답당 1행
- **XLSX 시트**: Responses, Answers, Scale Results, Subfactor Results, **Codebook**
- CSV 는 한국어 Excel 호환을 위해 **UTF-8 BOM** 기본 활성화
- 파일명: `survey_{surveyId}_{yyyyMMdd_HHmm}.{csv|xlsx}`


## 보안 (Supabase / 인가)

이 앱은 Supabase를 **Postgres 호스트로만** 사용합니다. `@supabase/supabase-js`·anon 키·Data API는 사용하지 않으며, DB 접근은 서버사이드 Prisma뿐입니다.

- **RLS**: 모든 `public` 테이블에 Row-Level Security를 켜 두었고, anon/authenticated용 허용 POLICY는 없습니다(deny-by-default). Prisma 연결(테이블 오너)은 RLS를 우회합니다.
- **연구자 격리**: `RESEARCHER`는 본인이 만든 Scale/Survey(및 그 응답)만 관리합니다. `ADMIN`은 전체 접근. 타 연구자의 **PUBLISHED/LOCKED** 척도 버전만 설문에 부착할 수 있습니다.
- **세션**: `SESSION_SECRET`으로 세션 쿠키(`psych_session`)에 HMAC 서명을 적용합니다. 프로덕션에서는 반드시 긴 랜덤 값을 설정하세요.
- **배포 후 확인**: Supabase Dashboard → Advisors에서 `rls_disabled_in_public`이 사라졌는지 확인하고, DB 비밀번호·시드 관리자 비밀번호를 기본값에서 회전하세요.

## 배포 방법 (Supabase + Vercel 권장)

1. Supabase 프로젝트 생성 → `DATABASE_URL`(pooler), `DIRECT_URL`(direct) 확보
2. Vercel 프로젝트에 환경 변수 등록 (`DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `NEXT_PUBLIC_APP_URL`)
3. 빌드 명령은 `prisma generate && next build` (기본 `npm run build` 에 포함)
4. 배포 후 최초 1회: `npm run prisma:deploy && npm run db:seed`

## 향후 계획 (P1 이후)

대시보드 추이 그래프, 박스플롯, 결과지 PDF, 이메일 일괄 발송, SPSS/R 내보내기 프리셋, 척도 라이브러리, 논문 PDF 척도 추출(P2) 등.

## MVP 완료 상태

문서 15장의 관리자·응답자·분석 시나리오가 실제 DB 흐름으로 동작하며, `scripts/smoke.mjs` 및 Vitest/Playwright 테스트로 검증됩니다.
