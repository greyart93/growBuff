-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "seoPrimaryKeyword" TEXT,
ADD COLUMN     "seoSecondaryCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "seoServiceAreas" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "SeoKeyword" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "intent" TEXT NOT NULL DEFAULT 'local',
    "demand" INTEGER NOT NULL DEFAULT 50,
    "difficulty" INTEGER NOT NULL DEFAULT 50,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "tracked" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'generated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoContent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeoKeyword_tenantId_priority_idx" ON "SeoKeyword"("tenantId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "SeoKeyword_tenantId_keyword_key" ON "SeoKeyword"("tenantId", "keyword");

-- CreateIndex
CREATE INDEX "SeoContent_tenantId_createdAt_idx" ON "SeoContent"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "SeoKeyword" ADD CONSTRAINT "SeoKeyword_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoContent" ADD CONSTRAINT "SeoContent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
