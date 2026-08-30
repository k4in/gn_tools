import { useEffect, type RefObject } from "react";

/** Scrollt `ref` ins Sichtfeld, sobald der umgebende Tab aktiv wird. */
export function useScrollIntoViewWhenActive(
  isActive: boolean,
  ref: RefObject<HTMLElement | null>,
  block: ScrollLogicalPosition = "center",
  inline: ScrollLogicalPosition = "nearest",
) {
  useEffect(() => {
    if (!isActive) return;
    const id = requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ block, inline });
    });
    return () => cancelAnimationFrame(id);
  }, [isActive, ref, block, inline]);
}
