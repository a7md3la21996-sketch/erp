import { useState, useEffect } from 'react';
import { MessageCircle, X, Send, ExternalLink, Download } from 'lucide-react';
import {
  logMessage as logWhatsAppMessage, getTemplates as getWhatsAppTemplates,
  generateWhatsAppLink, fillTemplate, getMessagesByContact,
} from '../../../services/whatsappService';
import { normalizePhone } from './constants';

// Quick WhatsApp composer shown inline under the drawer action bar.
// Extracted from ContactDrawer so its templates + recent-messages fetches
// only fire when the popup is actually opened (it mounts on open), instead
// of running on every contact navigation. Parent owns the `showWAPopup`
// visibility flag (keyboard-nav guards need it) and renders this only when
// open AND the contact has a phone number.
export default function WhatsAppQuickPopup({ contact, isRTL, onClose, onLogInteraction }) {
  const [waMessage, setWaMessage] = useState('');
  const [waSelectedTpl, setWaSelectedTpl] = useState('');
  const [waTemplates, setWaTemplates] = useState([]);
  const [recentWAMessages, setRecentWAMessages] = useState([]);

  // Templates — load once when the popup opens.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const t = await getWhatsAppTemplates(true);
        if (alive) setWaTemplates(Array.isArray(t) ? t : []);
      } catch (err) {
        if (import.meta.env.DEV) console.warn('fetch WA templates:', err);
        if (alive) setWaTemplates([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Recent messages — re-fetch if the user navigates contacts while open.
  useEffect(() => {
    setRecentWAMessages([]);
    if (!contact?.id) return;
    const cid = contact.id;
    (async () => {
      try {
        const msgs = await getMessagesByContact(cid);
        if (cid !== contact.id) return; // guard late response after nav
        setRecentWAMessages(Array.isArray(msgs) ? msgs.slice(0, 5) : []);
      } catch (err) {
        if (import.meta.env.DEV) console.warn('fetch WA messages:', err);
      }
    })();
  }, [contact?.id]);

  return (
    <div className="mb-4 rounded-xl border border-[#25D366]/20 bg-[#25D366]/[0.03] dark:bg-[#25D366]/[0.05] p-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-bold text-[#25D366] flex items-center gap-1.5">
          <MessageCircle size={13} /> {isRTL ? 'إرسال واتساب' : 'Send WhatsApp'}
        </span>
        <button onClick={onClose} className="w-6 h-6 rounded-md flex items-center justify-center bg-transparent border-0 cursor-pointer text-content-muted dark:text-content-muted-dark hover:bg-surface-bg dark:hover:bg-brand-500/10 transition-colors">
          <X size={13} />
        </button>
      </div>
      <select
        value={waSelectedTpl}
        onChange={e => {
          setWaSelectedTpl(e.target.value);
          if (e.target.value) {
            const tpl = waTemplates.find(t => t.id === e.target.value);
            if (tpl) {
              const body = isRTL ? (tpl.body_ar || tpl.body) : tpl.body;
              const filled = fillTemplate(body, {
                name: contact.full_name || '',
                company: contact.company || '',
                amount: '',
                date: new Date().toLocaleDateString(isRTL ? 'ar-EG' : 'en-US'),
              });
              setWaMessage(filled);
            }
          }
        }}
        className="w-full px-2.5 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs outline-none mb-2 font-cairo"
      >
        <option value="">{isRTL ? 'اختر قالب...' : 'Pick a template...'}</option>
        {waTemplates.map(t => (
          <option key={t.id} value={t.id}>{isRTL ? (t.name_ar || t.name) : t.name}</option>
        ))}
      </select>
      <textarea
        value={waMessage}
        onChange={e => setWaMessage(e.target.value)}
        placeholder={isRTL ? 'اكتب رسالة...' : 'Type a message...'}
        rows={3}
        className="w-full px-2.5 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs outline-none resize-none font-cairo"
        style={{ lineHeight: 1.5 }}
      />
      <div className="flex gap-2 mt-2.5">
        <button
          onClick={() => {
            const phone = normalizePhone(contact.phone).replace('+', '');
            const link = generateWhatsAppLink(phone, waMessage);
            const sentMessage = waMessage;
            logWhatsAppMessage({
              contact_id: contact.id,
              contact_name: contact.full_name,
              contact_phone: contact.phone,
              direction: 'outgoing',
              message: sentMessage || '',
              template_id: waSelectedTpl || null,
              type: waSelectedTpl ? 'template' : 'text',
            });
            // Also drop a whatsapp interaction on the timeline (via the unified
            // path) so a WhatsApp send is visible in history + bumps last
            // activity. This is the QUICK-SEND button, so it bypasses the
            // mandatory follow-up (skipFollowUpEnforcement) — the rep fires off
            // the message and sets the next step himself. (Deliberately logging
            // a whatsapp interaction in a form still requires a follow-up.)
            // Swallow any rejection — the drawer's handler already toasts.
            Promise.resolve(
              onLogInteraction?.({
                type: 'whatsapp',
                description: sentMessage || (isRTL ? 'رسالة واتساب' : 'WhatsApp message'),
                followUp: null,
                skipFollowUpEnforcement: true,
              })
            ).catch(() => {});
            window.open(link, '_blank');
            setWaMessage('');
            setWaSelectedTpl('');
            onClose();
          }}
          className="flex-1 py-2 rounded-lg border-0 text-white text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
          style={{ background: '#25D366' }}
        >
          <Send size={12} /> {isRTL ? 'إرسال' : 'Send'}
        </button>
        <a
          href={generateWhatsAppLink(normalizePhone(contact.phone).replace('+', ''))}
          target="_blank"
          rel="noreferrer"
          className="py-2 px-4 rounded-lg border border-[#25D366]/25 text-[#25D366] text-xs font-semibold no-underline flex items-center justify-center gap-1.5 hover:bg-[#25D366]/5 transition-colors"
        >
          <ExternalLink size={12} /> {isRTL ? 'فتح' : 'Open'}
        </a>
      </div>
      {recentWAMessages.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-[#25D366]/10">
          <span className="text-[10px] font-semibold text-content-muted dark:text-content-muted-dark mb-1 block">
            {isRTL ? 'آخر الرسائل' : 'Recent Messages'}
          </span>
          {recentWAMessages.map(m => (
            <div key={m.id} className="flex items-start gap-1.5 mt-1.5">
              {m.direction === 'outgoing' ? <Send size={9} className="text-[#25D366] mt-0.5 flex-shrink-0" /> : <Download size={9} className="text-brand-500 mt-0.5 flex-shrink-0" />}
              <span className="text-[10px] text-content-muted dark:text-content-muted-dark truncate flex-1">{m.message?.slice(0, 50)}</span>
              <span className="text-[9px] text-content-muted dark:text-content-muted-dark flex-shrink-0 opacity-60">
                {new Date(m.sent_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
