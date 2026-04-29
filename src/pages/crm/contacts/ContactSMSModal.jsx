import { useState, useEffect, useMemo, useRef } from 'react';
import { Phone, X, Send, MessageSquare } from 'lucide-react';
import { getTemplates, renderBody, sendSMS, SAMPLE_DATA } from '../../../services/smsTemplateService';
import { Button } from '../../../components/ui/';
import { logAction } from '../../../services/auditService';
import { useFocusTrap } from '../../../utils/hooks';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';

// ── Contact SMS Modal ────────────────────────────────────────────────────
export default function ContactSMSModal({ contact, isRTL, onClose, onSent }) {
  const { profile } = useAuth();
  const toast = useToast();
  const templates = useMemo(() => getTemplates(), []);
  const [selectedId, setSelectedId] = useState(templates[0]?.id || '');
  const [lang, setLang] = useState(isRTL ? 'ar' : 'en');
  const [sending, setSending] = useState(false);

  const contactData = useMemo(() => ({
    client_name: contact.full_name || '',
    client_phone: contact.phone || '',
    project_name: contact.project || SAMPLE_DATA.project_name,
    // Use the logged-in user's actual name for the {agent_name} template var.
    // SAMPLE_DATA.agent_name is a hardcoded test string — using it in real SMS
    // would put a placeholder name in production messages.
    agent_name: profile?.full_name_en || profile?.full_name_ar || SAMPLE_DATA.agent_name,
    company_name: contact.company || SAMPLE_DATA.company_name,
    date: new Date().toLocaleDateString('en-GB'),
    amount: SAMPLE_DATA.amount,
  }), [contact, profile]);

  const selectedTemplate = (templates || []).find(t => t.id === selectedId);
  const body = selectedTemplate ? (lang === 'ar' ? (selectedTemplate.bodyAr || selectedTemplate.body) : selectedTemplate.body) : '';
  const preview = renderBody(body, contactData);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [onClose]);

  const dialogRef = useRef(null);
  useFocusTrap(dialogRef);

  const handleSend = async () => {
    if (!selectedTemplate || !contact.phone || sending) return;
    setSending(true);
    try {
      // Previously fired-and-forgot — any error vanished and onSent ran as if successful.
      await sendSMS(contact.phone, preview, selectedTemplate.id, selectedTemplate.name);
      logAction({ action: 'create', entity: 'sms_send', entityId: contact.id, entityName: contact.full_name, description: `SMS sent to ${contact.full_name} (${contact.phone})` });
      toast.success(isRTL ? 'تم إرسال الرسالة' : 'SMS sent');
      onSent();
    } catch (err) {
      toast.error(isRTL ? `فشل الإرسال: ${err.message || ''}` : `Send failed: ${err.message || ''}`);
      setSending(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      dir={isRTL ? 'rtl' : 'ltr'}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sms-title"
        onClick={e => e.stopPropagation()}
        className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl w-full max-w-[420px] shadow-[0_12px_40px_rgba(27,51,71,0.2)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-edge dark:border-edge-dark">
          <span id="sms-title" className="text-sm font-bold text-content dark:text-content-dark flex items-center gap-2">
            <Send size={15} className="text-brand-500" />
            {isRTL ? 'إرسال SMS' : 'Send SMS'}
          </span>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-content-muted dark:text-content-muted-dark p-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-3.5">
          {/* To */}
          <div>
            <div className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'إلى' : 'To'}</div>
            <div className="text-xs text-content dark:text-content-dark bg-brand-500/[0.06] rounded-lg px-3 py-2 flex items-center gap-2">
              <Phone size={12} className="text-brand-500" />
              <span className="font-semibold">{contact.full_name}</span>
              <span className="text-content-muted dark:text-content-muted-dark" dir="ltr">{contact.phone}</span>
            </div>
          </div>

          {/* Template select */}
          <div>
            <div className="text-[11px] font-semibold text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'القالب' : 'Template'}</div>
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs outline-none font-cairo"
            >
              {(templates || []).map(t => (
                <option key={t.id} value={t.id}>{isRTL ? (t.nameAr || t.name) : t.name}</option>
              ))}
            </select>
          </div>

          {/* Language toggle */}
          <div className="flex gap-1.5">
            {['en', 'ar'].map(l => (
              <button key={l} onClick={() => setLang(l)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors font-cairo ${
                  lang === l
                    ? 'bg-brand-500/10 border-brand-500 text-brand-500'
                    : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'
                }`}>
                {l === 'en' ? 'English' : 'عربي'}
              </button>
            ))}
          </div>

          {/* Preview */}
          <div className="bg-brand-500/[0.05] border border-brand-500/10 rounded-xl px-3.5 py-3" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
            <div className="text-[10px] font-semibold text-brand-500 mb-1.5 flex items-center gap-1">
              <MessageSquare size={10} /> {isRTL ? 'معاينة' : 'Preview'}
            </div>
            <div className="text-xs text-content dark:text-content-dark leading-relaxed">
              {preview || (isRTL ? 'اختر قالب...' : 'Select a template...')}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-5 py-3.5 border-t border-edge dark:border-edge-dark">
          <Button variant="secondary" size="sm" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button size="sm" onClick={handleSend} disabled={!selectedTemplate || sending}>
            <Send size={12} />
            {sending ? (isRTL ? 'جاري...' : 'Sending...') : (isRTL ? 'إرسال' : 'Send')}
          </Button>
        </div>
      </div>
    </div>
  );
}
