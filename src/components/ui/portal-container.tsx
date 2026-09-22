import * as React from "react";

/**
 * A fullscreen element is the only thing the browser paints, so a portal that
 * lives on `document.body` (the Radix default) is invisible and unclickable
 * while the smartboard is full screen. Wrapping a subtree in this provider
 * sends every popover, dialog and menu into the fullscreen element instead.
 */
const PortalContainerContext = React.createContext<HTMLElement | null>(null);

export function PortalContainerProvider({
  container,
  children,
}: {
  container: HTMLElement | null;
  children: React.ReactNode;
}) {
  return <PortalContainerContext.Provider value={container}>{children}</PortalContainerContext.Provider>;
}

/** Portal target for the current subtree, or `undefined` to use document.body. */
export function usePortalContainer(): HTMLElement | undefined {
  return React.useContext(PortalContainerContext) ?? undefined;
}
