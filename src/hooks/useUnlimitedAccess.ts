import { useNoPackagePreview } from "@/lib/adminExperiencePreview";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isLocalMockAdminEnabled } from "@/lib/localDevAuth";

/**
 * Admin / developer accounts have full access to every class & subject
 * (existing and future ones) without needing any subscription.
 * Mirrors the server-side rule in public.can_read_question().
 */
export function useUnlimitedAccess() {
  const { user } = useAuth();
  const noPackagePreview = useNoPackagePreview(user?.id);
  const localMockAdmin = isLocalMockAdminEnabled();
  const [unlimited, setUnlimited] = useState(localMockAdmin);
  const [loading, setLoading] = useState(!localMockAdmin);

  useEffect(() => {
    if (localMockAdmin) {
      setUnlimited(true);
      setLoading(false);
      return;
    }

    if (!user?.id) { setUnlimited(false); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: user.id, _role: "developer" }),
    ]).then(([adminResult, developerResult]) => {
      if (cancelled) return;
      setUnlimited(!!adminResult.data || !!developerResult.data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user?.id, localMockAdmin]);

  return { unlimited: unlimited && !noPackagePreview, loading, noPackagePreview: unlimited && noPackagePreview };
}
