const editable = 'input, textarea, [contenteditable]:not([contenteditable="false"])';

export function installInteractionGuards(doc: Document) {
  const inEditor = (target: EventTarget | null) => !!(target as Element | null)?.closest?.(editable);
  const contextMenu = (event: Event) => event.preventDefault();
  const selection = (event: Event) => { if (!inEditor(event.target)) event.preventDefault(); };
  const keydown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a' && !inEditor(event.target)) event.preventDefault();
  };
  doc.addEventListener('contextmenu', contextMenu, true);
  doc.addEventListener('selectstart', selection, true);
  doc.addEventListener('keydown', keydown, true);
  return () => {
    doc.removeEventListener('contextmenu', contextMenu, true);
    doc.removeEventListener('selectstart', selection, true);
    doc.removeEventListener('keydown', keydown, true);
  };
}
