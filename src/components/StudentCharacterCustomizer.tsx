"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, LockKeyhole, Sparkles, Star } from "lucide-react";
import { updateStudentCharacter } from "@/app/student/actions";
import { StudentAvatar } from "@/components/StudentAvatar";
import { cosmeticSlots, equippedCosmetics, vocabDashAccessories, vocabDashColors, type CosmeticSlot } from "@/lib/vocab-dash";

function SaveLook({ cost, stars }: { cost: number; stars: number }) {
  const { pending } = useFormStatus();
  return <button className="button wardrobe-save" type="submit" disabled={pending || cost > stars}>
    <Sparkles size={17} />{pending ? "Saving your look…" : cost > stars ? `Earn ${cost - stars} more stars` : cost ? `Unlock & wear · ${cost} stars` : "Save my look"}
  </button>;
}

export function StudentCharacterCustomizer({ initialColor, initialAccessory, ownedAccessories, stars }: {
  initialColor: string;
  initialAccessory: string | null;
  ownedAccessories: string[];
  stars: number;
}) {
  const [color, setColor] = useState(initialColor);
  const [keys, setKeys] = useState(() => equippedCosmetics(initialAccessory));
  const [tab, setTab] = useState<CosmeticSlot>("hat");
  const selected = keys.map((key) => vocabDashAccessories.find((item) => item.key === key)!);
  const purchase = selected.filter((item) => item.cost > 0 && !ownedAccessories.includes(item.key));
  const cost = purchase.reduce((sum, item) => sum + item.cost, 0);
  const serialized = JSON.stringify(keys);
  function choose(slot: CosmeticSlot, key: string) {
    setKeys((current) => [...current.filter((id) => vocabDashAccessories.find((item) => item.key === id)?.slot !== slot), ...(key ? [key] : [])]);
  }
  return (
    <section className="panel character-customizer" id="alien-wardrobe">
      <div className="character-customizer-head">
        <div><div className="eyebrow">Alien wardrobe</div><h2>Make it yours.</h2><p>Mix headwear, eyewear, and an extra.</p><span className="wardrobe-balance"><Star size={16} fill="currentColor" /> {stars} stars to spend</span></div>
        <div className="character-preview-stage"><StudentAvatar color={color} accessoryKey={serialized} size={132} /></div>
      </div>
      <form action={updateStudentCharacter}>
        <input type="hidden" name="accessoryKey" value={serialized} />
        <fieldset className="character-color-picker">
          <legend>Choose your color <small>Always free</small></legend>
          <div>{vocabDashColors.map((item) => (
            <label key={item.key}>
              <input name="characterColor" type="radio" value={item.key} checked={color === item.key} onChange={() => setColor(item.key)} />
              <span style={{ background: item.hex }} /><small>{item.label}</small>
            </label>
          ))}</div>
        </fieldset>
        <div className="wardrobe-categories" aria-label="Cosmetic categories">
          {cosmeticSlots.map((slot) => <button key={slot.key} type="button" aria-pressed={tab === slot.key} onClick={() => setTab(slot.key)}>{slot.label}</button>)}
        </div>
        {cosmeticSlots.map((slot) => <fieldset className="character-accessory-picker" key={slot.key} hidden={tab !== slot.key}>
          <legend>{slot.label}</legend>
          <div>
            <label>
              <input name={`cosmetic-${slot.key}`} type="radio" value="" checked={!selected.some((item) => item.slot === slot.key)} onChange={() => choose(slot.key, "")} />
              <StudentAvatar color={color} size={74} /><span>None</span><small>Keep it simple</small>
            </label>
            {vocabDashAccessories.filter((item) => item.slot === slot.key).map((item) => {
              const owned = ownedAccessories.includes(item.key);
              const locked = item.cost > 0 && !owned;
              return <label key={item.key} className={locked ? "cosmetic-locked" : ""}>
                <input name={`cosmetic-${slot.key}`} type="radio" value={item.key} checked={keys.includes(item.key)} onChange={() => choose(slot.key, item.key)} />
                <StudentAvatar color={color} accessoryKey={item.key} size={74} />
                <span>{item.label}</span>
                <small>{item.cost === 0 ? "Free" : owned ? <><Check size={13} /> Owned</> : <><LockKeyhole size={13} /> {item.cost} stars</>}</small>
                {locked && item.cost >= 30 && <em className="cosmetic-special">Special</em>}
              </label>;
            })}
          </div>
        </fieldset>)}
        <div className="wardrobe-checkout" aria-live="polite">
          <strong>{cost ? `Unlock ${purchase.length} ${purchase.length === 1 ? "item" : "items"} · ${cost} stars` : "Your look is ready"}</strong>
          <p>{cost ? `${purchase.map((item) => item.label).join(" + ")}. ${cost <= stars ? `${stars - cost} stars left after unlocking.` : `Play games to earn ${cost - stars} more stars.`}` : "Free and owned items can be worn anytime."}</p>
          <small>Preview any item. Stars are spent only when you unlock it. Unlocks stay yours.</small>
        </div>
        <SaveLook cost={cost} stars={stars} />
      </form>
    </section>
  );
}
