import * as React from "react";

/** State of the dashboard navigation drawer, shared with the page that opens it. */
export interface DashboardNavState {
  open: boolean;
  toggle: () => void;
}

/**
 * Lets a page rendered inside the dashboard (the smartboard) open the left
 * navigation drawer from its own header and make room for it while it is open.
 * `null` when the page is rendered without dashboard chrome.
 */
const DashboardNavContext = React.createContext<DashboardNavState | null>(null);

export function DashboardNavProvider({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ open, toggle: onToggle }), [open, onToggle]);
  return <DashboardNavContext.Provider value={value}>{children}</DashboardNavContext.Provider>;
}

export function useDashboardNav(): DashboardNavState | null {
  return React.useContext(DashboardNavContext);
}