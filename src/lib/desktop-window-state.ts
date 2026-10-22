type WindowState = {
  isMaximized: () => Promise<boolean>;
  isFullscreen: () => Promise<boolean>;
  onResized: (callback: () => void) => Promise<() => void>;
};

export function watchWindowExpanded(win: WindowState, update: (expanded: boolean) => void) {
  let disposed = false;
  let revision = 0;
  let unlisten: (() => void) | undefined;
  const refresh = async () => {
    const current = ++revision;
    try {
      const [maximized, fullscreen] = await Promise.all([win.isMaximized(), win.isFullscreen()]);
      if (!disposed && current === revision) update(maximized || fullscreen);
    } catch { /* Keep the last known shape if the native window is closing. */ }
  };
  win.onResized(() => { void refresh(); }).then(stop => {
    if (disposed) stop();
    else { unlisten = stop; void refresh(); }
  }).catch(() => {});
  void refresh();
  return () => { disposed = true; unlisten?.(); };
}
