import { Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import SessionPage from './pages/SessionPage.jsx';
import AboutPage from './pages/AboutPage.jsx';

export default function App() {
  return (
    <Routes>
      {/* Public homepage */}
      <Route path="/" element={<AboutPage />} />
      {/* Create or join a planning poker session */}
      <Route path="/start" element={<LandingPage />} />
      <Route path="/session/:roomId" element={<SessionPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/About.html" element={<AboutPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
