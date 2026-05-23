import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home          from './Home';
import MultiUserPlan  from './dashboards/MultiUserPlan';
import PortalC        from './dashboards/PortalC';
import PortalB        from './dashboards/PortalB';
import PortalA        from './dashboards/PortalA';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"              element={<Home />} />
        <Route path="/multi-user-plan" element={<MultiUserPlan />} />
        <Route path="/live"          element={<PortalC />} />
        <Route path="/parent"        element={<PortalB />} />
        <Route path="/cockpit"       element={<PortalA />} />
        {/* New routes added here as Cowork drops dashboards in */}
      </Routes>
    </BrowserRouter>
  );
}
