// ── Operations Module — Mock Data & Config ──────────────────────────────

// ── Status Configs ──────────────────────────────────────────────────────

export const DEAL_STATUS_CONFIG = {
  new_deal:        { ar: 'صفقة جديدة',     en: 'New Deal',         color: '#4A7AAB', bg: 'rgba(74,122,171,0.12)',  step: 1 },
  under_review:    { ar: 'قيد المراجعة',    en: 'Under Review',     color: '#6B8DB5', bg: 'rgba(107,141,181,0.12)', step: 2 },
  docs_collection: { ar: 'تجميع المستندات', en: 'Collecting Docs',  color: '#2B4C6F', bg: 'rgba(43,76,111,0.12)',   step: 3 },
  contract_prep:   { ar: 'إعداد العقد',     en: 'Contract Prep',    color: '#2B4C6F', bg: 'rgba(43,76,111,0.15)',   step: 4 },
  contract_signed: { ar: 'تم التوقيع',      en: 'Contract Signed',  color: '#1B3347', bg: 'rgba(27,51,71,0.12)',    step: 5 },
  completed:       { ar: 'مكتمل',          en: 'Completed',        color: '#1B3347', bg: 'rgba(27,51,71,0.18)',    step: 6 },
  cancelled:       { ar: 'ملغي',           en: 'Cancelled',        color: '#EF4444', bg: 'rgba(239,68,68,0.08)',   step: 0 },
};

export const PAYMENT_STATUS_CONFIG = {
  upcoming: { ar: 'قادم',   en: 'Upcoming', color: '#6B8DB5', bg: 'rgba(107,141,181,0.12)' },
  due:      { ar: 'مستحق',  en: 'Due',      color: '#F97316', bg: 'rgba(249,115,22,0.10)'  },
  overdue:  { ar: 'متأخر',  en: 'Overdue',  color: '#EF4444', bg: 'rgba(239,68,68,0.08)'   },
  paid:     { ar: 'مدفوع',  en: 'Paid',     color: '#2B4C6F', bg: 'rgba(43,76,111,0.12)'   },
  partial:  { ar: 'جزئي',   en: 'Partial',  color: '#4A7AAB', bg: 'rgba(74,122,171,0.12)'  },
};

export const HANDOVER_STATUS_CONFIG = {
  reserved:            { ar: 'محجوز',        en: 'Reserved',           color: '#4A7AAB', bg: 'rgba(74,122,171,0.12)' },
  developer_confirmed: { ar: 'تأكيد المطور', en: 'Developer Confirmed', color: '#6B8DB5', bg: 'rgba(107,141,181,0.12)' },
  under_construction:  { ar: 'تحت الإنشاء',  en: 'Under Construction',  color: '#2B4C6F', bg: 'rgba(43,76,111,0.12)' },
  finishing:           { ar: 'تشطيب',        en: 'Finishing',           color: '#2B4C6F', bg: 'rgba(43,76,111,0.15)' },
  ready:               { ar: 'جاهز للتسليم', en: 'Ready',              color: '#1B3347', bg: 'rgba(27,51,71,0.15)' },
  handed_over:         { ar: 'تم التسليم',   en: 'Handed Over',        color: '#1B3347', bg: 'rgba(27,51,71,0.18)' },
};

export const TICKET_STATUS_CONFIG = {
  open:        { ar: 'مفتوح',       en: 'Open',        color: '#EF4444', bg: 'rgba(239,68,68,0.08)'  },
  in_progress: { ar: 'قيد المعالجة', en: 'In Progress', color: '#F97316', bg: 'rgba(249,115,22,0.10)' },
  waiting:     { ar: 'بانتظار رد',  en: 'Waiting',     color: '#6B8DB5', bg: 'rgba(107,141,181,0.12)' },
  resolved:    { ar: 'تم الحل',     en: 'Resolved',    color: '#4A7AAB', bg: 'rgba(74,122,171,0.12)' },
  closed:      { ar: 'مغلق',       en: 'Closed',      color: '#2B4C6F', bg: 'rgba(43,76,111,0.12)' },
};

export const TICKET_TYPE_CONFIG = {
  complaint:    { ar: 'شكوى',         en: 'Complaint',    color: '#EF4444' },
  maintenance:  { ar: 'صيانة',        en: 'Maintenance',  color: '#F97316' },
  inquiry:      { ar: 'استفسار',      en: 'Inquiry',      color: '#4A7AAB' },
  modification: { ar: 'تعديل بيانات', en: 'Modification', color: '#6B8DB5' },
};

export const PRIORITY_CONFIG = {
  urgent: { ar: 'عاجل',  en: 'Urgent', color: '#EF4444' },
  high:   { ar: 'عالي',  en: 'High',   color: '#2B4C6F' },
  medium: { ar: 'متوسط', en: 'Medium', color: '#6B8DB5' },
  low:    { ar: 'منخفض', en: 'Low',    color: '#8BA8C8' },
};

export const DOCUMENT_CHECKLIST = [
  { key: 'national_id',          ar: 'صورة البطاقة',   en: 'National ID',          required: true  },
  { key: 'reservation_form',     ar: 'استمارة الحجز',   en: 'Reservation Form',     required: true  },
  { key: 'down_payment_receipt', ar: 'إيصال المقدم',    en: 'Down Payment Receipt', required: true  },
  { key: 'contract',             ar: 'العقد',           en: 'Contract',             required: true  },
  { key: 'developer_receipt',    ar: 'إيصال المطور',    en: 'Developer Receipt',    required: true  },
  { key: 'power_of_attorney',    ar: 'توكيل',           en: 'Power of Attorney',    required: false },
  { key: 'unit_specs',           ar: 'مواصفات الوحدة',  en: 'Unit Specs',           required: false },
];

// ── Mock Deals ──────────────────────────────────────────────────────────

export const MOCK_OPS_DEALS = [
  { id: 'deal-001', deal_number: 'D-2026-001', client_ar: 'محمد عبد الله',  client_en: 'Mohamed Abdullah', phone: '01001234567', agent_ar: 'أحمد محمد',  agent_en: 'Ahmed Mohamed',  project_ar: 'سيليا العاصمة الادارية', project_en: 'Celia New Capital',    developer_ar: 'طلعت مصطفى',  developer_en: 'Talaat Moustafa', unit_code: 'A-204', unit_type_ar: 'شقة',    unit_type_en: 'Apartment', deal_value: 2500000,  down_payment: 500000,  installments_count: 8,  status: 'new_deal',        created_at: '2026-03-08', documents: { national_id: true,  reservation_form: true,  down_payment_receipt: false, contract: false, developer_receipt: false } },
  { id: 'deal-002', deal_number: 'D-2026-002', client_ar: 'لمياء خليل',     client_en: 'Lamiaa Khalil',    phone: '01112345678', agent_ar: 'خالد عمر',   agent_en: 'Khaled Omar',    project_ar: 'ريفان الشيخ زايد',       project_en: 'Rivan Sheikh Zayed',   developer_ar: 'ريبورتاج',    developer_en: 'Reportage',       unit_code: 'V-12',  unit_type_ar: 'فيلا',   unit_type_en: 'Villa',     deal_value: 7200000,  down_payment: 1440000, installments_count: 12, status: 'new_deal',        created_at: '2026-03-09', documents: { national_id: true,  reservation_form: false, down_payment_receipt: false, contract: false, developer_receipt: false } },
  { id: 'deal-003', deal_number: 'D-2026-003', client_ar: 'ياسر نجيب',      client_en: 'Yasser Naguib',    phone: '01223456789', agent_ar: 'محمود حسن',  agent_en: 'Mahmoud Hassan', project_ar: 'سيليا العاصمة الادارية', project_en: 'Celia New Capital',    developer_ar: 'طلعت مصطفى',  developer_en: 'Talaat Moustafa', unit_code: 'B-501', unit_type_ar: 'شقة',    unit_type_en: 'Apartment', deal_value: 4500000,  down_payment: 900000,  installments_count: 10, status: 'under_review',    created_at: '2026-03-05', documents: { national_id: true,  reservation_form: true,  down_payment_receipt: true,  contract: false, developer_receipt: false } },
  { id: 'deal-004', deal_number: 'D-2026-004', client_ar: 'كريم فوزي',      client_en: 'Karim Fawzy',      phone: '01098765432', agent_ar: 'أحمد محمد',  agent_en: 'Ahmed Mohamed',  project_ar: 'تاون جيت 6 اكتوبر',     project_en: 'Town Gate October',    developer_ar: 'اورا',        developer_en: 'ORA',             unit_code: 'TH-08', unit_type_ar: 'تاون هاوس', unit_type_en: 'Townhouse', deal_value: 3200000,  down_payment: 640000,  installments_count: 8,  status: 'under_review',    created_at: '2026-03-03', documents: { national_id: true,  reservation_form: true,  down_payment_receipt: true,  contract: false, developer_receipt: false } },
  { id: 'deal-005', deal_number: 'D-2026-005', client_ar: 'وليد جمال',      client_en: 'Walid Gamal',      phone: '01155544433', agent_ar: 'محمود حسن',  agent_en: 'Mahmoud Hassan', project_ar: 'سيليا العاصمة الادارية', project_en: 'Celia New Capital',    developer_ar: 'طلعت مصطفى',  developer_en: 'Talaat Moustafa', unit_code: 'C-302', unit_type_ar: 'دوبلكس',  unit_type_en: 'Duplex',    deal_value: 5500000,  down_payment: 1100000, installments_count: 10, status: 'docs_collection', created_at: '2026-02-25', documents: { national_id: true,  reservation_form: true,  down_payment_receipt: true,  contract: false, developer_receipt: false } },
  { id: 'deal-006', deal_number: 'D-2026-006', client_ar: 'طارق ابراهيم',   client_en: 'Tarek Ibrahim',    phone: '01066677788', agent_ar: 'نورا احمد',  agent_en: 'Noura Ahmed',    project_ar: 'بلو تري المرج',          project_en: 'Blue Tree El Marg',    developer_ar: 'سيتي إيدج',   developer_en: 'City Edge',       unit_code: 'D-105', unit_type_ar: 'شقة',    unit_type_en: 'Apartment', deal_value: 1350000,  down_payment: 270000,  installments_count: 6,  status: 'docs_collection', created_at: '2026-02-20', documents: { national_id: true,  reservation_form: true,  down_payment_receipt: true,  contract: false, developer_receipt: true  } },
  { id: 'deal-007', deal_number: 'D-2026-007', client_ar: 'سمر الحسيني',    client_en: 'Samar Elhosseiny', phone: '01277788899', agent_ar: 'سارة علي',   agent_en: 'Sara Ali',       project_ar: 'ريفان الشيخ زايد',       project_en: 'Rivan Sheikh Zayed',   developer_ar: 'ريبورتاج',    developer_en: 'Reportage',       unit_code: 'A-410', unit_type_ar: 'شقة',    unit_type_en: 'Apartment', deal_value: 1800000,  down_payment: 360000,  installments_count: 8,  status: 'contract_prep',   created_at: '2026-02-15', documents: { national_id: true,  reservation_form: true,  down_payment_receipt: true,  contract: false, developer_receipt: true  } },
  { id: 'deal-008', deal_number: 'D-2026-008', client_ar: 'منى الشريف',     client_en: 'Mona Elsherif',    phone: '01088899900', agent_ar: 'أحمد محمد',  agent_en: 'Ahmed Mohamed',  project_ar: 'بلو تري المرج',          project_en: 'Blue Tree El Marg',    developer_ar: 'سيتي إيدج',   developer_en: 'City Edge',       unit_code: 'E-203', unit_type_ar: 'شقة',    unit_type_en: 'Apartment', deal_value: 1650000,  down_payment: 330000,  installments_count: 8,  status: 'contract_prep',   created_at: '2026-02-10', documents: { national_id: true,  reservation_form: true,  down_payment_receipt: true,  contract: true,  developer_receipt: true  } },
  { id: 'deal-009', deal_number: 'D-2026-009', client_ar: 'عمر البدري',     client_en: 'Omar Elbadry',     phone: '01199900011', agent_ar: 'سارة علي',   agent_en: 'Sara Ali',       project_ar: 'سيليا العاصمة الادارية', project_en: 'Celia New Capital',    developer_ar: 'طلعت مصطفى',  developer_en: 'Talaat Moustafa', unit_code: 'A-712', unit_type_ar: 'شقة',    unit_type_en: 'Apartment', deal_value: 3800000,  down_payment: 760000,  installments_count: 10, status: 'contract_signed', created_at: '2026-01-20', documents: { national_id: true,  reservation_form: true,  down_payment_receipt: true,  contract: true,  developer_receipt: true  } },
  { id: 'deal-010', deal_number: 'D-2026-010', client_ar: 'ريم السيد',      client_en: 'Reem Elsayed',     phone: '01022233344', agent_ar: 'خالد عمر',   agent_en: 'Khaled Omar',    project_ar: 'ريفان الشيخ زايد',       project_en: 'Rivan Sheikh Zayed',   developer_ar: 'ريبورتاج',    developer_en: 'Reportage',       unit_code: 'B-108', unit_type_ar: 'شقة',    unit_type_en: 'Apartment', deal_value: 2100000,  down_payment: 420000,  installments_count: 8,  status: 'contract_signed', created_at: '2026-01-15', documents: { national_id: true,  reservation_form: true,  down_payment_receipt: true,  contract: true,  developer_receipt: true  } },
  { id: 'deal-011', deal_number: 'D-2025-045', client_ar: 'دينا مصطفى',     client_en: 'Dina Mostafa',     phone: '01033344455', agent_ar: 'نورا احمد',  agent_en: 'Noura Ahmed',    project_ar: 'تاون جيت 6 اكتوبر',     project_en: 'Town Gate October',    developer_ar: 'اورا',        developer_en: 'ORA',             unit_code: 'TH-03', unit_type_ar: 'تاون هاوس', unit_type_en: 'Townhouse', deal_value: 4100000,  down_payment: 820000,  installments_count: 10, status: 'completed',       created_at: '2025-11-10', documents: { national_id: true,  reservation_form: true,  down_payment_receipt: true,  contract: true,  developer_receipt: true  } },
  { id: 'deal-012', deal_number: 'D-2026-005B', client_ar: 'هالة منصور',    client_en: 'Hala Mansour',     phone: '01044455566', agent_ar: 'نورا احمد',  agent_en: 'Noura Ahmed',    project_ar: 'بلو تري المرج',          project_en: 'Blue Tree El Marg',    developer_ar: 'سيتي إيدج',   developer_en: 'City Edge',       unit_code: 'F-101', unit_type_ar: 'شقة',    unit_type_en: 'Apartment', deal_value: 950000,   down_payment: 190000,  installments_count: 6,  status: 'cancelled',       created_at: '2026-02-01', documents: { national_id: true,  reservation_form: true,  down_payment_receipt: false, contract: false, developer_receipt: false } },
];

// ── Mock Installments ───────────────────────────────────────────────────

export const MOCK_INSTALLMENTS = [
  // Deal 009 - عمر البدري (contract_signed) - 10 installments, 3 paid
  { id: 'inst-001', deal_id: 'deal-009', deal_number: 'D-2026-009', client_ar: 'عمر البدري',   client_en: 'Omar Elbadry',    project_ar: 'سيليا العاصمة الادارية', project_en: 'Celia New Capital',  num: 1, total: 10, amount: 304000, due_date: '2026-01-01', paid_date: '2026-01-02', status: 'paid',     method: 'bank_transfer', receipt: 'R-090001' },
  { id: 'inst-002', deal_id: 'deal-009', deal_number: 'D-2026-009', client_ar: 'عمر البدري',   client_en: 'Omar Elbadry',    project_ar: 'سيليا العاصمة الادارية', project_en: 'Celia New Capital',  num: 2, total: 10, amount: 304000, due_date: '2026-02-01', paid_date: '2026-02-03', status: 'paid',     method: 'bank_transfer', receipt: 'R-090002' },
  { id: 'inst-003', deal_id: 'deal-009', deal_number: 'D-2026-009', client_ar: 'عمر البدري',   client_en: 'Omar Elbadry',    project_ar: 'سيليا العاصمة الادارية', project_en: 'Celia New Capital',  num: 3, total: 10, amount: 304000, due_date: '2026-03-01', paid_date: '2026-03-02', status: 'paid',     method: 'cash',          receipt: 'R-090003' },
  { id: 'inst-004', deal_id: 'deal-009', deal_number: 'D-2026-009', client_ar: 'عمر البدري',   client_en: 'Omar Elbadry',    project_ar: 'سيليا العاصمة الادارية', project_en: 'Celia New Capital',  num: 4, total: 10, amount: 304000, due_date: '2026-04-01', paid_date: null,          status: 'upcoming', method: null,             receipt: null },
  { id: 'inst-005', deal_id: 'deal-009', deal_number: 'D-2026-009', client_ar: 'عمر البدري',   client_en: 'Omar Elbadry',    project_ar: 'سيليا العاصمة الادارية', project_en: 'Celia New Capital',  num: 5, total: 10, amount: 304000, due_date: '2026-05-01', paid_date: null,          status: 'upcoming', method: null,             receipt: null },
  // Deal 010 - ريم السيد (contract_signed) - 8 installments, 2 paid, 1 overdue
  { id: 'inst-006', deal_id: 'deal-010', deal_number: 'D-2026-010', client_ar: 'ريم السيد',    client_en: 'Reem Elsayed',    project_ar: 'ريفان الشيخ زايد',       project_en: 'Rivan Sheikh Zayed', num: 1, total: 8,  amount: 210000, due_date: '2026-01-15', paid_date: '2026-01-15', status: 'paid',     method: 'check',         receipt: 'R-100001' },
  { id: 'inst-007', deal_id: 'deal-010', deal_number: 'D-2026-010', client_ar: 'ريم السيد',    client_en: 'Reem Elsayed',    project_ar: 'ريفان الشيخ زايد',       project_en: 'Rivan Sheikh Zayed', num: 2, total: 8,  amount: 210000, due_date: '2026-02-15', paid_date: '2026-02-16', status: 'paid',     method: 'bank_transfer', receipt: 'R-100002' },
  { id: 'inst-008', deal_id: 'deal-010', deal_number: 'D-2026-010', client_ar: 'ريم السيد',    client_en: 'Reem Elsayed',    project_ar: 'ريفان الشيخ زايد',       project_en: 'Rivan Sheikh Zayed', num: 3, total: 8,  amount: 210000, due_date: '2026-03-01', paid_date: null,          status: 'overdue',  method: null,             receipt: null },
  { id: 'inst-009', deal_id: 'deal-010', deal_number: 'D-2026-010', client_ar: 'ريم السيد',    client_en: 'Reem Elsayed',    project_ar: 'ريفان الشيخ زايد',       project_en: 'Rivan Sheikh Zayed', num: 4, total: 8,  amount: 210000, due_date: '2026-04-01', paid_date: null,          status: 'upcoming', method: null,             receipt: null },
  // Deal 011 - دينا مصطفى (completed) - paid installments
  { id: 'inst-010', deal_id: 'deal-011', deal_number: 'D-2025-045', client_ar: 'دينا مصطفى',   client_en: 'Dina Mostafa',    project_ar: 'تاون جيت 6 اكتوبر',     project_en: 'Town Gate October',  num: 1, total: 10, amount: 328000, due_date: '2025-12-01', paid_date: '2025-12-01', status: 'paid',     method: 'bank_transfer', receipt: 'R-110001' },
  { id: 'inst-011', deal_id: 'deal-011', deal_number: 'D-2025-045', client_ar: 'دينا مصطفى',   client_en: 'Dina Mostafa',    project_ar: 'تاون جيت 6 اكتوبر',     project_en: 'Town Gate October',  num: 2, total: 10, amount: 328000, due_date: '2026-01-01', paid_date: '2026-01-03', status: 'paid',     method: 'cash',          receipt: 'R-110002' },
  { id: 'inst-012', deal_id: 'deal-011', deal_number: 'D-2025-045', client_ar: 'دينا مصطفى',   client_en: 'Dina Mostafa',    project_ar: 'تاون جيت 6 اكتوبر',     project_en: 'Town Gate October',  num: 3, total: 10, amount: 328000, due_date: '2026-02-01', paid_date: '2026-02-01', status: 'paid',     method: 'bank_transfer', receipt: 'R-110003' },
  { id: 'inst-013', deal_id: 'deal-011', deal_number: 'D-2025-045', client_ar: 'دينا مصطفى',   client_en: 'Dina Mostafa',    project_ar: 'تاون جيت 6 اكتوبر',     project_en: 'Town Gate October',  num: 4, total: 10, amount: 328000, due_date: '2026-03-01', paid_date: null,          status: 'due',      method: null,             receipt: null },
  { id: 'inst-014', deal_id: 'deal-011', deal_number: 'D-2025-045', client_ar: 'دينا مصطفى',   client_en: 'Dina Mostafa',    project_ar: 'تاون جيت 6 اكتوبر',     project_en: 'Town Gate October',  num: 5, total: 10, amount: 328000, due_date: '2026-04-01', paid_date: null,          status: 'upcoming', method: null,             receipt: null },
  // Deal 008 - منى الشريف (contract_prep) - partial payment
  { id: 'inst-015', deal_id: 'deal-008', deal_number: 'D-2026-008', client_ar: 'منى الشريف',   client_en: 'Mona Elsherif',   project_ar: 'بلو تري المرج',          project_en: 'Blue Tree El Marg',  num: 1, total: 8,  amount: 165000, due_date: '2026-03-10', paid_date: null,          status: 'due',      method: null,             receipt: null },
];

// ── Mock Handovers ──────────────────────────────────────────────────────

export const MOCK_HANDOVERS = [
  { id: 'ho-001', deal_id: 'deal-009', deal_number: 'D-2026-009', client_ar: 'عمر البدري',   client_en: 'Omar Elbadry',    project_ar: 'سيليا العاصمة الادارية', project_en: 'Celia New Capital',  developer_ar: 'طلعت مصطفى', developer_en: 'Talaat Moustafa', unit_code: 'A-712', reserved_date: '2026-01-20', expected_handover: '2027-06-30', actual_handover: null,         status: 'under_construction', dev_contact: 'أحمد سمير',    dev_phone: '01112223344', notes_ar: 'المرحلة الثانية - مبنى A' },
  { id: 'ho-002', deal_id: 'deal-010', deal_number: 'D-2026-010', client_ar: 'ريم السيد',    client_en: 'Reem Elsayed',    project_ar: 'ريفان الشيخ زايد',       project_en: 'Rivan Sheikh Zayed', developer_ar: 'ريبورتاج',   developer_en: 'Reportage',       unit_code: 'B-108', reserved_date: '2026-01-15', expected_handover: '2026-12-31', actual_handover: null,         status: 'developer_confirmed', dev_contact: 'محمد فؤاد',   dev_phone: '01223334455', notes_ar: 'تأكيد الحجز من المطور' },
  { id: 'ho-003', deal_id: 'deal-011', deal_number: 'D-2025-045', client_ar: 'دينا مصطفى',   client_en: 'Dina Mostafa',    project_ar: 'تاون جيت 6 اكتوبر',     project_en: 'Town Gate October',  developer_ar: 'اورا',       developer_en: 'ORA',             unit_code: 'TH-03', reserved_date: '2025-11-10', expected_handover: '2026-04-15', actual_handover: null,         status: 'finishing',           dev_contact: 'كريم سعيد',   dev_phone: '01334445566', notes_ar: 'التشطيب جاري - متبقي شهر' },
  { id: 'ho-004', deal_id: 'deal-old1', deal_number: 'D-2025-030', client_ar: 'أسامة فتحي', client_en: 'Osama Fathy',     project_ar: 'سيليا العاصمة الادارية', project_en: 'Celia New Capital',  developer_ar: 'طلعت مصطفى', developer_en: 'Talaat Moustafa', unit_code: 'D-602', reserved_date: '2025-06-01', expected_handover: '2026-03-15', actual_handover: null,         status: 'ready',               dev_contact: 'أحمد سمير',   dev_phone: '01112223344', notes_ar: 'جاهز للتسليم - بانتظار العميل' },
  { id: 'ho-005', deal_id: 'deal-old2', deal_number: 'D-2025-022', client_ar: 'فاطمة الزهراء', client_en: 'Fatma Elzahraa', project_ar: 'ريفان الشيخ زايد',       project_en: 'Rivan Sheikh Zayed', developer_ar: 'ريبورتاج',   developer_en: 'Reportage',       unit_code: 'C-305', reserved_date: '2025-04-10', expected_handover: '2025-12-30', actual_handover: '2026-01-05', status: 'handed_over',         dev_contact: 'محمد فؤاد',   dev_phone: '01223334455', notes_ar: 'تم التسليم بنجاح' },
  { id: 'ho-006', deal_id: 'deal-old3', deal_number: 'D-2025-018', client_ar: 'حسام عادل',   client_en: 'Hossam Adel',     project_ar: 'بلو تري المرج',          project_en: 'Blue Tree El Marg',  developer_ar: 'سيتي إيدج',  developer_en: 'City Edge',       unit_code: 'G-401', reserved_date: '2025-03-20', expected_handover: '2026-06-30', actual_handover: null,         status: 'under_construction', dev_contact: 'سامي جمال',   dev_phone: '01445556677', notes_ar: 'المبنى G - الدور الرابع' },
  { id: 'ho-007', deal_id: 'deal-005', deal_number: 'D-2026-005', client_ar: 'وليد جمال',    client_en: 'Walid Gamal',     project_ar: 'سيليا العاصمة الادارية', project_en: 'Celia New Capital',  developer_ar: 'طلعت مصطفى', developer_en: 'Talaat Moustafa', unit_code: 'C-302', reserved_date: '2026-02-25', expected_handover: '2027-09-30', actual_handover: null,         status: 'reserved',            dev_contact: 'أحمد سمير',   dev_phone: '01112223344', notes_ar: 'في انتظار تأكيد المطور' },
];

// ── Mock Tickets ─────────────────────────────────────────────────────────

export const MOCK_TICKETS = [
  { id: 'tkt-001', ticket_number: 'T-2026-001', deal_id: 'deal-old2', client_ar: 'فاطمة الزهراء', client_en: 'Fatma Elzahraa', type: 'complaint',    priority: 'high',   subject_ar: 'تأخر موعد التسليم 5 أيام',          subject_en: 'Handover delayed by 5 days',     assigned_ar: 'سارة علي',   assigned_en: 'Sara Ali',     status: 'resolved',    created_at: '2026-01-10', resolved_at: '2026-01-15', rating: 4 },
  { id: 'tkt-002', ticket_number: 'T-2026-002', deal_id: 'deal-old1', client_ar: 'أسامة فتحي',    client_en: 'Osama Fathy',    type: 'inquiry',      priority: 'medium', subject_ar: 'استفسار عن موعد التسليم النهائي',     subject_en: 'Asking about final handover date', assigned_ar: 'خالد عمر',  assigned_en: 'Khaled Omar',  status: 'closed',      created_at: '2026-02-20', resolved_at: '2026-02-21', rating: 5 },
  { id: 'tkt-003', ticket_number: 'T-2026-003', deal_id: 'deal-009', client_ar: 'عمر البدري',     client_en: 'Omar Elbadry',   type: 'modification', priority: 'low',    subject_ar: 'تعديل اسم في العقد',                  subject_en: 'Name correction in contract',     assigned_ar: 'نورا احمد', assigned_en: 'Noura Ahmed',  status: 'in_progress', created_at: '2026-03-05', resolved_at: null, rating: null },
  { id: 'tkt-004', ticket_number: 'T-2026-004', deal_id: 'deal-010', client_ar: 'ريم السيد',      client_en: 'Reem Elsayed',   type: 'complaint',    priority: 'urgent', subject_ar: 'مشكلة في جودة التشطيب',                subject_en: 'Finishing quality issue',          assigned_ar: 'سارة علي',  assigned_en: 'Sara Ali',     status: 'open',        created_at: '2026-03-08', resolved_at: null, rating: null },
  { id: 'tkt-005', ticket_number: 'T-2026-005', deal_id: 'deal-old3', client_ar: 'حسام عادل',     client_en: 'Hossam Adel',    type: 'maintenance',  priority: 'medium', subject_ar: 'تسريب مياه في الحمام',                 subject_en: 'Bathroom water leak',              assigned_ar: 'محمود حسن', assigned_en: 'Mahmoud Hassan', status: 'open',      created_at: '2026-03-09', resolved_at: null, rating: null },
  { id: 'tkt-006', ticket_number: 'T-2026-006', deal_id: 'deal-011', client_ar: 'دينا مصطفى',    client_en: 'Dina Mostafa',   type: 'inquiry',      priority: 'low',    subject_ar: 'طلب نسخة من العقد',                    subject_en: 'Requesting contract copy',         assigned_ar: 'نورا احمد', assigned_en: 'Noura Ahmed',  status: 'waiting',     created_at: '2026-03-07', resolved_at: null, rating: null },
  { id: 'tkt-007', ticket_number: 'T-2026-007', deal_id: 'deal-old2', client_ar: 'فاطمة الزهراء', client_en: 'Fatma Elzahraa', type: 'maintenance',  priority: 'high',   subject_ar: 'عطل في التكييف المركزي',               subject_en: 'Central AC malfunction',           assigned_ar: 'سارة علي',  assigned_en: 'Sara Ali',     status: 'in_progress', created_at: '2026-03-10', resolved_at: null, rating: null },
  { id: 'tkt-008', ticket_number: 'T-2026-008', deal_id: 'deal-009', client_ar: 'عمر البدري',     client_en: 'Omar Elbadry',   type: 'inquiry',      priority: 'low',    subject_ar: 'استفسار عن مواعيد السداد القادمة',     subject_en: 'Next payment dates inquiry',       assigned_ar: 'خالد عمر',  assigned_en: 'Khaled Omar',  status: 'resolved',    created_at: '2026-02-15', resolved_at: '2026-02-16', rating: 5 },
];

// ── Mock Activity Log (for Overview timeline) ───────────────────────────

export const MOCK_OPS_ACTIVITY = [
  { id: 'log-001', type: 'deal_created',       description_ar: 'صفقة جديدة D-2026-002 — لمياء خليل — ريفان الشيخ زايد',             description_en: 'New deal D-2026-002 — Lamiaa Khalil — Rivan Sheikh Zayed',       user_ar: 'خالد عمر',   user_en: 'Khaled Omar',    timestamp: '2026-03-09T14:20:00' },
  { id: 'log-002', type: 'deal_created',       description_ar: 'صفقة جديدة D-2026-001 — محمد عبد الله — سيليا العاصمة',             description_en: 'New deal D-2026-001 — Mohamed Abdullah — Celia New Capital',     user_ar: 'أحمد محمد',  user_en: 'Ahmed Mohamed',  timestamp: '2026-03-08T10:15:00' },
  { id: 'log-003', type: 'payment_received',   description_ar: 'تم تحصيل القسط 3 — عمر البدري — 304,000 ج.م',                       description_en: 'Payment received inst. 3 — Omar Elbadry — 304,000 EGP',         user_ar: 'نورا احمد',  user_en: 'Noura Ahmed',    timestamp: '2026-03-02T11:30:00' },
  { id: 'log-004', type: 'ticket_opened',      description_ar: 'تذكرة جديدة T-2026-007 — فاطمة الزهراء — عطل تكييف',               description_en: 'New ticket T-2026-007 — Fatma Elzahraa — AC malfunction',        user_ar: 'سارة علي',   user_en: 'Sara Ali',       timestamp: '2026-03-10T09:00:00' },
  { id: 'log-005', type: 'deal_status_change', description_ar: 'D-2026-008 انتقلت لـ "إعداد العقد" — منى الشريف',                    description_en: 'D-2026-008 moved to "Contract Prep" — Mona Elsherif',            user_ar: 'أحمد محمد',  user_en: 'Ahmed Mohamed',  timestamp: '2026-03-07T16:45:00' },
  { id: 'log-006', type: 'ticket_resolved',    description_ar: 'تم حل التذكرة T-2026-008 — عمر البدري — استفسار مواعيد سداد',       description_en: 'Ticket T-2026-008 resolved — Omar Elbadry — Payment dates',      user_ar: 'خالد عمر',   user_en: 'Khaled Omar',    timestamp: '2026-02-16T10:00:00' },
  { id: 'log-007', type: 'handover_update',    description_ar: 'تحديث حالة تسليم D-2025-045 — دينا مصطفى — تشطيب',                  description_en: 'Handover update D-2025-045 — Dina Mostafa — Finishing',           user_ar: 'محمود حسن',  user_en: 'Mahmoud Hassan', timestamp: '2026-03-01T13:20:00' },
  { id: 'log-008', type: 'document_uploaded',  description_ar: 'تم رفع العقد — D-2026-008 — منى الشريف',                             description_en: 'Contract uploaded — D-2026-008 — Mona Elsherif',                 user_ar: 'أحمد محمد',  user_en: 'Ahmed Mohamed',  timestamp: '2026-03-06T14:10:00' },
];

// ── Helpers ──────────────────────────────────────────────────────────────

export const fmtMoney = (n) => {
  if (!n && n !== 0) return '-';
  return n.toLocaleString('en-US') + ' EGP';
};

export const fmtMoneyShort = (n) => {
  if (!n) return '-';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return n.toLocaleString('en-US');
};

export const daysSince = (dateStr) => {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

export const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};
