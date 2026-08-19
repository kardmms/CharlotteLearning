import Link from "next/link";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import { VocabFlashcards } from "@/components/VocabFlashcards";
import { StudentTopbar } from "@/components/AppTopbar";
import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function VocabFlashcardPage({ params }: { params: Promise<{ roomId: string }> }) {
  const student = await requireStudent();
  const { roomId } = await params;
  const room = await prisma.gameRoom.findFirst({
    where: { id: roomId, schoolId: student.schoolId, classroomId: student.classroomId },
    include: { vocabTerms: { orderBy: { sortOrder: "asc" } } }
  });
  if (!room?.vocabTerms.length) notFound();
  return (
    <div className="student-shell">
      <StudentTopbar name={student.displayName} />
      <main className="page student-practice-page narrow-page">
        <Link className="student-back-link" href="/student/practice"><ArrowLeft size={17} /> Practice sets</Link>
        <section className="practice-heading"><div><span>Flashcards</span><h1>Vocab Dash review</h1><p>Tap each card to reveal the definition.</p></div><Link className="button" href={`/student/practice/vocab/${room.id}/solo`}><Gamepad2 size={17} /> Solo practice</Link></section>
        <VocabFlashcards terms={room.vocabTerms} />
      </main>
    </div>
  );
}
