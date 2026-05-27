import { Routes, Route, Navigate } from "react-router-dom";

import Home from "./pages/Home";
import Register from "./pages/Register";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

import Dashboard from "./pages/Dashboard";
import Vote from "./pages/Vote";
import Feedback from "./pages/Feedback";
import VerifyReceipt from "./pages/VerifyReceipt";

import RequireAdmin from "./routes/RequireAdmin";
import AdminPanel from "./pages/AdminPanel";

export default function App() {
  return (
    <Routes>
      {/* public */}
      <Route path="/" element={<Home />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* voter */}
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/vote" element={<Vote />} />
      <Route path="/feedback" element={<Feedback />} />
      <Route path="/verify" element={<VerifyReceipt />} />

      {/* admin */}
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminPanel />
          </RequireAdmin>
        }
      />

      {/* fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
