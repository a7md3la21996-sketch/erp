import { Component, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SystemConfigProvider } from './contexts/SystemConfigContext';
import { ToastProvider } from './contexts/ToastContext';
import { ProtectedRoute } from './components/auth/PermissionGate';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/auth/LoginPage';
import { P } from './config/roles';
import { Button } from './components/ui';
import './i18n';

// Lazy-loaded pages
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const ContactsPage = lazy(() => import('./pages/ContactsPage'));
const OpportunitiesPage = lazy(() => import('./pages/crm/OpportunitiesPage'));
const LeadPoolPage = lazy(() => import('./pages/crm/LeadPoolPage'));
const ActivitiesPage = lazy(() => import('./pages/ActivitiesPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const PerformancePage = lazy(() => import('./pages/PerformancePage'));
const FinancePage = lazy(() => import('./pages/finance/FinancePage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const EmployeesPage = lazy(() => import('./pages/hr/EmployeesPage'));
const HRPoliciesPage = lazy(() => import('./pages/hr/HRPoliciesPage'));
const AttendancePage = lazy(() => import('./pages/hr/AttendancePage'));
const LeavePage = lazy(() => import('./pages/hr/LeavePage'));
const PayrollPage = lazy(() => import('./pages/hr/PayrollPage'));
const CompetenciesPage = lazy(() => import('./pages/hr/CompetenciesPage'));
const RecruitmentPage = lazy(() => import('./pages/hr/RecruitmentPage'));
const DisciplinaryPage = lazy(() => import('./pages/hr/DisciplinaryPage'));
const TrainingPage = lazy(() => import('./pages/hr/TrainingPage'));
const SelfServicePage = lazy(() => import('./pages/hr/SelfServicePage'));
const AssetsPage = lazy(() => import('./pages/hr/AssetsPage'));
const OnboardingPage = lazy(() => import('./pages/hr/OnboardingPage'));
const OperationsPage = lazy(() => import('./pages/operations/OperationsPage'));
const AuditLogPage = lazy(() => import('./pages/settings/AuditLogPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const MarketingPage = lazy(() => import('./pages/MarketingPage'));
const SystemConfigPage = lazy(() => import('./pages/settings/SystemConfigPage'));
const UserTrackingPage = lazy(() => import('./pages/settings/UserTrackingPage'));
const DealsPage = lazy(() => import('./pages/sales/DealsPage'));
const CommissionsPage = lazy(() => import('./pages/sales/CommissionsPage'));
const ProjectsPage = lazy(() => import('./pages/real-estate/ProjectsPage'));
const UnitsPage = lazy(() => import('./pages/real-estate/UnitsPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-[60vh] flex-col gap-3">
      <div className="w-8 h-8 border-[3px] border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
    </div>
  );
}

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-surface-bg-dark flex-col gap-4 p-6">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-2xl">!</div>
          <h2 className="text-content dark:text-content-dark m-0 text-lg">Something went wrong</h2>
          <p className="text-content-muted dark:text-content-muted-dark m-0 text-[13px] text-center max-w-[400px]">{this.state.error?.message}</p>
          <Button size="sm" className="mt-2" onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/dashboard'; }}>
            Back to Dashboard
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ComingSoon({ title }) {
  return (
    <div className="flex items-center justify-center h-[50vh]">
      <div className="text-center">
        <h2 className="text-content dark:text-content-dark m-0 mb-2">{title}</h2>
        <p className="text-content-muted dark:text-content-muted-dark">Coming soon — Next phase</p>
      </div>
    </div>
  );
}

function AuthRedirect() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-surface-bg-dark flex-col gap-4">
      <div className="w-10 h-10 border-[3px] border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
      <p className="text-content-muted-dark text-sm m-0">Loading...</p>
    </div>
  );
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <SystemConfigProvider>
        <AuthProvider>
          <ToastProvider>
            <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<AuthRedirect />} />
              <Route path="/" element={<AuthRedirect />} />
              <Route element={<ProtectedRoute permission={P.DASHBOARD}><MainLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/contacts" element={<ContactsPage />} />
                <Route path="/activities" element={<ActivitiesPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/crm/opportunities" element={<OpportunitiesPage />} />
                <Route path="/crm/lead-pool" element={<LeadPoolPage />} />
                <Route path="/performance" element={<PerformancePage />} />
                <Route path="/sales/deals" element={<DealsPage />} />
                <Route path="/sales/commissions" element={<CommissionsPage />} />
                <Route path="/sales/targets" element={<Navigate to="/reports" replace />} />
                <Route path="/sales/*" element={<DealsPage />} />
                <Route path="/finance" element={<FinancePage />} />
                <Route path="/finance/*" element={<FinancePage />} />
                <Route path="/hr/employees" element={<EmployeesPage />} />
                <Route path="/hr/policies" element={<HRPoliciesPage />} />
                <Route path="/hr/attendance" element={<AttendancePage />} />
                <Route path="/hr/leave" element={<LeavePage />} />
                <Route path="/hr/payroll" element={<PayrollPage />} />
                <Route path="/hr/competencies" element={<CompetenciesPage />} />
                <Route path="/hr/recruitment" element={<RecruitmentPage />} />
                <Route path="/hr/disciplinary" element={<DisciplinaryPage />} />
                <Route path="/hr/training" element={<TrainingPage />} />
                <Route path="/hr/self-service" element={<SelfServicePage />} />
                <Route path="/hr/assets" element={<AssetsPage />} />
                <Route path="/hr/onboarding" element={<OnboardingPage />} />
                <Route path="/hr/*" element={<ComingSoon title="HR" />} />
                <Route path="/operations" element={<OperationsPage />} />
                <Route path="/operations/*" element={<OperationsPage />} />
                <Route path="/real-estate/projects" element={<ProjectsPage />} />
                <Route path="/real-estate/units" element={<UnitsPage />} />
                <Route path="/real-estate/*" element={<ProjectsPage />} />
                <Route path="/marketing" element={<MarketingPage />} />
                <Route path="/marketing/*" element={<MarketingPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/chat" element={<ComingSoon title="Chat" />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/settings/general" element={<SettingsPage />} />
                <Route path="/settings/audit-log" element={<AuditLogPage />} />
                <Route path="/settings/system" element={<SystemConfigPage />} />
                <Route path="/settings/tracking" element={<UserTrackingPage />} />
                <Route path="/settings/*" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
            </Suspense>
            </ErrorBoundary>
          </ToastProvider>
        </AuthProvider>
        </SystemConfigProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
