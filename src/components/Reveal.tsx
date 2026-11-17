"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Phase = "ssr" | "hidden" | "shown";

/**
 * Fades, un-blurs and lifts its content into view the first time it scrolls on screen. Content that
 * is already in view when the page loads is never hidden, and nothing is hidden before the
 * script runs, so the page still works without JavaScript. Honors reduced-motion settings.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
  as: Tag = "div",
  id,
}: {
  children: ReactNode;
  className?: string;
  /** Milliseconds to wait before the animation, to stagger siblings. */
  delay?: number;
  as?: "div" | "section";
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("ssr");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase("shown");
          observer.disconnect();
        } else {
          // The first report says it starts off screen: now it can wait, hidden, to be revealed.
          setPhase((p) => (p === "ssr" ? "hidden" : p));
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -5% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hidden = phase === "hidden";
  return (
    <Tag
      id={id}
      ref={ref as never}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`transition-[opacity,translate,filter] duration-1000 ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:blur-none motion-reduce:transition-none ${
        hidden ? "translate-y-10 opacity-0 [@media(hover:hover)_and_(pointer:fine)]:blur-[10px]" : "opacity-100"
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
