ALTER TABLE "StudentAccount"
ADD COLUMN "stars" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "characterColor" TEXT NOT NULL DEFAULT 'blue',
ADD COLUMN "unlockedAccessories" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN "selectedAccessory" TEXT;

ALTER TABLE "GameParticipant"
ADD COLUMN "characterColor" TEXT NOT NULL DEFAULT 'blue',
ADD COLUMN "accessoryKey" TEXT,
ADD COLUMN "questionOrderJson" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN "incorrectAnswersJson" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN "starsEarned" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "GameVocabTerm"
ADD COLUMN "alternateDefinition" TEXT;
