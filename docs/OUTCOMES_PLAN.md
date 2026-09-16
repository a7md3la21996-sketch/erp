# خطة نظام «نتيجة المحادثة» (Conversation Outcomes)

_آخر تحديث: 2026-09-17 · الحالة: capture + display شغّالين على الإنتاج؛ الباقي مخطّط._

## 0. أين نحن الآن (Done)

- **Capture:** بعد أي تفاعل حقيقي (مكالمة «رد» / واتساب+إيميل «رد» / اجتماع «حضر») بيظهر
  picker إجباري **نتيجة المحادثة** في كل نقاط التسجيل (Take Action / Log Call / Meeting /
  Complete Task) عبر كمبوننت مشترك واحد `OutcomeSelect`.
- **Storage:** عمود `activities.outcome` (نص حر، بدون enum) + index. بيتكتب بـ update خفيف
  بعد `log_interaction` (من غير ما نلمس الـRPC المركزي).
- **Display:** `OutcomeBadge` جنب `ResultBadge` في تايم‑لاين الدرور وعمود «آخر تفاعل» في جدول Leads
  (الجدول عبر RPC `get_latest_feedback_per_contact` اللي بيرجّع outcome).
- **Taxonomy:** 15 نتيجة **مستخرجة من لغة الموظفين** (تحليل 7,444 ملاحظة مكالمة)، 3 مجموعات
  traffic-light. الـkeys المتقاعدة محفوظة في `LEGACY_OUTCOMES` للـback-compat.

> المصدر الوحيد للتصنيف: `CONVERSATION_OUTCOME_GROUPS` في
> `src/pages/crm/contacts/constants.jsx`.

---

## 1. الفكرة المحورية: معنى → أثر → قياس

النتيجة النهاردة مجرد **label**. قيمتها الحقيقية لما يبقى لكل outcome:
1. **نية موحّدة (intent)** تحدّد معناه في البايبلاين.
2. **أثر تلقائي** (اقتراح حالة/مرحلة + متابعة + توجيه) — دايماً **اقتراح** الموظف يقدر يرفضه، مش تنفيذ صامت.
3. **قياس** يغذّي التقارير والكوتشينج وقرارات المنتج/التسويق.

كل الأساس بيعتمد على **خريطة النية**.

---

## 2. خريطة النية (العمود الفقري)

ثلاث نيات: `hot` (فرصة نشطة) · `warm` (تنمية/متابعة) · `dead` (مقفول/خروج من البايبلاين).

| outcome (key) | العربي | المجموعة | intent | اقتراح الحالة | سبب الاستبعاد (DQ) | المتابعة الافتراضية |
|---|---|---|---|---|---|---|
| `offer_sent` | بعتله عرض/أوفر | moving | **hot** | has_opportunity | — | +2 أيام |
| `wants_meeting` | عايز معاينة/زيارة | moving | **hot** | has_opportunity | — | احجز زيارة |
| `callback_scheduled` | هيكلّمني/حدّد ميعاد | moving | **hot** | following | — | في الميعاد المتفق |
| `interested` | مهتم | moving | warm | following | — | +2 أيام |
| `wants_info` | طلب تفاصيل (واتساب) | moving | warm | following | — | +1 يوم (بعد الإرسال) |
| `wants_ready` | عايز استلام فوري/قريب | objection | warm | following | — | +3 أيام (لما يبقى في stock فوري) |
| `price_high` | السعر غالي/فوق ميزانيته | objection | warm | following | — | +3 أيام (إعادة تفاوض) |
| `needs_time` | محتاج وقت يفكر | objection | warm | following | — | +5–7 أيام |
| `comparing` | بيقارن عروض | objection | warm | following | — | +3 أيام |
| `not_interested` | غير مهتم / صرف نظر | lost | **dead** | disqualified | `not_interested` | — |
| `already_bought` | اشترى بالفعل | lost | **dead** | disqualified | `existing_client` | — |
| `broker` | بروكر/سمسار (مش عميل) | lost | **dead** | disqualified | `wrong_audience` | — |
| `no_budget` | مش قادر مادياً | lost | dead/recycle | disqualified | `no_budget` | (اختياري) recycle 3–6 شهور |
| `wrong_person` | رقم/شخص غلط | lost | **dead** | disqualified | `wrong_number` | — |
| `do_not_contact` | ممنوع التواصل | lost | **dead** | disqualified + suppress | `other` (أو reason جديد) | — |

> أسباب الاستبعاد الموجودة حالياً (`DQ_REASONS` في `TakeActionForm.jsx`): existing_client,
> resale, not_interested, no_answer_all_time, no_budget, wrong_audience, wrong_number,
> duplicate, other. لو حبينا سبب مستقل لـ«ممنوع التواصل» نضيفه.

**قرار مبدئي:** الأثر دايماً **اقتراح** (pre-select قابل للتعديل)، مش auto صامت — لمنع الموظف
يلغي/يرفّع ليدات بالغلط، ولحماية الداتا من الـgaming.

---

## 3. المراحل (Phases)

### Phase 1 — النية + اقتراح الحالة  ⭐ (الأعلى قيمة، الأقل تكلفة)
- أضيف `intent` لكل outcome في `constants.jsx` (خاصية جوّه الـgroup/العنصر) + helper `getOutcomeIntent(key)`.
- في نفس الفورم اللي بيختار فيه الـoutcome: لما النية = dead → **يقترح** الحالة «استبعاد» +
  يملأ سبب الـDQ من الخريطة (الموظف يقدر يغيّر). لما hot → يقترح «لديه فرصة».
- Frontend فقط. مفيش migration (بيستخدم حالة/DQ الموجودين).
- **مخرج:** كل نتيجة بتحرّك البايبلاين فعلياً بضغطة تأكيد.

### Phase 2 — متابعة مدفوعة بالـoutcome
- الـoutcome يحدّد **نوع وميعاد** الخطوة الجاية تلقائياً (عمود «المتابعة الافتراضية» فوق):
  `callback_scheduled` → تاسك في الوقت المذكور · `needs_time` → snooze أطول · dead → من غير متابعة.
- Frontend (منطق preset). ممكن نستخرج أوقات من النص لاحقاً (NLP خفيف) — مؤجّل.

### Phase 3 — تجهيز القياس: denormalize آخر نتيجة على العميل
- عمود `contacts.last_outcome` (+ `last_outcome_at`) يتحدّث بـtrigger على insert/update للـactivities
  (نفس نمط [denormalized-names-trigger]). Migration بسيط + backfill.
- يفعّل: **فلتر outcome في Leads**، chip على مستوى العميل، وتقارير أسرع من غير joins ثقيلة.

### Phase 4 — التقارير (القيمة الإدارية)
- **«ليه بنخسر»:** توزيع أسباب القفل/الاعتراض (السعر · استلام فوري · بروكر · …) → feedback
  للتسويق والمنتج (أنهي اعتراض بيتكرر، أنهي منطقة/سعر).
- **التحويل حسب الـoutcome:** أنهي نتيجة بتوصل فعلاً لـDeal → نتأكد إن تصنيف «hot» صح ونعدّله.
- **لكل موظف:** مزيج النتايج (كوتشينج — مين بيقفل كله «غير مهتم»، مين بيوصل عروض).
- **الفانل:** تفاعل → outcome → deal، مع نقطة التسريب. (RPC للتجميع + تبويب في Reports — يعتمد على Phase 3.)

### Phase 5 — تنبيهات وفتح Deal للحار
- outcome حار (`offer_sent` / `wants_meeting`) → تنبيه للتيم‑ليدر و/أو **prompt لفتح Deal** من الدرور.
- يربط الـoutcome بتبويب Deals (المكان الرسمي للحجز/البيع).

### Phase 6 — إعادة تدوير (Recycling)
- `no_budget` / `needs_time` → قائمة recycle بعد 3–6 شهور (مع timestamps لمنع الـgaming) بدل ما تموت.

---

## 4. اعتبارات الداتا والنزاهة (Integrity)

- **اقتراح لا تنفيذ:** أي تغيير حالة من outcome = pre-select قابل للرفض. مفيش auto-DQ صامت.
- **Back-compat:** الـkeys القديمة محفوظة في `LEGACY_OUTCOMES` — أي تعديل تصنيف مستقبلي لازم يفضل
  يعرض الـbadges المتسجّلة.
- **مصدر واحد للحقيقة:** التصنيف والنية والألوان كلها من `constants.jsx` بس.
- **anti-gaming:** timestamps على الـrecycle/الـDQ؛ مراقبة الموظف اللي بيقفل نسبة شاذة «غير مهتم».
- **الـoutcome ≠ Deal:** الحجز/البيع الفعلي بيتسجّل في تبويب Deals؛ الـoutcome إشارة محادثة مش معاملة.

## 5. قرارات مطلوبة (Open questions)

1. اقتراح الحالة: pre-select قابل للتعديل (المُوصى به) ولا auto مع undo؟
2. `no_budget`: استبعاد نهائي ولا recycle بعد فترة؟
3. نضيف سبب DQ مستقل لـ«ممنوع التواصل» ولا نستخدم `other`؟
4. `do_not_contact` هل يقفل الإشعارات/التوزيع (suppress) على مستوى الـDB؟
5. denormalize آخر outcome (Phase 3) دلوقتي ولا نستنى الحاجة للفلتر/التقارير؟

## 6. الترتيب المقترح للتنفيذ

`Phase 1` (نية + اقتراح حالة) → `Phase 2` (متابعة ذكية) → `Phase 3` (denormalize) →
`Phase 4` (تقارير) → `Phase 5` (تنبيهات/Deal) → `Phase 6` (recycle).

الأساس اللي كله بيتعلّق عليه = **خريطة النية (Phase 1)**.
