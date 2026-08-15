import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Modal, { ModalFooter } from './Modal';
import Button from './Button';

// Promise-based replacement for window.confirm — renders a themed, RTL-aware
// modal (matching the app's look + entrance animation) instead of the raw
// browser dialog. Usage at a call site:
//
//   import { confirm } from '../components/ui';
//   if (!(await confirm(isRTL ? 'حذف؟' : 'Delete?'))) return;
//
// Pass a string, or an options object for more control:
//   await confirm({ message, title, confirmText, cancelText, danger: true })
//
// A single <ConfirmHost/> is mounted once at the app root; `confirm()` talks to
// it through this module-level bridge so any code (even non-component) can call
// it without wiring a hook. Falls back to window.confirm if the host isn't
// mounted yet (e.g. very early startup).

let notify = null;

export function confirm(opts) {
  const options = typeof opts === 'string' ? { message: opts } : (opts || {});
  return new Promise((resolve) => {
    if (!notify) { resolve(window.confirm(options.message || '')); return; }
    notify({ options, resolve });
  });
}

export function ConfirmHost() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [req, setReq] = useState(null); // { options, resolve }

  useEffect(() => {
    notify = setReq;
    return () => { notify = null; };
  }, []);

  if (!req) return null;
  const { options, resolve } = req;
  const done = (val) => { setReq(null); resolve(val); };

  return (
    <Modal
      open
      onClose={() => done(false)}
      width="max-w-sm"
      title={options.title || (isRTL ? 'تأكيد' : 'Confirm')}
    >
      <p className="m-0 text-sm text-content dark:text-content-dark leading-relaxed whitespace-pre-line">
        {options.message}
      </p>
      <ModalFooter className="justify-end">
        <Button variant="secondary" onClick={() => done(false)}>
          {options.cancelText || (isRTL ? 'إلغاء' : 'Cancel')}
        </Button>
        <Button variant={options.danger ? 'danger' : 'primary'} onClick={() => done(true)} autoFocus>
          {options.confirmText || (isRTL ? 'تأكيد' : 'Confirm')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
