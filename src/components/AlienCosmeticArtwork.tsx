// Code-native overlays share the alien's coordinates, so rims and straps follow
// the head rather than treating the accessory as an unrelated product image.
function Star({ x, y, size = 12, fill = "#ffe36a" }: { x: number; y: number; size?: number; fill?: string }) {
  return <path transform={`translate(${x} ${y}) scale(${size / 10})`} d="M0-10 3-3 10-3 5 2 7 9 0 5-7 9-5 2-10-3-3-3Z" fill={fill} />;
}
export function AlienCosmeticArtwork({ kind }: { kind: string }) {
  const outline = "#302044";
  return <g stroke={outline} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
    {kind === "sport-headband" && <>
      <path d="M54 62 Q120 38 186 62 L190 76 Q120 56 50 76Z" fill="#ff6b7d" />
      <path d="M54 68 Q120 46 186 68" fill="none" stroke="#fff4e5" strokeWidth="5" />
      <path d="M118 52 109 63 119 61 115 70 130 56 120 58 125 52" fill="#ffe36a" strokeWidth="1.5" />
    </>}
    {kind === "star-bow" && <>
      <path d="M151 44 Q130 20 122 34 L126 57 Q137 64 153 50 Q171 64 181 55 L184 33 Q174 20 156 44Z" fill="#a285ff" />
      <path d="M150 48 141 67 156 62 163 69 161 48" fill="#ff88cd" />
      <path d="M130 37 148 45 M176 36 162 45" stroke="#d5baff" strokeWidth="4" />
      <Star x={154} y={46} size={10} />
    </>}
    {kind === "bandana" && <>
      <path d="M88 156 Q120 170 151 156 L143 175 121 190 98 177Z" fill="#25dac5" />
      <path d="M89 157 Q120 171 151 157" fill="none" stroke="#b8fff4" strokeWidth="4" />
      <Star x={121} y={175} size={6} fill="#f2ffff" />
    </>}
    {kind === "comet-scarf" && <>
      <path d="M131 169 151 171 160 194 H140Z" fill="#ffb75b" />
      <path d="M143 184 156 182 M146 191 159 190" stroke="#ff657f" strokeWidth="5" />
      <path d="M82 153 Q120 170 158 153 L155 169 Q120 184 85 169Z" fill="#ff657f" />
      <path d="M91 162 Q121 174 149 161" fill="none" stroke="#ffd275" strokeWidth="5" />
    </>}
    {kind === "pixel-shades" && <>
      <path d="M45 73 H106 V80 H134 V73 H195 V85 H186 V107 H174 V114 H143 V104 H137 V88 H103 V104 H96 V114 H65 V107 H54 V85 H45Z" fill="#211a3b" />
      <path d="M61 81 H99 V98 H91 V105 H70 V99 H61Z M141 81 H179 V99 H170 V105 H149 V98 H141Z" fill="#5f4acb" stroke="none" />
      <path d="M67 82 V89 H74 V96 H81 M150 82 V89 H157 V96 H164" fill="none" stroke="#a8fff4" strokeWidth="6" strokeLinecap="square" />
    </>}
    {kind === "star-shades" && <>
      <path d="M48 85 68 87 M172 87 192 85 M108 89 Q120 82 132 89" fill="none" stroke="#f8c63e" strokeWidth="7" />
      <Star x={86} y={91} size={29} /><Star x={154} y={91} size={29} />
      <g strokeWidth="1.5"><Star x={86} y={91} size={21} fill="#934bcc" /><Star x={154} y={91} size={21} fill="#934bcc" /></g>
      <path d="M77 85 86 79 M145 85 154 79" stroke="#ffd2f7" strokeWidth="4" />
    </>}
    {kind === "orbit-visor" && <>
      <path d="M47 74 Q120 63 193 74 L187 111 Q158 126 130 109 Q120 104 110 109 Q82 126 53 111Z" fill="#6942bd" />
      <path d="M54 79 Q120 69 186 79 L181 105 Q157 114 132 102 Q120 95 108 102 Q83 114 59 105Z" fill="#34dacd" />
      <path d="M66 81 92 79 73 103 62 103Z M117 78 127 78 107 101 97 104Z" fill="#bcfff9" stroke="none" />
      <path d="M176 87 V98" stroke="#fff" strokeWidth="4" />
    </>}
    {kind === "explorer-goggles" && <>
      <path d="M49 86 H64 M176 86 H191" stroke="#f8a848" strokeWidth="9" />
      <path d="M106 88 Q120 79 134 88" fill="none" stroke="#996132" strokeWidth="6" />
      <ellipse cx="86" cy="91" rx="26" ry="29" fill="#b0faff" fillOpacity=".2" stroke="#ffcf73" strokeWidth="8" />
      <ellipse cx="154" cy="91" rx="26" ry="29" fill="#b0faff" fillOpacity=".2" stroke="#ffcf73" strokeWidth="8" />
      <path d="M73 77 84 70 M141 77 152 70" stroke="white" strokeWidth="4" />
    </>}
    {kind === "space-crown" && <>
      <path d="M62 56 54 19 83 36 99 9 120 34 141 9 157 36 186 19 178 56 Q120 69 62 56Z" fill="#ffce48" />
      <path d="M63 49 Q120 61 177 49 L177 63 Q120 75 63 63Z" fill="#ffb238" />
      <path d="M66 54 Q120 64 174 54" stroke="#fff4a6" strokeWidth="3" fill="none" />
      <path d="M120 43 130 53 120 63 110 53Z" fill="#a382ff" />
      <circle cx="83" cy="55" r="4" fill="#ff83bc" /><circle cx="157" cy="55" r="4" fill="#45e5d4" />
      <circle cx="55" cy="18" r="4" fill="#fff0a0" /><circle cx="99" cy="9" r="4" fill="#fff0a0" /><circle cx="141" cy="9" r="4" fill="#fff0a0" /><circle cx="185" cy="18" r="4" fill="#fff0a0" />
    </>}
    {kind === "headphones" && <>
      <path d="M49 92 C40 9 196 9 191 92" fill="none" stroke={outline} strokeWidth="15" />
      <path d="M49 92 C40 9 196 9 191 92" fill="none" stroke="#ac82fa" strokeWidth="9" />
      <rect x="38" y="76" width="23" height="47" rx="10" fill="#ad83ff" />
      <rect x="179" y="76" width="23" height="47" rx="10" fill="#ad83ff" />
      <rect x="44" y="83" width="11" height="30" rx="5" fill="#43eadc" strokeWidth="1.5" />
      <rect x="185" y="83" width="11" height="30" rx="5" fill="#43eadc" strokeWidth="1.5" />
      <path d="M192 122 Q181 140 156 139" fill="none" strokeWidth="4" />
      <rect x="144" y="134" width="17" height="8" rx="4" fill="#43eadc" strokeWidth="2" />
    </>}
  </g>;
}
