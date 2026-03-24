import { Component, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SystemConfigProvider } from './contexts/SystemConfigContext';
import { ToastProvider } from './contexts/ToastContext';
import { ProtectedRoute } from './components/auth/PermissionGate';
import MainLayout from './components/layout/MainLayout';
import KeyboardShortcutsProvider from './components/layout/KeyboardShortcutsProvider';
import LoginPage from './pages/auth/LoginPage';
import { P } from './config/roles';
import { Button } from './components/ui';
import { PageSkeleton } from './components/ui/PageSkeletons';
import ErrorBoundary from './components/ErrorBoundary';

import ConnectionStatus from './components/ui/ConnectionStatus';
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
const ExpenseClaimsPage = lazy(() => import('./pages/hr/ExpenseClaimsPage'));
const OperationsPage = lazy(() => import('./pages/operations/OperationsPage'));
const AuditLogPage = lazy(() => import('./pages/settings/AuditLogPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const MarketingPage = lazy(() => import('./pages/MarketingPage'));
const SystemConfigPage = lazy(() => import('./pages/settings/SystemConfigPage'));
const UserTrackingPage = lazy(() => import('./pages/settings/UserTrackingPage'));
const DealsPage = lazy(() => import('./pages/sales/DealsPage'));
const CommissionsPage = lazy(() => import('./pages/sales/CommissionsPage'));
const SalesForecastPage = lazy(() => import('./pages/sales/SalesForecastPage'));
const ProjectsPage = lazy(() => import('./pages/real-estate/ProjectsPage'));
const UnitsPage = lazy(() => import('./pages/real-estate/UnitsPage'));
const UsersPage = lazy(() => import('./pages/settings/UsersPage'));
const TriggersPage = lazy(() => import('./pages/settings/TriggersPage'));
const CustomFieldsPage = lazy(() => import('./pages/settings/CustomFieldsPage'));
const BackupPage = lazy(() => import('./pages/settings/BackupPage'));
const ScheduledReportsPage = lazy(() => import('./pages/settings/ScheduledReportsPage'));
const SMSTemplatesPage = lazy(() => import('./pages/settings/SMSTemplatesPage'));
const PrintSettingsPage = lazy(() => import('./pages/settings/PrintSettingsPage'));
const ChatInboxPage = lazy(() => import('./pages/ChatInboxPage'));
const EmailPage = lazy(() => import('./pages/EmailPage'));
const WhatsAppPage = lazy(() => import('./pages/WhatsAppPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const ChartBuilderPage = lazy(() => import('./pages/ChartBuilderPage'));
const AnnouncementsPage = lazy(() => import('./pages/AnnouncementsPage'));
const GoalsPage = lazy(() => import('./pages/GoalsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const HeatmapPage = lazy(() => import('./pages/HeatmapPage'));
const SecurityPage = lazy(() => import('./pages/settings/SecurityPage'));
const WorkflowBuilderPage = lazy(() => import('./pages/settings/WorkflowBuilderPage'));
const SystemHealthPage = lazy(() => import('./pages/settings/SystemHealthPage'));
const APIDocsPage = lazy(() => import('./pages/settings/APIDocsPage'));
const ExportImportHistoryPage = lazy(() => import('./pages/settings/ExportImportHistoryPage'));
const ChangelogPage = lazy(() => import('./pages/ChangelogPage'));
const RolesPage = lazy(() => import('./pages/settings/RolesPage'));
const SLAManagementPage = lazy(() => import('./pages/settings/SLAManagementPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const HelpCenterPage = lazy(() => import('./pages/HelpCenterPage'));
const KnowledgeBasePage = lazy(() => import('./pages/KnowledgeBasePage'));
const ComparisonReportsPage = lazy(() => import('./pages/ComparisonReportsPage'));
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage'));


function PageLoader() {
  return <PageSkeleton hasKpis={false} tableRows={5} tableCols={4} />;
}

// Top-level crash fallback (last resort)
class AppErrorBoundary extends Component {
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

/** Wraps a page element with a per-route ErrorBoundary */
function Guarded({ children }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
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
    <div className="flex items-center justify-center h-screen bg-surface-bg dark:bg-surface-bg-dark flex-col gap-4">
      <div className="w-10 h-10 border-[3px] border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
      <p className="text-content-muted dark:text-content-muted-dark text-sm m-0">Loading...</p>
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
            <AppErrorBoundary>
            <KeyboardShortcutsProvider>
            <ConnectionStatus />

            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<AuthRedirect />} />
              <Route path="/" element={<AuthRedirect />} />
              <Route element={<ProtectedRoute permission={P.DASHBOARD}><MainLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Guarded><DashboardPage /></Guarded>} />
                <Route path="/contacts" element={<Guarded><ContactsPage /></Guarded>} />
                <Route path="/activities" element={<Guarded><ActivitiesPage /></Guarded>} />
                <Route path="/tasks" element={<Guarded><TasksPage /></Guarded>} />
                <Route path="/crm/opportunities" element={<Guarded><OpportunitiesPage /></Guarded>} />
                <Route path="/crm/lead-pool" element={<Guarded><LeadPoolPage /></Guarded>} />
                <Route path="/hr/performance" element={<Guarded><PerformancePage /></Guarded>} />
                <Route path="/hr/goals" element={<Guarded><GoalsPage /></Guarded>} />
                <Route path="/performance" element={<Navigate to="/hr/performance" replace />} />
                <Route path="/goals" element={<Navigate to="/hr/goals" replace />} />
                <Route path="/sales/deals" element={<Guarded><DealsPage /></Guarded>} />
                <Route path="/sales/commissions" element={<Guarded><CommissionsPage /></Guarded>} />
                <Route path="/sales/forecast" element={<Guarded><SalesForecastPage /></Guarded>} />
                <Route path="/sales/targets" element={<Navigate to="/reports" replace />} />
                <Route path="/sales/*" element={<Guarded><DealsPage /></Guarded>} />
                <Route path="/finance" element={<Guarded><FinancePage /></Guarded>} />
                <Route path="/finance/*" element={<Guarded><FinancePage /></Guarded>} />
                <Route path="/hr/employees" element={<Guarded><EmployeesPage /></Guarded>} />
                <Route path="/hr/policies" element={<Guarded><HRPoliciesPage /></Guarded>} />
                <Route path="/hr/attendance" element={<Guarded><AttendancePage /></Guarded>} />
                <Route path="/hr/leave" element={<Guarded><LeavePage /></Guarded>} />
                <Route path="/hr/payroll" element={<Guarded><PayrollPage /></Guarded>} />
                <Route path="/hr/competencies" element={<Guarded><CompetenciesPage /></Guarded>} />
                <Route path="/hr/recruitment" element={<Guarded><RecruitmentPage /></Guarded>} />
                <Route path="/hr/disciplinary" element={<Guarded><DisciplinaryPage /></Guarded>} />
                <Route path="/hr/training" element={<Guarded><TrainingPage /></Guarded>} />
                <Route path="/hr/self-service" element={<Guarded><SelfServicePage /></Guarded>} />
                <Route path="/hr/assets" element={<Guarded><AssetsPage /></Guarded>} />
                <Route path="/hr/onboarding" element={<Guarded><OnboardingPage /></Guarded>} />
                <Route path="/hr/expense-claims" element={<Guarded><ExpenseClaimsPage /></Guarded>} />
                <Route path="/hr/*" element={<ComingSoon title="HR" />} />
                <Route path="/operations" element={<Guarded><OperationsPage /></Guarded>} />
                <Route path="/operations/*" element={<Guarded><OperationsPage /></Guarded>} />
                <Route path="/real-estate/projects" element={<Guarded><ProjectsPage /></Guarded>} />
                <Route path="/real-estate/units" element={<Guarded><UnitsPage /></Guarded>} />
                <Route path="/real-estate/*" element={<Guarded><ProjectsPage /></Guarded>} />
                <Route path="/marketing" element={<Guarded><MarketingPage /></Guarded>} />
                <Route path="/marketing/*" element={<Guarded><MarketingPage /></Guarded>} />
                <Route path="/calendar" element={<Guarded><CalendarPage /></Guarded>} />
                <Route path="/chat" element={<Guarded><ChatInboxPage /></Guarded>} />
                <Route path="/email" element={<Guarded><EmailPage /></Guarded>} />
                <Route path="/whatsapp" element={<Guarded><WhatsAppPage /></Guarded>} />
                <Route path="/reports" element={<Guarded><ReportsPage /></Guarded>} />
                <Route path="/comparison" element={<Navigate to="/reports?tab=comparison" replace />} />
                <Route path="/approvals" element={<Guarded><ApprovalsPage /></Guarded>} />
                <Route path="/analytics" element={<Navigate to="/reports?tab=analytics" replace />} />
                <Route path="/heatmap" element={<Navigate to="/reports?tab=heatmap" replace />} />
                <Route path="/chart-builder" element={<Navigate to="/reports?tab=chart-builder" replace />} />
                <Route path="/announcements" element={<Guarded><AnnouncementsPage /></Guarded>} />
                <Route path="/settings/general" element={<Guarded><SettingsPage /></Guarded>} />
                <Route path="/settings/audit-log" element={<Guarded><AuditLogPage /></Guarded>} />
                <Route path="/settings/system" element={<Guarded><SystemConfigPage /></Guarded>} />
                <Route path="/settings/tracking" element={<Guarded><UserTrackingPage /></Guarded>} />
                <Route path="/settings/users" element={<Guarded><UsersPage /></Guarded>} />
                <Route path="/settings/triggers" element={<Guarded><TriggersPage /></Guarded>} />
                <Route path="/settings/custom-fields" element={<Guarded><CustomFieldsPage /></Guarded>} />
                <Route path="/settings/backup" element={<Guarded><BackupPage /></Guarded>} />
                <Route path="/settings/scheduled-reports" element={<Guarded><ScheduledReportsPage /></Guarded>} />
                <Route path="/settings/sms-templates" element={<Guarded><SMSTemplatesPage /></Guarded>} />
                <Route path="/settings/print" element={<Guarded><PrintSettingsPage /></Guarded>} />
                <Route path="/settings/security" element={<Guarded><SecurityPage /></Guarded>} />
                <Route path="/settings/workflows" element={<Guarded><WorkflowBuilderPage /></Guarded>} />
                <Route path="/settings/system-health" element={<Guarded><SystemHealthPage /></Guarded>} />
                <Route path="/settings/api-docs" element={<Guarded><APIDocsPage /></Guarded>} />
                <Route path="/settings/export-import-history" element={<Guarded><ExportImportHistoryPage /></Guarded>} />
                <Route path="/settings/roles" element={<Guarded><RolesPage /></Guarded>} />
                <Route path="/settings/sla" element={<Guarded><SLAManagementPage /></Guarded>} />
                <Route path="/changelog" element={<Guarded><ChangelogPage /></Guarded>} />
                <Route path="/notifications" element={<Guarded><NotificationsPage /></Guarded>} />
                <Route path="/help" element={<Guarded><HelpCenterPage /></Guarded>} />
                <Route path="/knowledge-base" element={<Guarded><KnowledgeBasePage /></Guarded>} />
                <Route path="/settings/*" element={<Guarded><SettingsPage /></Guarded>} />
                <Route path="/profile" element={<Guarded><ProfilePage /></Guarded>} />
              </Route>
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
            </Suspense>
            </KeyboardShortcutsProvider>
            </AppErrorBoundary>
          </ToastProvider>
        </AuthProvider>
        </SystemConfigProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
