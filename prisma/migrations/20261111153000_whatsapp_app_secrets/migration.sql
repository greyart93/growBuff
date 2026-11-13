-- Encrypted Meta app secret and webhook verification token
ALTER TABLE "Connection" ADD COLUMN "appSecretEnc" TEXT;
ALTER TABLE "Connection" ADD COLUMN "verifyTokenEnc" TEXT;
