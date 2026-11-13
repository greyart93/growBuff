-- Delivery metadata for inbox messages
ALTER TABLE "Message" ADD COLUMN "statusAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "error" TEXT;

-- Campaign recipient delivery callbacks
ALTER TABLE "CampaignRecipient" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "CampaignRecipient" ADD COLUMN "readAt" TIMESTAMP(3);
ALTER TABLE "CampaignRecipient" ADD COLUMN "waMessageId" TEXT;

CREATE UNIQUE INDEX "CampaignRecipient_waMessageId_key" ON "CampaignRecipient"("waMessageId");
