-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Widget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "spaceId" TEXT NOT NULL,
    "widgetId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "layout" TEXT NOT NULL DEFAULT 'masonryAnimated',
    "scrollDirection" TEXT NOT NULL DEFAULT 'up',
    "showHeart" BOOLEAN NOT NULL DEFAULT true,
    "hideDate" BOOLEAN NOT NULL DEFAULT false,
    "hideSource" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Widget_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Widget" ("createdAt", "hideDate", "hideSource", "id", "scrollDirection", "showHeart", "spaceId", "theme", "updatedAt", "widgetId") SELECT "createdAt", "hideDate", "hideSource", "id", "scrollDirection", "showHeart", "spaceId", "theme", "updatedAt", "widgetId" FROM "Widget";
DROP TABLE "Widget";
ALTER TABLE "new_Widget" RENAME TO "Widget";
CREATE UNIQUE INDEX "Widget_spaceId_key" ON "Widget"("spaceId");
CREATE UNIQUE INDEX "Widget_widgetId_key" ON "Widget"("widgetId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
