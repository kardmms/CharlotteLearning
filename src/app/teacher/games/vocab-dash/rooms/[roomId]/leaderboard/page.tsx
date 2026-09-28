import { StudentAvatar } from "@/components/StudentAvatar";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GameRoomStatus } from "@prisma/client";
import { ArrowLeft, Crown, Medal, Sparkles, Square, Trophy, UsersRound } from "lucide-react";
import { endVocabDashRoom } from "@/app/teacher/actions";
import { TeacherTopbar } from "@/components/AppTopbar";
import { VocabDashFullscreenButton } from "@/components/VocabDashFullscreenButton";
import { VocabDashRoomRefresh } from "@/components/VocabDashRoomRefresh";
import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { gamesFeatureEnabled } from "@/lib/features";
import { accuracyPercent, progressPercent, rankedParticipants } from "@/lib/vocab-dash";

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
  const showPodium = ranked.some((participant) => participant.finishRank === 1);
  const podiumSlots = [
    { place: 2, participant: leaders[1], tone: "silver" },
    { place: 1, participant: leaders[0], tone: "gold" },
    { place: 3, participant: leaders[2], tone: "bronze" }
  ];
  const lowerSlots = [
    { place: 4, participant: leaders[3] },
    { place: 5, participant: leaders[4] }
  ];

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
            <div className="eyebrow">{room.status === GameRoomStatus.COMPLETED ? "Final results" : showPodium ? "Podium reveal" : "Live game"}</div>
            <h1>Vocab Dash</h1>
            <p>{room.status === GameRoomStatus.COMPLETED
              ? "The race is complete. Final placement and star rewards are saved for every student."
              : showPodium
                ? "The first perfect run is in. Top five standings are on the stage."
                : "Only correct answers advance the race. One miss sends the score back to the starting line."}</p>
          </div>
          <div className="vocab-leaderboard-code">
            <span>Join code</span>
            <strong>{room.code}</strong>
          </div>
        </section>

        {showPodium ? (
          <section className="vocab-podium-stage" aria-label="Vocab Dash podium">
            <div className="vocab-podium-head">
              <div>
                <div className="eyebrow">Podium reveal</div>
                <h2>Top Five</h2>
              </div>
              <div className="vocab-reveal-chip">
                <Sparkles size={18} />
                Revealing #1
              </div>
            </div>

            <div className="vocab-podium-grid">
              {podiumSlots.map(({ place, participant, tone }) => {
                return (
                  <div className={`vocab-podium-slot place-${place} tone-${tone} ${participant ? "" : "empty"}`} key={place}>
                    <div className="vocab-podium-avatar">
                      {place === 1 ? <Crown size={30} fill="currentColor" /> : <Medal size={26} />}
                      {participant ? <StudentAvatar color={participant.characterColor} accessoryKey={participant.accessoryKey} size={100} /> : <span>?</span>}
                    </div>
                    <div className="vocab-podium-name">
                      <span>#{place}</span>
                      <strong>{participant?.displayName || "Still racing"}</strong>
                      <small>{participant ? `${participant.currentStreak}/${termCount} score` : "Waiting"}</small>
                    </div>
                    <div className="vocab-podium-step">
                      <span>{place}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="vocab-lower-ranks">
              {lowerSlots.map(({ place, participant }) => (
                <div className={`vocab-lower-rank-box ${participant ? "" : "empty"}`} key={place}>
                  <strong>#{place}</strong>
                  <span>{participant?.displayName || "Still racing"}</span>
                  <small>{participant ? `${participant.currentStreak}/${termCount} score` : "Waiting"}</small>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="vocab-race-board">
            <div className="vocab-race-timer">
              <span>Progress</span>
              <div><i style={{ width: `${leaders[0] ? progressPercent(leaders[0].currentStreak, termCount) : 0}%` }} /></div>
            </div>
            <div className="vocab-race-layout">
              <div className="vocab-racer-list">
                {ranked.length ? ranked.map((participant, index) => {
                  const progress = progressPercent(participant.currentStreak, termCount);
                  return (
                    <div className="vocab-racer-row" key={participant.id}>
                      <div className="vocab-racer-avatar"><StudentAvatar color={participant.characterColor} accessoryKey={participant.accessoryKey} size={48} /></div>
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
        )}
      </main>
    </>
  );
}
