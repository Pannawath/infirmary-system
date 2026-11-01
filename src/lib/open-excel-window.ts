import type {ExcelInspectionSheet, SheetConfig} from '@/lib/excel-parser';

type OpenExcelWindowOptions = {
  fileName: string;
  gridSheets: ExcelInspectionSheet[];
  personType: 'STUDENT' | 'STAFF';
  academicYear: number;
  initialConfigs?: SheetConfig[] | null;
  onSubmit: (config: {sheetConfigs: SheetConfig[]}) => void;
  onClose?: () => void;
};

export async function openExcelStudioWindow(options: OpenExcelWindowOptions): Promise<boolean> {
  const payload = {
    fileName: options.fileName,
    gridSheets: options.gridSheets,
    personType: options.personType,
    academicYear: options.academicYear,
    initialConfigs: options.initialConfigs || null,
  };

  try {
    localStorage.setItem('infirmary_excel_payload', JSON.stringify(payload));
  } catch (e) {
    console.warn('Failed to store excel payload to localStorage', e);
  }

  // Setup BroadcastChannel for 2-way sync
  const channel = new BroadcastChannel('infirmary_excel_sync');
  channel.onmessage = (event) => {
    if (event.data?.type === 'SECONDARY_WINDOW_READY') {
      channel.postMessage({type: 'LOAD_DATA', payload});
    } else if (event.data?.type === 'CONFIG_SUBMITTED') {
      options.onSubmit({sheetConfigs: event.data.sheetConfigs});
      channel.close();
    } else if (event.data?.type === 'WINDOW_CLOSED') {
      options.onClose?.();
      channel.close();
    }
  };

  // Try creating a native Tauri WebviewWindow
  try {
    const {isTauri} = await import('@tauri-apps/api/core');
    if (isTauri()) {
      const {WebviewWindow} = await import('@tauri-apps/api/webviewWindow');
      
      // Check if existing excel-window exists
      const existing = await WebviewWindow.getByLabel('excel-studio');
      if (existing) {
        await existing.destroy();
      }

      // In Tauri desktop environment, the Next.js server is at http://127.0.0.1:3103
      const targetUrl = window.location.origin.includes('127.0.0.1') || window.location.origin.includes('localhost')
        ? `${window.location.origin}/excel-window`
        : 'http://127.0.0.1:3103/excel-window';

      // Create a brand new OS-level window pointing directly to the full URL
      const win = new WebviewWindow('excel-studio', {
        url: targetUrl,
        title: `จัดการข้อมูล Excel - ${options.fileName}`,
        width: 1300,
        height: 860,
        minWidth: 900,
        minHeight: 600,
        decorations: false,
        transparent: true,
        backgroundColor: '#00000000',
        center: true,
        focus: true,
      });

      win.once('tauri://error', (e) => {
        console.error('Failed to open native excel window:', e);
      });

      return true;
    }
  } catch (e) {
    console.warn('Could not launch native Tauri window, falling back to browser window/modal:', e);
  }

  // Fallback for standard browser mode: window.open
  const win = window.open('/excel-window', 'excel-studio', 'width=1300,height=860,menubar=no,toolbar=no');
  if (win) {
    return true;
  }

  // If popup blocked or failed
  return false;
}

