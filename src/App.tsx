import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider }    from './contexts/AuthContext';
import { ProtectedRoute }  from './components/ProtectedRoute';
import Home                from './Home';
import Login               from './pages/Login';
import MultiUserPlan        from './dashboards/MultiUserPlan';
import PortalC              from './dashboards/PortalC';
import PortalB              from './dashboards/PortalB';
import PortalA              from './dashboards/PortalA';
import KartingDashboard     from './dashboards/KartingDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Protected — auth required */}
          <Route path="/" element={
            <ProtectedRoute><Home /></ProtectedRoute>
          } />
          <Route path="/multi-user-plan" element={
            <ProtectedRoute><MultiUserPlan /></ProtectedRoute>
          } />
          <Route path="/live" element={
            <ProtectedRoute><PortalC /></ProtectedRoute>
          } />
          <Route path="/parent" element={
            <ProtectedRoute><PortalB /></ProtectedRoute>
          } />
          <Route path="/cockpit" element={
            <ProtectedRoute><PortalA /></ProtectedRoute>
          } />
          {/* Module 13 — Go-Karting */}
          <Route path="/karting"                  element={<ProtectedRoute><KartingDashboard /></ProtectedRoute>} />
          <Route path="/karting/races"             element={<ProtectedRoute><KartingDashboard /></ProtectedRoute>} />
          <Route path="/karting/sessions"          element={<ProtectedRoute><KartingDashboard /></ProtectedRoute>} />
          <Route path="/karting/kart"              element={<ProtectedRoute><KartingDashboard /></ProtectedRoute>} />
          <Route path="/karting/competition-guide" element={<ProtectedRoute><KartingDashboard /></ProtectedRoute>} />
          {/* New routes added here as Cowork drops dashboards in */}
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
