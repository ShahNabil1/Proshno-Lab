import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Admin / developer accounts have full access to every class & subject
 * (existing and future ones) without needing any subscription.
 * Mirrors the server-side rule in public.can_read_question().
 */
export function useUnlimitedAccess() {
  const { user } = useAuth();
  const [unlimited, setUnlimited] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) { setUnlimited(false); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      if (cancelled) return;
      setUnlimited(!!data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  return { unlimited, loading };
}
