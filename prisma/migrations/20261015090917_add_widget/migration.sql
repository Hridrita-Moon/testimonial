-- CreateTable
CREATE TABLE "Widget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "spaceId" TEXT NOT NULL,
    "widgetId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "scrollDirection" TEXT NOT NULL DEFAULT 'up',
    "showHeart" BOOLEAN NOT NULL DEFAULT true,
    "hideDate" BOOLEAN NOT NULL DEFAULT false,
    "hideSource" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Widget_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Widget_spaceId_key" ON "Widget"("spaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Widget_widgetId_key" ON "Widget"("widgetId");
