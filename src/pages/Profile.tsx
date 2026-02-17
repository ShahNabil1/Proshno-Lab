import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { User, Mail, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Profile() {
  const { user, loading, signOut } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const avatarUrl = user.user_metadata?.avatar_url;
  const fullName = user.user_metadata?.full_name || "ব্যবহারকারী";
  const email = user.email;

  return (
    <div className="py-10 pt-28">
      <div className="container max-w-3xl">
        <div className="bg-card rounded-2xl shadow-card p-8 text-center">
          {avatarUrl ? (
            <img src={avatarUrl} alt={fullName} className="w-24 h-24 rounded-full mx-auto mb-4 object-cover ring-4 ring-primary/20" />
          ) : (
            <div className="w-24 h-24 rounded-full gradient-green mx-auto flex items-center justify-center mb-4">
              <User className="w-12 h-12 text-primary-foreground" />
            </div>
          )}
          <h1 className="font-heading text-2xl font-bold text-foreground">{fullName}</h1>
          <div className="flex items-center justify-center gap-2 text-muted-foreground mt-1">
            <Mail className="w-4 h-4" />
            <span className="text-sm">{email}</span>
          </div>

          <Button onClick={signOut} variant="outline" size="sm" className="mt-6 gap-2">
            <LogOut className="w-4 h-4" /> লগআউট
          </Button>
        </div>
      </div>
    </div>
  );
}
