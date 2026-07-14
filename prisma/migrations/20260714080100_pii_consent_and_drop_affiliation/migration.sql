-- AlterEnum
ALTER TYPE "ConsentType" ADD VALUE 'PERSONAL_IDENTIFICATION';

-- AlterTable
ALTER TABLE "Participant" DROP COLUMN IF EXISTS "guestAffiliation";
ALTER TABLE "Participant" ADD COLUMN "guestConsentResultDelivery" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Participant" ADD COLUMN "guestConsentPersonalId" BOOLEAN NOT NULL DEFAULT false;
