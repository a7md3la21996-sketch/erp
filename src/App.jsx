import { Component, lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SystemConfigProvider } from './contexts/SystemConfigContext';
import { ToastProvider } from './contexts/ToastContext';
import { GlobalFilterProvider } from './contexts/GlobalFilterContext';
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

// ── Chunk-load retry: if a lazy chunk 404s after deploy, reload the page ────
function lazyRetry(importFn) {
  return lazy(() =>
    importFn().catch((err) => {
      // Only auto-reload once to avoid infinite loops
      const reloaded = sessionStorage.getItem('chunk_reload');
      if (!reloaded) {
        sessionStorage.setItem('chunk_reload', '1');
        window.location.reload();
        return new Promise(() => {}); // never resolves — page is reloading
      }
      sessionStorage.removeItem('chunk_reload');
      throw err; // let ErrorBoundary handle it
    })
  );
}

// Lazy-loaded pages
const DashboardPage = lazyRetry(() => import('./pages/dashboard/DashboardPage'));
const ContactsPage = lazyRetry(() => import('./pages/ContactsPage'));
const OpportunitiesPage = lazyRetry(() => import('./pages/crm/OpportunitiesPage'));
const LeadPoolPage = lazyRetry(() => import('./pages/crm/LeadPoolPage'));
const ActivitiesPage = lazyRetry(() => import('./pages/ActivitiesPage'));
const TasksPage = lazyRetry(() => import('./pages/TasksPage'));
const PerformancePage = lazyRetry(() => import('./pages/PerformancePage'));
const FinancePage = lazyRetry(() => import('./pages/finance/FinancePage'));
const SettingsPage = lazyRetry(() => import('./pages/settings/SettingsPage'));
const EmployeesPage = lazyRetry(() => import('./pages/hr/EmployeesPage'));
const HRPoliciesPage = lazyRetry(() => import('./pages/hr/HRPoliciesPage'));
const AttendancePage = lazyRetry(() => import('./pages/hr/AttendancePage'));
const LeavePage = lazyRetry(() => import('./pages/hr/LeavePage'));
const PayrollPage = lazyRetry(() => import('./pages/hr/PayrollPage'));
const CompetenciesPage = lazyRetry(() => import('./pages/hr/CompetenciesPage'));
const RecruitmentPage = lazyRetry(() => import('./pages/hr/RecruitmentPage'));
const DisciplinaryPage = lazyRetry(() => import('./pages/hr/DisciplinaryPage'));
const TrainingPage = lazyRetry(() => import('./pages/hr/TrainingPage'));
const SelfServicePage = lazyRetry(() => import('./pages/hr/SelfServicePage'));
const AssetsPage = lazyRetry(() => import('./pages/hr/AssetsPage'));
const OnboardingPage = lazyRetry(() => import('./pages/hr/OnboardingPage'));
const ExpenseClaimsPage = lazyRetry(() => import('./pages/hr/ExpenseClaimsPage'));
const OperationsPage = lazyRetry(() => import('./pages/operations/OperationsPage'));
const AuditLogPage = lazyRetry(() => import('./pages/settings/AuditLogPage'));
const CalendarPage = lazyRetry(() => import('./pages/CalendarPage'));
const ReportsPage = lazyRetry(() => import('./pages/ReportsPage'));
const MarketingPage = lazyRetry(() => import('./pages/MarketingPage'));
const SystemConfigPage = lazyRetry(() => import('./pages/settings/SystemConfigPage'));
const UserTrackingPage = lazyRetry(() => import('./pages/settings/UserTrackingPage'));
const DealsPage = lazyRetry(() => import('./pages/sales/DealsPage'));
const CommissionsPage = lazyRetry(() => import('./pages/sales/CommissionsPage'));
const SalesForecastPage = lazyRetry(() => import('./pages/sales/SalesForecastPage'));
const ProjectsPage = lazyRetry(() => import('./pages/real-estate/ProjectsPage'));
const UnitsPage = lazyRetry(() => import('./pages/real-estate/UnitsPage'));
const UsersPage = lazyRetry(() => import('./pages/settings/UsersPage'));
const TriggersPage = lazyRetry(() => import('./pages/settings/TriggersPage'));
const CustomFieldsPage = lazyRetry(() => import('./pages/settings/CustomFieldsPage'));
const BackupPage = lazyRetry(() => import('./pages/settings/BackupPage'));
const ScheduledReportsPage = lazyRetry(() => import('./pages/settings/ScheduledReportsPage'));
const SMSTemplatesPage = lazyRetry(() => import('./pages/settings/SMSTemplatesPage'));
const PrintSettingsPage = lazyRetry(() => import('./pages/settings/PrintSettingsPage'));
const ChatInboxPage = lazyRetry(() => import('./pages/ChatInboxPage'));
const EmailPage = lazyRetry(() => import('./pages/EmailPage'));
const WhatsAppPage = lazyRetry(() => import('./pages/WhatsAppPage'));
const AnalyticsPage = lazyRetry(() => import('./pages/AnalyticsPage'));
const ChartBuilderPage = lazyRetry(() => import('./pages/ChartBuilderPage'));
const AnnouncementsPage = lazyRetry(() => import('./pages/AnnouncementsPage'));
const GoalsPage = lazyRetry(() => import('./pages/GoalsPage'));
const ProfilePage = lazyRetry(() => import('./pages/ProfilePage'));
const HeatmapPage = lazyRetry(() => import('./pages/HeatmapPage'));
const SecurityPage = lazyRetry(() => import('./pages/settings/SecurityPage'));
const WorkflowBuilderPage = lazyRetry(() => import('./pages/settings/WorkflowBuilderPage'));
const SystemHealthPage = lazyRetry(() => import('./pages/settings/SystemHealthPage'));
const APIDocsPage = lazyRetry(() => import('./pages/settings/APIDocsPage'));
const ExportImportHistoryPage = lazyRetry(() => import('./pages/settings/ExportImportHistoryPage'));
const ChangelogPage = lazyRetry(() => import('./pages/ChangelogPage'));
const RolesPage = lazyRetry(() => import('./pages/settings/RolesPage'));
const SLAManagementPage = lazyRetry(() => import('./pages/settings/SLAManagementPage'));
const AdsIntegrationPage = lazyRetry(() => import('./pages/settings/AdsIntegrationPage'));
const NotificationsPage = lazyRetry(() => import('./pages/NotificationsPage'));
const HelpCenterPage = lazyRetry(() => import('./pages/HelpCenterPage'));
const KnowledgeBasePage = lazyRetry(() => import('./pages/KnowledgeBasePage'));
const ComparisonReportsPage = lazyRetry(() => import('./pages/ComparisonReportsPage'));
const ApprovalsPage = lazyRetry(() => import('./pages/ApprovalsPage'));


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
          <Button size="sm" className="mt-2" onClick={() => { window.location.href = '/dashboard'; window.location.reload(); }}>
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // data stays fresh for 5 minutes
      gcTime: 30 * 60 * 1000,         // cache kept for 30 minutes
      refetchOnWindowFocus: false,     // don't refetch on tab switch
      retry: 1,                        // retry failed queries once
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <ThemeProvider>
        <SystemConfigProvider>
        <AuthProvider>
          <GlobalFilterProvider>
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
                <Route path="/settings/general" element={<ProtectedRoute permission={P.SETTINGS_MANAGE}><Guarded><SettingsPage /></Guarded></ProtectedRoute>} />
                <Route path="/settings/audit-log" element={<ProtectedRoute permission={P.AUDIT_VIEW}><Guarded><AuditLogPage /></Guarded></ProtectedRoute>} />
                <Route path="/settings/system" element={<ProtectedRoute permission={P.SETTINGS_MANAGE}><Guarded><SystemConfigPage /></Guarded></ProtectedRoute>} />
                <Route path="/settings/tracking" element={<ProtectedRoute permission={P.AUDIT_VIEW}><Guarded><UserTrackingPage /></Guarded></ProtectedRoute>} />
                <Route path="/settings/users" element={<ProtectedRoute permission={P.USERS_MANAGE}><Guarded><UsersPage /></Guarded></ProtectedRoute>} />
                <Route path="/settings/triggers" element={<ProtectedRoute permission={P.SETTINGS_MANAGE}><Guarded><TriggersPage /></Guarded></ProtectedRoute>} />
                <Route path="/settings/custom-fields" element={<ProtectedRoute permission={P.SETTINGS_MANAGE}><Guarded><CustomFieldsPage /></Guarded></ProtectedRoute>} />
                <Route path="/settings/backup" element={<ProtectedRoute permission={P.SETTINGS_MANAGE}><Guarded><BackupPage /></Guarded></ProtectedRoute>} />
                <Route path="/settings/scheduled-reports" element={<ProtectedRoute permission={P.SETTINGS_MANAGE}><Guarded><ScheduledReportsPage /></Guarded></ProtectedRoute>} />
                <Route path="/settings/sms-templates" element={<ProtectedRoute permission={P.SETTINGS_MANAGE}><Guarded><SMSTemplatesPage /></Guarded></ProtectedRoute>} />
                <Route path="/settings/print" element={<ProtectedRoute permission={P.SETTINGS_MANAGE}><Guarded><PrintSettingsPage /></Guarded></ProtectedRoute>} />
                <Route path="/settings/security" element={<ProtectedRoute permission={P.SETTINGS_MANAGE}><Guarded><SecurityPage /></Guarded></ProtectedRoute>} />
                <Route path="/settings/workflows" element={<ProtectedRoute permission={P.SETTINGS_MANAGE}><Guarded><WorkflowBuilderPage /></Guarded></ProtectedRoute>} />
                <Route path="/settings/system-health" element={<ProtectedRoute permission={P.SETTINGS_MANAGE}><Guarded><SystemHealthPage /></Guarded></ProtectedRoute>} />
                <Route path="/settings/api-docs" element={<ProtectedRoute permission={P.SETTINGS_MANAGE}><Guarded><APIDocsPage /></Guarded></ProtectedRoute>} />
                <Route path="/settings/export-import-history" element={<ProtectedRoute permission={P.SETTINGS_MANAGE}><Guarded><ExportImportHistoryPage /></Guarded></ProtectedRoute>} />
                <Route path="/settings/roles" element={<ProtectedRoute permission={P.ROLES_MANAGE}><Guarded><RolesPage /></Guarded></ProtectedRoute>} />
                <Route path="/settings/sla" element={<ProtectedRoute permission={P.SLA_MANAGE}><Guarded><SLAManagementPage /></Guarded></ProtectedRoute>} />
                <Route path="/settings/ads-integration" element={<ProtectedRoute permission={P.SETTINGS_MANAGE}><Guarded><AdsIntegrationPage /></Guarded></ProtectedRoute>} />
                <Route path="/changelog" element={<Guarded><ChangelogPage /></Guarded>} />
                <Route path="/notifications" element={<Guarded><NotificationsPage /></Guarded>} />
                <Route path="/help" element={<Guarded><HelpCenterPage /></Guarded>} />
                <Route path="/knowledge-base" element={<Guarded><KnowledgeBasePage /></Guarded>} />
                <Route path="/settings/*" element={<ProtectedRoute permission={P.SETTINGS_VIEW}><Guarded><SettingsPage /></Guarded></ProtectedRoute>} />
                <Route path="/profile" element={<Guarded><ProfilePage /></Guarded>} />
              </Route>
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
            </Suspense>
            </KeyboardShortcutsProvider>
            </AppErrorBoundary>
          </ToastProvider>
          </GlobalFilterProvider>
        </AuthProvider>
        </SystemConfigProvider>
      </ThemeProvider>
    </BrowserRouter>
    </QueryClientProvider>
  );
}
