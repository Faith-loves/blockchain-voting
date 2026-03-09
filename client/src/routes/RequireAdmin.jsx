import { Navigate } from "react-router-dom";
import { isLoggedIn, isAdmin } from "../utils/auth";

export default function RequireAdmin({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  if (!isAdmin()) return <Navigate to="/dashboard" replace />;
  return children;
}