import { useCallback, useRef } from "react";

/**
 * Material state layer + ripple for a pressable surface.
 *
 * Returns a `ripple()` handler to call from `onPointerDown`, and the element
 * that should be `position: relative; overflow: hidden` (which is usually the
 * same node). The ripple is a short-lived `<span>` positioned at the press
 * point and scaled to cover the surface, so it always completes inside the
 * element's own rounded clip instead of being cut off at the bounding box.
 *
 * Deliberately pointer-driven rather than CSS-only: a CSS `::after` cannot know
 * where the press landed, and a centred scale-up is what looked wrong on the
 * sidebar's wide, full-radius rows.
 */
export function useRipple() {
  const container = useRef<HTMLElement | null>(null);

  const ripple = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const host = container.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const rect = host.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Cover the farthest corner so the wave is fully gone by the clip edge.
    const radius = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y));

    const wave = document.createElement("span");
    wave.className = "state-ripple";
    wave.style.setProperty("--ripple-x", `${x}px`);
    wave.style.setProperty("--ripple-y", `${y}px`);
    wave.style.setProperty("--ripple-r", `${radius}px`);
    wave.addEventListener("animationend", () => wave.remove());
    host.appendChild(wave);
  }, []);

  return { ripple, rippleTarget: container };
}
