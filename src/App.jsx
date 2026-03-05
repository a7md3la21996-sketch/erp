import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/auth/PermissionGate';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import ContactsPage from './pages/crm/ContactsPage';
import { P } from './config/roles';
import './i18n';

function ComingSoon({ title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🚧</div>
        <h2 style={{ color: '#374151', margin: '0 0 8px' }}>{title}</h2>
        <p style={{ color: '#9ca3af' }}>قيد التطوير — سيتم بناؤه في المرحلة القادمة</p>
      </div>
    </div>
  );
}

function AuthRedirect() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<AuthRedirect />} />
            <Route element={<ProtectedRoute permission={P.DASHBOARD}><MainLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* CRM */}
              <Route path="/crm/contacts" element={<ContactsPage />} />
              <Route path="/crm/opportunities" element={<ComingSoon title="الفرص البيعية - Opportunities" />} />
              <Route path="/crm/lead-pool" element={<ComingSoon title="بركة الليدز - Lead Pool" />} />

              {/* Real Estate */}
              <Route path="/real-estate/*" element={<ComingSoon title="العقارات - Real Estate" />} />

              {/* Sales */}
              <Route path="/sales/*" element={<ComingSoon title="المبيعات - Sales" />} />

              {/* Marketing */}
              <Route path="/marketing/*" element={<ComingSoon title="التسويق - Marketing" />} />

              {/* HR */}
              <Route path="/hr/*" element={<ComingSoon title="الموارد البشرية - HR" />} />

              {/* Finance */}
              <Route path="/finance/*" element={<ComingSoon title="المالية - Finance" />} />

              {/* Others */}
              <Route path="/tasks" element={<ComingSoon title="المهام - Tasks" />} />
              <Route path="/calendar" element={<ComingSoon title="التقويم - Calendar" />} />
              <Route path="/chat" element={<ComingSoon title="الدردشة - Chat" />} />
              <Route path="/reports" element={<ComingSoon title="التقارير - Reports" />} />
              <Route path="/settings/*" element={<ComingSoon title="الإعدادات - Settings" />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
