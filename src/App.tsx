import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './Home';
import MultiUserPlan from './dashboards/MultiUserPlan';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/multi-user-plan" element={<MultiUserPlan />} />
        {/* New routes added here as Cowork drops dashboards in */}
      </Routes>
    </BrowserRouter>
  );
}
