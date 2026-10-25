-- 이슈 #36: 척도에 참여자용 안내문 추가, 척도 소개 표시 모드에 INSTRUCTIONS 추가
ALTER TABLE "Scale" ADD COLUMN "instructions" TEXT;
ALTER TYPE "ScaleDisplayMode" ADD VALUE 'INSTRUCTIONS';

-- 이슈 #35: 설문의 비회원 응답 가능이 기본값
ALTER TABLE "Survey" ALTER COLUMN "requireLogin" SET DEFAULT false;
