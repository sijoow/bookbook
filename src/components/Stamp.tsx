// 발도장 스티커 — 별·하트·꽃·책 (다꾸: 흰 테두리 + 갈색 펜). 그림 파일 없이 SVG.

export const STAMPS = ["star", "heart", "flower", "book"] as const;
export type StampKindUI = (typeof STAMPS)[number];
export const STAMP_LABEL: Record<StampKindUI, string> = { star: "별", heart: "하트", flower: "꽃", book: "책" };

export function StampIcon({ kind, size = 26 }: { kind: string; size?: number }) {
  const ink = "var(--ink)";
  const common = { stroke: ink, strokeWidth: 2.2, strokeLinejoin: "round" as const };
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden style={{ display: "inline-block", verticalAlign: "middle", overflow: "visible" }}>
      <g style={{ filter: "drop-shadow(0 0 0 #fff)" }}>
        {kind === "heart" && (
          <path d="M16 27 C 5 19 3 13 6.5 8.5 C 9.5 4.8 14 6 16 9.6 C 18 6 22.5 4.8 25.5 8.5 C 29 13 27 19 16 27 Z" fill="var(--coral)" {...common} />
        )}
        {kind === "star" && (
          <path d="M16 3.5 L19.6 11.6 L28.4 12.4 L21.7 18.2 L23.7 26.8 L16 22.3 L8.3 26.8 L10.3 18.2 L3.6 12.4 L12.4 11.6 Z" fill="var(--butter)" {...common} />
        )}
        {kind === "flower" && (
          <g {...common}>
            {[0, 72, 144, 216, 288].map((a) => (
              <circle key={a} cx={16 + Math.sin((a * Math.PI) / 180) * 7} cy={16 - Math.cos((a * Math.PI) / 180) * 7} r={5.6} fill="var(--sky)" />
            ))}
            <circle cx={16} cy={16} r={4.4} fill="var(--butter)" />
          </g>
        )}
        {kind === "book" && (
          <g {...common}>
            <path d="M4 8 Q 10 5.5 16 8 L16 26 Q 10 23.5 4 26 Z" fill="var(--mint)" />
            <path d="M28 8 Q 22 5.5 16 8 L16 26 Q 22 23.5 28 26 Z" fill="var(--card)" />
          </g>
        )}
      </g>
    </svg>
  );
}
