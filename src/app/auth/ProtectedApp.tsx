import { Navigate } from "react-router";
import { Root } from "../Root";
import { useAuth } from "./AuthProvider";

export function ProtectedApp() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full border-4 border-slate-700 border-t-cyan-400 animate-spin" />
          <p className="text-sm text-slate-300">Validando sesión segura...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Root />;
}
