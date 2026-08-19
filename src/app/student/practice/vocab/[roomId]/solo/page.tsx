import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SoloVocabPractice } from "@/components/SoloVocabPractice";
import { StudentTopbar } from "@/components/AppTopbar";
import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SoloVocabPage({ params }: { params: Promise<{ roomId: string }> }) {
  const student = await requireStudent();
  const { roomId } = await params;
  const room = await prisma.gameRoom.findFirst({
    where: { id: roomId, schoolId: student.schoolId, classroomId: student.classroomId },
    include: { vocabTerms: { orderBy: { sortOrder: "asc" } } }
  });
  if (!room || room.vocabTerms.length < 4) notFound();
  return (
    <div className="student-shell">
      <StudentTopbar name={student.displayName} />
      <main className="page student-practice-page narrow-page">
        <Link className="student-back-link" href={`/student/practice/vocab/${room.id}`}><ArrowLeft size={17} /> Flashcards</Link>
        <section className="practice-heading"><div><span>Solo Vocab Dash</span><h1>Practice at your pace</h1><p>Every round reshuffles both questions and answer choices.</p></div></section>
        <SoloVocabPractice terms={room.vocabTerms} />
      </main>
    </div>
  );
}
