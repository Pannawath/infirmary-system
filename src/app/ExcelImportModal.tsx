'use client';
import {useState,useMemo,useEffect,useRef,useCallback} from 'react';
import {
  FileSpreadsheet,
  X,
  Minus,
  Square,
  EyeOff,
  Eye,
  Check,
  AlertTriangle,
  Layers,
  ArrowRight,
  RotateCcw,
  Copy,
  CheckSquare,
} from 'lucide-react';
import type {ExcelInspectionSheet,ExcelImportMapping,SheetConfig} from '@/lib/excel-parser';

type Props = {
  fileName: string;
  gridSheets: ExcelInspectionSheet[];
  personType: 'STUDENT' | 'STAFF';
  academicYear: number;
  initialConfigs?: SheetConfig[] | Record<string, SheetConfig> | null;
  onClose: () => void;
  onSubmit: (config: {
    sheetConfigs: SheetConfig[];
  }) => void;
  isNativeWindow?: boolean;
};

function getColLabel(n: number): string {
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export default function ExcelImportModal({
  fileName,
  gridSheets,
  personType,
  academicYear,
  initialConfigs,
  onClose,
  onSubmit,
  isNativeWindow = false,
}: Props) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState<{x: number; y: number}>({x: 0, y: 0});
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{startX: number; startY: number; posX: number; posY: number}>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });
  const [selectedSheetName, setSelectedSheetName] = useState(gridSheets[0]?.name || '');

  // Persistent sheet-by-sheet configuration map: sheetName -> SheetConfig
  const [configs, setConfigs] = useState<Record<string, SheetConfig>>(() => {
    const mapFromProp: Record<string, SheetConfig> = {};
    if (initialConfigs) {
      if (Array.isArray(initialConfigs)) {
        for (const c of initialConfigs) {
          if (c && c.sheetName) mapFromProp[c.sheetName] = c;
        }
      } else if (typeof initialConfigs === 'object') {
        Object.assign(mapFromProp, initialConfigs);
      }
    }

    const initial: Record<string, SheetConfig> = {};
    for (const s of gridSheets) {
      if (mapFromProp[s.name]) {
        initial[s.name] = mapFromProp[s.name];
        continue;
      }
      const sug = s.suggestedColumns || {};
      let nameMode: ExcelImportMapping['nameMode'] = 'single';
      if (sug.firstName && sug.lastName) {
        nameMode = sug.prefix ? 'prefix_first_last' : 'first_last';
      }

      initial[s.name] = {
        sheetName: s.name,
        headerRow: s.suggestedHeaderRow || 1,
        excludedRows: [],
        excludedCols: [],
        enabled: true,
        mapping: {
          nameMode,
          studentCodeCol: sug.studentCode || 0,
          fullNameCol: sug.fullName || sug.firstName || 0,
          prefixCol: sug.prefix || 0,
          firstNameCol: sug.firstName || 0,
          lastNameCol: sug.lastName || 0,
          gradeMode: 'column',
          gradeLevelCol: sug.gradeLevel || 0,
          fixedGradeLevel: '',
          classMode: 'column',
          classroomCol: sug.classroom || 0,
          fixedClassroom: '',
          rollNumberCol: sug.rollNumber || 0,
          departmentMode: 'fixed',
          departmentCol: sug.department || 0,
          fixedDepartment: s.name,
          positionMode: 'column',
          positionCol: sug.position || 0,
          fixedPosition: '',
        },
      };
    }
    return initial;
  });

  const handleNativeAction = async (act: 'minimize' | 'maximize' | 'close') => {
    try {
      const {getCurrentWindow} = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      if (act === 'minimize') await win.minimize();
      else if (act === 'maximize') await win.toggleMaximize();
      else await win.close();
    } catch {
      if (act === 'close') onClose();
      else if (act === 'maximize') setIsMaximized(m => !m);
      else setIsMinimized(true);
    }
  };
  // Window drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isNativeWindow) {
      // In native OS window, Tauri's data-tauri-drag-region handles moving the real OS window
      return;
    }
    if (isMaximized) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('select')) return;

    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [isNativeWindow, isMaximized, position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.startX;
      const deltaY = e.clientY - dragStartRef.current.startY;
      setPosition({
        x: dragStartRef.current.posX + deltaX,
        y: dragStartRef.current.posY + deltaY,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const currentSheet = useMemo(
    () => gridSheets.find(s => s.name === selectedSheetName) || gridSheets[0],
    [gridSheets, selectedSheetName]
  );

  const activeConfig = configs[selectedSheetName] || configs[gridSheets[0]?.name];

  const updateActiveConfig = (updater: (prev: SheetConfig) => SheetConfig) => {
    setConfigs(prev => {
      const curr = prev[selectedSheetName];
      if (!curr) return prev;
      return {
        ...prev,
        [selectedSheetName]: updater(curr),
      };
    });
  };

  const [selectedRows, setSelectedRows] = useState<number[]>([]);

  // Clear transient selected rows when switching sheets
  useEffect(() => {
    setSelectedRows([]);
  }, [selectedSheetName]);

  const headerCells = useMemo(() => {
    if (!currentSheet || !activeConfig) return [];
    const r = currentSheet.previewRows.find(x => x.rowNumber === activeConfig.headerRow);
    return r ? r.cells : [];
  }, [currentSheet, activeConfig]);

  const excludedRowSet = useMemo(
    () => new Set(activeConfig?.excludedRows || []),
    [activeConfig?.excludedRows]
  );
  const excludedColSet = useMemo(
    () => new Set(activeConfig?.excludedCols || []),
    [activeConfig?.excludedCols]
  );
  const selectedRowSet = useMemo(() => new Set(selectedRows), [selectedRows]);

  const toggleRowSelect = (rNum: number, isShift: boolean) => {
    if (isShift && selectedRows.length > 0) {
      const last = selectedRows[selectedRows.length - 1];
      const start = Math.min(last, rNum);
      const end = Math.max(last, rNum);
      const range = Array.from({length: end - start + 1}, (_, i) => start + i);
      setSelectedRows(Array.from(new Set([...selectedRows, ...range])));
    } else {
      if (selectedRowSet.has(rNum)) {
        setSelectedRows(selectedRows.filter(r => r !== rNum));
      } else {
        setSelectedRows([...selectedRows, rNum]);
      }
    }
  };

  const excludeSelectedRows = () => {
    updateActiveConfig(cfg => ({
      ...cfg,
      excludedRows: Array.from(new Set([...cfg.excludedRows, ...selectedRows])),
    }));
    setSelectedRows([]);
  };

  const restoreSelectedRows = () => {
    updateActiveConfig(cfg => ({
      ...cfg,
      excludedRows: cfg.excludedRows.filter(r => !selectedRowSet.has(r)),
    }));
    setSelectedRows([]);
  };

  const toggleExcludeCol = (cIndex: number) => {
    updateActiveConfig(cfg => ({
      ...cfg,
      excludedCols: cfg.excludedCols.includes(cIndex)
        ? cfg.excludedCols.filter(c => c !== cIndex)
        : [...cfg.excludedCols, cIndex],
    }));
  };

  // Copy mapping to all sheets
  const copyMappingToAllSheets = () => {
    if (!activeConfig) return;
    const currentMapping = activeConfig.mapping;
    const currentHeader = activeConfig.headerRow;
    const currentExcluded = activeConfig.excludedRows;
    const currentCols = activeConfig.excludedCols;

    setConfigs(prev => {
      const updated = {...prev};
      for (const name of Object.keys(updated)) {
        if (name === selectedSheetName) continue;
        updated[name] = {
          ...updated[name],
          headerRow: currentHeader,
          excludedRows: [...currentExcluded],
          excludedCols: [...currentCols],
          mapping: {
            ...currentMapping,
            fixedDepartment: updated[name].mapping.fixedDepartment || name,
          },
        };
      }
      return updated;
    });
    alert(`คัดลอกการตั้งค่าจากชีต "${selectedSheetName}" ไปยังทุกชีตเรียบร้อยแล้ว`);
  };

  // Live sample previews from current active sheet
  const samplePreviews = useMemo(() => {
    if (!currentSheet || !activeConfig) return [];
    const mapping = activeConfig.mapping;
    const samples: {
      rowNumber: number;
      studentCode: string;
      fullName: string;
      grade: string;
      classroom: string;
      rollNumber?: string;
      department?: string;
      position?: string;
    }[] = [];

    for (const pr of currentSheet.previewRows) {
      if (pr.rowNumber === activeConfig.headerRow || excludedRowSet.has(pr.rowNumber)) continue;

      const getVal = (col?: number) => (col && col > 0 ? pr.cells[col - 1] || '' : '');

      let fullName = '';
      if (mapping.nameMode === 'single') {
        fullName = getVal(mapping.fullNameCol);
      } else if (mapping.nameMode === 'first_last') {
        fullName = [getVal(mapping.firstNameCol), getVal(mapping.lastNameCol)].filter(Boolean).join(' ');
      } else {
        const pref = getVal(mapping.prefixCol);
        const f = getVal(mapping.firstNameCol);
        const l = getVal(mapping.lastNameCol);
        fullName = [(pref + f).trim(), l].filter(Boolean).join(' ');
      }

      const grade = mapping.gradeMode === 'fixed' ? (mapping.fixedGradeLevel || '') : getVal(mapping.gradeLevelCol);
      const cls = mapping.classMode === 'fixed' ? (mapping.fixedClassroom || '') : getVal(mapping.classroomCol);
      const roll = getVal(mapping.rollNumberCol);
      const dept = mapping.departmentMode === 'fixed' ? (mapping.fixedDepartment || currentSheet.name) : getVal(mapping.departmentCol);
      const pos = mapping.positionMode === 'fixed' ? (mapping.fixedPosition || '') : getVal(mapping.positionCol);

      if (fullName || getVal(mapping.studentCodeCol)) {
        samples.push({
          rowNumber: pr.rowNumber,
          studentCode: getVal(mapping.studentCodeCol),
          fullName,
          grade,
          classroom: cls,
          rollNumber: roll,
          department: dept,
          position: pos,
        });
      }
      if (samples.length >= 4) break;
    }
    return samples;
  }, [currentSheet, activeConfig, excludedRowSet]);

  // Validation
  const validationError = useMemo(() => {
    if (!activeConfig) return 'ไม่พบข้อมูลชีต';
    const mapping = activeConfig.mapping;
    if (personType === 'STUDENT') {
      if (!mapping.studentCodeCol) return 'กรุณาเลือกคอลัมน์รหัสนักเรียน';
      if (mapping.nameMode === 'single' && !mapping.fullNameCol) return 'กรุณาเลือกคอลัมน์ชื่อ–นามสกุล';
      if (mapping.nameMode !== 'single' && (!mapping.firstNameCol || !mapping.lastNameCol)) return 'กรุณาเลือกคอลัมน์ชื่อและนามสกุลให้ครบ';
      if (mapping.gradeMode === 'column' && !mapping.gradeLevelCol) return 'กรุณาเลือกคอลัมน์ระดับชั้น หรือกำหนดค่าคงที่';
      if (mapping.gradeMode === 'fixed' && !mapping.fixedGradeLevel?.trim()) return 'กรุณากรอกระดับชั้นคงที่';
      if (mapping.classMode === 'column' && !mapping.classroomCol) return 'กรุณาเลือกคอลัมน์ห้อง หรือกำหนดค่าคงที่';
      if (mapping.classMode === 'fixed' && !mapping.fixedClassroom?.trim()) return 'กรุณากรอกห้องคงที่';
    } else {
      if (mapping.nameMode === 'single' && !mapping.fullNameCol) return 'กรุณาเลือกคอลัมน์ชื่อ–นามสกุล';
      if (mapping.nameMode !== 'single' && (!mapping.firstNameCol || !mapping.lastNameCol)) return 'กรุณาเลือกคอลัมน์ชื่อและนามสกุลให้ครบ';
    }
    return null;
  }, [activeConfig, personType]);

  const handleApply = () => {
    if (validationError) return;
    onSubmit({
      sheetConfigs: Object.values(configs),
    });
  };

  const colOptions = useMemo(() => {
    if (!currentSheet) return [];
    return Array.from({length: currentSheet.columnCount}, (_, i) => {
      const colNum = i + 1;
      const letter = getColLabel(colNum);
      const text = headerCells[i] ? ` · ${headerCells[i]}` : '';
      return {
        value: colNum,
        label: `${letter} (${colNum})${text}`,
      };
    });
  }, [currentSheet, headerCells]);

  const enabledSheetCount = Object.values(configs).filter(c => c.enabled !== false).length;

  // Minimized dock bar representation
  if (isMinimized) {
    return (
      <div className="excel-minimized-dock" role="region" aria-label="หน้าต่าง Excel ที่ย่อไว้">
        <button
          type="button"
          className="excel-minimized-bar"
          onClick={() => setIsMinimized(false)}
          title="คลิกเพื่อคืนขนาดหน้าต่างจัดการ Excel"
        >
          <div className="flex items-center gap-2">
            <span className="window-dot window-minimize"><Minus size={10} /></span>
            <FileSpreadsheet size={15} className="text-emerald-500" />
            <b className="text-xs text-slate-800">จัดการ Excel: {fileName}</b>
          </div>
          <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            คลิกเพื่อเปิด ({enabledSheetCount} ชีต)
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className={`excel-window-overlay ${isNativeWindow ? 'is-native-window' : ''} ${isMaximized ? 'is-overlay-maximized' : ''}`} role="dialog" aria-modal="true">
      <div
        className={`excel-window-container ${isNativeWindow ? 'is-native-container' : ''} ${isMaximized ? 'is-maximized' : ''} ${isDragging ? 'is-dragging' : ''}`}
        style={(!isMaximized && !isNativeWindow) ? {
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          transition: isDragging ? 'none' : 'box-shadow 0.2s',
        } : undefined}
      >
        {/* Top Window Bar - Draggable Region with Authentic OS-like Controls */}
        <div
          className="excel-window-topbar cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
          data-tauri-drag-region
        >
          <div className="excel-window-topbar-left pointer-events-none">
            <div className="excel-window-badge">
              <FileSpreadsheet size={18} className="text-emerald-500" />
              <span>จัดการข้อมูล Excel (หลายชีต)</span>
            </div>
            <span className="excel-file-pill" title={fileName}>
              {fileName}
            </span>
            <span className="excel-info-pill">
              {personType === 'STUDENT' ? 'นักเรียน' : 'ครู/บุคลากร'} · ปี {academicYear} · นำเข้า {enabledSheetCount} ชีต
            </span>
          </div>

          {/* Desktop-Style Window Controls (Matches App Navigation Desktop Controls) */}
          <div className="desktop-window-controls pointer-events-auto" aria-label="ควบคุมหน้าต่าง Excel">
            <button
              type="button"
              className="window-dot window-minimize"
              aria-label="ย่อหน้าต่าง"
              title="ย่อหน้าต่าง"
              onClick={() => {
                if (isNativeWindow) handleNativeAction('minimize');
                else setIsMinimized(true);
              }}
            >
              <Minus size={10} />
            </button>
            <button
              type="button"
              className="window-dot window-maximize"
              aria-label={isMaximized ? 'คืนขนาดหน้าต่าง' : 'ขยายเต็มหน้าจอ'}
              title={isMaximized ? 'คืนขนาด' : 'ขยายเต็มจอ'}
              onClick={() => {
                if (isNativeWindow) {
                  handleNativeAction('maximize');
                } else {
                  setIsMaximized(!isMaximized);
                  if (!isMaximized) setPosition({x: 0, y: 0});
                }
              }}
            >
              <Square size={8} />
            </button>
            <button
              type="button"
              className="window-dot window-close"
              aria-label="ปิดหน้าต่างตาราง"
              title="ปิดหน้าต่างตาราง Excel"
              onClick={() => {
                if (isNativeWindow) handleNativeAction('close');
                else onClose();
              }}
            >
              <X size={10} />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="excel-toolbar">
          <div className="excel-toolbar-group">
            <span className="excel-toolbar-label">หัวตารางชีตนี้:</span>
            <input
              type="number"
              min={1}
              max={currentSheet?.rowCount || 1}
              value={activeConfig?.headerRow || 1}
              onChange={e => {
                const val = Math.max(1, Number(e.target.value));
                updateActiveConfig(cfg => ({...cfg, headerRow: val}));
              }}
              className="excel-header-input"
            />
          </div>

          <div className="excel-toolbar-divider" />

          <div className="excel-toolbar-group">
            <span className="text-xs font-semibold text-slate-600">
              เลือก {selectedRows.length} แถว
            </span>
            <button
              type="button"
              disabled={!selectedRows.length}
              onClick={excludeSelectedRows}
              className="excel-action-button is-danger"
              title="ไม่นำเข้าแถวที่กำลังเลือกในชีตนี้"
            >
              <EyeOff size={14} />
              ตัดแถวที่เลือกออก ({selectedRows.length})
            </button>

            {selectedRows.some(r => excludedRowSet.has(r)) && (
              <button
                type="button"
                onClick={restoreSelectedRows}
                className="excel-action-button is-secondary"
                title="นำแถวที่ตัดออกกลับมาใช้"
              >
                <Eye size={14} />
                นำแถวกลับมาใช้
              </button>
            )}

            {(activeConfig?.excludedRows?.length || 0) > 0 && (
              <button
                type="button"
                onClick={() => updateActiveConfig(cfg => ({...cfg, excludedRows: []}))}
                className="excel-text-button"
                title="ล้างรายการแถวที่ตัดออกของชีตนี้"
              >
                <RotateCcw size={12} />
                คืนค่าตัดแถว ({activeConfig?.excludedRows?.length})
              </button>
            )}
          </div>

          <div className="excel-toolbar-divider" />

          {/* Copy settings across sheets */}
          {gridSheets.length > 1 && (
            <button
              type="button"
              onClick={copyMappingToAllSheets}
              className="excel-action-button is-secondary"
              title="คัดลอกหัวตารางและการจับคู่ของชีตนี้ไปใช้กับชีตอื่นทั้งหมด"
            >
              <Copy size={13} />
              ใช้การตั้งค่านี้กับทุกชีต
            </button>
          )}
        </div>

        {/* Main Content: Split Grid & Mapping Panel */}
        <div className="excel-workspace-body">
          {/* Main Grid View */}
          <div className="excel-grid-section">
            <div className="excel-grid-scroll">
              <table className="excel-table">
                <thead>
                  <tr>
                    <th className="excel-corner-cell">#</th>
                    {Array.from({length: currentSheet?.columnCount || 0}, (_, c) => {
                      const colNum = c + 1;
                      const isExcluded = excludedColSet.has(colNum);
                      return (
                        <th
                          key={colNum}
                          className={`excel-col-header ${isExcluded ? 'is-excluded' : ''}`}
                          onClick={() => toggleExcludeCol(colNum)}
                          title={`คอลัมน์ ${getColLabel(colNum)} (คลิกเพื่อ ${isExcluded ? 'เปิดใช้' : 'ตัดออก'})`}
                        >
                          <div className="excel-col-header-inner">
                            <span>{getColLabel(colNum)}</span>
                            {isExcluded && <EyeOff size={11} className="text-rose-500" />}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {currentSheet?.previewRows.map(pr => {
                    const isHeader = pr.rowNumber === activeConfig?.headerRow;
                    const isExcluded = excludedRowSet.has(pr.rowNumber);
                    const isSelected = selectedRowSet.has(pr.rowNumber);

                    return (
                      <tr
                        key={pr.rowNumber}
                        className={`excel-row ${isHeader ? 'is-header-row' : ''} ${
                          isExcluded ? 'is-excluded-row' : ''
                        } ${isSelected ? 'is-selected-row' : ''}`}
                      >
                        <td
                          className="excel-row-header"
                          onClick={e => toggleRowSelect(pr.rowNumber, e.shiftKey)}
                          title={`แถวที่ ${pr.rowNumber} (คลิกเพื่อเลือก, Shift+คลิก เพื่อเลือกช่วง)`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span>{pr.rowNumber}</span>
                            {isHeader && (
                              <span className="excel-header-badge" title="แถวนี้เป็นหัวตาราง">
                                หัว
                              </span>
                            )}
                            {isExcluded && (
                              <span className="excel-excluded-badge" title="ไม่นำเข้าแถวนี้">
                                ตัด
                              </span>
                            )}
                          </div>
                        </td>

                        {pr.cells.map((val, cIndex) => {
                          const colNum = cIndex + 1;
                          const isColExcluded = excludedColSet.has(colNum);
                          return (
                            <td
                              key={cIndex}
                              className={`excel-cell ${isColExcluded ? 'is-col-excluded' : ''}`}
                            >
                              <span className="truncate">{val || ''}</span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Sheet Tabs Bottom */}
            <div className="excel-sheets-bar">
              <span className="excel-sheets-label">
                <Layers size={14} /> แผ่นงาน ({gridSheets.length} ชีต):
              </span>
              <div className="excel-sheets-list">
                {gridSheets.map(s => {
                  const cfg = configs[s.name];
                  const isEnabled = cfg?.enabled !== false;
                  const cutCount = cfg?.excludedRows?.length || 0;

                  return (
                    <div
                      key={s.name}
                      className={`flex items-center gap-1 rounded-lg border px-2 py-1 transition-all ${
                        selectedSheetName === s.name
                          ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold'
                          : 'border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setConfigs(prev => ({
                            ...prev,
                            [s.name]: {...prev[s.name], enabled: !isEnabled},
                          }));
                        }}
                        title={isEnabled ? 'นำเข้าชีตนี้' : 'ข้ามชีตนี้'}
                        className="text-slate-400 hover:text-blue-600"
                      >
                        {isEnabled ? <CheckSquare size={13} className="text-blue-600" /> : <Square size={13} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedSheetName(s.name)}
                        className="text-xs text-left"
                      >
                        <span>{s.name}</span>
                        {cutCount > 0 && (
                          <span className="ml-1 text-[10px] text-rose-600 font-semibold">
                            (ตัด {cutCount})
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Side: Mapping & Preview Panel */}
          {activeConfig && (
            <div className="excel-sidebar-panel">
              <div className="excel-sidebar-header">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-sm">
                    จับคู่คอลัมน์: {selectedSheetName}
                  </h3>
                  <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    ตัดออก {activeConfig.excludedRows.length} แถว
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  ตั้งค่าเฉพาะชีตนี้ (หรือกดใช้กับทุกชีตที่แถบเครื่องมือ)
                </p>
              </div>

              <div className="excel-sidebar-content">
                {/* Name Mode */}
                <div className="excel-field-group">
                  <label className="excel-field-title">รูปแบบชื่อ–นามสกุล</label>
                  <div className="excel-radio-cards">
                    <label
                      className={`excel-radio-card ${
                        activeConfig.mapping.nameMode === 'single' ? 'is-active' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name={`nameMode_${selectedSheetName}`}
                        checked={activeConfig.mapping.nameMode === 'single'}
                        onChange={() =>
                          updateActiveConfig(cfg => ({
                            ...cfg,
                            mapping: {...cfg.mapping, nameMode: 'single'},
                          }))
                        }
                      />
                      <span>ชื่อรวมช่องเดียว</span>
                    </label>
                    <label
                      className={`excel-radio-card ${
                        activeConfig.mapping.nameMode === 'first_last' ? 'is-active' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name={`nameMode_${selectedSheetName}`}
                        checked={activeConfig.mapping.nameMode === 'first_last'}
                        onChange={() =>
                          updateActiveConfig(cfg => ({
                            ...cfg,
                            mapping: {...cfg.mapping, nameMode: 'first_last'},
                          }))
                        }
                      />
                      <span>ชื่อ + นามสกุล แยกกัน</span>
                    </label>
                    <label
                      className={`excel-radio-card ${
                        activeConfig.mapping.nameMode === 'prefix_first_last' ? 'is-active' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name={`nameMode_${selectedSheetName}`}
                        checked={activeConfig.mapping.nameMode === 'prefix_first_last'}
                        onChange={() =>
                          updateActiveConfig(cfg => ({
                            ...cfg,
                            mapping: {...cfg.mapping, nameMode: 'prefix_first_last'},
                          }))
                        }
                      />
                      <span>คำนำหน้า + ชื่อ + สกุล</span>
                    </label>
                  </div>
                </div>

                {/* Code column */}
                <div className="excel-field-group">
                  <label className="excel-field-title">
                    {personType === 'STUDENT' ? 'รหัสนักเรียนโรงเรียน *' : 'รหัสบุคลากร (ถ้ามี)'}
                  </label>
                  <select
                    className="excel-select"
                    value={activeConfig.mapping.studentCodeCol || 0}
                    onChange={e => {
                      const val = Number(e.target.value);
                      updateActiveConfig(cfg => ({
                        ...cfg,
                        mapping: {...cfg.mapping, studentCodeCol: val},
                      }));
                    }}
                  >
                    <option value={0}>-- เลือกคอลัมน์ --</option>
                    {colOptions.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Name columns */}
                {activeConfig.mapping.nameMode === 'single' ? (
                  <div className="excel-field-group">
                    <label className="excel-field-title">คอลัมน์ชื่อ–นามสกุล *</label>
                    <select
                      className="excel-select"
                      value={activeConfig.mapping.fullNameCol || 0}
                      onChange={e => {
                        const val = Number(e.target.value);
                        updateActiveConfig(cfg => ({
                          ...cfg,
                          mapping: {...cfg.mapping, fullNameCol: val},
                        }));
                      }}
                    >
                      <option value={0}>-- เลือกคอลัมน์ --</option>
                      {colOptions.map(o => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    {activeConfig.mapping.nameMode === 'prefix_first_last' && (
                      <div className="excel-field-group">
                        <label className="excel-field-title">คำนำหน้าชื่อ</label>
                        <select
                          className="excel-select"
                          value={activeConfig.mapping.prefixCol || 0}
                          onChange={e => {
                            const val = Number(e.target.value);
                            updateActiveConfig(cfg => ({
                              ...cfg,
                              mapping: {...cfg.mapping, prefixCol: val},
                            }));
                          }}
                        >
                          <option value={0}>-- เลือกคอลัมน์คำนำหน้า (ถ้ามี) --</option>
                          {colOptions.map(o => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="excel-field-group">
                        <label className="excel-field-title">ชื่อ *</label>
                        <select
                          className="excel-select"
                          value={activeConfig.mapping.firstNameCol || 0}
                          onChange={e => {
                            const val = Number(e.target.value);
                            updateActiveConfig(cfg => ({
                              ...cfg,
                              mapping: {...cfg.mapping, firstNameCol: val},
                            }));
                          }}
                        >
                          <option value={0}>-- คอลัมน์ชื่อ --</option>
                          {colOptions.map(o => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="excel-field-group">
                        <label className="excel-field-title">นามสกุล *</label>
                        <select
                          className="excel-select"
                          value={activeConfig.mapping.lastNameCol || 0}
                          onChange={e => {
                            const val = Number(e.target.value);
                            updateActiveConfig(cfg => ({
                              ...cfg,
                              mapping: {...cfg.mapping, lastNameCol: val},
                            }));
                          }}
                        >
                          <option value={0}>-- คอลัมน์นามสกุล --</option>
                          {colOptions.map(o => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                )}

                {/* Grade & Classroom or Staff Department */}
                {personType === 'STUDENT' ? (
                  <>
                    <div className="excel-field-group">
                      <div className="flex items-center justify-between mb-1">
                        <label className="excel-field-title">ระดับชั้น *</label>
                        <div className="flex gap-2 text-xs">
                          <button
                            type="button"
                            className={`font-semibold ${
                              activeConfig.mapping.gradeMode === 'column'
                                ? 'text-blue-600'
                                : 'text-slate-400'
                            }`}
                            onClick={() =>
                              updateActiveConfig(cfg => ({
                                ...cfg,
                                mapping: {...cfg.mapping, gradeMode: 'column'},
                              }))
                            }
                          >
                            จากคอลัมน์
                          </button>
                          <span>|</span>
                          <button
                            type="button"
                            className={`font-semibold ${
                              activeConfig.mapping.gradeMode === 'fixed'
                                ? 'text-blue-600'
                                : 'text-slate-400'
                            }`}
                            onClick={() =>
                              updateActiveConfig(cfg => ({
                                ...cfg,
                                mapping: {...cfg.mapping, gradeMode: 'fixed'},
                              }))
                            }
                          >
                            ค่าคงที่
                          </button>
                        </div>
                      </div>
                      {activeConfig.mapping.gradeMode === 'column' ? (
                        <select
                          className="excel-select"
                          value={activeConfig.mapping.gradeLevelCol || 0}
                          onChange={e => {
                            const val = Number(e.target.value);
                            updateActiveConfig(cfg => ({
                              ...cfg,
                              mapping: {...cfg.mapping, gradeLevelCol: val},
                            }));
                          }}
                        >
                          <option value={0}>-- เลือกคอลัมน์ระดับชั้น --</option>
                          {colOptions.map(o => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="เช่น ม.1 หรือ ม.4"
                          value={activeConfig.mapping.fixedGradeLevel || ''}
                          onChange={e => {
                            const val = e.target.value;
                            updateActiveConfig(cfg => ({
                              ...cfg,
                              mapping: {...cfg.mapping, fixedGradeLevel: val},
                            }));
                          }}
                          className="excel-input"
                        />
                      )}
                    </div>

                    <div className="excel-field-group">
                      <div className="flex items-center justify-between mb-1">
                        <label className="excel-field-title">ห้อง *</label>
                        <div className="flex gap-2 text-xs">
                          <button
                            type="button"
                            className={`font-semibold ${
                              activeConfig.mapping.classMode === 'column'
                                ? 'text-blue-600'
                                : 'text-slate-400'
                            }`}
                            onClick={() =>
                              updateActiveConfig(cfg => ({
                                ...cfg,
                                mapping: {...cfg.mapping, classMode: 'column'},
                              }))
                            }
                          >
                            จากคอลัมน์
                          </button>
                          <span>|</span>
                          <button
                            type="button"
                            className={`font-semibold ${
                              activeConfig.mapping.classMode === 'fixed'
                                ? 'text-blue-600'
                                : 'text-slate-400'
                            }`}
                            onClick={() =>
                              updateActiveConfig(cfg => ({
                                ...cfg,
                                mapping: {...cfg.mapping, classMode: 'fixed'},
                              }))
                            }
                          >
                            ค่าคงที่
                          </button>
                        </div>
                      </div>
                      {activeConfig.mapping.classMode === 'column' ? (
                        <select
                          className="excel-select"
                          value={activeConfig.mapping.classroomCol || 0}
                          onChange={e => {
                            const val = Number(e.target.value);
                            updateActiveConfig(cfg => ({
                              ...cfg,
                              mapping: {...cfg.mapping, classroomCol: val},
                            }));
                          }}
                        >
                          <option value={0}>-- เลือกคอลัมน์ห้อง --</option>
                          {colOptions.map(o => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="เช่น 1 หรือ 2"
                          value={activeConfig.mapping.fixedClassroom || ''}
                          onChange={e => {
                            const val = e.target.value;
                            updateActiveConfig(cfg => ({
                              ...cfg,
                              mapping: {...cfg.mapping, fixedClassroom: val},
                            }));
                          }}
                          className="excel-input"
                        />
                      )}
                    </div>

                    <div className="excel-field-group">
                      <label className="excel-field-title">เลขที่ (ถ้ามี)</label>
                      <select
                        className="excel-select"
                        value={activeConfig.mapping.rollNumberCol || 0}
                        onChange={e => {
                          const val = Number(e.target.value);
                          updateActiveConfig(cfg => ({
                            ...cfg,
                            mapping: {...cfg.mapping, rollNumberCol: val},
                          }));
                        }}
                      >
                        <option value={0}>-- เลือกคอลัมน์เลขที่ --</option>
                        {colOptions.map(o => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="excel-field-group">
                      <div className="flex items-center justify-between mb-1">
                        <label className="excel-field-title">กลุ่มงาน / แผนก</label>
                        <div className="flex gap-2 text-xs">
                          <button
                            type="button"
                            className={`font-semibold ${
                              activeConfig.mapping.departmentMode === 'fixed'
                                ? 'text-blue-600'
                                : 'text-slate-400'
                            }`}
                            onClick={() =>
                              updateActiveConfig(cfg => ({
                                ...cfg,
                                mapping: {...cfg.mapping, departmentMode: 'fixed'},
                              }))
                            }
                          >
                            ตามชีต/ค่าคงที่
                          </button>
                          <span>|</span>
                          <button
                            type="button"
                            className={`font-semibold ${
                              activeConfig.mapping.departmentMode === 'column'
                                ? 'text-blue-600'
                                : 'text-slate-400'
                            }`}
                            onClick={() =>
                              updateActiveConfig(cfg => ({
                                ...cfg,
                                mapping: {...cfg.mapping, departmentMode: 'column'},
                              }))
                            }
                          >
                            จากคอลัมน์
                          </button>
                        </div>
                      </div>
                      {activeConfig.mapping.departmentMode === 'fixed' ? (
                        <input
                          type="text"
                          placeholder="เช่น กลุ่มสาระการเรียนรู้"
                          value={activeConfig.mapping.fixedDepartment || selectedSheetName}
                          onChange={e => {
                            const val = e.target.value;
                            updateActiveConfig(cfg => ({
                              ...cfg,
                              mapping: {...cfg.mapping, fixedDepartment: val},
                            }));
                          }}
                          className="excel-input"
                        />
                      ) : (
                        <select
                          className="excel-select"
                          value={activeConfig.mapping.departmentCol || 0}
                          onChange={e => {
                            const val = Number(e.target.value);
                            updateActiveConfig(cfg => ({
                              ...cfg,
                              mapping: {...cfg.mapping, departmentCol: val},
                            }));
                          }}
                        >
                          <option value={0}>-- เลือกคอลัมน์กลุ่มงาน --</option>
                          {colOptions.map(o => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="excel-field-group">
                      <label className="excel-field-title">ตำแหน่ง (ถ้ามี)</label>
                      <select
                        className="excel-select"
                        value={activeConfig.mapping.positionCol || 0}
                        onChange={e => {
                          const val = Number(e.target.value);
                          updateActiveConfig(cfg => ({
                            ...cfg,
                            mapping: {...cfg.mapping, positionCol: val},
                          }));
                        }}
                      >
                        <option value={0}>-- เลือกคอลัมน์ตำแหน่ง --</option>
                        {colOptions.map(o => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Sample Live Preview Box */}
                <div className="excel-preview-box">
                  <span className="excel-preview-header">
                    <Check size={14} className="text-emerald-500" /> ตัวอย่างผลลัพธ์ในชีตนี้
                  </span>
                  {samplePreviews.length > 0 ? (
                    <div className="space-y-2 mt-2">
                      {samplePreviews.map(s => (
                        <div key={s.rowNumber} className="excel-preview-item">
                          <div className="flex items-baseline justify-between text-xs">
                            <b className="text-slate-800">{s.fullName || '(ไม่มีชื่อ)'}</b>
                            <span className="text-slate-500 text-[11px]">{s.studentCode || '-'}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {personType === 'STUDENT' ? (
                              <span>
                                ชั้น {s.grade || '-'} / ห้อง {s.classroom || '-'}{' '}
                                {s.rollNumber ? `· เลขที่ ${s.rollNumber}` : ''}
                              </span>
                            ) : (
                              <span>
                                {s.department || selectedSheetName}{' '}
                                {s.position ? `· ${s.position}` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 mt-2">
                      จับคู่คอลัมน์ให้ครบเพื่อดูตัวอย่าง
                    </p>
                  )}
                </div>
              </div>

              {/* Sidebar Bottom Action */}
              <div className="excel-sidebar-footer">
                {validationError && (
                  <div className="excel-error-notice">
                    <AlertTriangle size={15} />
                    <span>{validationError}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="workspace-button secondary flex-1"
                    onClick={onClose}
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(validationError)}
                    className="workspace-button primary flex-1"
                    onClick={handleApply}
                  >
                    <Check size={15} />
                    บันทึกข้อมูล ({enabledSheetCount} ชีต)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
