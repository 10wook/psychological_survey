-- 이슈 #11: 비회원 응답 시 연락처 수집 방식 설정
-- CreateEnum
CREATE TYPE "GuestContactMode" AS ENUM ('NONE', 'OPTIONAL', 'REQUIRED');

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN "guestContactMode" "GuestContactMode" NOT NULL DEFAULT 'OPTIONAL';
