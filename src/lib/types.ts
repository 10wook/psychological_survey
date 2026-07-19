// 클라이언트 컴포넌트에서 사용하는 API 응답 형태.
export type QuestionType = "LIKERT" | "SINGLE" | "MULTIPLE" | "TEXT";

export interface QuestionOptionDTO {
  id: string;
  value: number;
  label: string;
  displayOrder: number;
}

export interface QuestionDTO {
  id: string;
  code: string;
  content: string;
  type: QuestionType;
  isReverse: boolean;
  isActive: boolean;
  isRequired: boolean;
  subfactorId: string | null;
  minScore: number | null;
  maxScore: number | null;
  minSelect: number | null;
  maxSelect: number | null;
  displayOrder: number;
  options: QuestionOptionDTO[];
}

export interface SubfactorDTO {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
}

export type ScaleVersionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED" | "LOCKED";
export type ScaleType = "LIKERT" | "SINGLE" | "MULTIPLE" | "TEXT" | "MIXED";

export interface ScaleVersionDTO {
  id: string;
  versionNumber: number;
  status: ScaleVersionStatus;
  scaleType: ScaleType;
  minScore: number;
  maxScore: number;
  likertLabels: string[] | null;
  requiredByDefault: boolean;
  shuffleQuestions: boolean;
  estimatedSeconds: number | null;
  subfactors: SubfactorDTO[];
  questions: QuestionDTO[];
}

export interface ScaleDTO {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  versions: ScaleVersionDTO[];
}
