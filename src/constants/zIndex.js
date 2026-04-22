// Centralized z-index tiers to prevent modal stacking wars.
//
// Use Z.XXX for inline styles: `style={{ zIndex: Z.MODAL }}`.
// For Tailwind JIT classes (z-[900]), match the numbers here so values stay aligned.
//
// Tier ordering (low → high):
//   BASE     0     default flow
//   STICKY   5     sticky headers inside drawers
//   POPOVER  150   in-page popovers (quick actions)
//   TOOLBAR  300   floating bottom action bar
//   DRAWER   900   right-side contact/detail drawer
//   MODAL    1000  standard modals
//   MODAL_OVER 1100  modals that must appear over other modals (confirm, create-from-inside)
//   MODAL_TOP  1200  highest modal tier (bulk/batch ops, destructive confirms)
//   DROPDOWN_ABOVE_MODAL 1300  dropdowns inside top modals (campaign picker)
//   TOAST    2000  toast notifications (always on top)
//
// NEVER use 9999 — conflicts with system menus and browser UI overlays.
export const Z = {
  BASE: 0,
  STICKY: 5,
  BADGE: 100,
  POPOVER: 150,
  POPOVER_CONTENT: 151,
  QUICK_MODAL: 200,
  TOOLBAR: 300,
  TOOLBAR_DROPDOWN: 301,
  FLOATING_DROPDOWN: 400,
  DRAWER: 900,
  MODAL: 1000,
  MODAL_OVER: 1100,
  MODAL_TOP: 1200,
  DROPDOWN_ABOVE_MODAL: 1300,
  DISCARD_CONFIRM: 1500,  // "unsaved changes?" dialog, must appear above any form modal
  TOAST: 2000,
};

export default Z;
