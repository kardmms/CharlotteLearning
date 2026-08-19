import Link from "next/link";
import { ArrowRight, BookOpen, Gamepad2 } from "lucide-react";
import { StudentTopbar } from "@/components/AppTopbar";
import { requireStudent } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function StudentPracticePage() {
  const student = await requireStudent();
  const rooms = await prisma.gameRoom.findMany({
    where: { schoolId: student.schoolId, classroomId: student.classroomId, vocabTerms: { some: {} } },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { _count: { select: { vocabTerms: true } } }
  });

  return (
    <div className="student-shell">
      <StudentTopbar name={student.displayName} />
      <main className="page student-practice-page">
        <section className="student-menu-heading"><div><span>Optional extra practice</span><h1>Vocabulary practice</h1><p>Review words your class has already used.</p></div><BookOpen size={36} /></section>
        <section className="practice-set-grid">
          {rooms.map((room) => (
            <article className="practice-set-card" key={room.id}>
              <div><span>Vocab Dash set</span><h2>{room._count.vocabTerms} vocabulary words</h2><p>Flashcards and self-paced multiple-choice practice.</p></div>
              <div>
                <Link className="ghost-button" href={`/student/practice/vocab/${room.id}`}><BookOpen size={17} /> Flashcards</Link>
                <Link className="button" href={`/student/practice/vocab/${room.id}/solo`}><Gamepad2 size={17} /> Solo practice <ArrowRight size={16} /></Link>
              </div>
            </article>
          ))}
          {!rooms.length && <div className="empty-state"><h2>No vocabulary sets yet</h2><p>Sets appear here after your class uses Vocab Dash words.</p></div>}
        </section>
      </main>
    </div>
  );
}
