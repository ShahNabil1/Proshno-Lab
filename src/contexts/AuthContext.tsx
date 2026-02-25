import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/auth/callback",
        skipBrowserRedirect: true,
      },
    });

    if (error || !data?.url) return;

    const popup = window.open(data.url, "oauth", "width=500,height=600");

    if (!popup) {
      // Fallback to redirect if popup blocked
      window.location.href = data.url;
      return;
    }

    const messageHandler = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.data?.type === "oauth-complete") {
        popup?.close();
        window.removeEventListener("message", messageHandler);
        window.location.reload();
      }
    };
    window.addEventListener("message", messageHandler);

    // Also poll for popup close (user may complete OAuth without postMessage)
    const pollTimer = setInterval(async () => {
      if (popup.closed) {
        clearInterval(pollTimer);
        window.removeEventListener("message", messageHandler);
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSession(session);
          setUser(session.user);
        }
      }
    }, 500);
  };

  const signOut = async () => {
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
