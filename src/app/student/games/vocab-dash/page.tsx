import { Gamepad2, Rocket } from "lucide-react";
import { joinVocabDashRoom } from "@/app/student/actions";
import { PublicTopbar } from "@/components/AppTopbar";
import { Message } from "@/components/Message";
import { vocabDashCharacters } from "@/lib/vocab-dash";

export const dynamic = "force-dynamic";

export default async function StudentVocabDashJoinPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; code?: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      <PublicTopbar />
      <main className="vocab-student-join-page">
        <section className="vocab-student-join-card">
          <div className="vocab-student-join-icon"><Rocket size={32} /></div>
          <div>
            <div className="eyebrow">Classroom game</div>
            <h1>Join Vocab Dash</h1>
            <p>Enter your game code, choose a character, and get ready to match each word to the right definition.</p>
          </div>
          <Message error={params.error} />
          <form className="form-grid" action={joinVocabDashRoom}>
            <label>
              Game code
              <input name="code" inputMode="numeric" pattern="[0-9]*" maxLength={6} defaultValue={params.code || ""} required />
            </label>
            <label>
              Your name
              <input name="displayName" maxLength={80} placeholder="First name" required />
            </label>
            <fieldset className="vocab-character-picker">
              <legend>Choose a character</legend>
              <div>
                {vocabDashCharacters.map((character, index) => (
                  <label key={character.key}>
                    <input name="characterKey" type="radio" value={character.key} defaultChecked={index === 0} />
                    <span>{character.glyph}</span>
                    <small>{character.label}</small>
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="button vocab-dash-start-button" type="submit">
              <Gamepad2 size={18} />
              Join game
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
