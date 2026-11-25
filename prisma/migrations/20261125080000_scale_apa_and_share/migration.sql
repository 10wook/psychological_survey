-- AlterTable: APA 출처 필드 (이슈 #38) + 아카이브 공유 (이슈 #39)
ALTER TABLE "Scale" ADD COLUMN "sourceJournal" TEXT;
ALTER TABLE "Scale" ADD COLUMN "sourceVolume" TEXT;
ALTER TABLE "Scale" ADD COLUMN "sourceIssue" TEXT;
ALTER TABLE "Scale" ADD COLUMN "isShared" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Scale" ADD COLUMN "sharedAt" TIMESTAMP(3);

CREATE INDEX "Scale_isShared_idx" ON "Scale"("isShared");
