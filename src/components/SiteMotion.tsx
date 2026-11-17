"use client";

import { useEffect, useRef } from "react";

const LIGHT = "122,162,255"; // --brand-light
const BRAND = "47,91,255"; // --brand

interface Dot {
  x: number;
  y: number;
  /** Depth 0.25 (far) … 1 (near): nearer dots are bigger, brighter and move more. */
  z: number;
  vx: number;
  vy: number;
  ph: number;
  tw: number;
  ox: number;
  oy: number;
}

/**
 * The page's ambient motion, in one place:
 * - a fixed canvas of twinkling dots that drift upward, shift with scroll by depth and step aside from the pointer;
 * - parallax for any element with `data-speed` (it moves by `-scrollY * speed`);
 * - with a mouse: cards with `data-tilt` (degrees) lean toward the pointer and light up their `.tilt-glow`, and
 *   buttons with `data-mag` follow it a little.
 * Fewer dots at a lower frame rate on phones; a still sky and no movement for people who prefer reduced motion.
 */
export function SiteMotion() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const small = window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
    const cleanups: (() => void)[] = [];
    const on = <T extends EventTarget>(target: T, type: string, fn: EventListener, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn, opts);
      cleanups.push(() => target.removeEventListener(type, fn, opts));
    };

    // ── Dots ──
    let w = 0;
    let h = 0;
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const count = small ? 36 : Math.round(Math.min(110, Math.max(40, (w * h) / 15000)));
    const dots: Dot[] = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: 0.25 + Math.random() * 0.75,
      vx: (Math.random() - 0.5) * 0.12,
      vy: -(0.05 + Math.random() * 0.25),
      ph: Math.random() * 6.28,
      tw: 0.008 + Math.random() * 0.02,
      ox: 0,
      oy: 0,
    }));
    let mouse: { x: number; y: number } | null = null;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      const sy = window.scrollY;
      for (const d of dots) {
        if (!reduce) {
          d.x += d.vx * d.z;
          d.y += d.vy * d.z;
          d.ph += d.tw;
        }
        let x = ((d.x % w) + w) % w;
        let y = (((d.y - sy * d.z * 0.35) % h) + h) % h;
        if (mouse) {
          const dx = x + d.ox - mouse.x;
          const dy = y + d.oy - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 140) {
            const f = (1 - dist / 140) * 2.2;
            d.ox += (dx / (dist || 1)) * f;
            d.oy += (dy / (dist || 1)) * f;
          }
        }
        d.ox *= 0.94;
        d.oy *= 0.94;
        x += d.ox;
        y += d.oy;
        const a = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(d.ph))) * d.z;
        const r = 0.6 + d.z * 1.8;
        if (d.z > 0.6) {
          ctx.fillStyle = `rgba(${BRAND},${a * 0.18})`;
          ctx.beginPath();
          ctx.arc(x, y, r * 5, 0, 6.283);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(${d.z > 0.7 ? "255,255,255" : LIGHT},${a})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 6.283);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    };

    let raf = 0;
    if (reduce) {
      draw();
      on(window, "resize", () => {
        size();
        draw();
      });
      return () => cleanups.forEach((f) => f());
    }

    on(window, "resize", size);
    const step = small ? 1000 / 30 : 0;
    let last = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (step && now - last < step) return;
      last = now;
      draw();
    };
    raf = requestAnimationFrame(frame);
    cleanups.push(() => cancelAnimationFrame(raf));

    // ── Parallax ──
    let ticking = false;
    const parallax = () => {
      ticking = false;
      const y = window.scrollY;
      document.querySelectorAll<HTMLElement>("[data-speed]").forEach((el) => {
        el.style.translate = `0 ${(-y * Number(el.dataset.speed)).toFixed(1)}px`;
      });
    };
    on(
      window,
      "scroll",
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(parallax);
        }
      },
      { passive: true },
    );
    parallax();
    // New pages bring new parallax elements; place them before they are seen.
    const mo = new MutationObserver(() => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(parallax);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    cleanups.push(() => mo.disconnect());

    // ── Tilt and magnetic buttons (mouse only) ──
    if (finePointer) {
      let tilted: HTMLElement | null = null;
      let magnet: HTMLElement | null = null;
      const resetTilt = (el: HTMLElement) => {
        el.style.transform = "";
        el.style.setProperty("--go", "0");
      };
      on(document, "pointermove", (ev) => {
        const e = ev as PointerEvent;
        mouse = { x: e.clientX, y: e.clientY };
        const target = e.target instanceof Element ? e.target : null;

        const t = target?.closest<HTMLElement>("[data-tilt]") ?? null;
        if (tilted && tilted !== t) resetTilt(tilted);
        tilted = t;
        if (t) {
          const r = t.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width;
          const py = (e.clientY - r.top) / r.height;
          const s = Number(t.dataset.tilt) || 8;
          t.style.transform = `perspective(1000px) rotateX(${((0.5 - py) * s).toFixed(2)}deg) rotateY(${((px - 0.5) * s).toFixed(2)}deg) translateY(-4px)`;
          t.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
          t.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
          t.style.setProperty("--go", "1");
        }

        const m = target?.closest<HTMLElement>("[data-mag]") ?? null;
        if (magnet && magnet !== m) magnet.style.translate = "";
        magnet = m;
        if (m) {
          const r = m.getBoundingClientRect();
          m.style.translate = `${((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1)}px ${((e.clientY - r.top - r.height / 2) * 0.35).toFixed(1)}px`;
        }
      });
      on(document.documentElement, "pointerleave", () => {
        if (tilted) resetTilt(tilted);
        if (magnet) magnet.style.translate = "";
        tilted = magnet = null;
        mouse = null;
      });
    }

    return () => cleanups.forEach((f) => f());
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-screen w-screen"
    />
  );
}
