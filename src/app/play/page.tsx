import { Gamepad2, LockKeyhole, Sparkles, Star } from "lucide-react";
import { redirect } from "next/navigation";
import { joinVocabDashRoom, updateStudentCharacter } from "@/app/student/actions";
import { StudentTopbar } from "@/components/AppTopbar";
import { Message } from "@/components/Message";
import { getStudentSession, requireStudentAccount } from "@/lib/auth";
import { vocabDashAccessories, vocabDashColors } from "@/lib/vocab-dash";

export const dynamic = "force-dynamic";

function unlockedAccessories(value: string) {
  try {
    const parsed = JSON.parse(value);
    return new Set(Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []);
  } catch {
    return new Set<string>();
  }
}

export default async function PlayPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; code?: string; saved?: string }>;
}) {
  if (!(await getStudentSession())) redirect("/student/login?next=%2Fplay");
  const [account, query] = await Promise.all([requireStudentAccount(), searchParams]);
  const unlocked = unlockedAccessories(account.unlockedAccessories);

  return (
    <div className="student-shell play-shell">
      <StudentTopbar name={account.displayName} />
      <main className="page play-page">
        <section className="play-heading">
          <div>
            <div className="eyebrow">Live classroom games</div>
            <h1>Play Vocab Dash</h1>
            <p>Enter the code on your teacher&apos;s screen. Your game stars stay connected to this account.</p>
          </div>
          <div className="play-stars"><Star size={22} fill="currentColor" /><strong>{account.stars}</strong><span>stars</span></div>
        </section>

        <Message error={query.error} success={query.saved ? "Character updated." : undefined} />

        <div className="play-layout">
          <section className="panel play-join-panel">
            <div className="play-panel-icon"><Gamepad2 size={26} /></div>
            <div><div className="eyebrow">Join a game</div><h2>Enter the 6-digit code</h2></div>
            <form className="play-code-form" action={joinVocabDashRoom}>
              <input
                aria-label="Game code"
                name="code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                defaultValue={query.code || ""}
                placeholder="000000"
                required
              />
              <button className="button" type="submit">Join game</button>
            </form>
          </section>

          <section className="panel character-customizer">
            <div className="character-customizer-head">
              <div><div className="eyebrow">Customize character</div><h2>Make your runner yours</h2></div>
              <div className={`base-character color-${account.characterColor}`} aria-label="Character preview">
                <span className={`character-accessory ${account.selectedAccessory || "none"}`} />
                <i />
              </div>
            </div>
            <form action={updateStudentCharacter}>
              <fieldset className="character-color-picker">
                <legend>Color</legend>
                <div>
                  {vocabDashColors.map((color) => (
                    <label key={color.key}>
                      <input name="characterColor" type="radio" value={color.key} defaultChecked={color.key === account.characterColor} />
                      <span style={{ background: color.hex }} />
                      <small>{color.label}</small>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="character-accessory-picker">
                <legend>Accessories</legend>
                <div>
                  <label>
                    <input name="accessoryKey" type="radio" value="" defaultChecked={!account.selectedAccessory} />
                    <span>None</span>
                  </label>
                  {vocabDashAccessories.map((accessory) => {
                    const owned = unlocked.has(accessory.key);
                    return (
                      <label key={accessory.key}>
                        <input name="accessoryKey" type="radio" value={accessory.key} defaultChecked={account.selectedAccessory === accessory.key} />
                        <span>{accessory.label}</span>
                        <small>{owned ? "Owned" : <><LockKeyhole size={13} /> {accessory.cost} stars</>}</small>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <button className="ghost-button" type="submit"><Sparkles size={17} /> Save character</button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
