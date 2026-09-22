import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { analytics } from "@/lib/analytics";
import {
  createLocalMockAdmin,
  disableLocalMockAdmin,
  isLocalMockAdminEnabled,
} from "@/lib/localDevAuth";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const OAUTH_COMPLETE_MESSAGE_TYPE = "oauth-complete";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const syncSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    setUser(session?.user ?? null);
    setLoading(false);
    return session;
  };

  useEffect(() => {
    if (isLocalMockAdminEnabled()) {
      // Prefer a real Supabase session when one exists. The local UI mock only
      // bypasses route guards and cannot read RLS-protected admin data.
      void supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? createLocalMockAdmin());
        setLoading(false);
      });
      return;
    }

    void syncSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === "SIGNED_IN") {
        analytics.login("google");
      } else if (event === "SIGNED_OUT") {
        analytics.buttonClick("sign_out", "auth");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const redirectTo = `${window.location.origin}/auth/callback`;
    const isEmbedded = window.self !== window.top;

    if (!isEmbedded) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
      return;
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;
    if (!data?.url) return;

    const popup = window.open(data.url, "google-oauth", "popup=yes,width=520,height=720");

    if (!popup) {
      window.alert("সাইন-ইন করতে popup allow করুন, তারপর আবার চেষ্টা করুন।");
      return;
    }

    const cleanup = () => {
      window.removeEventListener("message", handleMessage);
      window.clearInterval(popupWatcher);
    };

    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== OAUTH_COMPLETE_MESSAGE_TYPE) {
        return;
      }

      cleanup();
      popup.close();
      await syncSession();
    };

    const popupWatcher = window.setInterval(() => {
      if (popup.closed) {
        cleanup();
      }
    }, 500);

    window.addEventListener("message", handleMessage);
  };

  const signOut = async () => {
    if (isLocalMockAdminEnabled()) {
      disableLocalMockAdmin();
      setSession(null);
      setUser(null);
      return;
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
