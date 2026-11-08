"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * The hero's animated backdrop: soft colour fields, glass spheres, a few geometric shapes,
 * light particles and slow energy waves, all drifting at different depths. Everything is
 * decorative (aria-hidden, no pointer events) and only animates transform and opacity so it
 * stays cheap; phones get fewer objects, and reduced-motion users get a still picture.
 *
 * The mouse moves `--mx` / `--my` (-1..1) on the parent section; every `.hs-layer` shifts by
 * its own `--d` depth, so near objects travel further than far ones.
 */
function Layer({
  depth,
  className = "",
  floatSeconds = 10,
  delay = 0,
  children,
}: {
  depth: number;
  className?: string;
  floatSeconds?: number;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <div className={`hs-layer ${className}`} style={{ "--d": depth } as CSSProperties}>
      <div className="hs-float" style={{ "--dur": `${floatSeconds}s`, "--delay": `${-delay}s` } as CSSProperties}>
        {children}
      </div>
    </div>
  );
}

/** Deterministic "random" numbers, so the server and the browser draw the same particles. */
const noise = (i: number, salt: number) => ((i * 7919 + salt * 104729) % 1000) / 1000;
const PARTICLES = Array.from({ length: 30 }, (_, i) => ({
  left: 3 + noise(i, 1) * 94,
  top: 4 + noise(i, 2) * 90,
  size: 1.5 + noise(i, 3) * 2.5,
  delay: noise(i, 4) * 6,
  duration: 3 + noise(i, 5) * 4,
  cyan: i % 3 === 0,
}));

export function HeroScene() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = ref.current?.parentElement;
    if (!section) return;
    const quiet = window.matchMedia("(prefers-reduced-motion: reduce), (hover: none)");
    if (quiet.matches) return;

    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        section.style.setProperty("--mx", String((e.clientX / window.innerWidth - 0.5) * 2));
        section.style.setProperty("--my", String((e.clientY / window.innerHeight - 0.5) * 2));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="hs-scene pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden"
    >
      {/* Colour fields: deep navy, purple, electric blue and a touch of cyan. */}
      <div className="hs-field" />
      <div className="hs-glow hs-pulse right-[6%] top-[-8%] size-[520px] max-md:size-[320px]" style={{ background: "radial-gradient(circle, rgba(59,130,246,0.38), transparent 68%)" }} />
      <div className="hs-glow hs-pulse bottom-[-14%] left-[-6%] size-[560px] max-md:size-[340px]" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.34), transparent 68%)", animationDelay: "-3s" }} />
      <div className="hs-glow hs-pulse right-[28%] top-[34%] size-[380px] max-md:hidden" style={{ background: "radial-gradient(circle, rgba(34,211,238,0.16), transparent 70%)", animationDelay: "-5s" }} />

      {/* Energy waves. */}
      <svg className="hs-wave absolute bottom-[6%] left-[-10%] h-[240px] w-[120%] max-md:bottom-0 max-md:h-[160px]" viewBox="0 0 1200 240" preserveAspectRatio="none" fill="none">
        <defs>
          <linearGradient id="hs-wave-a" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#8b5cf6" stopOpacity="0" />
            <stop offset="0.45" stopColor="#6366f1" stopOpacity="0.7" />
            <stop offset="0.75" stopColor="#22d3ee" stopOpacity="0.55" />
            <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 150 C 150 70, 300 70, 450 130 S 750 200, 900 120 S 1100 60, 1200 110" stroke="url(#hs-wave-a)" strokeWidth="1.5" />
        <path d="M0 175 C 160 110, 320 100, 480 160 S 780 220, 930 150 S 1110 100, 1200 140" stroke="url(#hs-wave-a)" strokeWidth="1" opacity="0.6" />
        <path className="max-md:hidden" d="M0 120 C 140 40, 320 50, 470 105 S 760 175, 910 95 S 1120 35, 1200 80" stroke="url(#hs-wave-a)" strokeWidth="1" opacity="0.4" />
      </svg>

      {/* Light particles. */}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className={`hs-twinkle absolute rounded-full ${i >= 12 ? "max-md:hidden" : ""}`}
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            background: p.cyan ? "#67e8f9" : "#c4b5fd",
            boxShadow: `0 0 ${p.size * 4}px ${p.cyan ? "rgba(103,232,249,0.9)" : "rgba(196,181,253,0.9)"}`,
            animationDelay: `${-p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}

      {/* Large glass sphere, far right. */}
      <Layer depth={26} floatSeconds={11} delay={2} className="right-[3%] top-[10%] max-md:right-[-8%] max-md:top-[4%]">
        <div className="hs-sphere size-[210px] max-md:size-[120px]" />
      </Layer>

      {/* Mid glass sphere, lower left of the picture area. */}
      <Layer depth={38} floatSeconds={8} delay={5} className="bottom-[16%] right-[40%] max-lg:hidden">
        <div className="hs-sphere size-[96px]" />
      </Layer>

      {/* Small bright sphere, near the top. */}
      <Layer depth={52} floatSeconds={7} delay={1} className="right-[22%] top-[6%] max-md:right-[30%] max-md:top-[2%]">
        <div className="hs-sphere size-[46px] max-md:size-[30px]" />
      </Layer>

      {/* Orbit ring. */}
      <Layer depth={18} floatSeconds={13} delay={4} className="right-[10%] top-[42%] max-md:hidden">
        <div className="hs-orbit">
          <div className="hs-ring hs-spin size-[300px]" />
        </div>
      </Layer>

      {/* Glass cube. */}
      <Layer depth={44} floatSeconds={9} delay={3} className="right-[5%] bottom-[8%] max-md:right-[6%] max-md:bottom-[10%]">
        <div className="hs-cube hs-tumble size-[74px] max-md:size-[48px]" />
      </Layer>

      {/* Crystal. */}
      <Layer depth={32} floatSeconds={10} delay={6} className="bottom-[10%] left-[42%] max-xl:hidden">
        <div className="hs-gem-glow">
          <div className="hs-gem hs-spin-slow size-[70px]" />
        </div>
      </Layer>

      {/* Prism. */}
      <Layer depth={60} floatSeconds={8} delay={7} className="left-[46%] top-[8%] max-xl:hidden">
        <div className="hs-gem-glow">
          <div className="hs-prism hs-spin-slow size-[44px]" />
        </div>
      </Layer>

      {/* The scene fades into the page below it. */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-b from-transparent to-background" />
    </div>
  );
}
