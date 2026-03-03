import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated } from './api/client';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Targets from './pages/Targets';
import Jobs from './pages/Jobs';
import Data from './pages/Data';

export default function App() {
    const [authed, setAuthed] = useState(isAuthenticated());

    if (!authed) {
        return <Login onLogin={() => setAuthed(true)} />;
    }

    return (
        <BrowserRouter>
            <Layout onLogout={() => { localStorage.removeItem('ss_api_key'); setAuthed(false); }}>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/targets" element={<Targets />} />
                    <Route path="/jobs" element={<Jobs />} />
                    <Route path="/data" element={<Data />} />
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </Layout>
        </BrowserRouter>
    );
}
