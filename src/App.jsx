import { Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import SessionPage from './pages/SessionPage.jsx';
export default function App(){return <Routes><Route path='/' element={<LandingPage/>}/><Route path='/session/:roomId' element={<SessionPage/>}/><Route path='*' element={<Navigate to='/' replace/>}/></Routes>}
