-- CreateEnum
CREATE TYPE "QuestionOrderMode" AS ENUM ('SCALE_GROUPED', 'SHUFFLE_ALL');

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN "questionOrderMode" "QuestionOrderMode" NOT NULL DEFAULT 'SCALE_GROUPED';

-- AlterTable
ALTER TABLE "SurveyScale" ADD COLUMN "includeInGlobalShuffle" BOOLEAN NOT NULL DEFAULT true;
