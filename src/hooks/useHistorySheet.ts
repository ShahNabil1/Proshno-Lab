import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** Give a transient sheet its own history entry so device Back closes it. */
export function useHistorySheet(name: string): [boolean, (open: boolean) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const open = location.state?.paperSheet === name;
  const setOpen = useCallback((next: boolean) => {
    if (next === open) return;
    if (next) {
      navigate(`${location.pathname}${location.search}${location.hash}`, {
        state: { ...location.state, paperSheet: name }, preventScrollReset: true,
      });
    } else {
      navigate(-1);
    }
  }, [open, location, name, navigate]);
  return [open, setOpen];
}
