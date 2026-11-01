'use client';
import {useEffect, useState, useCallback} from 'react';
import ExcelImportModal from '../ExcelImportModal';
import type {ExcelInspectionSheet, SheetConfig} from '@/lib/excel-parser';
import DesktopControls from '../DesktopControls';

type SessionData = {
  fileName: string;
  gridSheets: ExcelInspectionSheet[];
  personType: 'STUDENT' | 'STAFF';
  academicYear: number;
  initialConfigs?: SheetConfig[] | null;
};

export default function ExcelWindowPage() {
  const [data, setData] = useState<SessionData | null>(null);
  const [channel, setChannel] = useState<BroadcastChannel | null>(null);

  useEffect(() => {
    // Initialize BroadcastChannel
    const bc = new BroadcastChannel('infirmary_excel_sync');
    setChannel(bc);

    // Try reading initial payload from sessionStorage / localStorage
    try {
      const stored = localStorage.getItem('infirmary_excel_payload');
      if (stored) {
        setData(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to parse excel payload', e);
    }

    bc.onmessage = (event) => {
      if (event.data?.type === 'LOAD_DATA') {
        setData(event.data.payload);
      }
    };

    // Notify main window that secondary window is ready
    bc.postMessage({type: 'SECONDARY_WINDOW_READY'});

    return () => {
      bc.close();
    };
  }, []);

  const handleClose = useCallback(async () => {
    if (channel) {
      channel.postMessage({type: 'WINDOW_CLOSED'});
    }
    // If Tauri is active, close this WebviewWindow
    try {
      const {getCurrentWindow} = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      await win.close();
    } catch {
      window.close();
    }
  }, [channel]);

  const handleSubmit = useCallback(async (config: {sheetConfigs: SheetConfig[]}) => {
    if (channel) {
      channel.postMessage({
        type: 'CONFIG_SUBMITTED',
        sheetConfigs: config.sheetConfigs,
      });
    }
    // Close window after submitting
    try {
      const {getCurrentWindow} = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      await win.close();
    } catch {
      window.close();
    }
  }, [channel]);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-400 mb-4" />
        <p className="text-sm font-medium text-slate-300">กำลังรอข้อมูล Excel จากหน้าต่างหลัก...</p>
      </div>
    );
  }

  return (
    <main className="w-screen h-screen overflow-hidden bg-slate-100 flex flex-col">
      <ExcelImportModal
        fileName={data.fileName}
        gridSheets={data.gridSheets}
        personType={data.personType}
        academicYear={data.academicYear}
        initialConfigs={data.initialConfigs}
        onClose={handleClose}
        onSubmit={handleSubmit}
        isNativeWindow={true}
      />
    </main>
  );
}

