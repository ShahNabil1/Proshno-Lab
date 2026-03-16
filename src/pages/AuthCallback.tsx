import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const OAUTH_COMPLETE_MESSAGE_TYPE = "oauth-complete";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let isActive = true;

    const completeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!isActive || !session) return;

      if (window.opener && window.opener !== window) {
        window.opener.postMessage({ type: OAUTH_COMPLETE_MESSAGE_TYPE }, window.location.origin);
        window.close();
        return;
      }

      navigate("/dashboard", { replace: true });
    };

    void completeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" || !session) return;

      if (window.opener && window.opener !== window) {
        window.opener.postMessage({ type: OAUTH_COMPLETE_MESSAGE_TYPE }, window.location.origin);
        window.close();
        return;
      }

      navigate("/dashboard", { replace: true });
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">লগইন সম্পন্ন হচ্ছে...</p>
    </div>
  );
}
