import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();

  if (loading || user === null) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="font-mono-data text-xs uppercase tracking-widest text-cyan-400 animate-pulse">
          Initialising SPARK…
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === "planner" ? "/intelligence" : "/citizen"} replace />;
  }
  return children;
}
