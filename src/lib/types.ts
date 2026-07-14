// 클라이언트 컴포넌트에서 사용하는 API 응답 형태.
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
  isReverse: boolean;
  isActive: boolean;
  subfactorId: string | null;
  minScore: number | null;
  maxScore: number | null;
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

export interface ScaleVersionDTO {
  id: string;
  versionNumber: number;
  status: ScaleVersionStatus;
  minScore: number;
  maxScore: number;
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
