// 전체 흐름 스모크 테스트 (개발용). node scripts/smoke.mjs
const BASE = process.env.BASE ?? "http://127.0.0.1:3000";

function cookieJar() {
  let cookie = "";
  return {
    get: () => cookie,
    set: (res) => {
      const sc = res.headers.get("set-cookie");
      if (sc) cookie = sc.split(";")[0];
    },
  };
}

async function call(jar, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", Cookie: jar.get() },
    body: body ? JSON.stringify(body) : undefined,
  });
  jar.set(res);
  const ct = res.headers.get("content-type") ?? "";
  const data = ct.includes("json") ? await res.json() : await res.text();
  return { status: res.status, data, res };
}

function assert(cond, msg) {
  if (!cond) {
    console.error("❌ FAIL:", msg);
    process.exit(1);
  }
  console.log("✔", msg);
}

const admin = cookieJar();
const resp = cookieJar();

// 1. 관리자 로그인 + 설문 publicId 확보
await call(admin, "POST", "/api/auth/login", {
  email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.com",
  password: process.env.SEED_ADMIN_PASSWORD ?? "Admin1234!",
});
const surveys = await call(admin, "GET", "/api/admin/surveys");
assert(surveys.data.ok && surveys.data.data.surveys.length > 0, "관리자 설문 목록 조회");
const survey = surveys.data.data.surveys[0];
const detail = await call(admin, "GET", `/api/admin/surveys/${survey.id}`);
const publicId = detail.data.data.survey.publicId;
console.log("  publicId =", publicId);

// 2. 응답자 회원가입
const email = `test_${Date.now()}@example.com`;
const reg = await call(resp, "POST", "/api/auth/register", {
  name: "테스트유저",
  email,
  password: "Test1234!",
  passwordConfirm: "Test1234!",
  birthYear: 1998,
  birthMonth: 3,
  birthDay: 15,
  gender: "FEMALE",
  phone: "010-1234-5678",
  consentResultDelivery: true,
  consentPersonalIdentification: true,
  consentPrivacy: true,
  consentResearch: true,
});
assert(reg.data.ok, "응답자 회원가입 + 자동 로그인");

// 3. 설문 시작
const start = await call(resp, "POST", `/api/public/surveys/${publicId}/start`, {});
assert(start.data.ok, "설문 시작(문항 순서 생성)");
const responseId = start.data.data.responseId;

// 4. 응답 로드 + 순서 확인
const loaded = await call(resp, "GET", `/api/responses/${responseId}`);
assert(loaded.data.ok, "응답 로드");
const scales = loaded.data.data.response.scales;
const qIds1 = scales.flatMap((s) => s.questions.map((q) => q.id));

// 5. 이어하기 순서 재현 확인 (재요청 시 동일 순서)
const loaded2 = await call(resp, "GET", `/api/responses/${responseId}`);
const qIds2 = loaded2.data.data.response.scales.flatMap((s) => s.questions.map((q) => q.id));
assert(JSON.stringify(qIds1) === JSON.stringify(qIds2), "새로고침해도 문항 순서 동일(재현성)");

// 6. 답변 저장 (모든 문항 3점)
const answers = scales.flatMap((s) => s.questions.map((q) => ({ questionId: q.id, rawScore: 3 })));
const save = await call(resp, "PUT", `/api/responses/${responseId}/answers`, { answers });
assert(save.data.ok, "답변 자동 저장(upsert)");

// 7. 범위 밖 값 거부 확인
const bad = await call(resp, "PUT", `/api/responses/${responseId}/answers`, {
  answers: [{ questionId: qIds1[0], rawScore: 99 }],
});
assert(!bad.data.ok, "범위 밖 응답값 거부");

// 8. 제출
const submit = await call(resp, "POST", `/api/responses/${responseId}/submit`);
assert(submit.data.ok && submit.data.data.completed, "설문 제출 + 채점");

// 9. 결과 확인
const result = await call(resp, "GET", `/api/responses/${responseId}/result`);
assert(result.data.ok, "응답자 결과 조회");
const rScale = result.data.data.result.scales[0];
console.log("  결과 총점 =", rScale.convertedTotal, "/ 하위요인 =", rScale.subfactors.length);
assert(rScale.subfactors.length >= 1, "하위요인 점수 계산됨");

// 10. 관리자 통계
const stats = await call(admin, "GET", `/api/admin/surveys/${survey.id}/statistics`);
assert(stats.data.ok, "관리자 기술통계 조회");
assert(stats.data.data.monitoring.completed >= 1, "완료 응답 수 반영");

// 11. CSV 내보내기
const exp = await fetch(BASE + `/api/admin/surveys/${survey.id}/export`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: admin.get() },
  body: JSON.stringify({ format: "csv", layout: "wide", includePii: false }),
});
const csv = await exp.text();
assert(exp.status === 200 && csv.includes("respondent_id"), "CSV(wide) 내보내기");

// 12. 잠긴 척도 수정 차단 확인
const scaleList = await call(admin, "GET", "/api/admin/scales");
const lockedScale = scaleList.data.data.scales[0];
const lockedVersionId = lockedScale.versions[0].id;
const editAttempt = await call(admin, "PATCH", `/api/admin/scale-versions/${lockedVersionId}`, { minScore: 0 });
assert(!editAttempt.data.ok, "응답 존재 척도 버전 수정 차단");

console.log("\n🎉 전체 흐름 스모크 테스트 통과");
