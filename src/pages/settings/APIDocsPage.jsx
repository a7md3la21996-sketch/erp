import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import {
  BookOpen, Search, ChevronRight, Code2, Database,
  Copy, Check, FileText,
} from 'lucide-react';

// ── Service documentation data ──────────────────────────────────────────

const SERVICES = [
  {
    id: 'contacts',
    name: { en: 'Contacts Service', ar: 'خدمة جهات الاتصال' },
    description: { en: 'Manage contacts (leads, clients, companies) with Supabase backend and filtering by role/team.', ar: 'إدارة جهات الاتصال (عملاء محتملين، عملاء، شركات) مع Supabase.' },
    file: 'src/services/contactsService.js',
    storageKey: 'Supabase: contacts',
    functions: [
      { name: 'fetchContacts', params: '{ role, userId, teamId, filters }', returns: 'Promise<Contact[]>', desc: { en: 'Fetch contacts with role-based filtering, search, and type/source/temperature filters.', ar: 'جلب جهات الاتصال مع فلترة حسب الدور والبحث.' } },
      { name: 'createContact', params: 'contactData', returns: 'Promise<Contact>', desc: { en: 'Create a new contact record.', ar: 'إنشاء جهة اتصال جديدة.' } },
      { name: 'updateContact', params: 'id, updates', returns: 'Promise<Contact>', desc: { en: 'Update an existing contact by ID.', ar: 'تحديث جهة اتصال حسب المعرف.' } },
      { name: 'blacklistContact', params: 'id, reason', returns: 'Promise<void>', desc: { en: 'Blacklist a contact with a reason.', ar: 'إضافة جهة اتصال للقائمة السوداء.' } },
      { name: 'checkDuplicate', params: 'phone', returns: 'Promise<Contact|null>', desc: { en: 'Check for existing contact with same phone number.', ar: 'التحقق من وجود جهة اتصال بنفس رقم الهاتف.' } },
      { name: 'fetchContactActivities', params: 'contactId', returns: 'Promise<Activity[]>', desc: { en: 'Get activities for a specific contact.', ar: 'جلب أنشطة جهة اتصال معينة.' } },
      { name: 'fetchContactOpportunities', params: 'contactId', returns: 'Promise<Opportunity[]>', desc: { en: 'Get opportunities linked to a contact.', ar: 'جلب الفرص المرتبطة بجهة اتصال.' } },
    ],
    example: `import { fetchContacts, createContact } from './services/contactsService';

// Fetch contacts for a sales agent
const contacts = await fetchContacts({
  role: 'sales_agent',
  userId: 'user-123',
  filters: { search: 'Ahmed', contact_type: 'lead' }
});

// Create a new contact
const newContact = await createContact({
  full_name: 'Ahmed Ali',
  phone: '+201234567890',
  contact_type: 'lead',
  source: 'website',
});`,
  },
  {
    id: 'opportunities',
    name: { en: 'Opportunities Service', ar: 'خدمة الفرص البيعية' },
    description: { en: 'Manage sales opportunities with stage tracking, assignment, and pipeline management.', ar: 'إدارة الفرص البيعية مع تتبع المراحل والتعيين.' },
    file: 'src/services/opportunitiesService.js',
    storageKey: 'Supabase: opportunities',
    functions: [
      { name: 'fetchOpportunities', params: '{ role, userId, teamId }', returns: 'Promise<Opportunity[]>', desc: { en: 'Fetch opportunities with role-based access control.', ar: 'جلب الفرص مع صلاحيات حسب الدور.' } },
      { name: 'createOpportunity', params: 'oppData', returns: 'Promise<Opportunity>', desc: { en: 'Create a new sales opportunity.', ar: 'إنشاء فرصة بيعية جديدة.' } },
      { name: 'updateOpportunity', params: 'id, updates', returns: 'Promise<Opportunity>', desc: { en: 'Update opportunity details or stage.', ar: 'تحديث تفاصيل الفرصة أو المرحلة.' } },
      { name: 'deleteOpportunity', params: 'id', returns: 'Promise<void>', desc: { en: 'Delete an opportunity by ID.', ar: 'حذف فرصة حسب المعرف.' } },
      { name: 'fetchSalesAgents', params: '', returns: 'Promise<User[]>', desc: { en: 'Get list of all sales agents for assignment.', ar: 'جلب قائمة وكلاء المبيعات للتعيين.' } },
      { name: 'fetchProjects', params: '', returns: 'Promise<Project[]>', desc: { en: 'Get available real estate projects.', ar: 'جلب المشاريع العقارية المتاحة.' } },
      { name: 'searchContacts', params: 'query', returns: 'Promise<Contact[]>', desc: { en: 'Search contacts by name/phone for linking.', ar: 'البحث عن جهات اتصال للربط.' } },
    ],
    example: `import { fetchOpportunities, updateOpportunity } from './services/opportunitiesService';

const opps = await fetchOpportunities({ role: 'team_leader', userId: 'u1', teamId: 't1' });

// Move to next stage
await updateOpportunity(opps[0].id, { stage: 'negotiation' });`,
  },
  {
    id: 'deals',
    name: { en: 'Deals Service', ar: 'خدمة الصفقات' },
    description: { en: 'Manage won deals created from opportunities with Supabase and localStorage fallback.', ar: 'إدارة الصفقات الرابحة من الفرص مع دعم localStorage.' },
    file: 'src/services/dealsService.js',
    storageKey: 'platform_deals / Supabase: deals',
    functions: [
      { name: 'getWonDeals', params: '', returns: 'Promise<Deal[]>', desc: { en: 'Fetch all won deals from Supabase with localStorage fallback.', ar: 'جلب جميع الصفقات الرابحة.' } },
      { name: 'getWonDealsSync', params: '', returns: 'Deal[]', desc: { en: 'Synchronously get deals from localStorage.', ar: 'جلب الصفقات من التخزين المحلي بشكل متزامن.' } },
      { name: 'createDealFromOpportunity', params: 'opp, existingDeals', returns: 'Promise<Deal>', desc: { en: 'Create a deal record from a won opportunity.', ar: 'إنشاء صفقة من فرصة رابحة.' } },
      { name: 'dealExistsForOpportunity', params: 'oppId', returns: 'boolean', desc: { en: 'Check if a deal already exists for an opportunity.', ar: 'التحقق من وجود صفقة لفرصة معينة.' } },
    ],
    example: `import { getWonDeals, createDealFromOpportunity } from './services/dealsService';

const deals = await getWonDeals();
const newDeal = await createDealFromOpportunity(opportunity, deals);`,
  },
  {
    id: 'tasks',
    name: { en: 'Tasks Service', ar: 'خدمة المهام' },
    description: { en: 'CRUD operations for tasks with Supabase backend, department and status filtering.', ar: 'عمليات CRUD للمهام مع فلترة حسب القسم والحالة.' },
    file: 'src/services/tasksService.js',
    storageKey: 'Supabase: tasks',
    functions: [
      { name: 'fetchTasks', params: '{ contactId, dept, status }', returns: 'Promise<Task[]>', desc: { en: 'Fetch tasks with optional filters.', ar: 'جلب المهام مع فلاتر اختيارية.' } },
      { name: 'createTask', params: 'data', returns: 'Promise<Task>', desc: { en: 'Create a new task.', ar: 'إنشاء مهمة جديدة.' } },
      { name: 'updateTask', params: 'id, updates', returns: 'Promise<Task>', desc: { en: 'Update task details or status.', ar: 'تحديث تفاصيل المهمة.' } },
      { name: 'deleteTask', params: 'id', returns: 'Promise<void>', desc: { en: 'Delete a task by ID.', ar: 'حذف مهمة.' } },
    ],
    example: `import { fetchTasks, createTask } from './services/tasksService';

const tasks = await fetchTasks({ dept: 'sales', status: 'pending' });
await createTask({ title: 'Follow up', contact_id: 'c1', due_date: '2026-03-20' });`,
  },
  {
    id: 'activities',
    name: { en: 'Activities Service', ar: 'خدمة الأنشطة' },
    description: { en: 'Track interactions (calls, meetings, emails, WhatsApp) with contacts and entities.', ar: 'تتبع التفاعلات (مكالمات، اجتماعات، بريد) مع جهات الاتصال.' },
    file: 'src/services/activitiesService.js',
    storageKey: 'Supabase: activities',
    functions: [
      { name: 'fetchActivities', params: '{ entityType, entityId, dept, limit }', returns: 'Promise<Activity[]>', desc: { en: 'Fetch activities with entity/department filtering.', ar: 'جلب الأنشطة مع فلترة حسب الكيان والقسم.' } },
      { name: 'createActivity', params: '{ type, notes, entityType, entityId, dept, userId }', returns: 'Promise<Activity>', desc: { en: 'Log a new activity (call, meeting, email, note, whatsapp).', ar: 'تسجيل نشاط جديد.' } },
      { name: 'deleteActivity', params: 'id', returns: 'Promise<void>', desc: { en: 'Delete an activity record.', ar: 'حذف نشاط.' } },
    ],
    example: `import { createActivity } from './services/activitiesService';

await createActivity({
  type: 'call', notes: 'Discussed pricing',
  entityType: 'contact', entityId: 'c1', dept: 'sales', userId: 'u1',
});`,
  },
  {
    id: 'audit',
    name: { en: 'Audit Service', ar: 'خدمة التدقيق' },
    description: { en: 'Audit logging with Supabase + localStorage fallback. Tracks all create/update/delete actions.', ar: 'تسجيل التدقيق مع Supabase و localStorage. يتتبع جميع العمليات.' },
    file: 'src/services/auditService.js',
    storageKey: 'platform_audit_logs',
    functions: [
      { name: 'logAudit', params: '{ action, entity, entityId, entityName, oldData, newData, description, userName }', returns: 'Promise<void>', desc: { en: 'Log an audit entry with before/after data.', ar: 'تسجيل إدخال تدقيق مع البيانات قبل وبعد.' } },
      { name: 'getLocalAuditLogs', params: '{ limit, offset, action, entity, search }', returns: 'AuditLog[]', desc: { en: 'Query local audit logs with filters and pagination.', ar: 'استعلام سجلات التدقيق المحلية مع فلاتر وتقسيم صفحات.' } },
    ],
    example: `import { logAudit } from './services/auditService';

await logAudit({
  action: 'update', entity: 'contact', entityId: 'c1',
  entityName: 'Ahmed Ali', description: 'Updated phone number',
  userName: 'Admin',
});`,
  },
  {
    id: 'notifications',
    name: { en: 'Notifications Service', ar: 'خدمة الإشعارات' },
    description: { en: 'In-app notification system with localStorage. Supports typed notifications and read tracking.', ar: 'نظام إشعارات داخلي مع localStorage. يدعم أنواع الإشعارات وتتبع القراءة.' },
    file: 'src/services/notificationsService.js',
    storageKey: 'platform_notifications',
    functions: [
      { name: 'createNotification', params: '{ type, title_ar, title_en, body_ar, body_en, for_user_id, entity_type, entity_id, from_user }', returns: 'Notification', desc: { en: 'Create a notification for a user.', ar: 'إنشاء إشعار لمستخدم.' } },
      { name: 'getNotifications', params: 'userId, { unreadOnly, limit }', returns: 'Notification[]', desc: { en: 'Get notifications for a user.', ar: 'جلب إشعارات المستخدم.' } },
      { name: 'getUnreadCount', params: 'userId', returns: 'number', desc: { en: 'Get count of unread notifications.', ar: 'عدد الإشعارات غير المقروءة.' } },
      { name: 'markAsRead', params: 'notificationId', returns: 'void', desc: { en: 'Mark a notification as read.', ar: 'تحديد إشعار كمقروء.' } },
      { name: 'markAllAsRead', params: 'userId', returns: 'void', desc: { en: 'Mark all notifications as read.', ar: 'تحديد الكل كمقروء.' } },
      { name: 'notifyLeadAssigned', params: '{ contactName, agentId, agentName, assignedBy }', returns: 'void', desc: { en: 'Send lead assignment notification.', ar: 'إرسال إشعار تعيين ليد.' } },
      { name: 'notifyTaskAssigned', params: '{ taskTitle, assigneeId, assignedBy }', returns: 'void', desc: { en: 'Send task assignment notification.', ar: 'إرسال إشعار تعيين مهمة.' } },
      { name: 'notifyDealWon', params: '{ dealNumber, clientName, value, agentId }', returns: 'void', desc: { en: 'Send deal won notification.', ar: 'إرسال إشعار صفقة رابحة.' } },
    ],
    example: `import { createNotification, getUnreadCount } from './services/notificationsService';

createNotification({
  type: 'lead_assigned',
  title_en: 'New Lead', title_ar: 'ليد جديد',
  for_user_id: 'agent-1',
});

const count = getUnreadCount('agent-1');`,
  },
  {
    id: 'chat',
    name: { en: 'Chat / Comments Service', ar: 'خدمة المحادثات والتعليقات' },
    description: { en: 'Comment threads on entities with @mentions support and team member lookup.', ar: 'سلاسل تعليقات على الكيانات مع دعم الإشارات (@mentions).' },
    file: 'src/services/chatService.js',
    storageKey: 'platform_comments',
    functions: [
      { name: 'addComment', params: '{ entity, entityId, entityName, text, authorId, authorName, mentions }', returns: 'Comment', desc: { en: 'Add a comment to an entity with optional mentions.', ar: 'إضافة تعليق مع إشارات اختيارية.' } },
      { name: 'getComments', params: 'entity, entityId', returns: 'Comment[]', desc: { en: 'Get comments for a specific entity.', ar: 'جلب تعليقات كيان معين.' } },
      { name: 'getRecentComments', params: 'limit', returns: 'Comment[]', desc: { en: 'Get most recent comments across all entities.', ar: 'جلب أحدث التعليقات.' } },
      { name: 'getMentions', params: 'userId', returns: 'Comment[]', desc: { en: 'Get comments where user is mentioned.', ar: 'جلب التعليقات التي تمت الإشارة فيها للمستخدم.' } },
      { name: 'editComment', params: 'commentId, newText', returns: 'void', desc: { en: 'Edit an existing comment.', ar: 'تعديل تعليق.' } },
      { name: 'deleteComment', params: 'commentId', returns: 'void', desc: { en: 'Delete a comment.', ar: 'حذف تعليق.' } },
      { name: 'getTeamMembers', params: '', returns: 'User[]', desc: { en: 'Get team members for mention autocomplete.', ar: 'جلب أعضاء الفريق للإكمال التلقائي.' } },
    ],
    example: `import { addComment, getComments } from './services/chatService';

addComment({
  entity: 'contact', entityId: 'c1', entityName: 'Ahmed',
  text: 'Follow up needed @john', authorId: 'u1', authorName: 'Sarah',
});

const comments = getComments('contact', 'c1');`,
  },
  {
    id: 'documents',
    name: { en: 'Documents Service', ar: 'خدمة المستندات' },
    description: { en: 'Attach documents (contracts, IDs, receipts) to entities with localStorage storage.', ar: 'إرفاق مستندات (عقود، هويات، إيصالات) بالكيانات.' },
    file: 'src/services/documentService.js',
    storageKey: 'platform_documents',
    functions: [
      { name: 'addDocument', params: '{ entity, entity_id, name, type, file_name, file_size, data_url, uploaded_by, notes }', returns: 'Document', desc: { en: 'Attach a document to an entity.', ar: 'إرفاق مستند بكيان.' } },
      { name: 'getDocuments', params: '{ entity, entity_id, type, search }', returns: 'Document[]', desc: { en: 'Get documents with optional filters.', ar: 'جلب المستندات مع فلاتر اختيارية.' } },
      { name: 'getDocumentsByEntity', params: 'entity, entity_id', returns: 'Document[]', desc: { en: 'Get all documents for a specific entity.', ar: 'جلب جميع مستندات كيان معين.' } },
      { name: 'deleteDocument', params: 'id', returns: 'void', desc: { en: 'Delete a document by ID.', ar: 'حذف مستند.' } },
      { name: 'formatFileSize', params: 'bytes', returns: 'string', desc: { en: 'Format bytes to human-readable size.', ar: 'تحويل البايت لحجم مقروء.' } },
    ],
    example: `import { addDocument, getDocumentsByEntity } from './services/documentService';

addDocument({
  entity: 'contact', entity_id: 'c1', name: 'ID Copy',
  type: 'id', file_name: 'id.pdf', file_size: 150000,
});

const docs = getDocumentsByEntity('contact', 'c1');`,
  },
  {
    id: 'backup',
    name: { en: 'Backup Service', ar: 'خدمة النسخ الاحتياطي' },
    description: { en: 'Create/restore JSON backups of all platform_ localStorage keys.', ar: 'إنشاء/استعادة نسخ احتياطية JSON لجميع بيانات localStorage.' },
    file: 'src/services/backupService.js',
    storageKey: 'platform_last_backup',
    functions: [
      { name: 'createBackup', params: '', returns: 'BackupObject', desc: { en: 'Collect all platform_ keys into a backup object.', ar: 'جمع جميع مفاتيح platform_ في كائن نسخة احتياطية.' } },
      { name: 'downloadBackup', params: '', returns: 'BackupObject', desc: { en: 'Create and trigger browser download of backup JSON.', ar: 'إنشاء وتحميل ملف JSON للنسخة الاحتياطية.' } },
      { name: 'restoreBackup', params: 'file: File', returns: 'Promise<{ restored, errors }>', desc: { en: 'Read a JSON file and restore keys to localStorage.', ar: 'قراءة ملف JSON واستعادة البيانات.' } },
      { name: 'getBackupInfo', params: '', returns: '{ totalKeys, totalSizeKB, lastBackup }', desc: { en: 'Get backup stats: key count, size, last backup date.', ar: 'إحصائيات النسخ: عدد المفاتيح، الحجم، آخر نسخة.' } },
      { name: 'getStorageUsage', params: '', returns: 'UsageEntry[]', desc: { en: 'Get per-key storage usage sorted by size.', ar: 'استخدام التخزين لكل مفتاح مرتب حسب الحجم.' } },
      { name: 'clearAllData', params: '', returns: 'number', desc: { en: 'Clear all platform_ keys. Returns count of removed keys.', ar: 'مسح جميع بيانات platform_. يرجع عدد المفاتيح المحذوفة.' } },
    ],
    example: `import { downloadBackup, getBackupInfo, getStorageUsage } from './services/backupService';

const info = getBackupInfo();
console.log(\`\${info.totalKeys} keys, \${info.totalSizeKB} KB\`);

downloadBackup(); // triggers browser download`,
  },
  {
    id: 'triggers',
    name: { en: 'Triggers Service', ar: 'خدمة المشغلات' },
    description: { en: 'Automation triggers that execute actions on entity events (create, update, stage change).', ar: 'مشغلات أتمتة تنفذ إجراءات عند أحداث الكيانات.' },
    file: 'src/services/triggerService.js',
    storageKey: 'platform_triggers',
    functions: [
      { name: 'createTrigger', params: 'trigger', returns: 'Trigger', desc: { en: 'Create an automation trigger.', ar: 'إنشاء مشغل أتمتة.' } },
      { name: 'getTriggers', params: '', returns: 'Trigger[]', desc: { en: 'Get all triggers.', ar: 'جلب جميع المشغلات.' } },
      { name: 'updateTrigger', params: 'id, updates', returns: 'void', desc: { en: 'Update trigger configuration.', ar: 'تحديث إعدادات المشغل.' } },
      { name: 'deleteTrigger', params: 'id', returns: 'void', desc: { en: 'Delete a trigger.', ar: 'حذف مشغل.' } },
      { name: 'toggleTrigger', params: 'id', returns: 'void', desc: { en: 'Enable/disable a trigger.', ar: 'تفعيل/تعطيل مشغل.' } },
      { name: 'evaluateTriggers', params: 'entity, event, data', returns: 'void', desc: { en: 'Evaluate and execute matching triggers for an event.', ar: 'تقييم وتنفيذ المشغلات المطابقة لحدث.' } },
    ],
    example: `import { createTrigger, evaluateTriggers } from './services/triggerService';

createTrigger({
  name: 'Auto-assign hot leads',
  entity: 'contact', event: 'create',
  conditions: [{ field: 'temperature', operator: 'eq', value: 'hot' }],
  actions: [{ type: 'notify', config: { message: 'Hot lead incoming!' } }],
});

// Called internally when entity events happen
evaluateTriggers('contact', 'create', { temperature: 'hot' });`,
  },
  {
    id: 'finance',
    name: { en: 'Finance Service', ar: 'خدمة المالية' },
    description: { en: 'Journal entries, invoices, expenses, and chart of accounts via Supabase.', ar: 'القيود اليومية والفواتير والمصروفات ودليل الحسابات.' },
    file: 'src/services/financeService.js',
    storageKey: 'Supabase: journal_entries, invoices, expenses',
    functions: [
      { name: 'fetchJournalEntries', params: 'filters', returns: 'Promise<JournalEntry[]>', desc: { en: 'Fetch journal entries with date/status filters.', ar: 'جلب القيود اليومية مع فلاتر.' } },
      { name: 'createJournalEntry', params: 'data', returns: 'Promise<JournalEntry>', desc: { en: 'Create a double-entry journal record.', ar: 'إنشاء قيد يومي.' } },
      { name: 'fetchInvoices', params: 'filters', returns: 'Promise<Invoice[]>', desc: { en: 'Fetch invoices with status/client filters.', ar: 'جلب الفواتير.' } },
      { name: 'createInvoice', params: 'data', returns: 'Promise<Invoice>', desc: { en: 'Create a new invoice.', ar: 'إنشاء فاتورة جديدة.' } },
      { name: 'updateInvoiceStatus', params: 'id, status', returns: 'Promise<Invoice>', desc: { en: 'Update invoice status (draft/sent/paid).', ar: 'تحديث حالة الفاتورة.' } },
      { name: 'fetchExpenses', params: 'filters', returns: 'Promise<Expense[]>', desc: { en: 'Fetch expenses with category/date filters.', ar: 'جلب المصروفات.' } },
      { name: 'createExpense', params: 'data', returns: 'Promise<Expense>', desc: { en: 'Record a new expense.', ar: 'تسجيل مصروف جديد.' } },
      { name: 'fetchChartOfAccounts', params: '', returns: 'Promise<Account[]>', desc: { en: 'Get chart of accounts tree.', ar: 'جلب دليل الحسابات.' } },
    ],
    example: `import { fetchInvoices, createExpense } from './services/financeService';

const invoices = await fetchInvoices({ status: 'paid' });
await createExpense({ category: 'office', amount: 500, date: '2026-03-15' });`,
  },
  {
    id: 'operations',
    name: { en: 'Operations Service', ar: 'خدمة العمليات' },
    description: { en: 'Deal processing, installments, handovers, and after-sales tickets.', ar: 'معالجة الصفقات والأقساط والتسليمات وتذاكر ما بعد البيع.' },
    file: 'src/services/operationsService.js',
    storageKey: 'Supabase: ops_deals, installments, handovers, tickets',
    functions: [
      { name: 'fetchDeals', params: 'filters', returns: 'Promise<Deal[]>', desc: { en: 'Fetch operational deals with filters.', ar: 'جلب صفقات العمليات.' } },
      { name: 'createDeal', params: 'data', returns: 'Promise<Deal>', desc: { en: 'Create operational deal record.', ar: 'إنشاء سجل صفقة عمليات.' } },
      { name: 'fetchInstallments', params: 'dealId', returns: 'Promise<Installment[]>', desc: { en: 'Get installments for a deal.', ar: 'جلب أقساط صفقة.' } },
      { name: 'createInstallment', params: 'data', returns: 'Promise<Installment>', desc: { en: 'Create an installment record.', ar: 'إنشاء قسط.' } },
      { name: 'updateInstallmentStatus', params: 'id, status, extra', returns: 'Promise<Installment>', desc: { en: 'Update installment payment status.', ar: 'تحديث حالة دفع القسط.' } },
      { name: 'fetchHandovers', params: 'filters', returns: 'Promise<Handover[]>', desc: { en: 'Get handover records.', ar: 'جلب سجلات التسليم.' } },
      { name: 'fetchTickets', params: 'filters', returns: 'Promise<Ticket[]>', desc: { en: 'Get after-sales support tickets.', ar: 'جلب تذاكر ما بعد البيع.' } },
      { name: 'createTicket', params: 'data', returns: 'Promise<Ticket>', desc: { en: 'Create a support ticket.', ar: 'إنشاء تذكرة دعم.' } },
    ],
    example: `import { fetchDeals, createTicket } from './services/operationsService';

const deals = await fetchDeals({ status: 'processing' });
await createTicket({ deal_id: 'd1', subject: 'Maintenance request', priority: 'high' });`,
  },
  {
    id: 'marketing',
    name: { en: 'Marketing Service', ar: 'خدمة التسويق' },
    description: { en: 'Campaign management with Supabase. Track campaigns, contacts per campaign, and interactions.', ar: 'إدارة الحملات مع Supabase. تتبع الحملات والعملاء والتفاعلات.' },
    file: 'src/services/marketingService.js',
    storageKey: 'Supabase: campaigns',
    functions: [
      { name: 'fetchCampaigns', params: '', returns: 'Promise<Campaign[]>', desc: { en: 'Fetch all marketing campaigns.', ar: 'جلب جميع الحملات التسويقية.' } },
      { name: 'createCampaign', params: 'data', returns: 'Promise<Campaign>', desc: { en: 'Create a new campaign.', ar: 'إنشاء حملة جديدة.' } },
      { name: 'updateCampaign', params: 'id, updates', returns: 'Promise<Campaign>', desc: { en: 'Update campaign details.', ar: 'تحديث تفاصيل الحملة.' } },
      { name: 'deleteCampaign', params: 'id', returns: 'Promise<void>', desc: { en: 'Delete a campaign.', ar: 'حذف حملة.' } },
      { name: 'getCampaignContacts', params: 'campaignName, contacts', returns: 'Contact[]', desc: { en: 'Get contacts associated with a campaign.', ar: 'جلب جهات اتصال حملة.' } },
    ],
    example: `import { fetchCampaigns, createCampaign } from './services/marketingService';

const campaigns = await fetchCampaigns();
await createCampaign({ name: 'Spring 2026', budget: 50000, channel: 'facebook' });`,
  },
  {
    id: 'employees',
    name: { en: 'Employees Service', ar: 'خدمة الموظفين' },
    description: { en: 'HR employee management with Supabase. CRUD for employee records and departments.', ar: 'إدارة الموظفين مع Supabase. عمليات CRUD والأقسام.' },
    file: 'src/services/employeesService.js',
    storageKey: 'Supabase: users',
    functions: [
      { name: 'fetchEmployees', params: 'filters', returns: 'Promise<Employee[]>', desc: { en: 'Fetch employees with department/status filters.', ar: 'جلب الموظفين مع فلاتر.' } },
      { name: 'createEmployee', params: 'data', returns: 'Promise<Employee>', desc: { en: 'Create a new employee record.', ar: 'إنشاء سجل موظف.' } },
      { name: 'updateEmployee', params: 'id, updates', returns: 'Promise<Employee>', desc: { en: 'Update employee details.', ar: 'تحديث بيانات الموظف.' } },
      { name: 'deleteEmployee', params: 'id', returns: 'Promise<void>', desc: { en: 'Delete an employee record.', ar: 'حذف سجل موظف.' } },
      { name: 'fetchDepartments', params: '', returns: 'Promise<string[]>', desc: { en: 'Get list of departments.', ar: 'جلب قائمة الأقسام.' } },
    ],
    example: `import { fetchEmployees, updateEmployee } from './services/employeesService';

const employees = await fetchEmployees({ department: 'sales' });
await updateEmployee('e1', { position: 'Senior Agent' });`,
  },
  {
    id: 'security',
    name: { en: 'Security Service', ar: 'خدمة الأمان' },
    description: { en: 'IP whitelist, password policies, export restrictions, and export audit logging.', ar: 'القائمة البيضاء IP، سياسات كلمات المرور، قيود التصدير.' },
    file: 'src/services/securityService.js',
    storageKey: 'platform_ip_whitelist, platform_password_policy, platform_export_restrictions',
    functions: [
      { name: 'getIPWhitelist', params: '', returns: 'IPEntry[]', desc: { en: 'Get whitelisted IP addresses.', ar: 'جلب عناوين IP المسموحة.' } },
      { name: 'addIP', params: 'ip, label', returns: 'void', desc: { en: 'Add an IP to the whitelist.', ar: 'إضافة IP للقائمة البيضاء.' } },
      { name: 'removeIP', params: 'id', returns: 'void', desc: { en: 'Remove an IP from the whitelist.', ar: 'إزالة IP من القائمة البيضاء.' } },
      { name: 'getPasswordPolicy', params: '', returns: 'PasswordPolicy', desc: { en: 'Get current password policy settings.', ar: 'جلب إعدادات سياسة كلمة المرور.' } },
      { name: 'validatePassword', params: 'password', returns: '{ valid, errors }', desc: { en: 'Validate a password against the policy.', ar: 'التحقق من كلمة المرور ضد السياسة.' } },
      { name: 'canExport', params: 'role, format', returns: 'boolean', desc: { en: 'Check if a role can export in a format.', ar: 'التحقق من صلاحية التصدير.' } },
    ],
    example: `import { validatePassword, canExport } from './services/securityService';

const result = validatePassword('MyP@ss123');
if (!result.valid) console.log(result.errors);

if (canExport('admin', 'csv')) { /* proceed */ }`,
  },
  {
    id: 'systemConfig',
    name: { en: 'System Config Service', ar: 'خدمة إعدادات النظام' },
    description: { en: 'Global system configuration with sections: company info, modules, localization, etc.', ar: 'إعدادات النظام العامة: معلومات الشركة، الوحدات، التعريب.' },
    file: 'src/services/systemConfigService.js',
    storageKey: 'platform_system_config',
    functions: [
      { name: 'loadConfig', params: '', returns: 'SystemConfig', desc: { en: 'Load full system config from localStorage.', ar: 'تحميل الإعدادات الكاملة.' } },
      { name: 'saveConfig', params: 'config', returns: 'void', desc: { en: 'Save entire config object.', ar: 'حفظ كامل الإعدادات.' } },
      { name: 'saveSection', params: 'key, data', returns: 'void', desc: { en: 'Save a single config section.', ar: 'حفظ قسم واحد.' } },
      { name: 'resetConfig', params: '', returns: 'void', desc: { en: 'Reset config to defaults.', ar: 'إعادة الإعدادات للافتراضي.' } },
      { name: 'exportConfig', params: '', returns: 'string', desc: { en: 'Export config as JSON string.', ar: 'تصدير الإعدادات كـ JSON.' } },
      { name: 'importConfig', params: 'jsonString', returns: 'void', desc: { en: 'Import config from JSON string.', ar: 'استيراد الإعدادات من JSON.' } },
    ],
    example: `import { loadConfig, saveSection } from './services/systemConfigService';

const config = loadConfig();
saveSection('company', { name: 'Acme Corp', currency: 'EGP' });`,
  },
  {
    id: 'analytics',
    name: { en: 'Analytics Service', ar: 'خدمة التحليلات' },
    description: { en: 'Advanced analytics computations: conversion funnel, lead ROI, sales cycle, win/loss analysis.', ar: 'حسابات تحليلية متقدمة: قمع التحويل، عائد الليدز، دورة المبيعات.' },
    file: 'src/services/analyticsService.js',
    storageKey: 'N/A (computed from other data)',
    functions: [
      { name: 'loadAnalyticsData', params: '', returns: '{ contacts, opportunities, deals, activities }', desc: { en: 'Load all data needed for analytics.', ar: 'تحميل جميع البيانات للتحليلات.' } },
      { name: 'computeConversionFunnel', params: 'opportunities', returns: 'FunnelData', desc: { en: 'Compute stage-by-stage conversion rates.', ar: 'حساب معدلات التحويل لكل مرحلة.' } },
      { name: 'computeLeadSourceROI', params: 'contacts, opportunities, deals', returns: 'ROIData[]', desc: { en: 'Compute ROI by lead source.', ar: 'حساب العائد حسب مصدر الليد.' } },
      { name: 'computeSalesCycleDuration', params: 'opportunities', returns: 'CycleData', desc: { en: 'Analyze sales cycle duration by stage.', ar: 'تحليل مدة دورة المبيعات.' } },
      { name: 'computeAgentPerformance', params: 'opportunities, activities', returns: 'AgentData[]', desc: { en: 'Compute per-agent performance metrics.', ar: 'حساب أداء كل وكيل مبيعات.' } },
      { name: 'computeWinLossAnalysis', params: 'opportunities', returns: 'WinLossData', desc: { en: 'Analyze win/loss patterns and reasons.', ar: 'تحليل أنماط الربح والخسارة.' } },
    ],
    example: `import { loadAnalyticsData, computeConversionFunnel } from './services/analyticsService';

const data = loadAnalyticsData();
const funnel = computeConversionFunnel(data.opportunities);`,
  },
  {
    id: 'smsTemplates',
    name: { en: 'SMS Templates Service', ar: 'خدمة قوالب الرسائل' },
    description: { en: 'SMS template management with variable interpolation, sending simulation, and quota tracking.', ar: 'إدارة قوالب الرسائل مع متغيرات وتتبع الحصة.' },
    file: 'src/services/smsTemplateService.js',
    storageKey: 'platform_sms_templates, platform_sms_log, platform_sms_quota',
    functions: [
      { name: 'getTemplates', params: 'filters', returns: 'Template[]', desc: { en: 'Get SMS templates with optional category filter.', ar: 'جلب قوالب الرسائل.' } },
      { name: 'createTemplate', params: '{ name, nameAr, body, bodyAr, category, variables }', returns: 'Template', desc: { en: 'Create a new SMS template.', ar: 'إنشاء قالب رسالة.' } },
      { name: 'renderTemplate', params: 'templateId, data, lang', returns: 'string', desc: { en: 'Render template with variable substitution.', ar: 'عرض القالب مع استبدال المتغيرات.' } },
      { name: 'sendSMS', params: 'phone, message, templateId, templateName', returns: 'SMSLogEntry', desc: { en: 'Simulate sending an SMS (logs to localStorage).', ar: 'محاكاة إرسال رسالة.' } },
      { name: 'bulkSend', params: 'templateId, contacts, lang', returns: 'SMSLogEntry[]', desc: { en: 'Send template to multiple contacts.', ar: 'إرسال قالب لعدة جهات اتصال.' } },
      { name: 'getQuota', params: '', returns: '{ used, limit, remaining }', desc: { en: 'Get current SMS quota status.', ar: 'حالة حصة الرسائل.' } },
    ],
    example: `import { renderTemplate, sendSMS } from './services/smsTemplateService';

const msg = renderTemplate('tpl-1', { name: 'Ahmed', project: 'Palm Hills' }, 'en');
sendSMS('+201234567890', msg, 'tpl-1', 'Welcome');`,
  },
];

export default function APIDocsPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';

  const [activeService, setActiveService] = useState(SERVICES[0].id);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const t = useCallback((en, ar) => isRTL ? ar : en, [isRTL]);

  const filteredServices = useMemo(() => {
    if (!search) return SERVICES;
    const q = search.toLowerCase();
    return SERVICES.filter(s =>
      s.name.en.toLowerCase().includes(q) ||
      s.name.ar.includes(q) ||
      s.functions.some(f => f.name.toLowerCase().includes(q))
    );
  }, [search]);

  const activeData = SERVICES.find(s => s.id === activeService) || SERVICES[0];

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // ── Styles ─────────────────────────────────────────────────────────────

  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const cardBg = isDark ? '#1a2332' : '#ffffff';
  const cardBorder = isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0';
  const innerBg = isDark ? '#132337' : '#f8fafc';
  const codeBg = isDark ? '#0d1b2a' : '#1e293b';
  const sidebarBg = isDark ? '#132337' : '#f8fafc';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ padding: '24px 16px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <BookOpen size={22} style={{ color: '#4A7AAB' }} />
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: textPrimary }}>
          {t('API Documentation', 'توثيق API')}
        </h1>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20, position: 'relative' }}>
        <Search size={16} style={{
          position: 'absolute', top: 11,
          ...(isRTL ? { right: 12 } : { left: 12 }),
          color: textSecondary,
        }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('Search services or functions...', 'ابحث عن الخدمات أو الدوال...')}
          style={{
            width: '100%', padding: '10px 14px',
            ...(isRTL ? { paddingRight: 38 } : { paddingLeft: 38 }),
            background: cardBg, border: cardBorder, borderRadius: 12,
            color: textPrimary, fontSize: 14, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Sidebar */}
        <div style={{
          width: 240, flexShrink: 0, background: sidebarBg,
          borderRadius: 14, border: cardBorder, padding: '12px 8px',
          position: 'sticky', top: 80, maxHeight: 'calc(100vh - 160px)', overflow: 'auto',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: textSecondary, padding: '4px 10px', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('Services', 'الخدمات')} ({filteredServices.length})
          </div>
          {filteredServices.map(s => {
            const isActive = s.id === activeService;
            return (
              <button
                key={s.id}
                onClick={() => setActiveService(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '9px 12px', borderRadius: 10, border: 'none',
                  background: isActive ? 'rgba(74,122,171,0.15)' : 'transparent',
                  color: isActive ? '#4A7AAB' : textPrimary,
                  cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 600 : 400,
                  textAlign: isRTL ? 'right' : 'left', marginBottom: 2,
                  transition: 'all 0.15s',
                }}
              >
                <Database size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isRTL ? s.name.ar : s.name.en}
                </span>
                {isActive && <ChevronRight size={14} style={{ marginInlineStart: 'auto', opacity: 0.5 }} />}
              </button>
            );
          })}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Service header */}
          <div style={{ ...{ background: cardBg, border: cardBorder, borderRadius: 16, padding: 24 }, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'rgba(74,122,171,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Code2 size={20} style={{ color: '#4A7AAB' }} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: textPrimary }}>
                  {isRTL ? activeData.name.ar : activeData.name.en}
                </h2>
                <div style={{ fontSize: 12, color: textSecondary, marginTop: 2, fontFamily: 'monospace' }}>
                  {activeData.file}
                </div>
              </div>
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 14, color: textSecondary, lineHeight: 1.6 }}>
              {isRTL ? activeData.description.ar : activeData.description.en}
            </p>
            <div style={{
              marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 8, background: innerBg, fontSize: 12, color: textSecondary,
            }}>
              <Database size={12} />
              <span style={{ fontWeight: 500 }}>{t('Storage:', 'التخزين:')}</span>
              <span style={{ fontFamily: 'monospace', color: textPrimary }}>{activeData.storageKey}</span>
            </div>
          </div>

          {/* Functions */}
          <div style={{ ...{ background: cardBg, border: cardBorder, borderRadius: 16, padding: 24 }, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <FileText size={16} style={{ color: '#4A7AAB' }} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: textPrimary }}>
                {t('Functions', 'الدوال')} ({activeData.functions.length})
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeData.functions.map((fn, i) => (
                <div key={i} style={{
                  padding: '14px 16px', borderRadius: 12, background: innerBg,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <code style={{
                          fontSize: 14, fontWeight: 700, color: '#4A7AAB',
                          fontFamily: "'SF Mono', 'Fira Code', monospace",
                        }}>
                          {fn.name}
                        </code>
                        <button
                          onClick={() => handleCopy(`${fn.name}(${fn.params})`, `fn-${i}`)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                            color: copiedId === `fn-${i}` ? '#10b981' : textSecondary, display: 'flex',
                          }}
                          title="Copy"
                        >
                          {copiedId === `fn-${i}` ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>
                      <div style={{ fontSize: 12, color: textSecondary, fontFamily: 'monospace', marginBottom: 6 }}>
                        ({fn.params || ''}) → <span style={{ color: '#f59e0b' }}>{fn.returns}</span>
                      </div>
                      <div style={{ fontSize: 13, color: textPrimary, lineHeight: 1.5 }}>
                        {isRTL ? fn.desc.ar : fn.desc.en}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Example */}
          <div style={{ ...{ background: cardBg, border: cardBorder, borderRadius: 16, padding: 24 } }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Code2 size={16} style={{ color: '#4A7AAB' }} />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: textPrimary }}>
                  {t('Example Usage', 'مثال الاستخدام')}
                </h3>
              </div>
              <button
                onClick={() => handleCopy(activeData.example, 'example')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                  background: 'rgba(74,122,171,0.1)', border: '1px solid rgba(74,122,171,0.3)',
                  borderRadius: 8, cursor: 'pointer',
                  color: copiedId === 'example' ? '#10b981' : '#4A7AAB', fontSize: 12,
                }}
              >
                {copiedId === 'example' ? <Check size={12} /> : <Copy size={12} />}
                {copiedId === 'example' ? t('Copied!', 'تم النسخ!') : t('Copy', 'نسخ')}
              </button>
            </div>
            <pre style={{
              margin: 0, padding: 18, borderRadius: 12, background: codeBg,
              color: '#e2e8f0', fontSize: 13, lineHeight: 1.7, overflow: 'auto',
              fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              {activeData.example}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
