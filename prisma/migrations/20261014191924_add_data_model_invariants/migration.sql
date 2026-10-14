-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'active',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentBillingPeriod" DATETIME,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Subscription" ("createdAt", "currentBillingPeriod", "id", "plan", "status", "stripeCustomerId", "stripeSubscriptionId", "updatedAt", "userId") SELECT "createdAt", "currentBillingPeriod", "id", "plan", "status", "stripeCustomerId", "stripeSubscriptionId", "updatedAt", "userId" FROM "Subscription";
DROP TABLE "Subscription";
ALTER TABLE "new_Subscription" RENAME TO "Subscription";
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "EmbedConfiguration_spaceId_key" ON "EmbedConfiguration"("spaceId");

-- CreateIndex
CREATE INDEX "SpaceField_spaceId_displayOrder_idx" ON "SpaceField"("spaceId", "displayOrder");

-- CreateIndex
CREATE INDEX "Testimonial_spaceId_submissionTimestamp_idx" ON "Testimonial"("spaceId", "submissionTimestamp");

-- CreateIndex
CREATE INDEX "Testimonial_spaceId_isWallOfLove_visibilityStatus_idx" ON "Testimonial"("spaceId", "isWallOfLove", "visibilityStatus");
