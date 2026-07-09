CREATE INDEX "Classroom_teacherId_archivedAt_idx" ON "Classroom"("teacherId", "archivedAt");
CREATE INDEX "Student_classroomId_active_idx" ON "Student"("classroomId", "active");
CREATE INDEX "Material_teacherId_updatedAt_idx" ON "Material"("teacherId", "updatedAt");
CREATE INDEX "Material_classroomId_createdAt_idx" ON "Material"("classroomId", "createdAt");
CREATE INDEX "StudentSession_materialId_status_completedAt_idx" ON "StudentSession"("materialId", "status", "completedAt");
CREATE INDEX "StudentSession_studentId_materialId_status_idx" ON "StudentSession"("studentId", "materialId", "status");
CREATE INDEX "StudentAnswer_questionId_idx" ON "StudentAnswer"("questionId");
