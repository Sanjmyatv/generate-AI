"use client";

import { useEffect, useRef } from "react";

/**
 * The hero backdrop: three layers of small dots (white and soft brand tints) that drift at different rates as the
 * page scrolls and shift slightly with the pointer, so the far layer barely moves and the near one travels most.
 * One canvas, one requestAnimationFrame loop that only runs while the hero is on screen, a passive scroll listener,
 * fewer dots on phones, and a single still picture for people who prefer reduced motion. Decorative only.
 */
interface Dot {
  x: number;
  y: number;
}
interface Layer {
  dots: Dot[];
  radius: number;
  alpha: number;
  /** How far the layer moves per pixel scrolled. */
  scroll: number;
  /** How far (px) the pointer can shift it. */
  pointer: number;
  tints: string[];
}

/** A small seeded generator, so a given screen size always draws the same sky. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WHITE = "255, 255, 255";
const BRAND = "212, 104, 212"; // --brand-light

export function HeroScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const host = canvas?.parentElement;
    if (!canvas || !ctx || !host) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const phone = window.matchMedia("(max-width: 767px)").matches;
    const density = phone ? 0.45 : 1;
    // Far, middle, near: bigger, brighter and faster as they get closer.
    const layers: Layer[] = [
      { dots: [], radius: 0.8, alpha: 0.35, scroll: 0.05, pointer: 4, tints: [WHITE, WHITE, BRAND] },
      { dots: [], radius: 1.3, alpha: 0.5, scroll: 0.12, pointer: 9, tints: [WHITE, BRAND] },
      { dots: [], radius: 2, alpha: 0.7, scroll: 0.24, pointer: 16, tints: [BRAND, WHITE, BRAND] },
    ];
    const counts = [70, 45, 22].map((n) => Math.round(n * density));

    let width = 0;
    let height = 0;
    let scrollY = window.scrollY;
    let pointerX = 0;
    let pointerY = 0;
    let smoothX = 0;
    let smoothY = 0;
    let frame = 0;
    let visible = true;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = host!.clientWidth;
      height = host!.clientHeight;
      canvas!.width = Math.max(1, Math.round(width * dpr));
      canvas!.height = Math.max(1, Math.round(height * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const random = rng(width * 31 + height);
      layers.forEach((layer, i) => {
        layer.dots = Array.from({ length: counts[i] }, () => ({ x: random() * width, y: random() * height }));
      });
      draw();
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);
      layers.forEach((layer) => {
        const offsetY = scrollY * layer.scroll;
        layer.dots.forEach((dot, i) => {
          // Scrolling moves the dots up; they wrap round so the sky never runs out.
          const y = (((dot.y - offsetY + smoothY * layer.pointer) % height) + height) % height;
          const x = (((dot.x + smoothX * layer.pointer) % width) + width) % width;
          ctx!.fillStyle = `rgba(${layer.tints[i % layer.tints.length]}, ${layer.alpha})`;
          ctx!.beginPath();
          ctx!.arc(x, y, layer.radius, 0, Math.PI * 2);
          ctx!.fill();
        });
      });
    }

    let drawnScroll = -1;
    function tick() {
      // Ease toward the pointer so the shift is smooth, and stop looping once nothing moves.
      smoothX += (pointerX - smoothX) * 0.08;
      smoothY += (pointerY - smoothY) * 0.08;
      const moving =
        Math.abs(pointerX - smoothX) > 0.002 || Math.abs(pointerY - smoothY) > 0.002 || scrollY !== drawnScroll;
      drawnScroll = scrollY;
      draw();
      frame = visible && moving ? requestAnimationFrame(tick) : 0;
    }
    function start() {
      if (!frame && visible && !reduced) frame = requestAnimationFrame(tick);
    }

    const onScroll = () => {
      scrollY = window.scrollY;
      if (reduced) return;
      start();
    };
    const onPointer = (e: PointerEvent) => {
      pointerX = (e.clientX / window.innerWidth - 0.5) * 2;
      pointerY = (e.clientY / window.innerHeight - 0.5) * 2;
      start();
    };

    // Pause when the hero is off screen or the tab is hidden.
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    observer.observe(host);
    const resizer = new ResizeObserver(resize);
    resizer.observe(host);

    if (!reduced) {
      window.addEventListener("scroll", onScroll, { passive: true });
      // A phone has no pointer to follow.
      if (!phone) window.addEventListener("pointermove", onPointer, { passive: true });
    }
    resize();
    start();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 overflow-hidden"
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
    </div>
  );
}
