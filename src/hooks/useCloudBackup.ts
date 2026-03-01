import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useCloudBackup() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "cloud_backup_enabled")
      .maybeSingle()
      .then(({ data }) => {
        setEnabled(data?.value === true);
        setLoading(false);
      });
  }, []);

  return { cloudBackupEnabled: enabled, loading };
}
