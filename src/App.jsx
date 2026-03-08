import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/auth/PermissionGate';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import ContactsPage from './pages/crm/ContactsPage';
import OpportunitiesPage from './pages/crm/OpportunitiesPage';
import SettingsPage from './pages/settings/SettingsPage';
import HRPoliciesPage from './pages/hr/HRPoliciesPage';
import EmployeesPage from './pages/hr/EmployeesPage';
import AttendancePage from './pages/hr/AttendancePage';
import LeavePage from './pages/hr/LeavePage';
import PayrollPage from './pages/hr/PayrollPage';
import CompetenciesPage from './pages/hr/CompetenciesPage';
import PerformancePage from './pages/PerformancePage';
import RecruitmentPage from './pages/hr/RecruitmentPage';
import DisciplinaryPage from './pages/hr/DisciplinaryPage';
import TrainingPage from './pages/hr/TrainingPage';
import SelfServicePage from './pages/hr/SelfServicePage';
import AssetsPage from './pages/hr/AssetsPage';
import OnboardingPage from './pages/hr/OnboardingPage';
import LeadPoolPage from './pages/crm/LeadPoolPage';
import TasksPage from './pages/TasksPage';
import ActivitiesPage from './pages/ActivitiesPage';
import FinancePage from './pages/finance/FinancePage';
import { P } from './config/roles';
import './i18n';

function ComingSoon({ title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(74,122,171,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><span style={{ fontSize: 24 }}>⚙</span></div>
        <h2 style={{ color: '#374151', margin: '0 0 8px' }}>{title}</h2>
        <p style={{ color: '#9ca3af' }}>Coming soon — Next phase</p>
      </div>
    </div>
  );
}

function AuthRedirect() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0F1E2D', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 40, height: 40, border: '3px solid rgba(74,122,171,0.3)', borderTop: '3px solid #4A7AAB', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color: '#8BA8C8', fontSize: 14, margin: 0 }}>Loading...</p>
    </div>
  );
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
            <Route path="/" element={<AuthRedirect />} />
            <Route element={<ProtectedRoute permission={P.DASHBOARD}><MainLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/crm/contacts" element={<ContactsPage />} />
              <Route path="/crm/opportunities" element={<OpportunitiesPage />} />
              <Route path="/activities" element={<ActivitiesPage />} />
              <Route path="/crm/lead-pool" element={<LeadPoolPage />} />
              <Route path="/real-estate/*" element={<ComingSoon title="Real Estate" />} />
              <Route path="/sales/*" element={<ComingSoon title="Sales" />} />
              <Route path="/marketing/*" element={<ComingSoon title="Marketing" />} />
              <Route path="/hr/employees" element={<EmployeesPage />} />
              <Route path="/hr/policies" element={<HRPoliciesPage />} />
              <Route path="/hr/attendance" element={<AttendancePage />} />
              <Route path="/hr/leave" element={<LeavePage />} />
              <Route path="/hr/payroll" element={<PayrollPage />} />
              <Route path="/hr/competencies" element={<CompetenciesPage />} />
              <Route path="/performance" element={<PerformancePage />} />
              <Route path="/hr/recruitment" element={<RecruitmentPage />} />
              <Route path="/hr/disciplinary" element={<DisciplinaryPage />} />
              <Route path="/hr/training" element={<TrainingPage />} />
              <Route path="/hr/self-service" element={<SelfServicePage />} />
              <Route path="/hr/assets" element={<AssetsPage />} />
              <Route path="/hr/onboarding" element={<OnboardingPage />} />
              <Route path="/hr/*" element={<ComingSoon title="HR" />} />
              <Route path="/finance" element={<FinancePage />} />
              <Route path="/finance/*" element={<FinancePage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/calendar" element={<ComingSoon title="Calendar" />} />
              <Route path="/chat" element={<ComingSoon title="Chat" />} />
              <Route path="/reports" element={<ComingSoon title="Reports" />} />
              <Route path="/settings/general" element={<SettingsPage />} />
              <Route path="/settings/*" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
