# 심리척도 기반 설문·분석 플랫폼 개발 작업지시서

## 0. 이 문서의 목적

이 문서는 Cursor에게 한 번에 전달할 수 있는 통합 개발 지시서다.

목표는 일반적인 설문조사 웹사이트가 아니라, 다음 흐름을 하나의 제품 안에서 처리하는 **심리학 연구 특화 설문 플랫폼**을 만드는 것이다.

> 연구자가 심리척도를 등록하고, 역문항과 하위요인을 설정하고, 설문을 생성·배포한 뒤, 응답자의 결과를 자동 채점하고, 관리자에게 기술통계와 원자료를 제공하는 웹서비스

이 문서를 읽은 뒤 Cursor는 바로 코드를 작성하지 말고, 먼저 현재 저장소 구조를 분석하고 구현 계획을 제시한 다음 단계별로 작업해야 한다.

---

# 1. 제품 개요

## 1.1 핵심 사용자

### 응답자

응답자는 다음 작업을 할 수 있어야 한다.

- 회원가입
- 로그인 및 로그아웃
- 개인정보 수집·이용 동의
- 참여 가능한 설문 확인
- 설문 응답
- 작성 중인 설문 이어서 응답
- 설문 제출
- 본인의 설문 결과 확인
- 완료한 설문 이력 확인

### 관리자 또는 연구자

관리자는 다음 작업을 할 수 있어야 한다.

- 척도 생성, 조회, 수정, 복제, 비활성화
- 척도 내 문항 생성, 수정, 삭제, 활성화, 비활성화
- 문항별 역문항 여부 설정
- 하위요인 생성 및 문항 연결
- 척도 전체 필수 응답 설정
- 척도 내 문항 무작위 제시 설정
- 여러 척도를 묶어 하나의 설문 생성
- 설문 배포 링크 생성
- QR 코드 생성
- 설문 응답 현황 조회
- 개별 응답 조회
- 평균, 표준편차, 분산 등 기술통계 조회
- 응답 데이터를 CSV 및 XLSX로 내보내기
- 완료되거나 배포된 설문과 척도 잠금
- 척도 버전 관리

---

# 2. 제품의 핵심 차별점

이 서비스는 Qualtrics, REDCap, LimeSurvey와 같은 범용 설문 도구를 그대로 복제하는 것이 아니다.

다음 네 가지를 핵심 차별점으로 구현한다.

## 2.1 척도를 독립적인 재사용 단위로 관리

척도와 설문은 서로 다른 개념으로 설계한다.

### 척도

- 척도명
- 설명
- 출처
- 응답 범위
- 문항 목록
- 역문항
- 하위요인
- 채점 방법
- 해석 기준
- 예상 소요시간
- 버전
- 활성화 여부

### 설문

- 설문명
- 안내문
- 포함할 척도
- 척도 순서
- 조사 기간
- 배포 주소
- 로그인 요구 여부
- 결과 공개 여부
- 목표 응답 수
- 설문 상태

동일한 척도를 여러 설문에서 재사용할 수 있어야 한다.

## 2.2 역문항과 하위요인 자동 채점

관리자가 문항별로 역문항 여부를 설정하면 서버에서 자동으로 변환 점수를 계산한다.

예를 들어 1점부터 5점까지의 척도에서는 다음 공식을 사용한다.

```text
변환점수 = 최댓값 + 최솟값 - 원점수
변환점수 = 6 - 원점수
```

하위요인별 합계와 평균도 자동으로 계산한다.

## 2.3 척도와 설문의 버전 및 잠금 관리

응답 수집이 시작된 척도나 설문은 직접 수정하지 않는다.

수정이 필요하면 기존 버전을 유지하고 새 버전을 생성한다.

```text
척도 v1
→ 설문에 배포
→ 응답 발생
→ 수정 요청
→ 척도 v2 생성
→ 신규 설문부터 v2 사용
```

과거 응답은 반드시 응답 당시의 척도 버전과 연결되어야 한다.

## 2.4 응답자 결과와 연구자 분석 데이터를 동시에 제공

응답자는 자신의 총점과 하위요인 점수를 확인한다.

관리자는 다음 정보를 확인한다.

- 전체 응답 수
- 완료 응답 수
- 미완료 응답 수
- 평균
- 표준편차
- 분산
- 중앙값
- 최솟값
- 최댓값
- 문항별 응답 분포
- 개인별 원점수
- 개인별 변환점수
- 척도 총점
- 하위요인 점수

---

# 3. 개발 목표와 우선순위

## 3.1 P0: 반드시 완성해야 하는 MVP

다음 기능은 MVP에 반드시 포함한다.

1. 관리자 및 응답자 인증
2. 개인정보 수집 및 동의 기록
3. 척도 CRUD
4. 문항 CRUD
5. 척도 및 문항 활성화·비활성화
6. 역문항 설정
7. 하위요인 설정
8. 척도 전체 필수 응답 설정
9. 척도 내 문항 무작위 제시
10. 설문 생성 및 척도 연결
11. 고유 설문 URL 생성
12. QR 코드 생성
13. 설문 응답 자동 저장
14. 미완료 설문 이어하기
15. 설문 완료 및 잠금
16. 개인 결과 자동 계산
17. 관리자 기술통계
18. 개별 응답 조회
19. CSV 내보내기
20. XLSX 내보내기
21. 척도 및 설문 버전 관리
22. 감사 로그의 최소 구현

## 3.2 P1: MVP 직후 구현

- 대시보드
- 총 시작 응답 수
- 완성 응답 수
- 이탈자 수
- 완료율
- 평균 응답 시간
- 목표 달성률
- 척도별 박스플롯
- 모바일 미리보기
- 개인 결과지 PDF
- 이메일 일괄 발송
- 연구자와 연구보조원 권한 분리
- SPSS 및 R 분석용 내보내기 프리셋
- 척도 라이브러리

## 3.3 P2: 장기 확장 기능

- 논문 PDF에서 척도 추출
- AI 기반 척도 추천
- AI 기반 결과 해석
- 다국어 설문
- 규준집단 기반 백분위
- 오프라인 응답
- 기관별 멀티테넌시
- 외부 기관 SSO
- 실험 조건 균등 무작위 배정

---

# 4. 권장 기술 스택

현재 저장소에 이미 기술 스택이 정해져 있다면 기존 스택을 우선 사용한다.

새 프로젝트라면 아래 구성을 기본값으로 한다.

## 4.1 프론트엔드

- Next.js
- TypeScript
- React
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zod
- TanStack Query
- Recharts
- SurveyJS Form Library 또는 자체 설문 렌더러

## 4.2 백엔드

다음 중 현재 저장소에 더 적합한 방식을 선택한다.

### 기본 권장안

- Next.js App Router
- Route Handlers 또는 별도 NestJS API
- TypeScript

### 대안

- FastAPI
- Python
- Pydantic
- SQLAlchemy

한 프로젝트 안에서 언어와 프레임워크를 불필요하게 혼합하지 않는다.

## 4.3 데이터베이스

- PostgreSQL
- Prisma ORM 또는 현재 스택에 맞는 ORM
- Redis는 세션, 임시 저장, 대규모 통계 캐시가 필요한 시점에 추가

## 4.4 인증

- 이메일과 비밀번호 로그인
- 비밀번호는 Argon2id 또는 bcrypt로 해시
- 세션 쿠키는 HttpOnly, Secure, SameSite 설정
- 관리자와 응답자 역할 기반 접근 제어
- 이후 OAuth 확장이 가능하도록 설계

## 4.5 파일 및 내보내기

- CSV: UTF-8 BOM 포함 옵션 제공
- XLSX: SheetJS, ExcelJS 또는 백엔드 라이브러리 사용
- QR 코드: 검증된 QR 생성 라이브러리 사용
- 향후 PDF 결과지는 서버에서 생성

---

# 5. 핵심 도메인 모델

데이터베이스 테이블과 ORM 모델은 다음 구조를 기본으로 설계한다.

필요하면 이름은 기존 프로젝트 규칙에 맞게 수정할 수 있으나, 관계와 책임은 유지한다.

## 5.1 User

```text
id
email
passwordHash
role
status
createdAt
updatedAt
lastLoginAt
```

role 예시:

```text
RESPONDENT
RESEARCHER
ADMIN
```

## 5.2 UserProfile

개인정보는 로그인 정보와 분리한다.

```text
id
userId
birthYear
birthMonth
birthDay
gender
createdAt
updatedAt
```

MVP에서는 생년월일 대신 출생연도만 저장하는 설정도 지원할 수 있다.

## 5.3 ConsentRecord

동의 문구와 동의 시점을 변경 이력과 함께 저장한다.

```text
id
userId
consentType
documentVersion
agreed
agreedAt
ipAddress
userAgent
```

consentType 예시:

```text
PRIVACY_COLLECTION
RESEARCH_PARTICIPATION
EMAIL_RESULT
MARKETING
```

필수 동의와 선택 동의를 구분한다.

## 5.4 Scale

척도의 논리적 식별자다.

```text
id
name
description
sourceTitle
sourceAuthor
sourceYear
sourceUrl
licenseNote
isActive
createdBy
createdAt
updatedAt
```

## 5.5 ScaleVersion

실제 설문에 사용되는 척도 버전이다.

```text
id
scaleId
versionNumber
status
minScore
maxScore
requiredByDefault
shuffleQuestions
estimatedSeconds
interpretationConfig
publishedAt
lockedAt
createdAt
```

status 예시:

```text
DRAFT
PUBLISHED
ARCHIVED
LOCKED
```

## 5.6 Subfactor

```text
id
scaleVersionId
name
description
displayOrder
```

MVP에서는 한 문항이 하나의 하위요인에만 속하도록 한다.

향후 다중 하위요인 연결이 필요하면 연결 테이블로 확장한다.

## 5.7 Question

```text
id
scaleVersionId
subfactorId
code
content
isReverse
isActive
displayOrder
minScore
maxScore
createdAt
updatedAt
```

질문별 응답 선택지 텍스트가 다를 수 있으므로 별도의 선택지 모델을 둔다.

## 5.8 QuestionOption

```text
id
questionId
value
label
displayOrder
```

## 5.9 Survey

```text
id
title
description
instructions
status
publicId
requireLogin
allowResume
allowDuplicate
showResult
targetResponseCount
startAt
endAt
createdBy
createdAt
updatedAt
publishedAt
lockedAt
```

status 예시:

```text
DRAFT
PUBLISHED
CLOSED
LOCKED
ARCHIVED
```

publicId는 설문 주소에 사용하는 추측하기 어려운 문자열이다.

예:

```text
/surveys/4f7ac91d
```

## 5.10 SurveyScale

설문과 척도 버전의 연결 테이블이다.

```text
id
surveyId
scaleVersionId
displayOrder
isRequired
shuffleQuestions
```

설문별로 척도의 기본 설정을 덮어쓸 수 있다.

## 5.11 Participant

연구 응답 데이터와 사용자의 직접 식별정보를 분리하기 위한 모델이다.

```text
id
userId
anonymousCode
createdAt
```

관리자 화면에서는 기본적으로 anonymousCode를 표시한다.

예:

```text
R-000012
```

## 5.12 SurveyResponse

```text
id
surveyId
participantId
status
startedAt
lastSavedAt
completedAt
durationSeconds
questionOrderJson
clientMetadataJson
createdAt
updatedAt
```

status 예시:

```text
NOT_STARTED
IN_PROGRESS
COMPLETED
ABANDONED
```

questionOrderJson에는 응답자에게 제시된 실제 척도별 문항 순서를 저장한다.

## 5.13 Answer

```text
id
surveyResponseId
questionId
rawScore
convertedScore
answeredAt
updatedAt
```

원점수와 역문항 적용 후 점수를 모두 저장한다.

## 5.14 ScaleResult

```text
id
surveyResponseId
scaleVersionId
rawTotal
convertedTotal
averageScore
completedQuestionCount
calculatedAt
```

## 5.15 SubfactorResult

```text
id
surveyResponseId
subfactorId
totalScore
averageScore
completedQuestionCount
calculatedAt
```

## 5.16 AuditLog

```text
id
actorUserId
entityType
entityId
action
beforeJson
afterJson
createdAt
ipAddress
```

최소한 다음 작업을 기록한다.

- 척도 생성
- 척도 수정
- 척도 버전 게시
- 설문 게시
- 설문 잠금
- 개인정보 포함 데이터 내보내기
- 응답 데이터 삭제 또는 수정

---

# 6. 기능 요구사항

## 6.1 인증과 권한

### 회원가입

입력값:

- 이메일
- 비밀번호
- 비밀번호 확인
- 출생연도 또는 생년월일
- 성별
- 개인정보 수집 동의
- 연구 참여 관련 동의

요구사항:

- 이메일 중복 검사
- 비밀번호 정책 적용
- 필수 동의 미체크 시 가입 불가
- 동의 문서 버전 저장
- 비밀번호 평문 저장 금지
- 로그인 실패 횟수 제한 또는 속도 제한

### 로그인

- 이메일과 비밀번호 로그인
- HttpOnly 쿠키 기반 세션 권장
- 로그아웃 시 세션 무효화
- 역할별 라우트 보호
- 관리자 API는 서버에서도 권한 검증

## 6.2 척도 관리

관리자는 다음 작업을 할 수 있다.

- 척도 생성
- 척도 목록 조회
- 척도 상세 조회
- 척도 수정
- 척도 복제
- 척도 비활성화
- 척도 버전 생성
- 척도 버전 게시
- 척도 버전 잠금

### 척도 삭제 정책

아직 사용되지 않은 DRAFT 척도만 물리 삭제를 허용한다.

설문에 사용되었거나 응답이 존재하는 척도는 삭제하지 않고 비활성화 또는 보관 처리한다.

## 6.3 문항 관리

관리자는 척도 버전 안에서 다음 작업을 할 수 있다.

- 문항 추가
- 문항 수정
- 문항 삭제
- 문항 활성화·비활성화
- 문항 순서 변경
- 역문항 설정
- 하위요인 연결
- 응답 범위 설정
- 선택지 라벨 설정

가능하면 문항 일괄 등록을 지원한다.

예:

```text
문항코드 | 문항내용 | 하위요인 | 역문항 | 순서
Q1 | 나는 최근 기분이 좋았다 | 긍정정서 | Y | 1
```

MVP에서 파일 업로드가 과도하면 표 형태의 붙여넣기 입력부터 구현한다.

## 6.4 하위요인 관리

- 하위요인 추가
- 하위요인 수정
- 하위요인 삭제
- 표시 순서 변경
- 문항 연결
- 하위요인별 점수 계산

응답이 있는 척도 버전에서는 하위요인 구성을 직접 수정하지 않는다.

## 6.5 역문항 계산

역문항 계산은 서버에서 수행한다.

공식:

```text
convertedScore = maxScore + minScore - rawScore
```

예:

```text
1~5 척도
1 → 5
2 → 4
3 → 3
4 → 2
5 → 1
```

필수 조건:

- 원점수 저장
- 변환점수 저장
- 척도 버전 저장
- 채점 결과 재계산 API 제공
- 응답값이 허용 범위를 벗어나면 저장 거부

## 6.6 설문 생성

관리자는 다음 정보를 입력한다.

- 제목
- 설명
- 안내문
- 포함 척도
- 척도 표시 순서
- 척도별 필수 응답 여부
- 척도별 문항 무작위화 여부
- 로그인 필수 여부
- 중복 응답 허용 여부
- 결과 공개 여부
- 시작일
- 종료일
- 목표 응답 수

## 6.7 설문 배포

설문 게시 시 다음을 생성한다.

- 고유 웹 URL
- QR 코드 이미지
- 링크 복사 기능

게시되지 않은 설문은 외부에서 접근할 수 없어야 한다.

종료된 설문은 응답 시작을 차단하고 종료 안내를 보여준다.

## 6.8 문항 무작위화

척도별 설정에 따라 척도 내부의 활성화된 문항을 섞는다.

중요한 규칙:

1. 설문 시작 시 한 번만 순서를 생성한다.
2. 생성된 순서를 SurveyResponse에 저장한다.
3. 새로고침해도 순서가 바뀌지 않아야 한다.
4. 설문을 이어서 응답해도 동일한 순서여야 한다.
5. 관리자 데이터 내보내기에 실제 제시 순서를 포함할 수 있어야 한다.
6. 하위요인별 블록 무작위화는 P1 이후로 미룬다.

## 6.9 필수 응답 일괄 적용

관리자는 척도 단위로 필수 응답을 설정할 수 있어야 한다.

필수 척도에서는 활성화된 모든 문항에 답해야 다음 단계로 이동하거나 제출할 수 있다.

문항별로 반복 설정하지 않아도 되도록 한다.

## 6.10 응답 자동 저장

다음 시점에 자동 저장한다.

- 선택지 선택 직후
- 다음 페이지 이동 시
- 일정한 debounce 이후
- 브라우저 종료 전에 가능한 범위에서 저장

서버는 upsert 방식으로 답변을 저장한다.

중복 요청에도 데이터가 손상되지 않도록 멱등성을 고려한다.

## 6.11 설문 제출

제출 시 서버에서 다시 검증한다.

- 필수 척도의 모든 활성 문항 응답 여부
- 응답값 범위
- 설문 기간
- 이미 완료된 응답인지 여부
- 중복 응답 허용 여부
- 사용된 척도 버전의 일치 여부

검증 성공 후 다음 작업을 하나의 트랜잭션으로 수행한다.

1. 미완료 답변 검증
2. 역문항 점수 계산
3. 척도 총점 계산
4. 하위요인 점수 계산
5. 응답 상태를 COMPLETED로 변경
6. 완료 시각 저장
7. 응답 시간 계산
8. 결과 레코드 저장

완료된 응답은 일반 사용자가 수정할 수 없다.

## 6.12 응답자 결과 화면

결과 공개 설정이 켜진 설문에 한해 보여준다.

표시 항목:

- 척도명
- 총점
- 평균 점수
- 하위요인별 점수
- 전체 응답 평균과 비교
- 관리자가 등록한 해석 문구
- 진단이 아님을 알리는 주의 문구

기본 문구:

```text
본 결과는 연구 및 참고 목적으로 제공되며,
의학적 또는 임상적 진단을 대체하지 않습니다.
```

초기 응답자가 매우 적을 때 전체 평균 비교는 숨길 수 있도록 한다.

## 6.13 관리자 응답 모니터링

설문별로 다음을 제공한다.

- 설문 시작 수
- 응답 중 수
- 완료 수
- 이탈 수
- 완료율
- 평균 응답 시간
- 목표 응답 수
- 목표 달성률

응답자 목록:

- 익명 응답자 코드
- 응답 상태
- 시작 시각
- 마지막 저장 시각
- 완료 시각
- 응답 시간
- 개인정보 열람 권한이 있는 경우에만 식별정보 보기

## 6.14 기술통계

최소 지원 통계:

- 응답자 수
- 평균
- 표준편차
- 분산
- 중앙값
- 최솟값
- 최댓값

통계 단위:

- 설문 전체
- 척도
- 하위요인
- 문항

기본 표준편차와 분산은 표본 기준으로 계산한다.

```text
sample variance
sample standard deviation
ddof = 1
```

응답자가 1명 이하이면 표본 분산과 표준편차는 null 또는 계산 불가로 처리한다.

결측 응답 처리 규칙을 명시한다.

MVP에서는 완료 응답만 기본 통계에 포함한다.

## 6.15 개별 응답 조회

관리자는 한 응답자의 다음 정보를 볼 수 있다.

- 익명 코드
- 설문 상태
- 인구통계 정보
- 문항별 원점수
- 문항별 변환점수
- 역문항 여부
- 실제 제시 순서
- 척도별 총점
- 하위요인 점수
- 시작 및 완료 시각
- 응답 시간

개인정보 열람 권한이 없는 연구자는 이메일 등 직접 식별정보를 볼 수 없어야 한다.

## 6.16 CSV 및 XLSX 내보내기

최소 두 가지 형식을 지원한다.

### Wide format

한 행이 한 응답자다.

```text
respondent_id,birth_year,gender,Q1,Q2,Q3,total_score
R-0001,1998,F,3,5,2,48
```

### Long format

한 행이 하나의 문항 응답이다.

```text
respondent_id,scale,question,raw_score,converted_score
R-0001,우울 척도,Q1,3,3
R-0001,우울 척도,Q2,1,5
```

내보내기 옵션:

- CSV 또는 XLSX
- 완료 응답만
- 전체 응답
- 개인정보 포함 여부
- 원점수 포함 여부
- 변환점수 포함 여부
- 척도 총점 포함 여부
- 하위요인 점수 포함 여부
- 실제 제시 순서 포함 여부
- 조사 기간 필터
- 문항 코드 사용
- 문항 전체 내용 사용

XLSX 권장 시트:

```text
Responses
Answers
Scale Results
Subfactor Results
Codebook
```

Codebook에는 변수명, 문항 내용, 역문항 여부, 하위요인, 응답 범위를 기록한다.

## 6.17 잠금과 버전 관리

다음 조건 중 하나를 만족하면 해당 척도 버전은 잠근다.

- 게시된 설문에서 사용 중
- 하나 이상의 응답이 시작됨
- 하나 이상의 완료 응답이 존재함

잠금 후 허용:

- 복제
- 새 버전 생성
- 비활성화
- 설명성 메모 추가

잠금 후 금지:

- 문항 내용 수정
- 역문항 변경
- 응답 범위 변경
- 하위요인 변경
- 선택지 값 변경
- 물리 삭제

---

# 7. 화면 구조

## 7.1 공통

- 로그인
- 회원가입
- 비밀번호 찾기
- 개인정보처리방침
- 이용약관
- 접근 권한 없음
- 404
- 서버 오류

## 7.2 응답자 화면

### 내 설문

- 참여 가능한 설문
- 작성 중인 설문
- 완료한 설문

### 설문 안내

- 설문 제목
- 연구 목적
- 예상 소요시간
- 개인정보 및 연구 참여 동의
- 시작 버튼

### 설문 응답

- 현재 척도명
- 진행률
- 문항
- 선택지
- 이전
- 다음
- 임시 저장 상태 표시
- 모바일 반응형

### 설문 완료

- 완료 메시지
- 결과 보기
- 내 설문으로 이동

### 결과

- 척도별 총점
- 하위요인
- 해석 문구
- 평균 비교
- 주의 문구

## 7.3 관리자 화면

### 대시보드

MVP에서는 간단한 요약 카드만 구현해도 된다.

- 전체 설문 수
- 활성 설문 수
- 총 완료 응답 수
- 최근 응답

### 척도 관리

- 척도 목록
- 생성
- 상세
- 버전 목록
- 버전 편집
- 문항 편집
- 하위요인 편집
- 미리보기
- 복제
- 게시
- 잠금 상태

### 설문 관리

- 설문 목록
- 생성
- 척도 선택
- 설정
- 미리보기
- 게시
- URL 및 QR
- 종료
- 잠금

### 응답 관리

- 응답 목록
- 상태 필터
- 기간 필터
- 개별 응답
- 개인정보 표시 토글
- 내보내기

### 통계

- 척도별 통계
- 하위요인별 통계
- 문항별 통계
- 완료 응답 기준 표시

---

# 8. API 요구사항

실제 라우트 이름은 프로젝트 규칙에 맞게 조정한다.

## 8.1 인증

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

## 8.2 척도

```text
GET    /api/admin/scales
POST   /api/admin/scales
GET    /api/admin/scales/:scaleId
PATCH  /api/admin/scales/:scaleId
POST   /api/admin/scales/:scaleId/versions
POST   /api/admin/scales/:scaleId/clone
PATCH  /api/admin/scales/:scaleId/active
```

## 8.3 척도 버전과 문항

```text
GET    /api/admin/scale-versions/:versionId
PATCH  /api/admin/scale-versions/:versionId
POST   /api/admin/scale-versions/:versionId/publish
POST   /api/admin/scale-versions/:versionId/lock

POST   /api/admin/scale-versions/:versionId/questions
PATCH  /api/admin/questions/:questionId
DELETE /api/admin/questions/:questionId
POST   /api/admin/scale-versions/:versionId/questions/reorder

POST   /api/admin/scale-versions/:versionId/subfactors
PATCH  /api/admin/subfactors/:subfactorId
DELETE /api/admin/subfactors/:subfactorId
```

## 8.4 설문

```text
GET    /api/admin/surveys
POST   /api/admin/surveys
GET    /api/admin/surveys/:surveyId
PATCH  /api/admin/surveys/:surveyId
POST   /api/admin/surveys/:surveyId/publish
POST   /api/admin/surveys/:surveyId/close
POST   /api/admin/surveys/:surveyId/lock
GET    /api/admin/surveys/:surveyId/qr
```

## 8.5 응답자 설문

```text
GET  /api/public/surveys/:publicId
POST /api/public/surveys/:publicId/start
GET  /api/responses/:responseId
PUT  /api/responses/:responseId/answers
POST /api/responses/:responseId/submit
GET  /api/responses/:responseId/result
```

## 8.6 관리자 통계와 내보내기

```text
GET  /api/admin/surveys/:surveyId/responses
GET  /api/admin/responses/:responseId
GET  /api/admin/surveys/:surveyId/statistics
POST /api/admin/surveys/:surveyId/export
```

---

# 9. 보안 및 개인정보 보호 요구사항

## 9.1 필수 보안 기준

- 비밀번호 평문 저장 금지
- Argon2id 또는 bcrypt 사용
- SQL Injection 방지
- XSS 방지
- CSRF 방지
- 세션 쿠키 보안 설정
- 역할 기반 서버 권한 검증
- 요청 속도 제한
- 입력값 스키마 검증
- 민감정보 로그 출력 금지
- 프로덕션에서 상세 오류 노출 금지
- 개인정보 포함 내보내기 감사 로그 저장
- 관리자 액션 로그 저장

## 9.2 데이터 분리

다음 세 범주를 논리적으로 분리한다.

```text
계정 정보
개인 프로필
연구 응답
```

연구 응답에는 사용자 이메일 대신 Participant ID를 저장한다.

## 9.3 개인정보 최소 수집

MVP 기본 수집값:

- 이메일
- 비밀번호
- 출생연도 또는 생년월일
- 성별

연구자가 필요하지 않은 개인정보를 수집하지 않도록 설문별 설정 확장을 고려한다.

## 9.4 동의 이력

동의 문구가 변경될 수 있으므로 문서 버전과 동의 시각을 반드시 저장한다.

## 9.5 삭제 정책

사용자 탈퇴와 연구 데이터 삭제 정책을 분리한다.

법적 또는 연구 윤리적 요구사항이 확정되지 않은 경우 임의로 완전 삭제하지 말고, 코드에 정책 인터페이스와 관리자 기능 확장 지점을 마련한다.

---

# 10. 통계 계산 규칙

## 10.1 점수

- 원점수와 변환점수를 각각 보관
- 일반 문항은 변환점수와 원점수가 동일
- 역문항은 공식 적용
- 비활성화 문항은 계산에서 제외
- 완료된 설문에서만 최종 점수 확정

## 10.2 척도 총점

```text
척도 총점 = 활성 문항의 convertedScore 합계
```

## 10.3 척도 평균

```text
척도 평균 = 척도 총점 / 응답 문항 수
```

## 10.4 하위요인 총점

```text
하위요인 총점 = 해당 하위요인 문항의 convertedScore 합계
```

## 10.5 기술통계

완료 응답을 기본 대상으로 한다.

```text
count
mean
sample variance
sample standard deviation
median
min
max
```

통계 로직은 화면 코드에 직접 넣지 말고 독립적인 서비스 또는 모듈로 작성한다.

동일한 데이터에 대해 API, 내보내기, 테스트에서 같은 계산 모듈을 사용한다.

---

# 11. 데이터 내보내기 세부 규칙

## 11.1 파일명

```text
survey_{surveyId}_{yyyyMMdd_HHmm}.csv
survey_{surveyId}_{yyyyMMdd_HHmm}.xlsx
```

## 11.2 개인정보 보호

기본값은 개인정보 미포함이다.

개인정보 포함 옵션은 별도 권한이 있는 관리자만 사용할 수 있다.

개인정보 포함 내보내기 시 감사 로그를 남긴다.

## 11.3 CSV 인코딩

한국어 Excel 호환을 위해 UTF-8 BOM 옵션을 기본 활성화한다.

## 11.4 코드북

XLSX에는 코드북 시트를 포함한다.

예:

| variable | question_code | question_text | scale | subfactor | reverse | min | max |
|---|---|---|---|---|---:|---:|---:|

---

# 12. 테스트 요구사항

최소한 다음 테스트를 작성한다.

## 12.1 단위 테스트

- 역문항 계산
- 척도 총점 계산
- 하위요인 계산
- 표본 평균
- 표본 분산
- 표본 표준편차
- 중앙값
- 필수 응답 검증
- 설문 기간 검증
- 문항 무작위화
- 무작위 순서 재사용

## 12.2 통합 테스트

- 회원가입과 로그인
- 관리자 척도 생성
- 척도 버전 게시
- 설문 생성
- 설문 게시
- 응답 시작
- 답변 자동 저장
- 제출
- 결과 계산
- 통계 조회
- CSV 내보내기
- XLSX 내보내기
- 잠금된 척도 수정 차단

## 12.3 E2E 테스트

Playwright 또는 현재 프로젝트의 E2E 도구를 사용한다.

핵심 시나리오:

```text
관리자가 척도 생성
→ 하위요인 생성
→ 문항과 역문항 등록
→ 설문 생성
→ 설문 게시
→ 응답자 회원가입
→ 설문 응답
→ 제출
→ 결과 확인
→ 관리자가 통계 확인
→ XLSX 다운로드
```

---

# 13. 구현 단계

Cursor는 다음 순서로 작업한다.

## Phase 0. 저장소 분석

코드를 수정하기 전에 다음을 수행한다.

1. 현재 폴더 구조 분석
2. package.json 또는 의존성 확인
3. 인증 구조 확인
4. 데이터베이스와 ORM 확인
5. 기존 UI 컴포넌트 확인
6. 테스트 도구 확인
7. 실행 방법 확인
8. 현재 구현된 기능과 누락 기능 정리

분석 결과를 먼저 보고한다.

다음 내용을 포함한다.

```text
현재 스택
현재 폴더 구조
재사용 가능한 코드
문제가 될 수 있는 부분
새로 만들 모듈
예상 마이그레이션
작업 순서
```

## Phase 1. 프로젝트 기반 구축

- 환경 변수 예시 작성
- 데이터베이스 연결
- ORM 모델 작성
- 마이그레이션 생성
- seed 데이터 작성
- 공통 오류 처리
- 입력값 검증
- 역할 기반 권한 미들웨어
- 감사 로그 기반 작성

## Phase 2. 인증과 개인정보 동의

- 회원가입
- 로그인
- 로그아웃
- 현재 사용자 조회
- UserProfile
- ConsentRecord
- 관리자 계정 seed
- 보호 라우트
- 개인정보처리방침 기본 페이지

## Phase 3. 척도와 문항 관리

- 척도 목록
- 척도 생성
- 척도 버전
- 하위요인 CRUD
- 문항 CRUD
- 역문항 설정
- 일괄 필수 설정
- 문항 순서 변경
- 척도 미리보기
- 게시 및 잠금

## Phase 4. 설문 관리와 배포

- 설문 CRUD
- 척도 선택
- 척도 순서
- 설문별 필수 여부
- 설문별 랜덤 여부
- 게시
- 고유 URL
- QR 코드
- 종료
- 잠금

## Phase 5. 응답자 설문

- 설문 안내
- 응답 시작
- 문항 순서 생성
- 순서 저장
- 반응형 응답 화면
- 자동 저장
- 이어하기
- 필수 문항 검증
- 제출

## Phase 6. 채점과 결과

- 역문항 계산 서비스
- 척도 점수
- 하위요인 점수
- 결과 저장
- 응답자 결과 화면
- 해석 문구

## Phase 7. 관리자 모니터링과 통계

- 응답 목록
- 응답 상태
- 개별 응답
- 기술통계
- 기본 대시보드
- 개인정보 표시 권한

## Phase 8. 데이터 내보내기

- Wide CSV
- Long CSV
- XLSX
- 코드북
- 내보내기 옵션
- 감사 로그

## Phase 9. 테스트와 품질 개선

- 단위 테스트
- 통합 테스트
- E2E
- 접근성 확인
- 모바일 화면 확인
- 빈 상태
- 오류 상태
- 로딩 상태
- 보안 점검
- README 갱신

---

# 14. Cursor 작업 방식

## 14.1 한 번에 전체 코드를 무리하게 생성하지 말 것

각 Phase마다 다음 순서를 지킨다.

1. 작업할 범위 요약
2. 변경할 파일 목록
3. 데이터베이스 변경점
4. 구현
5. 테스트 실행
6. 린트와 타입 검사
7. 결과 보고
8. 다음 Phase 제안

## 14.2 기존 코드 우선

- 기존 컴포넌트 재사용
- 기존 네이밍 규칙 준수
- 기존 상태 관리 방식 준수
- 기존 API 패턴 준수
- 기존 테스트 패턴 준수
- 새로운 라이브러리 추가 전 필요성 검토

## 14.3 품질 기준

- TypeScript strict mode 유지
- any 사용 최소화
- 함수와 컴포넌트 책임 분리
- 도메인 계산을 UI에서 분리
- 서버 검증 필수
- 중요한 작업은 트랜잭션 사용
- 중복 코드를 공통 모듈로 추출
- 주요 결정에 짧은 주석 작성
- 설명 없는 매직 넘버 금지
- 테스트 없이 점수 계산 로직 작성 금지

## 14.4 작업 중 판단이 필요한 경우

요구사항이 애매하더라도 작업을 중단하지 않는다.

다음 우선순위로 판단한다.

1. 데이터 무결성
2. 개인정보 보호
3. 기존 응답 재현 가능성
4. 관리자 편의성
5. 응답자 사용성
6. 개발 속도

중대한 가정은 코드와 작업 보고서에 명시한다.

---

# 15. MVP 완료 조건

다음 시나리오가 실제로 동작하면 MVP 완료로 판단한다.

## 관리자 시나리오

1. 관리자 로그인
2. 새 척도 생성
3. 척도 응답 범위 1~5 설정
4. 하위요인 2개 생성
5. 문항 10개 생성
6. 역문항 3개 설정
7. 척도 전체 필수 응답 설정
8. 척도 내 문항 무작위화 설정
9. 척도 버전 게시
10. 새 설문 생성
11. 척도 연결
12. 설문 게시
13. URL과 QR 코드 확인

## 응답자 시나리오

1. 회원가입
2. 개인정보 동의
3. 로그인
4. 설문 시작
5. 무작위 문항 순서 확인
6. 일부 답변 후 나가기
7. 다시 로그인
8. 동일 순서로 이어서 응답
9. 설문 제출
10. 총점과 하위요인 결과 확인

## 관리자 분석 시나리오

1. 완료 응답 수 확인
2. 개별 응답 확인
3. 원점수와 변환점수 확인
4. 평균, 표준편차, 분산 확인
5. CSV 다운로드
6. XLSX 다운로드
7. 응답이 존재하는 척도 수정이 차단되는지 확인
8. 새 버전 복제가 가능한지 확인

---

# 16. 비기능 요구사항

## 16.1 반응형

- 모바일 우선
- 설문 응답은 360px 화면에서도 사용 가능
- 선택지 터치 영역 충분히 확보
- 표는 모바일에서 카드 또는 가로 스크롤 처리

## 16.2 접근성

- label과 input 연결
- 키보드 탐색 지원
- 명확한 focus 상태
- 색상만으로 상태 표현 금지
- 오류 메시지를 스크린리더가 읽을 수 있게 처리

## 16.3 성능

- 설문 전체 문항을 불필요하게 반복 요청하지 않음
- 자동 저장 debounce
- 통계 쿼리 인덱스 고려
- 대규모 내보내기는 스트리밍 또는 비동기 작업 확장 가능 구조
- MVP에서는 동기 내보내기를 허용하되 응답 수 제한을 명시

## 16.4 관측성

- 서버 오류 로그
- 인증 실패 로그
- 내보내기 로그
- 설문 제출 실패 로그
- 개인정보는 로그에 기록하지 않음

---

# 17. P1 기능 설계 메모

MVP 완료 후 아래 기능을 순서대로 확장한다.

## 17.1 대시보드

```text
총 응답 시작 수
완료 응답 수
이탈자 수
완료율
평균 응답 시간
목표 달성률
일별 응답 추이
```

## 17.2 예상 소요시간

초기 계산:

```text
예상 시간 = 활성 문항 수 × 문항당 기본 응답시간
```

기본값은 문항당 10초로 두고, 실제 완료 응답이 쌓이면 중앙값 기반으로 보정한다.

## 17.3 박스플롯

척도와 하위요인별 분포를 제공한다.

응답 수가 5명 미만이면 박스플롯을 숨긴다.

## 17.4 이메일 일괄 전송

- 결과지 발송
- 설문 초대
- 미완료 알림
- 수신 동의 확인
- 발송 성공 및 실패 로그
- 중복 발송 방지

## 17.5 결과지 PDF

- 연구기관 로고
- 설문명
- 응답일
- 총점
- 하위요인
- 결과 해석
- 주의 문구
- PDF 다운로드

---

# 18. P2: 논문 PDF에서 척도 추출

이 기능은 MVP에서 구현하지 않는다.

향후 다음 단계로 설계한다.

```text
PDF 업로드
→ 텍스트 추출
→ 척도명 후보 탐색
→ 문항 후보 탐색
→ 응답 선택지 탐색
→ 역문항 후보 탐색
→ 하위요인 후보 탐색
→ 출처 및 참고문헌 추출
→ 관리자 검수
→ 척도 초안 생성
```

주의사항:

- 자동으로 게시하지 않는다.
- 반드시 관리자 검수 후 저장한다.
- 문항 저작권과 사용 허가를 확인한다.
- 원문, 번안본, 타당화 논문을 구분한다.
- 추출 신뢰도를 각 필드별로 표시한다.

---

# 19. README에 포함할 내용

구현 후 README를 다음 구조로 갱신한다.

```text
프로젝트 소개
핵심 기능
기술 스택
폴더 구조
환경 변수
로컬 실행 방법
데이터베이스 마이그레이션
Seed 실행
테스트 실행
관리자 계정
점수 계산 규칙
개인정보 처리 원칙
내보내기 형식
배포 방법
향후 계획
```

실제 비밀번호나 비밀키는 README에 작성하지 않는다.

---

# 20. Cursor에게 전달할 최종 명령

아래 명령에 따라 작업을 시작하라.

## 작업 시작 명령

현재 저장소를 먼저 분석하라.

바로 전체 구현을 시작하지 말고 다음 순서로 진행하라.

1. 저장소의 현재 기술 스택과 폴더 구조를 분석한다.
2. 현재 구현된 기능과 부족한 기능을 이 문서의 요구사항과 비교한다.
3. 재사용 가능한 코드와 제거하거나 수정해야 할 코드를 정리한다.
4. 데이터베이스 모델과 마이그레이션 계획을 제시한다.
5. 전체 구현을 Phase 단위로 나눈 상세 계획을 제시한다.
6. 첫 번째 Phase에서 변경할 파일 목록과 예상 결과를 제시한다.
7. 이후 Phase 1부터 실제 구현을 시작한다.
8. 각 Phase가 끝날 때마다 타입 검사, 린트, 테스트를 실행한다.
9. 테스트 실패를 방치한 채 다음 Phase로 넘어가지 않는다.
10. 구현 과정에서 요구사항 충돌이 있으면 데이터 무결성, 개인정보 보호, 과거 응답 재현 가능성을 우선한다.

최종적으로 다음 결과물을 완성하라.

- 실행 가능한 웹 애플리케이션
- 데이터베이스 스키마와 마이그레이션
- 관리자 및 응답자 주요 화면
- 인증과 권한 관리
- 척도, 문항, 역문항, 하위요인 관리
- 설문 생성과 배포
- QR 코드
- 응답 자동 저장
- 무작위 문항 순서 유지
- 자동 채점
- 결과 화면
- 관리자 기술통계
- CSV 및 XLSX 내보내기
- 잠금과 버전 관리
- 단위, 통합, E2E 테스트
- 최신 README

구현 시 임시 mock 데이터에만 의존하지 말고 실제 데이터베이스 흐름을 완성하라.

UI만 만들어 놓고 API나 저장 로직을 생략하지 말라.

API만 만들고 사용 가능한 화면을 생략하지 말라.

점수와 통계 계산은 반드시 테스트를 포함하라.

모든 민감한 작업은 서버에서 다시 검증하라.
