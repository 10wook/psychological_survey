-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('LIKERT', 'SINGLE', 'MULTIPLE', 'TEXT');

-- AlterTable
ALTER TABLE "Answer" ADD COLUMN     "selectedValues" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "textValue" TEXT;

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "guestAffiliation" TEXT,
ADD COLUMN     "guestBirthDay" INTEGER,
ADD COLUMN     "guestBirthMonth" INTEGER,
ADD COLUMN     "guestBirthYear" INTEGER,
ADD COLUMN     "guestEmail" TEXT,
ADD COLUMN     "guestGender" "Gender",
ADD COLUMN     "guestName" TEXT,
ADD COLUMN     "guestPhone" TEXT,
ADD COLUMN     "isGuest" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "isRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "maxSelect" INTEGER,
ADD COLUMN     "minSelect" INTEGER,
ADD COLUMN     "type" "QuestionType" NOT NULL DEFAULT 'LIKERT';

-- AlterTable
ALTER TABLE "SurveyResponse" ADD COLUMN     "accessToken" TEXT;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "affiliation" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "phone" TEXT;
