-- 단일 displayMode → 복수 displayModes 배열로 전환
ALTER TABLE "SurveyScale" ADD COLUMN "displayModes" "ScaleDisplayMode"[] NOT NULL DEFAULT ARRAY['NAME']::"ScaleDisplayMode"[];

UPDATE "SurveyScale"
SET "displayModes" = ARRAY["displayMode"]::"ScaleDisplayMode"[];

ALTER TABLE "SurveyScale" DROP COLUMN "displayMode";
