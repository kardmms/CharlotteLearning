import { AlienCosmeticArtwork } from "@/components/AlienCosmeticArtwork";
import { useId } from "react";
import { equippedCosmetics, vocabDashAccessories, vocabDashColors } from "@/lib/vocab-dash";

// Head-and-shoulders framing preserves the cosmetic anchor coordinates.
// Source viewBoxes remove transparent margins without altering the PNGs.
export function StudentAvatar({ color = "blue", accessoryKey, size = 88, label = "Friendly alien character" }: {
  color?: string | null;
  accessoryKey?: string | null;
  size?: number;
  label?: string;
}) {
  const hatClipId = useId();
  const fill = vocabDashColors.find((item) => item.key === color)?.hex || vocabDashColors[0].hex;
  const keys = equippedCosmetics(accessoryKey);
  const accessories = keys.map((key) => vocabDashAccessories.find((item) => item.key === key)!)
    .sort((a, b) => ["extra", "hat", "eyes"].indexOf(a.slot) - ["extra", "hat", "eyes"].indexOf(b.slot));
  const hidesEyes = accessories.some((item) => item.slot === "eyes" && item.hidesEyes !== false);
  return (
    <svg className="student-avatar" viewBox="28 0 184 200" width={size} height={size * 200 / 184} role="img" aria-label={label}>
      {/* A small shoulder silhouette keeps the focus on the face. */}
      <g stroke="#302044" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M57 188 C63 164 88 151 120 151 C152 151 177 164 183 188 Q185 194 178 194 H62 Q55 194 57 188Z" fill={fill} />
        {/* Oversized alien head and curved antennae. */}
        <path d="M120 30 C75 28 46 57 48 95 C50 134 83 161 120 162 C157 161 190 134 192 95 C194 57 165 28 120 30Z" fill={fill} />
        <path d="M78 45 Q65 11 47 25 M159 43 Q165 8 185 20" fill="none" strokeWidth="13" />
        <path d="M78 45 Q65 11 47 25 M159 43 Q165 8 185 20" fill="none" stroke={fill} strokeWidth="7" />
        <circle cx="46" cy="25" r="8" fill={fill} />
        <circle cx="186" cy="20" r="8" fill={fill} />
      </g>
      <path d="M101 36 Q118 31 133 36" fill="none" stroke="white" strokeOpacity=".55" strokeWidth="8" strokeLinecap="round" />
      <path d="M61 111 Q78 146 119 151 Q155 150 177 124 Q160 159 120 160 Q80 158 61 127Z" fill="#302044" fillOpacity=".09" />
      <g visibility={hidesEyes ? "hidden" : "visible"}>
        <ellipse cx="89" cy="92" rx="21" ry="27" transform="rotate(-32 89 92)" fill="#302044" />
        <ellipse cx="151" cy="92" rx="21" ry="27" transform="rotate(32 151 92)" fill="#302044" />
        <path d="M70 84 Q76 66 95 78 M144 77 Q160 65 169 82" fill="none" stroke="#b6a1d0" strokeWidth="4" strokeLinecap="round" />
      </g>
      <path d="M117 117 L118 120 M123 117 L122 120" stroke="#302044" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M109 131 Q120 141 132 130 Q122 147 109 131" fill="#302044" />
      {accessories.map((accessory) => {
        if (accessory.artwork) return <AlienCosmeticArtwork key={accessory.key} kind={accessory.artwork} />;
        const placement = accessory.placement;
        // The forehead hides the hollow lining behind the front brim/cuff.
        const frontEdge = accessory.key === "bucket-hat"
          ? "M0 0 H1536 V800 H1450 C1120 630 430 630 86 800 H0Z"
          : accessory.key === "beanie" ? "M0 0 H1536 V940 H1340 C1030 766 530 766 190 940 H0Z" : null;
        const clipId = `${hatClipId}-${accessory.key}`;
        return <svg key={accessory.key} x={placement?.x ?? (accessory.slot === "hat" ? 43 : 42)} y={placement?.y ?? (accessory.slot === "hat" ? 9 : 66)} width={placement?.width ?? (accessory.slot === "hat" ? 154 : 156)} height={placement?.height ?? (accessory.slot === "hat" ? 62 : 53)} viewBox={accessory.viewBox} preserveAspectRatio="none" overflow="visible" aria-hidden="true">
          {frontEdge && <defs><clipPath id={clipId}><path d={frontEdge} /></clipPath></defs>}
          <image href={accessory.image} width={accessory.width} height={accessory.height} clipPath={frontEdge ? `url(#${clipId})` : undefined} />
        </svg>;
      })}
    </svg>
  );
}
