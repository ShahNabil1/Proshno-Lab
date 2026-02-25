import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function AuthCallback() {
  useEffect(() => {
    // Wait for Supabase to process the OAuth tokens from the URL hash
    supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        // Notify the opener window and close this popup
        if (window.opener) {
          window.opener.postMessage({ type: "oauth-complete" }, window.location.origin);
          window.close();
        } else {
          // Not a popup, redirect to dashboard
          window.location.href = "/dashboard";
        }
      }
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">লগইন হচ্ছে...</p>
    </div>
  );
}
