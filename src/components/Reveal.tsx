"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Phase = "ssr" | "hidden" | "shown";

/**
 * Fades and scales its content up into view the first time it scrolls on screen. Content that
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
      className={`transition-[opacity,transform] duration-700 ease-out motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:opacity-100 motion-reduce:transition-none ${
        hidden ? "translate-y-8 scale-[0.97] opacity-0" : "translate-y-0 scale-100 opacity-100"
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
