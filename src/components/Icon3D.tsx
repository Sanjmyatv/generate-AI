import type { CSSProperties, ReactNode } from "react";

/**
 * A glossy 3D icon tile: blurred glow, tilted gradient back plate, frosted front plate with a white line icon.
 * `flip` tilts the back plate the other way; `round` makes it a circle. Decorative only.
 */
export function Icon3D({
  children,
  size = 72,
  radius = 22,
  delay = 0,
  flip = false,
  round = false,
  className = "",
}: {
  children: ReactNode;
  size?: number;
  radius?: number;
  /** Seconds into the float animation, so neighbours don't bob in step. */
  delay?: number;
  flip?: boolean;
  round?: boolean;
  className?: string;
}) {
  const style = {
    "--s": `${size}px`,
    "--r": round ? "50%" : `${radius}px`,
    "--delay": `${-delay}s`,
    "--off": flip ? "-6px" : "7px",
    "--rot": round ? "0deg" : flip ? "-8deg" : "8deg",
  } as CSSProperties;
  return (
    <div aria-hidden="true" className={`icon3d ${className}`} style={style}>
      <span className="icon3d-glow" />
      <span className="icon3d-back" />
      <span className="icon3d-front">{children}</span>
    </div>
  );
}

const stroke = {
  fill: "none",
  stroke: "#fff",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** The line icons used inside Icon3D tiles. */
export const icons = {
  grid: (s: number) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="3" width="7" height="9" rx="2" />
      <rect x="14" y="3" width="7" height="5" rx="2" />
      <rect x="14" y="12" width="7" height="9" rx="2" />
      <rect x="3" y="16" width="7" height="5" rx="2" />
    </svg>
  ),
  upload: (s: number) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...stroke}>
      <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" />
      <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </svg>
  ),
  sparkles: (s: number) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...stroke}>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </svg>
  ),
  play: (s: number) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#fff">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  ),
  bolt: (s: number) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...stroke}>
      <path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z" />
    </svg>
  ),
};
