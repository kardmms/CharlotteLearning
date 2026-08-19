-- AlterTable
ALTER TABLE "GameRoom"
ADD COLUMN "classroomId" TEXT;

-- CreateIndex
CREATE INDEX "GameRoom_classroomId_createdAt_idx" ON "GameRoom"("classroomId", "createdAt");

-- AddForeignKey
ALTER TABLE "GameRoom" ADD CONSTRAINT "GameRoom_classroomId_fkey"
FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
