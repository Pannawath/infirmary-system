'use client';
import {useState,useEffect} from 'react';
import {
  Users,
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Search,
  Check,
  RotateCcw,
} from 'lucide-react';

type StaffItem = {
  studentId: string;
  studentCode: string;
  fullName: string;
  department: string;
  position: string;
  gradeLevel: string;
  classroom: string;
  alreadyInTarget: boolean;
};

type Props = {
  targetYearId: string;
  targetYearNumber: number;
  availableYears: {id: string; year: number}[];
  onClose: () => void;
  onSuccess: () => void;
};

export default function StaffRolloverModal({
  targetYearId,
  targetYearNumber,
  availableYears,
  onClose,
  onSuccess,
}: Props) {
  // Source year default to the latest year that is not the target year
  const candidateYears = availableYears.filter(y => y.id !== targetYearId);
  const [sourceYearId, setSourceYearId] = useState(candidateYears[0]?.id || '');

  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch staff list whenever sourceYearId changes
  useEffect(() => {
    if (!sourceYearId) return;
    setLoading(true);
    setError('');
    fetch(`/api/settings/staff-rollover?sourceYearId=${sourceYearId}&targetYearId=${targetYearId}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || 'โหลดข้อมูลบุคลากรไม่สำเร็จ');
        setStaffList(d.items || []);
        // Auto-select those not yet in target
        const auto = new Set<string>();
        for (const item of d.items as StaffItem[]) {
          if (!item.alreadyInTarget) {
            auto.add(item.studentId);
          }
        }
        setSelectedIds(auto);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'เชื่อมต่อไม่ได้'))
      .finally(() => setLoading(false));
  }, [sourceYearId, targetYearId]);

  const filteredStaff = staffList.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.department.toLowerCase().includes(q) ||
      s.position.toLowerCase().includes(q) ||
      s.studentCode.toLowerCase().includes(q)
    );
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    const next = new Set(selectedIds);
    for (const item of filteredStaff) {
      if (!item.alreadyInTarget) next.add(item.studentId);
    }
    setSelectedIds(next);
  };

  const clearAll = () => {
    setSelectedIds(new Set());
  };

  const handleConfirm = async () => {
    if (busy || !selectedIds.size) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/settings/staff-rollover', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          targetYearId,
          studentIds: Array.from(selectedIds),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || 'นำเข้าไม่สำเร็จ');

      setSuccessMessage(`นำเข้าครู/บุคลากร ${d.added} คน เข้าปีการศึกษา ${targetYearNumber} สำเร็จ`);
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
      setBusy(false);
    }
  };

  const sourceYear = availableYears.find(y => y.id === sourceYearId);

  return (
    <div className="workspace-modal-backdrop" role="dialog" aria-modal="true">
      <div className="workspace-modal" style={{maxWidth: 720}}>
        <div className="workspace-modal-heading">
          <div>
            <span className="workspace-kicker">คัดลอกรายชื่อเดิม</span>
            <h2>ใช้รายชื่อครูและบุคลากรจากปีการศึกษาเดิม</h2>
            <p>
              เชื่อมโยงข้อมูลเดิมเข้าปีการศึกษา {targetYearNumber} โดยไม่สร้างตัวบุคคลซ้ำ
              และรักษาประวัติการรักษาเดิม
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div role="alert" className="settings-notice is-error mb-4">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}
        {successMessage && (
          <div role="status" className="settings-notice is-success mb-4">
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Source Year Selection */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              ดึงรายชื่อจากปีการศึกษา:
            </label>
            <select
              value={sourceYearId}
              disabled={busy || loading}
              onChange={e => setSourceYearId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              {candidateYears.map(y => (
                <option key={y.id} value={y.id}>
                  ปีการศึกษา {y.year}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-400">
              นำเข้าสู่ปีการศึกษา <b>{targetYearNumber}</b>
            </span>
          </div>

          {/* Search & Actions Bar */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, กลุ่มงาน หรือตำแหน่ง..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold"
              >
                เลือกทั้งหมด
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold"
              >
                ล้างการเลือก
              </button>
            </div>
          </div>

          {/* Staff List Table */}
          <div className="max-h-[360px] overflow-y-auto border border-slate-200 rounded-xl">
            {loading ? (
              <p className="p-8 text-center text-xs text-slate-500">กำลังโหลดรายชื่อ...</p>
            ) : !filteredStaff.length ? (
              <p className="p-8 text-center text-xs text-slate-500">
                ไม่พบรายชื่อครูหรือบุคลากรในปี {sourceYear?.year || ''}
              </p>
            ) : (
              <table className="workspace-table w-full text-xs">
                <thead>
                  <tr>
                    <th style={{width: 40}}>#</th>
                    <th>ชื่อ–นามสกุล</th>
                    <th>กลุ่มงาน / แผนก</th>
                    <th>ตำแหน่ง</th>
                    <th style={{width: 100}}>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map(staff => {
                    const isChecked = selectedIds.has(staff.studentId);
                    return (
                      <tr
                        key={staff.studentId}
                        onClick={() => {
                          if (!staff.alreadyInTarget) toggleSelect(staff.studentId);
                        }}
                        className={`cursor-pointer ${
                          staff.alreadyInTarget ? 'opacity-50 bg-slate-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <td>
                          <input
                            type="checkbox"
                            disabled={staff.alreadyInTarget}
                            checked={isChecked || staff.alreadyInTarget}
                            onChange={() => {}}
                            className="rounded text-blue-600"
                          />
                        </td>
                        <td>
                          <b>{staff.fullName}</b>
                          {staff.studentCode && !staff.studentCode.startsWith('STAFF-') && (
                            <small className="block text-slate-400">{staff.studentCode}</small>
                          )}
                        </td>
                        <td>{staff.department || '-'}</td>
                        <td>{staff.position || '-'}</td>
                        <td>
                          {staff.alreadyInTarget ? (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              มีในปี {targetYearNumber} แล้ว
                            </span>
                          ) : (
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium">
                              พร้อมเพิ่ม
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="text-xs text-slate-500 flex justify-between items-center px-1">
            <span>
              เลือก <b>{selectedIds.size}</b> คน จากทั้งหมด {staffList.length} คน
            </span>
            <span className="text-slate-400">
              * ข้อมูลแพ้ยา โรคประจำตัว และประวัติเข้าห้องพยาบาลจะคงเดิม
            </span>
          </div>
        </div>

        <div className="workspace-modal-footer">
          <button
            type="button"
            className="workspace-button secondary"
            disabled={busy}
            onClick={onClose}
          >
            ยกเลิก
          </button>
          <button
            type="button"
            className="workspace-button primary"
            disabled={busy || !selectedIds.size}
            onClick={handleConfirm}
          >
            {busy ? 'กำลังบันทึก...' : `ยืนยันนำเข้า ${selectedIds.size} คน`}
          </button>
        </div>
      </div>
    </div>
  );
}

