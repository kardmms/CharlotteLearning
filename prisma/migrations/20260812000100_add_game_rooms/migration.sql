-- CreateEnum
CREATE TYPE "GameKind" AS ENUM ('VOCAB_DASH');

-- CreateEnum
CREATE TYPE "GameRoomStatus" AS ENUM ('WAITING', 'STARTING', 'COMPLETED');

-- CreateTable
CREATE TABLE "GameRoom" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "kind" "GameKind" NOT NULL DEFAULT 'VOCAB_DASH',
  "code" TEXT NOT NULL,
  "status" "GameRoomStatus" NOT NULL DEFAULT 'WAITING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "GameRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameParticipant" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "studentId" TEXT,
  "displayName" TEXT NOT NULL,
  "characterKey" TEXT NOT NULL DEFAULT 'rocket',
  "currentStreak" INTEGER NOT NULL DEFAULT 0,
  "totalCorrect" INTEGER NOT NULL DEFAULT 0,
  "totalAttempts" INTEGER NOT NULL DEFAULT 0,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GameParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameRoom_code_key" ON "GameRoom"("code");

-- CreateIndex
CREATE INDEX "GameRoom_teacherId_createdAt_idx" ON "GameRoom"("teacherId", "createdAt");

-- CreateIndex
CREATE INDEX "GameRoom_code_status_idx" ON "GameRoom"("code", "status");

-- CreateIndex
CREATE INDEX "GameParticipant_roomId_joinedAt_idx" ON "GameParticipant"("roomId", "joinedAt");

-- CreateIndex
CREATE INDEX "GameParticipant_studentId_idx" ON "GameParticipant"("studentId");

-- AddForeignKey
ALTER TABLE "GameRoom" ADD CONSTRAINT "GameRoom_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameParticipant" ADD CONSTRAINT "GameParticipant_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "GameRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
