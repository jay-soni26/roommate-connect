-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Profile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "avatar" TEXT,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "location" TEXT,
    "occupation" TEXT,
    "gender" TEXT,
    "lifestyle" TEXT,
    "bio" TEXT,
    "address" TEXT,
    "preferredRoomType" TEXT,
    "showAvatarPublicly" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Profile" ("address", "avatar", "bio", "budgetMax", "budgetMin", "gender", "id", "lifestyle", "location", "occupation", "preferredRoomType", "userId") SELECT "address", "avatar", "bio", "budgetMax", "budgetMin", "gender", "id", "lifestyle", "location", "occupation", "preferredRoomType", "userId" FROM "Profile";
DROP TABLE "Profile";
ALTER TABLE "new_Profile" RENAME TO "Profile";
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
