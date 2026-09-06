function Base({ children }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {children}
    </svg>
  );
}

export function IconCopy(props) {
  return <Base {...props}><rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" /><path d="M5 15V5a2 2 0 0 1 2-2h10" stroke="currentColor" /></Base>;
}
export function IconEdit(props) {
  return <Base {...props}><path d="M12 20h9" stroke="currentColor" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" /></Base>;
}
export function IconTrash(props) {
  return <Base {...props}><path d="M3 6h18" stroke="currentColor" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" /></Base>;
}
export function IconPrint(props) {
  return <Base {...props}><path d="M6 9V3h12v6" stroke="currentColor" /><rect x="4" y="9" width="16" height="8" rx="1.5" stroke="currentColor" /><path d="M6 17h12v4H6z" stroke="currentColor" /></Base>;
}
export function IconDownload(props) {
  return <Base {...props}><path d="M12 3v12" stroke="currentColor" /><path d="M7 11l5 5 5-5" stroke="currentColor" /><path d="M4 19h16" stroke="currentColor" /></Base>;
}

