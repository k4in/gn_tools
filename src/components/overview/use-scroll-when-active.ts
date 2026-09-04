import { useEffect, type RefObject } from "react";

/** Scrollt `ref` ins Sichtfeld, sobald der Tab aktiv wird oder `trigger` sich ändert. */
export function useScrollIntoViewWhenActive(
  isActive: boolean,
  ref: RefObject<HTMLElement | null>,
  block: ScrollLogicalPosition = "center",
  inline: ScrollLogicalPosition = "nearest",
  trigger?: unknown,
) {
  useEffect(() => {
    if (!isActive) return;
    const id = requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ block, inline });
    });
    return () => cancelAnimationFrame(id);
  }, [isActive, ref, block, inline, trigger]);
}
