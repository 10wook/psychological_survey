import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

function publicId() {
  return randomBytes(6).toString("hex");
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin1234!";

  // --- 관리자 계정 -------------------------------------------------------
  const adminHash = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN", status: "ACTIVE", canViewPii: true },
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      role: "ADMIN",
      status: "ACTIVE",
      canViewPii: true,
      profile: { create: { gender: "UNDISCLOSED" } },
    },
  });
  console.log(`✔ 관리자 계정: ${adminEmail}`);

  // 이미 시드 척도가 있으면 중복 생성 방지
  const existing = await prisma.scale.findFirst({
    where: { name: "긍정·부정 정서 척도 (샘플)" },
  });
  if (existing) {
    console.log("ℹ 샘플 데이터가 이미 존재합니다. seed 생략.");
    return;
  }

  // --- 샘플 척도 (문서 15장 MVP 시나리오: 1~5, 하위요인 2, 문항 10, 역문항 3) ---
  const scale = await prisma.scale.create({
    data: {
      name: "긍정·부정 정서 척도 (샘플)",
      description: "최근 정서 상태를 측정하는 예시 척도입니다.",
      sourceTitle: "샘플 데이터",
      sourceAuthor: "연구팀",
      sourceYear: 2026,
      isActive: true,
      createdById: admin.id,
    },
  });

  const version = await prisma.scaleVersion.create({
    data: {
      scaleId: scale.id,
      versionNumber: 1,
      status: "DRAFT",
      minScore: 1,
      maxScore: 5,
      requiredByDefault: true,
      shuffleQuestions: true,
      estimatedSeconds: 100,
      interpretationConfig: {
        bands: [
          { min: 0, max: 20, label: "낮음", description: "정서 강도가 낮은 편입니다." },
          { min: 21, max: 35, label: "보통", description: "평균적인 정서 강도입니다." },
          { min: 36, max: 50, label: "높음", description: "정서 강도가 높은 편입니다." },
        ],
      },
    },
  });

  const positive = await prisma.subfactor.create({
    data: { scaleVersionId: version.id, name: "긍정정서", displayOrder: 1 },
  });
  const negative = await prisma.subfactor.create({
    data: { scaleVersionId: version.id, name: "부정정서", displayOrder: 2 },
  });

  const items: Array<{
    code: string;
    content: string;
    subfactorId: string;
    isReverse: boolean;
  }> = [
    { code: "Q1", content: "나는 최근 기분이 좋았다.", subfactorId: positive.id, isReverse: false },
    { code: "Q2", content: "나는 활기차다고 느꼈다.", subfactorId: positive.id, isReverse: false },
    { code: "Q3", content: "나는 삶에 만족한다.", subfactorId: positive.id, isReverse: false },
    { code: "Q4", content: "나는 즐거운 일이 많았다.", subfactorId: positive.id, isReverse: false },
    { code: "Q5", content: "나는 최근 무기력하다고 느꼈다.", subfactorId: positive.id, isReverse: true },
    { code: "Q6", content: "나는 불안했다.", subfactorId: negative.id, isReverse: false },
    { code: "Q7", content: "나는 우울했다.", subfactorId: negative.id, isReverse: false },
    { code: "Q8", content: "나는 짜증이 났다.", subfactorId: negative.id, isReverse: false },
    { code: "Q9", content: "나는 마음이 평온했다.", subfactorId: negative.id, isReverse: true },
    { code: "Q10", content: "나는 스트레스를 받지 않았다.", subfactorId: negative.id, isReverse: true },
  ];

  const optionLabels = [
    { value: 1, label: "전혀 아니다" },
    { value: 2, label: "아니다" },
    { value: 3, label: "보통이다" },
    { value: 4, label: "그렇다" },
    { value: 5, label: "매우 그렇다" },
  ];

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    await prisma.question.create({
      data: {
        scaleVersionId: version.id,
        subfactorId: item.subfactorId,
        code: item.code,
        content: item.content,
        isReverse: item.isReverse,
        isActive: true,
        displayOrder: i + 1,
        options: {
          create: optionLabels.map((o, idx) => ({
            value: o.value,
            label: o.label,
            displayOrder: idx + 1,
          })),
        },
      },
    });
  }

  // 버전 게시
  await prisma.scaleVersion.update({
    where: { id: version.id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  console.log("✔ 샘플 척도 v1 게시 완료 (문항 10, 역문항 3, 하위요인 2)");

  // --- 샘플 설문 ---------------------------------------------------------
  const survey = await prisma.survey.create({
    data: {
      title: "정서 상태 설문 (샘플)",
      description: "샘플 설문입니다.",
      instructions:
        "최근 2주간의 상태를 떠올리며 각 문항에 솔직하게 응답해 주세요.",
      status: "PUBLISHED",
      publicId: publicId(),
      requireLogin: true,
      allowResume: true,
      allowDuplicate: false,
      showResult: true,
      targetResponseCount: 30,
      publishedAt: new Date(),
      createdById: admin.id,
      surveyScales: {
        create: {
          scaleVersionId: version.id,
          displayOrder: 1,
          isRequired: true,
          shuffleQuestions: true,
        },
      },
    },
  });

  // 게시된 버전이 사용 중 → 잠금
  await prisma.scaleVersion.update({
    where: { id: version.id },
    data: { status: "LOCKED", lockedAt: new Date() },
  });

  console.log(`✔ 샘플 설문 게시 완료. 공개 URL: /s/${survey.publicId}`);
  console.log("✔ seed 완료");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
