import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { Button } from './index';
import { Z } from '../../constants/zIndex';

/**
 * "Unsaved changes" confirm dialog shown when the user tries to close a
 * form-bearing modal while it is dirty. Higher z-index than any modal tier
 * so it always layers on top.
 *
 * Captures Escape to cancel (keep editing) — matches platform convention.
 */
export default function DiscardConfirm({ isRTL, onCancel, onDiscard }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onCancel(); }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [onCancel]);

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      onClick={onCancel}
      className="fixed inset-0 bg-black/60 flex items-center justify-center p-5"
      style={{ zIndex: Z.DISCARD_CONFIRM }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="discard-title"
        aria-describedby="discard-desc"
        className="modal-content bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl w-full max-w-[380px] p-6 shadow-[0_12px_40px_rgba(27,51,71,0.25)]"
      >
        <h3
          id="discard-title"
          className="m-0 mb-2 text-base font-bold text-content dark:text-content-dark"
        >
          {isRTL ? 'بيانات مش محفوظة' : 'Unsaved changes'}
        </h3>
        <p
          id="discard-desc"
          className="m-0 mb-5 text-sm text-content-muted dark:text-content-muted-dark leading-relaxed"
        >
          {isRTL
            ? 'فيه بيانات عدّلتها. لو قفلت دلوقتي هتروح ومش هترجع.'
            : 'You have unsaved changes. Closing now will discard them permanently.'}
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onCancel} autoFocus>
            {isRTL ? 'رجوع للتعديل' : 'Keep editing'}
          </Button>
          <Button variant="danger" onClick={onDiscard}>
            {isRTL ? 'امسح وقفل' : 'Discard & close'}
          </Button>
        </div>
      </div>
    </div>
  );
}

DiscardConfirm.propTypes = {
  isRTL: PropTypes.bool,
  onCancel: PropTypes.func.isRequired,
  onDiscard: PropTypes.func.isRequired,
};
