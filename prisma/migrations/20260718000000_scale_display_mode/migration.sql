-- CreateEnum
CREATE TYPE "ScaleDisplayMode" AS ENUM ('NAME', 'DESCRIPTION', 'CUSTOM');

-- AlterTable
ALTER TABLE "SurveyScale" ADD COLUMN "displayMode" "ScaleDisplayMode" NOT NULL DEFAULT 'NAME',
ADD COLUMN "displayLabel" TEXT;
