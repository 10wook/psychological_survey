import { z } from "zod";

// 문서 6.1 / 9.1: 모든 입력은 스키마 검증한다.

export const genderEnum = z.enum(["MALE", "FEMALE", "OTHER", "UNDISCLOSED"]);

export const registerSchema = z
  .object({
    email: z.string().email("올바른 이메일을 입력하세요."),
    password: z
      .string()
      .min(8, "비밀번호는 8자 이상이어야 합니다.")
      .regex(/[A-Za-z]/, "영문을 포함해야 합니다.")
      .regex(/[0-9]/, "숫자를 포함해야 합니다."),
    passwordConfirm: z.string(),
    birthYear: z
      .number()
      .int()
      .min(1900)
      .max(new Date().getFullYear())
      .optional(),
    gender: genderEnum.default("UNDISCLOSED"),
    consentPrivacy: z.literal(true, {
      errorMap: () => ({ message: "개인정보 수집 동의는 필수입니다." }),
    }),
    consentResearch: z.literal(true, {
      errorMap: () => ({ message: "연구 참여 동의는 필수입니다." }),
    }),
    consentEmailResult: z.boolean().optional().default(false),
    consentMarketing: z.boolean().optional().default(false),
    documentVersion: z.string().default("v1"),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["passwordConfirm"],
  });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// --- 척도 ---------------------------------------------------------------
export const createScaleSchema = z.object({
  name: z.string().min(1, "척도명을 입력하세요."),
  description: z.string().optional(),
  sourceTitle: z.string().optional(),
  sourceAuthor: z.string().optional(),
  sourceYear: z.number().int().optional(),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  licenseNote: z.string().optional(),
  minScore: z.number().int().default(1),
  maxScore: z.number().int().default(5),
});

export const updateScaleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  sourceTitle: z.string().optional(),
  sourceAuthor: z.string().optional(),
  sourceYear: z.number().int().optional(),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  licenseNote: z.string().optional(),
});

// --- 척도 버전 ----------------------------------------------------------
export const updateScaleVersionSchema = z.object({
  minScore: z.number().int().optional(),
  maxScore: z.number().int().optional(),
  requiredByDefault: z.boolean().optional(),
  shuffleQuestions: z.boolean().optional(),
  estimatedSeconds: z.number().int().nonnegative().optional(),
  interpretationConfig: z.unknown().optional(),
});

// --- 하위요인 ----------------------------------------------------------
export const createSubfactorSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  displayOrder: z.number().int().optional(),
});

export const updateSubfactorSchema = createSubfactorSchema.partial();

// --- 문항 --------------------------------------------------------------
export const questionOptionSchema = z.object({
  value: z.number().int(),
  label: z.string().min(1),
  displayOrder: z.number().int().optional(),
});

export const createQuestionSchema = z.object({
  code: z.string().min(1),
  content: z.string().min(1),
  isReverse: z.boolean().default(false),
  isActive: z.boolean().default(true),
  subfactorId: z.string().nullish(),
  minScore: z.number().int().nullish(),
  maxScore: z.number().int().nullish(),
  displayOrder: z.number().int().optional(),
  options: z.array(questionOptionSchema).optional(),
});

export const updateQuestionSchema = createQuestionSchema.partial();

export const reorderQuestionsSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
});

// 표 형태 일괄 문항 등록 (문서 6.3)
export const bulkQuestionSchema = z.object({
  rows: z
    .array(
      z.object({
        code: z.string().min(1),
        content: z.string().min(1),
        subfactorName: z.string().optional(),
        isReverse: z.boolean().default(false),
      }),
    )
    .min(1),
});

// --- 설문 --------------------------------------------------------------
export const surveyScaleInputSchema = z.object({
  scaleVersionId: z.string().min(1),
  displayOrder: z.number().int().optional(),
  isRequired: z.boolean().optional(),
  shuffleQuestions: z.boolean().optional(),
});

export const createSurveySchema = z.object({
  title: z.string().min(1, "설문 제목을 입력하세요."),
  description: z.string().optional(),
  instructions: z.string().optional(),
  requireLogin: z.boolean().default(true),
  allowResume: z.boolean().default(true),
  allowDuplicate: z.boolean().default(false),
  showResult: z.boolean().default(true),
  targetResponseCount: z.number().int().positive().optional(),
  startAt: z.string().datetime().optional().or(z.literal("")),
  endAt: z.string().datetime().optional().or(z.literal("")),
  scales: z.array(surveyScaleInputSchema).default([]),
});

export const updateSurveySchema = createSurveySchema.partial();

// --- 응답 --------------------------------------------------------------
export const saveAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        rawScore: z.number().int().nullable(),
      }),
    )
    .min(1),
});

// --- 내보내기 ----------------------------------------------------------
export const exportOptionsSchema = z.object({
  format: z.enum(["csv", "xlsx"]).default("csv"),
  layout: z.enum(["wide", "long"]).default("wide"),
  includePii: z.boolean().default(false),
  onlyCompleted: z.boolean().default(true),
  includeRaw: z.boolean().default(true),
  includeConverted: z.boolean().default(true),
  includeScaleTotals: z.boolean().default(true),
  includeSubfactorScores: z.boolean().default(true),
  includePresentedOrder: z.boolean().default(false),
  useBom: z.boolean().default(true),
  useQuestionContent: z.boolean().default(false),
});

export type ExportOptions = z.infer<typeof exportOptionsSchema>;
