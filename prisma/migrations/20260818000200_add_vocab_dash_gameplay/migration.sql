-- AlterTable
ALTER TABLE "GameParticipant"
ADD COLUMN "streakTermIdsJson" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "finishRank" INTEGER;

-- CreateTable
CREATE TABLE "GameVocabTerm" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "word" TEXT NOT NULL,
  "definition" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GameVocabTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameVocabTerm_roomId_word_key" ON "GameVocabTerm"("roomId", "word");

-- CreateIndex
CREATE INDEX "GameVocabTerm_roomId_sortOrder_idx" ON "GameVocabTerm"("roomId", "sortOrder");

-- CreateIndex
CREATE INDEX "GameParticipant_roomId_finishRank_idx" ON "GameParticipant"("roomId", "finishRank");

-- AddForeignKey
ALTER TABLE "GameVocabTerm" ADD CONSTRAINT "GameVocabTerm_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "GameRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
