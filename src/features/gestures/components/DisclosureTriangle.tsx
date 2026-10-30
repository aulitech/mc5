// DisclosureTriangle.tsx — The solid ▶ used by show/hide buttons in the
// gesture lists. It always points right; the button's `disclosureOpen` class
// turns it down.

const DisclosureTriangle = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path d="M4.5 2 L13 8 L4.5 14 Z" fill="currentColor" />
  </svg>
);

export default DisclosureTriangle;
