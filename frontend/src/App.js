import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Citizen from "./pages/Citizen";
import PlannerLayout from "./layouts/PlannerLayout";

import Overview from "./pages/planner/Overview";
import Spatial from "./pages/planner/Spatial";
import Analytics from "./pages/planner/Analytics";
import Forecast from "./pages/planner/Forecast";
import Sites from "./pages/planner/Sites";
import Logistics from "./pages/planner/Logistics";
import Simulator from "./pages/planner/Simulator";
import Reports from "./pages/planner/Reports";

function App() {
  return (
    <AuthProvider>
      <Toaster theme="dark" position="top-right" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/citizen"
            element={
              <ProtectedRoute>
                <Citizen />
              </ProtectedRoute>
            }
          />

          <Route
            path="/intelligence"
            element={
              <ProtectedRoute role="planner">
                <PlannerLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Overview />} />
            <Route path="spatial" element={<Spatial />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="forecast" element={<Forecast />} />
            <Route path="sites" element={<Sites />} />
            <Route path="logistics" element={<Logistics />} />
            <Route path="simulator" element={<Simulator />} />
            <Route path="reports" element={<Reports />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
