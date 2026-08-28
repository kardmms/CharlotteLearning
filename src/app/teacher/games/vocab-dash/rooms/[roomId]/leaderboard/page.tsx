import Link from "next/link";
import { notFound } from "next/navigation";
import { GameRoomStatus } from "@prisma/client";
import { ArrowLeft, Square, Trophy, UsersRound } from "lucide-react";
import { endVocabDashRoom } from "@/app/teacher/actions";
import { TeacherTopbar } from "@/components/AppTopbar";
import { VocabDashFullscreenButton } from "@/components/VocabDashFullscreenButton";
import { VocabDashRoomRefresh } from "@/components/VocabDashRoomRefresh";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { gamesFeatureEnabled } from "@/lib/features";
import { accuracyPercent, characterForKey, progressPercent, rankedParticipants } from "@/lib/vocab-dash";

export const dynamic = "force-dynamic";

export default async function VocabDashLeaderboardPage({
  params
}: {
  params: Promise<{ roomId: string }>;
}) {
  if (!gamesFeatureEnabled()) notFound();
  const { roomId } = await params;
  const teacher = await requireTeacher();
  const room = await prisma.gameRoom.findFirst({
    where: { id: roomId, teacherId: teacher.id, schoolId: teacher.schoolId },
    include: {
      vocabTerms: { where: { schoolId: teacher.schoolId }, select: { id: true } },
      participants: { where: { schoolId: teacher.schoolId }, orderBy: { joinedAt: "asc" } }
    }
  });
  if (!room) notFound();
  if (room.status === GameRoomStatus.WAITING) {
    notFound();
  }

  const termCount = room.vocabTerms.length;
  const ranked = rankedParticipants(room.participants);
  const leaders = ranked.slice(0, 5);

  return (
    <>
      <TeacherTopbar name={teacher.name} />
      <VocabDashRoomRefresh active={room.status !== GameRoomStatus.COMPLETED} />
      <main className="page vocab-dash-leaderboard-page" id="vocab-dash-leaderboard">
        <div className="vocab-dash-projector-controls">
          <Link className="vocab-dash-control-button" href={`/teacher/games?classroomId=${room.classroomId || ""}`}>
            <ArrowLeft size={17} /> Games
          </Link>
          {room.status === GameRoomStatus.STARTING && (
            <form action={endVocabDashRoom}>
              <input type="hidden" name="roomId" value={room.id} />
              <button className="vocab-dash-control-button end" type="submit"><Square size={15} fill="currentColor" /> End game</button>
            </form>
          )}
          <VocabDashFullscreenButton targetId="vocab-dash-leaderboard" />
        </div>
        <section className="vocab-leaderboard-top">
          <div>
            <div className="eyebrow">{room.status === GameRoomStatus.COMPLETED ? "Final results" : "Live game"}</div>
            <h1>Vocab Dash</h1>
            <p>{room.status === GameRoomStatus.COMPLETED
              ? "The race is complete. Final placement and star rewards are saved for every student."
              : "Every answer advances the race. Accuracy breaks ties and shapes each student&apos;s results."}</p>
          </div>
          <div className="vocab-leaderboard-code">
            <span>Join code</span>
            <strong>{room.code}</strong>
          </div>
        </section>

        <section className="vocab-race-board">
          <div className="vocab-race-timer">
            <span>Progress</span>
            <div><i style={{ width: `${leaders[0] ? progressPercent(leaders[0].currentStreak, termCount) : 0}%` }} /></div>
          </div>
          <div className="vocab-race-layout">
            <div className="vocab-racer-list">
              {ranked.length ? ranked.map((participant, index) => {
                const character = characterForKey(participant.characterKey);
                const progress = progressPercent(participant.currentStreak, termCount);
                return (
                  <div className="vocab-racer-row" key={participant.id}>
                    <div className="vocab-racer-avatar">{character.glyph}</div>
                    <div className="vocab-racer-track">
                      <span
                        className={`vocab-racer-fill color-${index % 5}`}
                        style={{ width: `${Math.max(4, progress)}%` }}
                      />
                      <strong style={{ left: `${progress}%` }}>{participant.displayName}</strong>
                    </div>
                    <div className="vocab-racer-meta">
                      <span>{participant.currentStreak}/{termCount}</span>
                      <small>{accuracyPercent(participant.totalCorrect, participant.totalAttempts)}%</small>
                    </div>
                  </div>
                );
              }) : (
                <div className="vocab-leaderboard-empty">
                  <UsersRound size={34} />
                  <h2>Waiting for students</h2>
                  <p>Students who join with code {room.code} will appear here.</p>
                </div>
              )}
            </div>
            <aside className="vocab-rank-panel">
              <Trophy size={28} />
              <h2>Rank</h2>
              {ranked.slice(0, 5).map((participant, index) => (
                <div className="vocab-rank-row" key={participant.id}>
                  <strong>{participant.finishRank || index + 1}</strong>
                  <span>{participant.displayName}</span>
                </div>
              ))}
            </aside>
          </div>
        </section>
      </main>
    </>
  );
}
