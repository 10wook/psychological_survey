-- CreateEnum
CREATE TYPE "ScaleType" AS ENUM ('LIKERT', 'SINGLE', 'MULTIPLE', 'TEXT', 'MIXED');

-- CreateEnum
CREATE TYPE "ScaleOrderMode" AS ENUM ('FIXED', 'SHUFFLE');

-- CreateEnum
CREATE TYPE "ScalePinPosition" AS ENUM ('NONE', 'FIRST', 'LAST');

-- AlterTable ScaleVersion
ALTER TABLE "ScaleVersion" ADD COLUMN "scaleType" "ScaleType" NOT NULL DEFAULT 'LIKERT',
ADD COLUMN "likertLabels" JSONB;

-- AlterTable Survey
ALTER TABLE "Survey" ADD COLUMN "scaleOrderMode" "ScaleOrderMode" NOT NULL DEFAULT 'FIXED';

-- AlterTable SurveyScale
ALTER TABLE "SurveyScale" ADD COLUMN "pinPosition" "ScalePinPosition" NOT NULL DEFAULT 'NONE';
