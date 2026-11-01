import { useEffect, useEffectEvent } from "react";

/**
 * While `locked`, everything on the page but `keep()` ignores the user: `inert`
 * on each element beside it (and beside each of its ancestors) stops clicks,
 * drags and keyboard focus, and the page-locked class dims them
 * (styles/ui.css). Toasts (aria-live) are left alone.
 */
export function usePageLock(
  locked: boolean,
  keep: () => HTMLElement | null | undefined,
) {
  const getKept = useEffectEvent(keep);
  useEffect(() => {
    const kept = getKept();
    if (!locked || !kept) return;
    const others: HTMLElement[] = [];
    for (
      let node = kept;
      node !== document.body && node.parentElement;
      node = node.parentElement
    ) {
      for (const sibling of node.parentElement.children) {
        if (sibling === node || !(sibling instanceof HTMLElement)) continue;
        if (sibling.inert || sibling.matches("[aria-live], script, style"))
          continue;
        sibling.inert = true;
        sibling.classList.add("page-locked");
        others.push(sibling);
      }
    }
    return () => {
      for (const el of others) {
        el.inert = false;
        el.classList.remove("page-locked");
      }
    };
  }, [locked]);
}
