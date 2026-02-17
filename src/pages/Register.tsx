import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function Register() {
  const { user, loading, signInWithGoogle } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/profile" replace />;

  // Redirect to login since we only use Google OAuth
  return <Navigate to="/login" replace />;
}
