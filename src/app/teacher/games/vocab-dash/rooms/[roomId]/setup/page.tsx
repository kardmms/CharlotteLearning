import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Rocket } from "lucide-react";
import { saveVocabDashTermsAndOpenRoom } from "@/app/teacher/actions";
import { TeacherTopbar } from "@/components/AppTopbar";
import { Message } from "@/components/Message";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function VocabDashTermsSetupPage({
  params,
  searchParams
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ roomId }, query] = await Promise.all([params, searchParams]);
  const teacher = await requireTeacher();
  const room = await prisma.gameRoom.findFirst({
    where: { id: roomId, teacherId: teacher.id, schoolId: teacher.schoolId },
    include: { vocabTerms: { where: { schoolId: teacher.schoolId }, orderBy: { sortOrder: "asc" } } }
  });
  if (!room) notFound();

  return (
    <>
      <TeacherTopbar name={teacher.name} />
      <main className="page vocab-dash-setup-page">
        <Link className="student-back-link" href="/teacher/games/vocab-dash/new"><ArrowLeft size={18} /> Back to setup</Link>
        <section className="vocab-dash-setup-hero">
          <div>
            <div className="eyebrow">Review word list</div>
            <h1>Approve Vocab Dash words.</h1>
            <p>Keep at least 10 words. Edit any definition before students join the room.</p>
          </div>
          <Rocket size={34} />
        </section>

        <Message error={query.error} />

        <form className="panel vocab-review-panel" action={saveVocabDashTermsAndOpenRoom}>
          <input type="hidden" name="roomId" value={room.id} />
          <div className="vocab-review-head">
            <span>Keep</span>
            <span>Word</span>
            <span>Definition</span>
          </div>
          <div className="vocab-review-list">
            {room.vocabTerms.map((term, index) => (
              <div className="vocab-review-row" key={term.id}>
                <label className="vocab-keep-check" aria-label={`Keep ${term.word}`}>
                  <input name="keep" type="checkbox" value={String(index)} defaultChecked />
                  <CheckCircle2 size={18} />
                </label>
                <input name="word" defaultValue={term.word} maxLength={80} required />
                <textarea name="definition" defaultValue={term.definition} maxLength={260} required rows={2} />
              </div>
            ))}
          </div>
          <div className="vocab-dash-form-actions">
            <Link className="ghost-button" href="/teacher/games/vocab-dash/new">Start over</Link>
            <button className="button vocab-dash-start-button" type="submit">
              Open lobby
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
