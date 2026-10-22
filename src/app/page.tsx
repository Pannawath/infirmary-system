"use client";

import { useEffect, useMemo, useState } from "react";
import DeleteConfirmation from './DeleteConfirmation';
import ServiceWorkspace from './ServiceWorkspace';
import DashboardOverview from './DashboardOverview';
import {SideNavigation,TopNavigation} from './AppNavigation';
import StudentWorkspace from './StudentWorkspace';
import {useSharedNavigation} from '@/lib/shared-navigation';
import {useWorkspaceMotion} from '@/lib/workspace-motion';
import ReportsPanel from './ReportsPanel';
import VisitHistory from './CalendarHistory';
import {
  Bell,
  Boxes,
  ClipboardList,
  FileBarChart,
  Home,
  Menu,
  PackageOpen,
  Pill,
  Search,
  Users,
  X,
  AlertTriangle,
  CheckCircle2,
  Stethoscope,
  CalendarDays,
  CircleAlert,
  Plus,
  Trash2,
  Minus,
  ShieldCheck,
  Pencil,
  Save,
  Check,
} from "lucide-react";

type Tab =
  "dashboard" | "dispense" | "students" | "inventory" | "records" | "reports";
type Med = {
  id: string;
  updatedAt?: string;
  name: string;
  category: string;
  unit: string;
  stockQuantity: number;
  minThreshold: number;
  indications: string | null;
};
type Visit = {
  serviceType?: string;
  id: string;
  symptoms: string;
  visitedAt: string;
  student: { fullName: string; studentCode: string };
  dispensedItems: {
    id: string;
    quantity: number;
    medication: { name: string; unit: string };
  }[];
};
type StudentResult = {
  id: string;
  studentCode: string;
  fullName: string;
  gradeLevel: string;
  classroom: string;
  allergies: string | null;
  chronicDiseases?: string | null;
  guardianPhone?: string | null;
};
const menu = [
  ["dashboard", "แดชบอร์ด", Home],
  ["dispense", "บันทึกบริการ", Pill],
  ["students", "นักเรียน", Users],
  ["inventory", "คลังยา", PackageOpen],
  ["records", "ประวัติการจ่ายยา", ClipboardList],
  ["reports", "รายงาน", FileBarChart],
] as const;
const samples: Med[] = [
  {
    id: "1",
    name: "พาราเซตามอล 500 mg",
    category: "ยาแก้ปวด",
    unit: "เม็ด",
    stockQuantity: 98,
    minThreshold: 15,
    indications: "ลดไข้",
  },
  {
    id: "2",
    name: "ยาแก้ไอ (60 ml)",
    category: "ยาน้ำ",
    unit: "ขวด",
    stockQuantity: 5,
    minThreshold: 10,
    indications: "บรรเทาอาการไอ",
  },
  {
    id: "3",
    name: "ORS",
    category: "เกลือแร่",
    unit: "ซอง",
    stockQuantity: 8,
    minThreshold: 10,
    indications: "ทดแทนน้ำ",
  },
  {
    id: "4",
    name: "ยาทาแก้แพ้",
    category: "ยาทา",
    unit: "หลอด",
    stockQuantity: 15,
    minThreshold: 15,
    indications: "บรรเทาผื่นคัน",
  },
];
const Card = ({
  children,
  cn = "",
}: {
  children: React.ReactNode;
  cn?: string;
}) => (
  <section
    className={`app-card rounded-2xl border border-slate-100 bg-white shadow-[0_5px_22px_rgba(34,81,140,.07)] ${cn}`}
  >
    {children}
  </section>
);

export default function App() {
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("dashboard"),
    [open, setOpen] = useState(false),
    [q, setQ] = useState(""),
    [meds, setMeds] = useState<Med[]>([]),
    [visits, setVisits] = useState<Visit[]>([]),
    [summary, setSummary] = useState({
      todayVisits: 0,
      totalStudents: 0,
      lowStockCount: 0,
    });
  useEffect(() => {
    const refresh = () =>
      Promise.all([
        fetch("/api/medications"),
        fetch("/api/visits"),
        fetch("/api/reports/summary"),
      ])
        .then(async ([m, v, r]) => {
          if (!m.ok || !v.ok || !r.ok) throw new Error();
          setLoadError("");
          if (m.ok) {
            const d = await m.json();
            setMeds(d);
          }
          if (v.ok) setVisits(await v.json());
          if (r.ok) {
            const d = await r.json();
            setSummary(d.summary);
          }
        })
        .catch(() =>
          setLoadError(
            "โหลดข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง",
          ),
        );
    refresh();
    window.addEventListener("infirmary-data-changed", refresh);
    return () => window.removeEventListener("infirmary-data-changed", refresh);
  }, []);
  const low = useMemo(
    () => meds.filter((m) => m.stockQuantity <= m.minThreshold),
    [meds],
  );
  useWorkspaceMotion(tab);
  const go = useSharedNavigation(tab,setTab,()=>setOpen(false));
  return (
    <div className="app-shell min-h-screen bg-[#f4f8fe] text-[#17375f]">
      <TopNavigation items={menu} active={tab} go={go} lowStock={low.length} open={open} onToggle={()=>setOpen(current=>!current)}/>
      <SideNavigation items={menu} active={tab} go={go} lowStock={low.length} emptyStock={meds.filter(m=>m.stockQuantity===0).length} nearStock={low.filter(m=>m.stockQuantity>0).length} open={open} onClose={()=>setOpen(false)}/>
      <main className="app-main lg:ml-[264px]">
        <div
          key={tab}
          data-page-surface
          data-motion-managed
          className={`motion-page relative px-4 py-5 sm:px-7 ${tab === 'dashboard' ? 'dashboard-viewport' : ''} ${tab === "dispense" ? "xl:h-[calc(100dvh-73px)] xl:overflow-hidden" : "min-h-[calc(100vh-73px)]"}`}
        >
          {loadError && (
            <div
              role="alert"
              className="mb-3 flex items-center justify-between rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
            >
              {loadError}
              <button
                onClick={() =>
                  window.dispatchEvent(new Event("infirmary-data-changed"))
                }
                className="ml-2 font-bold"
              >
                ลองใหม่
              </button>
            </div>
          )}
          {tab === "dashboard" ? (
            <DashboardOverview
              meds={meds}
              low={low}
              visits={visits}
              summary={summary}
              go={go}
            />
          ) : (
            <Inner tab={tab} meds={meds} visits={visits} low={low} go={go} />
          )}
        </div>
      </main>
    </div>
  );
}
function Title({
  children,
  link,
  onClick,
}: {
  children: string;
  link?: string;
  onClick?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <h3 className="border-l-[4px] border-[#083e76] pl-3 text-sm font-extrabold">
        {children}
      </h3>
      {link && (
        <button onClick={onClick} className="text-xs font-bold text-[#087df5]">
          {link} →
        </button>
      )}
    </div>
  );
}
function Metric({
  icon,
  label,
  value,
  suffix,
  tone = "blue",
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix: string;
  tone?: string;
  onClick?: () => void;
}) {
  const styles: any = {
    blue: "bg-blue-50 text-[#087df5]",
    green: "bg-emerald-50 text-emerald-500",
    red: "bg-red-50 text-red-500",
  };
  return (
    <Card cn="p-5">
      <div className="flex justify-between">
        <div
          className={`grid h-14 w-14 place-items-center rounded-xl ${styles[tone]}`}
        >
          {icon}
        </div>
        {onClick && (
          <button
            onClick={onClick}
            className="text-xs font-semibold text-[#087df5]"
          >
            ดูทั้งหมด →
          </button>
        )}
      </div>
      <p
        className={`mt-3 text-sm font-bold ${tone === "red" ? "text-red-500" : ""}`}
      >
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <b
          className={`text-4xl ${tone === "red" ? "text-red-500" : "text-[#142f57]"}`}
        >
          {value}
        </b>
        <span className="text-sm font-semibold">{suffix}</span>
      </div>
      <p className="mt-2 text-xs text-slate-500">อัปเดตข้อมูลแบบเรียลไทม์</p>
    </Card>
  );
}
function Dashboard({ meds, low, visits, summary, go }: any) {
  const total = meds.length;
  return (
    <>
      <div className="absolute left-0 right-0 top-0 h-[155px] bg-[url('/school-hero.png')] bg-cover bg-center opacity-65" />
      <div className="absolute inset-x-0 top-0 h-[180px] bg-gradient-to-r from-[#f5f9ff] via-[#f5f9ff]/70 to-[#f5f9ff]/10" />
      <div className="relative">
        <div className="mb-7 flex flex-col justify-between gap-4 px-2 pt-3 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#4b79ad]">
              <CalendarDays size={14} /> ภาพรวมประจำวันที่{" "}
              {new Date().toLocaleDateString("th-TH", {
                timeZone: "Asia/Bangkok",
              })}
            </div>
            <h2 className="text-3xl font-extrabold">สวัสดีครับ</h2>
            <p className="mt-1 text-base text-[#35537c]">
              ระบบบริหารห้องพยาบาล โรงเรียนสารคามพิทยาคม
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={<Users />}
            label="นักเรียนที่รับบริการวันนี้"
            value={summary.todayVisits}
            suffix="คน"
          />
          <Metric
            icon={<Pill />}
            label="รายการจ่ายยาวันนี้"
            value={summary.todayDispensed || 0}
            suffix="รายการ"
            tone="green"
          />
          <Metric
            icon={<Boxes />}
            label="ยาคงเหลือทั้งหมด"
            value={total}
            suffix="รายการ"
          />
          <Metric
            icon={<AlertTriangle />}
            label="ยาที่ใกล้หมด"
            value={low.length}
            suffix="รายการ"
            tone="red"
            onClick={() => go("inventory")}
          />
        </div>
        <div className="mt-4 flex flex-col gap-4">
          <div className="contents">
            <Card cn="order-3 w-full overflow-hidden">
              <Title link="ดูทั้งหมด" onClick={() => go("records")}>
                การจ่ายยาล่าสุด
              </Title>
              <div className="overflow-x-auto px-5 pb-4">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="bg-[#f3f6fb] text-xs text-slate-500">
                    <tr>
                      {[
                        "เวลา",
                        "ชื่อ-สกุล",
                        "รหัสนักเรียน",
                        "รายการยา",
                        "จำนวน",
                        "ผู้จ่ายยา",
                        "สถานะ",
                      ].map((x) => (
                        <th key={x} className="px-3 py-3">
                          {x}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visits.slice(0, 5).map((v: Visit) => (
                      <tr key={v.id} className="border-b border-slate-100">
                        <td className="px-3 py-3 text-slate-500">
                          {new Date(v.visitedAt).toLocaleTimeString("th-TH", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-3 py-3 font-medium">
                          {v.student.fullName}
                        </td>
                        <td className="px-3 py-3">{v.student.studentCode}</td>
                        <td className="px-3 py-3">
                          {v.dispensedItems[0]?.medication.name || v.symptoms}
                        </td>
                        <td className="px-3 py-3">
                          {v.dispensedItems[0]
                            ? `${v.dispensedItems[0].quantity} ${v.dispensedItems[0].medication.unit}`
                            : "—"}
                        </td>
                        <td className="px-3 py-3 text-slate-500">ระบบ</td>
                        <td className="px-3 py-3">
                          <span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                            เรียบร้อย
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card cn="order-1">
              <Title link="ดูทั้งหมด" onClick={() => go("inventory")}>
                ยาที่ใกล้หมด / หมด
              </Title>
              <div className="px-5 pb-3">
                {low.slice(0, 5).map((m: Med) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 border-b border-slate-100 py-3"
                  >
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-500">
                      <Pill size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{m.name}</p>
                      <p className="text-xs text-slate-500">
                        คงเหลือ {m.stockQuantity} {m.unit}
                      </p>
                    </div>
                    <span
                      className={`rounded-lg px-3 py-1 text-xs font-bold ${m.stockQuantity <= m.minThreshold ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-500"}`}
                    >
                      {m.stockQuantity === 0 ? "หมด" : "ใกล้หมด"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div className="order-2">
            <RealStats visits={visits} />
          </div>
        </div>
      </div>
    </>
  );
}
function Chart() {
  return (
    <Card cn="p-5">
      <Title>สถิติการรับบริการ (7 วันล่าสุด)</Title>
      <div className="mt-2 flex h-32 items-end gap-5 border-b border-l border-slate-200 px-4 pb-1">
        {[30, 48, 43, 38, 68, 53, 78].map((h, i) => (
          <div key={i} className="flex h-full flex-1 items-end">
            <i
              style={{ height: `${h}%` }}
              className={`w-full rounded-t-sm ${i === 6 ? "bg-[#087df5]" : "bg-blue-300/80"}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-slate-500">
        <span>2 ต.ค.</span>
        <span>3 ต.ค.</span>
        <span>4 ต.ค.</span>
        <span>5 ต.ค.</span>
        <span>6 ต.ค.</span>
        <span>7 ต.ค.</span>
        <span>8 ต.ค.</span>
      </div>
    </Card>
  );
}
function Donut({ total }: { total: number }) {
  return (
    <Card cn="p-5">
      <Title>สัดส่วนประเภทอาการวันนี้</Title>
      <div className="mt-4 flex items-center gap-6">
        <div
          className="grid h-28 w-28 shrink-0 place-items-center rounded-full"
          style={{
            background:
              "conic-gradient(#087df5 0 36%, #398df2 36% 57%, #74b3ff 57% 75%, #b2d5ff 75% 100%)",
          }}
        >
          <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-center">
            <b className="text-xl">{total}</b>
            <span className="text-[10px] text-slate-500">คน</span>
          </div>
        </div>
        <div className="space-y-2 text-xs">
          {[
            "ไข้ 10 (36%)",
            "ไอ 6 (21%)",
            "ปวดหัว 5 (18%)",
            "ปวดท้อง 4 (14%)",
            "อื่น ๆ 3 (11%)",
          ].map((x) => (
            <p key={x}>● {x}</p>
          ))}
        </div>
      </div>
    </Card>
  );
}
function Top({ meds }: { meds: Med[] }) {
  return (
    <Card cn="p-5">
      <Title>ยาที่เบิกมากที่สุด (วันนี้)</Title>
      <ol className="mt-3 space-y-1">
        {meds.slice(0, 5).map((m, i) => (
          <li
            key={m.id}
            className="flex gap-3 rounded-lg bg-slate-50 px-3 py-1.5 text-sm"
          >
            <span>{i + 1}</span>
            <b className="flex-1">{m.name}</b>
            <span>{12 - i * 2}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
function RealStats({ visits }: { visits: Visit[] }) {
  const totals = new Map<
    string,
    { name: string; quantity: number; unit: string }
  >();
  visits.forEach((v) =>
    v.dispensedItems.forEach((item) => {
      const key = item.medication.name;
      const previous = totals.get(key);
      totals.set(key, {
        name: key,
        unit: item.medication.unit,
        quantity: (previous?.quantity || 0) + item.quantity,
      });
    }),
  );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card cn="p-5">
        <h3 className="font-bold">ประวัติที่แสดง</h3>
        <p className="mt-3 text-3xl font-extrabold">
          {visits.length}{" "}
          <span className="text-sm font-normal text-slate-500">ครั้ง</span>
        </p>
        <p className="mt-2 text-xs text-slate-500">
          สรุปจากประวัติล่าสุดสูงสุด 50 ครั้ง
        </p>
      </Card>
      <Card cn="p-5">
        <h3 className="mb-3 font-bold">ยอดเบิกยาจากประวัติที่แสดง</h3>
        {Array.from(totals.values())
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 5)
          .map((m) => (
            <div
              key={m.name}
              className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm"
            >
              <span>{m.name}</span>
              <b className="shrink-0">
                {m.quantity} {m.unit}
              </b>
            </div>
          ))}
        {totals.size === 0 && (
          <p className="py-4 text-sm text-slate-500">ยังไม่มีรายการเบิกยา</p>
        )}
      </Card>
    </div>
  );
}
function StudentDirectory() {
  const [grade,setGrade]=useState('');
  const [room,setRoom]=useState('');
  const [page,setPage]=useState(1);
  const [total,setTotal]=useState(0);
  const [groups,setGroups]=useState<{gradeLevel:string;classroom:string;_count:{_all:number}}[]>([]);
  const [loading,setLoading]=useState(false);
  const [revision,setRevision]=useState(0);
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<StudentResult[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<StudentResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [message, setMessage] = useState("");
  const saveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/students", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setStudents((items) => items.map((s) => (s.id === data.id ? data : s)));
      setEditing(null);
      setMessage("บันทึกข้อมูลนักเรียนเรียบร้อยแล้ว");
      setRevision(value=>value+1);
      window.dispatchEvent(new Event("infirmary-data-changed"));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/students?directory=1&q=${encodeURIComponent(query)}&grade=${encodeURIComponent(grade)}&room=${encodeURIComponent(room)}&page=${page}`, {
        signal: controller.signal,
      })
        .then(async (r) => {
          if (!r.ok) throw new Error();
          const data=await r.json();
          setStudents(data.items);setTotal(data.total);setGroups(data.groups);
          setError("");
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setError("โหลดรายชื่อนักเรียนไม่สำเร็จ");
        }).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query,grade,room,page,revision]);
  const grades=Array.from(new Set(groups.map(g=>g.gradeLevel))).sort((a,b)=>a.localeCompare(b,'th',{numeric:true}));
  const rooms=Array.from(new Set(groups.filter(g=>!grade||g.gradeLevel===grade).map(g=>g.classroom))).sort((a,b)=>a.localeCompare(b,'th',{numeric:true}));
  return (
    <div className="p-5">
      <div className="mb-4 flex flex-wrap items-end gap-3"><label className="text-sm font-semibold">ระดับชั้น<select value={grade} onChange={e=>{setGrade(e.target.value);setRoom('');setPage(1)}} className="mt-1 block min-w-40 rounded-xl border border-slate-200 bg-white p-3"><option value="">ทุกระดับชั้น</option>{grades.map(g=><option key={g} value={g}>{g} ({groups.filter(x=>x.gradeLevel===g).reduce((sum,x)=>sum+x._count._all,0)} คน)</option>)}</select></label><label className="text-sm font-semibold">ห้อง<select value={room} onChange={e=>{setRoom(e.target.value);setPage(1)}} className="mt-1 block min-w-40 rounded-xl border border-slate-200 bg-white p-3"><option value="">ทุกห้อง</option>{rooms.map(r=><option key={r} value={r}>ห้อง {r}</option>)}</select></label>{(grade||room||query)&&<button onClick={()=>{setGrade('');setRoom('');setQuery('');setPage(1)}} className="rounded-xl px-3 py-3 text-sm text-blue-700">ล้างตัวกรอง</button>}</div>
      <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3">
        <Search size={18} />
        <input
          aria-label="ค้นหานักเรียน"
          value={query}
          onChange={(e) => {setQuery(e.target.value);setPage(1)}}
          placeholder="ค้นหาชื่อหรือรหัสนักเรียน"
          className="w-full outline-none"
        />
      </label>
      <p className="my-3 text-xs text-slate-500">
        {loading?'กำลังค้นหา…':`พบ ${total.toLocaleString()} คน · ${grade||'ทุกระดับชั้น'} · ${room?`ห้อง ${room}`:'ทุกห้อง'} · หน้า ${page} / ${Math.max(1,Math.ceil(total/30))}`}
      </p>
      {message && (
        <p
          role="status"
          className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {students.map((s) => (
        <div
          key={s.id}
          className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-4"
        >
          <div className="min-w-0 flex-1">
            <p className="font-bold">{s.fullName}</p>
            <p className="text-xs text-slate-500">
              {s.studentCode} · {s.gradeLevel}/{s.classroom}
            </p>
            <p
              className={`mt-2 text-xs ${s.allergies && s.allergies !== "ไม่มี" ? "text-rose-700" : "text-slate-500"}`}
            >
              ประวัติการแพ้: {s.allergies || "ยังไม่ระบุ"}
            </p>
            {s.chronicDiseases && (
              <p className="mt-1 text-xs text-slate-500">
                โรคประจำตัว: {s.chronicDiseases}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              setEditing({ ...s });
              setSaveError("");
              setMessage("");
            }}
            className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700"
          >
            <Pencil size={15} />
            แก้ไขข้อมูล
          </button>
        </div>
      ))}
      {!students.length && !error && !loading && (
        <p className="py-8 text-center text-slate-500">ไม่พบรายชื่อที่ค้นหา</p>
      )}
      <div className="mt-4 flex items-center justify-between"><button disabled={loading||page<=1} onClick={()=>setPage(p=>p-1)} className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40">ก่อนหน้า</button><span className="text-xs text-slate-500">แสดงหน้าละ 30 คน</span><button disabled={loading||page*30>=total} onClick={()=>setPage(p=>p+1)} className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40">ถัดไป</button></div>
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <form
            onSubmit={saveStudent}
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-editor-title"
            className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 id="student-editor-title" className="text-lg font-bold">
                  แก้ไขข้อมูลนักเรียน
                </h3>
                <p className="text-xs text-slate-500">
                  {editing.studentCode} · {editing.fullName}
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditing(null)}
                aria-label="ปิดหน้าต่าง"
                className="p-2"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["fullName", "ชื่อ–นามสกุล"],
                  ["studentCode", "รหัสนักเรียน"],
                  ["gradeLevel", "ชั้น"],
                  ["classroom", "ห้อง"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="text-sm font-semibold">
                  {label}
                  <input
                    required
                    value={editing[key]}
                    onChange={(e) =>
                      setEditing({ ...editing, [key]: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-normal"
                  />
                </label>
              ))}
            </div>
            <label className="mt-4 block text-sm font-bold text-rose-700">
              ประวัติการแพ้ยา / อาหาร / สิ่งอื่น ๆ
              <textarea
                value={editing.allergies || ""}
                onChange={(e) =>
                  setEditing({ ...editing, allergies: e.target.value })
                }
                className="mt-1 h-24 w-full rounded-xl border border-rose-200 bg-rose-50/40 p-3 font-normal"
                placeholder="เช่น แพ้เพนิซิลลิน: มีผื่น / แพ้กุ้ง: ปากบวม"
              />
              <span className="text-xs font-normal text-slate-500">
                ระบุสิ่งที่แพ้และอาการที่เกิดขึ้น หากยืนยันว่าไม่มี ให้พิมพ์
                “ไม่มี”
              </span>
            </label>
            <label className="mt-4 block text-sm font-semibold">
              โรคประจำตัว
              <input
                value={editing.chronicDiseases || ""}
                onChange={(e) =>
                  setEditing({ ...editing, chronicDiseases: e.target.value })
                }
                placeholder="เช่น หอบหืด หรือ ไม่มี"
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-normal"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold">
              เบอร์ติดต่อผู้ปกครอง
              <input
                type="tel"
                value={editing.guardianPhone || ""}
                onChange={(e) =>
                  setEditing({ ...editing, guardianPhone: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-normal"
              />
            </label>
            {saveError && (
              <p role="alert" className="mt-3 text-sm text-rose-700">
                {saveError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditing(null)}
                className="rounded-xl px-4 py-3 text-sm"
              >
                ยกเลิก
              </button>
              <button
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white"
              >
                <Save size={16} />
                {saving ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
function ServiceReport(){
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'});
 const [from,setFrom]=useState(today.slice(0,7)+'-01');const [to,setTo]=useState(today);
 const [data,setData]=useState<{total:number;uniqueStudents:number;services:Record<string,number>;medications:{name:string;quantity:number;unit:string}[]}|null>(null);
 const [error,setError]=useState('');const [loading,setLoading]=useState(false);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setData(null);setError('');fetch(`/api/reports/services?from=${from}&to=${to}`,{signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setData(d)}).catch(e=>{if(!controller.signal.aborted)setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[from,to]);
 return <div><Head t="รายงานบริการรายภาคเรียน" d="เลือกวันเริ่มต้นและสิ้นสุดตามภาคเรียนจริงของโรงเรียน"/><Card cn="p-5"><div className="flex flex-wrap items-end gap-4"><label className="text-sm font-semibold">ตั้งแต่<input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 p-2"/></label><label className="text-sm font-semibold">ถึง<input type="date" value={to} onChange={e=>setTo(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 p-2"/></label><button onClick={()=>window.print()} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white">พิมพ์รายงาน / บันทึก PDF</button></div>{loading&&<p className="mt-4 text-sm text-slate-500">กำลังโหลดรายงาน…</p>}{error&&<p role="alert" className="mt-4 text-rose-600">{error}</p>}{data&&<><div className="mt-5 grid gap-3 sm:grid-cols-3">{[['DISPENSE','จ่ายยา'],['WOUND_CARE','ทำแผล'],['REST','นอนพัก']].map(([id,label])=><div key={id} className="rounded-xl bg-blue-50 p-4"><p className="text-sm">{label}</p><p className="mt-2 text-3xl font-bold">{data.services[id]} <span className="text-xs font-normal">ครั้ง</span></p></div>)}</div><p className="my-4 text-sm">รวม {data.total} ครั้ง · นักเรียนไม่ซ้ำ {data.uniqueStudents} คน</p><h3 className="font-bold">การเบิกยาภายในช่วงวันที่เลือก</h3>{data.medications.map(m=><div key={m.name} className="flex justify-between gap-3 border-b py-3 text-sm"><span>{m.name}</span><b>{m.quantity} {m.unit}</b></div>)}{!data.medications.length&&<p className="py-5 text-sm text-slate-500">ไม่มีการเบิกยาในช่วงนี้</p>}</>}</Card></div>
}
function Inner({ tab, meds, visits, low, go }: any) {
  if(tab==='reports') return <ReportsPanel/>;
  if(tab==='students') return <StudentWorkspace/>;
  const names: any = {
    dispense: "จ่ายยา",
    students: "จัดการข้อมูลนักเรียน",
    inventory: "คลังยาและเวชภัณฑ์",
    records: "ประวัติการจ่ายยา",
    reports: "รายงานและสถิติ",
  };
  if (tab === "dispense") return <ServiceWorkspace meds={meds} />;
  return (
    <>
      <div className="workspace-content">
        {tab === "inventory" ? (
          <Inventory meds={meds} />
        ) : tab === "records" ? (
          <VisitHistory />
        ) : tab === "students" ? (
          <StudentDirectory />
        ) : (
          <div className="p-7">
            <RealStats visits={visits} />
            <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-4 text-amber-800">
              <AlertTriangle />
              <p>มียา {low.length} รายการที่ต้องตรวจสอบสต็อก</p>
              <button
                onClick={() => go("inventory")}
                className="ml-auto text-sm font-bold"
              >
                เปิดคลังยา →
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
function DispenseWorkspace({ meds }: { meds: Med[] }) {
  const [serviceType,setServiceType]=useState('DISPENSE');
  const [student, setStudent] = useState("");
  const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(
    null,
  );
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [otherSymptoms, setOtherSymptoms] = useState("");
  const symptoms = selectedSymptoms.filter(label => label !== 'อื่น ๆ').concat(selectedSymptoms.includes('อื่น ๆ') && otherSymptoms.trim() ? [otherSymptoms.trim()] : []).join(', ');
  const symptomsReady = !!symptoms.trim() && (!selectedSymptoms.includes('อื่น ๆ') || !!otherSymptoms.trim());
  const [notes, setNotes] = useState("");
  const [medicineQuery, setMedicineQuery] = useState("");
  const [medicineFilter,setMedicineFilter] = useState('all');
  const [cart, setCart] = useState<{ med: Med; quantity: number }[]>([]);
  const [workingMeds, setWorkingMeds] = useState(meds);
  const [editing, setEditing] = useState<Med | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDispensing, setIsDispensing] = useState(false);
  const [dispenseMessage, setDispenseMessage] = useState<string | null>(null);
  useEffect(() => setWorkingMeds(meds), [meds]);
  useEffect(() => {
    if (!student.trim() || selectedStudent) {
      setStudentResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/students?q=${encodeURIComponent(student)}`,
          { signal: controller.signal },
        );
        if (response.ok)
          setStudentResults((await response.json()).slice(0, 10));
      } catch {
        if (!controller.signal.aborted) setStudentResults([]);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [student, selectedStudent]);
  const add = (med: Med) =>
    setCart((items) => {
      const found = items.find((item) => item.med.id === med.id);
      return found
        ? items.map((item) =>
            item.med.id === med.id
              ? {
                  ...item,
                  quantity: Math.min(item.quantity + 1, med.stockQuantity),
                }
              : item,
          )
        : [...items, { med, quantity: 1 }];
    });
  const changeQuantity = (id: string, adjustment: number) =>
    setCart((items) =>
      items.map((item) =>
        item.med.id === id
          ? {
              ...item,
              quantity: Math.max(
                1,
                Math.min(item.med.stockQuantity, item.quantity + adjustment),
              ),
            }
          : item,
      ),
    );
  const availableMeds = workingMeds.filter((med) =>
    `${med.name} ${med.category}`.toLowerCase().includes(medicineQuery.toLowerCase()) && (medicineFilter === 'all' || (medicineFilter === 'selected' ? cart.some(item=>item.med.id===med.id) : med.stockQuantity>0)),
  );
  const selectSymptom = (_id: string, label: string) => {
    setSelectedSymptoms(current => current.includes(label) ? current.filter(item => item !== label) : [...current, label]);
  };
  const saveDispense = async () => {
    if (!selectedStudent || !symptomsReady || (serviceType==='DISPENSE' && !cart.length) || isDispensing) return;
    setIsDispensing(true);
    setDispenseMessage(null);
    try {
      const response = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          serviceType,
          symptoms,
          treatmentNotes: notes,
          dispensedMedicines: cart.map((item) => ({
            medicationId: item.med.id,
            quantity: item.quantity,
            instructions: item.med.indications || "",
          })),
        }),
      });
      if (!response.ok) throw new Error();
      setWorkingMeds((items) =>
        items.map((med) => {
          const line = cart.find((item) => item.med.id === med.id);
          return line
            ? { ...med, stockQuantity: med.stockQuantity - line.quantity }
            : med;
        }),
      );
      setStudent("");
      setSelectedStudent(null);
      setSelectedSymptoms([]);
      setOtherSymptoms("");
      setNotes("");
      setCart([]);
      setDispenseMessage("บันทึกบริการเรียบร้อยแล้ว");
      window.dispatchEvent(new Event("infirmary-data-changed"));
    } catch {
      setDispenseMessage("บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsDispensing(false);
    }
  };
  const saveMedicine = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const response = await fetch("/api/medications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      if (!response.ok) throw new Error();
      const updated = await response.json();
      setWorkingMeds((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      setCart((items) =>
        items.map((item) =>
          item.med.id === updated.id ? { ...item, med: updated } : item,
        ),
      );
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <div className="mb-3 flex items-center gap-2 rounded-xl bg-white p-2 border border-slate-200" role="group" aria-label="ประเภทบริการ">{[['DISPENSE','จ่ายยา'],['WOUND_CARE','ทำแผล'],['REST','นอนพัก']].map(([id,label])=><button key={id} aria-pressed={serviceType===id} onClick={()=>setServiceType(id)} className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${serviceType===id?'bg-blue-600 text-white':'text-slate-600 hover:bg-slate-50'}`}>{label}</button>)}</div>
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        {[
          ["1", "เลือกนักเรียน", selectedStudent ? "selected" : ""],
          ["2", "บันทึกอาการ", symptomsReady ? symptoms : ''],
          [
            "3",
            "ตรวจสอบและบันทึก",
            selectedStudent && symptomsReady && (serviceType!=='DISPENSE'||cart.length) ? "พร้อมบันทึก" : "",
          ],
        ].map(([step, label, done]) => (
          <div
            key={step}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${done ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}
          >
            <span
              className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${done ? "bg-[#087df5] text-white" : "bg-slate-100 text-slate-500"}`}
            >
              {step}
            </span>
            <div>
              <p className="text-xs font-bold text-[#17375f]">{label}</p>
              <p className="text-[11px] text-slate-500">
                {done ? "พร้อมแล้ว" : "รอข้อมูล"}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-3 xl:h-[calc(100dvh-244px)] xl:min-h-0 xl:grid-cols-[1.55fr_.85fr]">
        <div className="grid min-h-0 gap-3 xl:grid-rows-[auto_auto_minmax(180px,1fr)] xl:overflow-y-auto xl:pr-1">
          <Card cn="p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold">ข้อมูลนักเรียน</h3>
                <p className="mt-1 text-xs text-slate-500">
                  ค้นด้วยชื่อ หรือรหัสนักเรียน
                </p>
              </div>
              <Users size={20} className="text-[#087df5]" />
            </div>
            <div className="relative mt-3">
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 ring-offset-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                <Search className="text-slate-400" size={19} />
                <input
                  value={student}
                  onChange={(e) => {
                    setStudent(e.target.value);
                    setSelectedStudent(null);
                  }}
                  className="w-full bg-transparent px-3 py-3 text-sm outline-none"
                  placeholder="พิมพ์ชื่อ หรือรหัสนักเรียน..."
                />
              </div>
              {studentResults.length > 0 && (
                <div className="absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                  {studentResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => {
                        setSelectedStudent(result);
                        setStudent(result.fullName);
                        setStudentResults([]);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-blue-50"
                    >
                      <div>
                        <p className="text-sm font-bold text-[#17375f]">
                          {result.fullName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {result.studentCode} · {result.gradeLevel}/
                          {result.classroom}
                        </p>
                      </div>
                      {result.allergies && result.allergies !== "ไม่มี" ? (
                        <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-600">
                          มีประวัติแพ้
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-[#087df5]">
                          เลือก
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedStudent && (
              <div className="mt-3 flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 p-3">
                <div>
                  <p className="text-sm font-bold">
                    {selectedStudent.fullName}{" "}
                    <span className="font-normal text-slate-500">
                      · {selectedStudent.studentCode}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {selectedStudent.gradeLevel}/{selectedStudent.classroom}
                    {selectedStudent.allergies &&
                    selectedStudent.allergies !== "ไม่มี"
                      ? ` · ประวัติการแพ้: ${selectedStudent.allergies}`
                      : ""}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setStudent("");
                    setSelectedStudent(null);
                  }}
                  className="rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-white"
                >
                  เปลี่ยน
                </button>
              </div>
            )}
          </Card>
          <Card cn="p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold">อาการเบื้องต้น</h3>
                <p className="mt-1 text-xs text-slate-500">
                  เลือกได้หลายอาการ · กดซ้ำเพื่อยกเลิก · “อื่น ๆ” ระบุเพิ่มเติม
                </p>
              </div>
              <Stethoscope size={20} className="text-[#087df5]" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {[
                ["fever", "มีไข้"],
                ["headache", "ปวดศีรษะ"],
                ["cough", "ไอ / เจ็บคอ"],
                ["stomach", "ปวดท้อง"],
                ["wound", "แผล / ฟกช้ำ"],
                ["other", "อื่น ๆ"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => selectSymptom(id, label)}
                  aria-pressed={selectedSymptoms.includes(label)}
                  className={`rounded-xl border px-3 py-3 text-left text-sm font-bold transition ${selectedSymptoms.includes(label) ? "border-blue-600 bg-blue-600 text-white ring-2 ring-blue-100" : "border-slate-200 bg-white text-[#35537c] hover:border-blue-200 hover:bg-blue-50/50"}`}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span>{label}</span>
                    {selectedSymptoms.includes(label) && (
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20">
                        <Check size={13} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
            {selectedSymptoms.includes('อื่น ๆ') ? (
              <textarea
                value={otherSymptoms}
                onChange={(e) => setOtherSymptoms(e.target.value)}
                className="mt-3 h-24 w-full resize-none rounded-xl border border-blue-200 bg-blue-50/30 p-3 text-sm outline-none ring-offset-2 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-100"
                placeholder="ระบุอาการเบื้องต้น เช่น เวียนศีรษะ คลื่นไส้ หรืออื่น ๆ..."
              />
            ) : null}
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-3 w-full border-b border-slate-200 bg-transparent px-1 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-[#087df5]"
              placeholder="เพิ่มหมายเหตุเพิ่มเติม (ถ้ามี)"
            />
          </Card>
          <Card cn="flex min-h-0 flex-col overflow-hidden p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold">เลือกยา</h3>
                <p className="mt-1 text-xs text-slate-500">
                  เลือกจากรายการที่มีสต็อก
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#087df5]">
                {workingMeds.length} รายการ
              </span>
            </div>
            <label className="mt-3 flex items-center rounded-xl bg-slate-50 px-3 text-slate-400">
              <Search size={17} />
              <input
                value={medicineQuery}
                onChange={(e) => setMedicineQuery(e.target.value)}
                className="w-full bg-transparent px-2 py-2.5 text-sm outline-none"
                placeholder="ค้นหาชื่อยา หรือประเภท"
              />
            </label>
            <div className="mt-2 flex gap-2" role="group" aria-label="กรองรายการยา">{[['all','ทั้งหมด'],['available','มีสต็อก'],['selected',`เลือกแล้ว (${cart.length})`]].map(([id,label])=><button key={id} aria-pressed={medicineFilter===id} onClick={()=>setMedicineFilter(id)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${medicineFilter===id?'bg-blue-600 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{label}</button>)}</div>
            <div className="mt-3 grid min-h-0 flex-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {!availableMeds.length && <p className="col-span-full py-6 text-center text-sm text-slate-500">ไม่พบยาในตัวกรองนี้ ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p>}
              {availableMeds.map((m) => (
                <button
                  key={m.id}
                  onClick={() => add(m)}
                  disabled={m.stockQuantity <= 0}
                  className={`group flex items-center gap-3 rounded-xl border p-3 text-left transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50 ${cart.some(item=>item.med.id===m.id)?'border-blue-300 bg-blue-50/60':'border-slate-200 bg-white'}`}
                >
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-[#087df5] group-hover:bg-white">
                    <Pill size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-relaxed">{m.name}</p>
                    <p
                      className={`text-xs ${m.stockQuantity <= m.minThreshold ? "text-amber-600" : "text-slate-500"}`}
                    >
                      คงเหลือ {m.stockQuantity} {m.unit}
                    </p>
                  </div>
                  {cart.some(item=>item.med.id===m.id)?<CheckCircle2 size={19} className="shrink-0 text-blue-600"/>:<Plus size={18} className="shrink-0 text-blue-600"/>}
                </button>
              ))}
            </div>
          </Card>
        </div>
        <Card cn="flex min-h-0 flex-col overflow-hidden">
          <div className="border-b border-slate-100 bg-[#f7faff] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#4b79ad]">
              {serviceType==='DISPENSE'?'รายการจ่ายยา':serviceType==='WOUND_CARE'?'บันทึกทำแผล':'บันทึกนอนพัก'}
            </p>
            <h3 className="mt-1 font-extrabold">ตรวจสอบก่อนบันทึก</h3>
          </div>
          <div className="flex min-h-0 flex-1 flex-col p-4">
            <div className="mb-3 rounded-xl bg-blue-50 p-3 text-sm">
              <p className="font-bold">
                {selectedStudent?.fullName || "ยังไม่ได้เลือกนักเรียน"}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                อาการ: {symptoms || "ยังไม่ได้ระบุ"}
              </p>
              {notes && (
                <p className="mt-1 text-xs text-slate-600">หมายเหตุ: {notes}</p>
              )}
            </div>
            {selectedStudent?.allergies && selectedStudent.allergies!=='ไม่มี' && <div role="note" className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><p className="flex items-center gap-2 font-bold"><AlertTriangle size={16}/>ประวัติการแพ้</p><p className="mt-1 whitespace-pre-wrap">{selectedStudent.allergies}</p></div>}
            {cart.length ? (
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {cart.map((m) => (
                  <div
                    key={m.med.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"
                  >
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-[#087df5]">
                      <Pill size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{m.med.name}</p>
                      <p className="text-xs text-slate-500">
                        คงเหลือ {m.med.stockQuantity} {m.med.unit}
                      </p>
                    </div>
                    <div className="flex items-center rounded-lg border border-slate-200 bg-white">
                      <button
                        onClick={() => changeQuantity(m.med.id, -1)}
                        aria-label={`ลดจำนวน ${m.med.name}`}
                        disabled={m.quantity <= 1}
                        className="p-1.5 text-slate-500 hover:text-[#087df5]"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-6 text-center text-xs font-bold">
                        {m.quantity}
                      </span>
                      <button
                        onClick={() => changeQuantity(m.med.id, 1)}
                        aria-label={`เพิ่มจำนวน ${m.med.name}`}
                        disabled={m.quantity >= m.med.stockQuantity}
                        className="p-1.5 text-slate-500 hover:text-[#087df5]"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      onClick={() =>
                        setCart(cart.filter((x) => x.med.id !== m.med.id))
                      }
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                      aria-label={`ลบ ${m.med.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
                <PackageOpen className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-semibold text-slate-500">
                  {serviceType==='DISPENSE'?'ยังไม่ได้เลือกยา':'ไม่จ่ายยาในบริการนี้'}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {serviceType==='DISPENSE'?'เลือกรายการจากด้านซ้าย':'บันทึกได้เมื่อเลือกนักเรียนและระบุอาการครบ'}
                </p>
              </div>
            )}
            <div className="mt-5 border-t border-slate-100 pt-4">
              {(!selectedStudent || !symptomsReady || (serviceType==='DISPENSE'&&!cart.length)) && (
                <p className="mb-3 text-xs text-slate-500">
                  {!selectedStudent
                    ? "① เลือกนักเรียนจากผลค้นหา"
                    : !symptomsReady
                      ? "② เลือกอาการ หรือระบุอาการอื่น ๆ"
                      : "③ เลือกยาที่ต้องการจ่าย"}
                </p>
              )}
              <div className="mb-3 flex justify-between text-sm">
                <span className="text-slate-500">จำนวนรายการ</span>
                <b>
                  {cart.reduce((sum, item) => sum + item.quantity, 0)} หน่วย ·{" "}
                  {cart.length} รายการ
                </b>
              </div>
              <button
                onClick={saveDispense}
                disabled={
                  !selectedStudent || !symptomsReady || (serviceType==='DISPENSE'&&!cart.length) || isDispensing
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#087df5] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#056fdc] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
              >
                <CheckCircle2 size={18} />
                {isDispensing ? "กำลังบันทึก..." : "บันทึกบริการ"}
              </button>
              {dispenseMessage && (
                <p
                  className={`mt-3 rounded-lg px-3 py-2 text-center text-xs font-semibold ${dispenseMessage.includes("เรียบร้อย") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}
                >
                  {dispenseMessage}
                </p>
              )}
              <p className="mt-3 text-center text-[11px] text-slate-400">
                <ShieldCheck
                  className="mr-1 inline text-emerald-500"
                  size={13}
                />{" "}
                ตรวจสอบข้อมูลให้ถูกต้องก่อนบันทึก
              </p>
            </div>
          </div>
        </Card>
      </div>
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#4b79ad]">
                  แก้ไขเวชภัณฑ์
                </p>
                <h3 className="mt-1 text-lg font-extrabold">{editing.name}</h3>
              </div>
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={19} />
              </button>
            </div>
            <label className="mt-5 block text-xs font-bold text-slate-600">
              เลือกรายการยา
            </label>
            <select
              value={editing.id}
              onChange={(e) =>
                setEditing(
                  workingMeds.find((m) => m.id === e.target.value) || null,
                )
              }
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"
            >
              {workingMeds.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-600">
                ชื่อยา
                <input
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-400"
                />
              </label>
              <label className="text-xs font-bold text-slate-600">
                หมวดหมู่
                <input
                  value={editing.category}
                  onChange={(e) =>
                    setEditing({ ...editing, category: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-400"
                />
              </label>
              <label className="text-xs font-bold text-slate-600">
                คงเหลือ
                <input
                  type="number"
                  min="0"
                  value={editing.stockQuantity}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      stockQuantity: Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-400"
                />
              </label>
              <label className="text-xs font-bold text-slate-600">
                เกณฑ์ขั้นต่ำ
                <input
                  type="number"
                  min="0"
                  value={editing.minThreshold}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      minThreshold: Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-400"
                />
              </label>
            </div>
            <label className="mt-3 block text-xs font-bold text-slate-600">
              ข้อบ่งใช้
              <input
                value={editing.indications || ""}
                onChange={(e) =>
                  setEditing({ ...editing, indications: e.target.value })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-400"
                placeholder="เช่น ลดไข้ หรือบรรเทาอาการไอ"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                onClick={saveMedicine}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[#087df5] px-4 py-2.5 text-sm font-bold text-white disabled:bg-slate-300"
              >
                <Save size={16} />
                {saving ? "กำลังบันทึก" : "บันทึกข้อมูลยา"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
function Head({ t, d }: { t: string; d: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-extrabold">{t}</h2>
      <p className="mt-1 text-sm text-slate-500">{d}</p>
    </div>
  );
}
function Inventory({ meds }: { meds: Med[] }) {
  const [filter, setFilter] = useState<"all" | "attention" | "healthy">("all");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(meds);
  const [editing, setEditing] = useState<Med | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget,setDeleteTarget]=useState<Med|null>(null);
  const [addStock, setAddStock] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  useEffect(() => setItems(meds), [meds]);
  const save = async () => {
    if (!editing || saving) return;
    setSaveError("");
    if (!Number.isSafeInteger(addStock) || addStock < 0) {
      setSaveError("จำนวนเพิ่มสต็อกต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/medications", {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editing,
          stockQuantity: editing.stockQuantity + addStock,
        }),
      });
      if (!response.ok) throw new Error();
      const updated = await response.json();
      setItems((all) =>
        creating
          ? [updated, ...all]
          : all.map((item) => (item.id === updated.id ? updated : item)),
      );
      setEditing(null);
      setAddStock(0);
      setCreating(false);
      window.dispatchEvent(new Event("infirmary-data-changed"));
    } catch {
      setSaveError(
        "บันทึกไม่สำเร็จ ตรวจสอบชื่อยาซ้ำและจำนวนสต็อก แล้วลองอีกครั้ง",
      );
    } finally {
      setSaving(false);
    }
  };
  const deleteMedication = async () => {
    if (!deleteTarget || saving) return;
    const original = deleteTarget;
    if (!original?.updatedAt) { setSaveError('กรุณาปิดแล้วเปิดรายการใหม่ก่อนลบ'); return; }
    setSaving(true); setSaveError('');
    try {
      const response = await fetch('/api/medications', {method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:original.id, updatedAt:original.updatedAt})});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'ลบยาไม่สำเร็จ');
      setItems(all => all.filter(m => m.id !== original.id));
      setDeleteTarget(null);
      setEditing(null);
      window.dispatchEvent(new Event('infirmary-data-changed'));
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'ลบยาไม่สำเร็จ'); }
    finally { setSaving(false); }
  };
  const visible = items.filter((m) => {
    const matchesText = `${m.name} ${m.category}`.toLowerCase().includes(query.toLowerCase());
    const isAttention = m.stockQuantity <= m.minThreshold;
    const matchesStatus =
      filter === "all" || (filter === "attention" ? isAttention : !isAttention);
    return matchesText && matchesStatus;
  }).sort((a,b)=>Number(b.stockQuantity<=b.minThreshold)-Number(a.stockQuantity<=a.minThreshold)||a.name.localeCompare(b.name,'th'));
  const attention = items.filter((m) => m.stockQuantity <= m.minThreshold);
  const totalUnits = items.reduce((sum, med) => sum + med.stockQuantity, 0);
  return (
    <div className="workspace-page inventory-workspace">
      {deleteTarget&&<DeleteConfirmation title={`ลบยา “${deleteTarget.name}”?`} description={`คงเหลือ ${deleteTarget.stockQuantity} ${deleteTarget.unit}\nการลบเป็นการลบถาวร ไม่สามารถกู้คืนได้\nยาที่มีประวัติการจ่ายแล้วจะไม่สามารถลบได้`} busy={saving} error={saveError} onCancel={()=>setDeleteTarget(null)} onConfirm={deleteMedication}/> }
      <div className="workspace-actions-only">
        <button
          onClick={() => {
            setCreating(true);
            setAddStock(0);
            setEditing({
              id: "",
              name: "",
              category: "ยาทั่วไป",
              unit: "เม็ด",
              stockQuantity: 0,
              minThreshold: 10,
              indications: "",
            });
          }}
          className="flex items-center gap-2 rounded-xl bg-[#087df5] px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#056fdc]"
        >
          <Plus size={15} /> เพิ่มยา
        </button>
      </div>
      <div className="inventory-metrics">
        <div className="rounded-2xl border border-blue-100 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              รายการยาทั้งหมด
            </span>
            <Boxes size={19} className="text-[#087df5]" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-[#17375f]">
            {items.length.toLocaleString()}{" "}
            <span className="text-sm font-semibold text-slate-500">รายการ</span>
          </p>
          <p className="mt-2 text-xs text-slate-400">
            แยกยอดคงเหลือตามหน่วยของแต่ละยา
          </p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              ต้องเติมสต็อก
            </span>
            <AlertTriangle size={19} className="text-amber-500" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-amber-600">
            {attention.length}{" "}
            <span className="text-sm font-semibold text-slate-500">รายการ</span>
          </p>
          <p className="mt-2 text-xs text-amber-600">ตรวจสอบก่อนเปิดจ่ายยา</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              เหนือเกณฑ์ขั้นต่ำ
            </span>
            <CheckCircle2 size={19} className="text-emerald-500" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-emerald-600">
            {Math.max(0, items.length - attention.length)}{" "}
            <span className="text-sm font-semibold text-slate-500">รายการ</span>
          </p>
          <p className="mt-2 text-xs text-emerald-600">
            ปริมาณมากกว่าเกณฑ์ขั้นต่ำ
          </p>
        </div>
      </div>
      <div className="workspace-panel inventory-catalog">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-extrabold text-[#17375f]">รายการเวชภัณฑ์</h3>
            <p className="mt-1 text-xs text-slate-500">
              คลิกดูสถานะและวางแผนเติมสต็อก
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex items-center rounded-xl bg-slate-50 px-3 text-slate-400 ring-offset-2 focus-within:ring-2 focus-within:ring-blue-100">
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent px-2 py-2 text-sm outline-none sm:w-52"
                placeholder="ค้นหาชื่อยา"
              />
            </label>
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
              {(
                [
                  ["all", "ทั้งหมด"],
                  ["attention", "ต้องเติม"],
                  ["healthy", "พร้อมจ่าย"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  aria-pressed={filter === id} onClick={() => setFilter(id)}
                  className={`rounded-lg px-3 py-2 transition ${filter === id ? "bg-white text-[#087df5] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="inventory-list divide-y divide-slate-100">
          {visible.length ? (
            visible.map((m) => {
              const empty = m.stockQuantity === 0;
              const risk = m.stockQuantity <= m.minThreshold;
              const pct = Math.min(
                100,
                Math.round(
                  (m.stockQuantity / Math.max(m.minThreshold * 4, 1)) * 100,
                ),
              );
              return (
                <div
                  key={m.id}
                  className="grid gap-4 p-4 transition hover:bg-blue-50/40 md:grid-cols-[minmax(220px,1.5fr)_minmax(180px,1fr)_130px_110px] md:items-center"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`grid h-11 w-11 place-items-center rounded-xl ${empty ? "bg-red-50 text-red-600" : risk ? "bg-yellow-50 text-yellow-600" : "bg-blue-50 text-[#087df5]"}`}
                    >
                      <Pill size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#17375f]">
                        {m.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {m.category} · {m.indications || "ไม่มีข้อมูลข้อบ่งใช้"}
                      </p>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex justify-between text-xs">
                      <span className={`font-bold ${empty ? "text-red-600" : risk ? "text-yellow-700" : "text-[#17375f]"}`}>
                        {m.stockQuantity} {m.unit}
                      </span>
                      <span className="text-slate-400">
                        ขั้นต่ำ {m.minThreshold}
                      </span>
                    </div>
                    <div className={`inventory-stock-meter h-2 overflow-hidden rounded-full ${empty ? "bg-red-100" : risk ? "bg-yellow-100" : "bg-slate-100"}`}>
                      <div
                        className={`h-full rounded-full ${empty ? "bg-red-500" : risk ? "bg-yellow-400" : "bg-emerald-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span
                    className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${empty ? "bg-red-50 text-red-700" : risk ? "bg-yellow-50 text-yellow-800" : "bg-emerald-50 text-emerald-700"}`}
                  >
                    {m.stockQuantity===0 ? "หมดสต็อก" : risk ? "ใกล้หมด" : "พร้อมจ่าย"}
                  </span>
                  <button
                    onClick={() => {
                      setCreating(false);
                      setEditing(m);
                      setAddStock(0);
                    }}
                    className="flex w-fit items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[#17375f] transition hover:border-blue-200 hover:bg-blue-50"
                  >
                    <Pencil size={13} /> แก้ไข
                  </button>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center">
              <PackageOpen className="mx-auto mb-3 text-slate-300" />
              <p className="font-semibold text-slate-500">
                ไม่พบรายการที่ค้นหา
              </p>
              <button
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
                className="mt-2 text-sm font-bold text-[#087df5]"
              >
                ล้างตัวกรอง
              </button>
            </div>
          )}
        </div>
      </div>
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4">
          <div role="dialog" aria-modal="true" aria-label="ข้อมูลยา" className="workspace-modal w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#4b79ad]">
                  {creating ? "เพิ่มรายการยา" : "แก้ไขข้อมูลยา"}
                </p>
                <h3 className="mt-1 text-lg font-extrabold">
                  {creating ? "ระบุข้อมูลเวชภัณฑ์ใหม่" : editing.name}
                </h3>
              </div>
              <button
                disabled={saving} onClick={() => setEditing(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={19} />
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-600">
                ชื่อยา
                <input
                  value={editing.name}
                  onChange={(e) =>
                    setEditing({ ...editing, name: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-400"
                />
              </label>
              <label className="text-xs font-bold text-slate-600">
                หมวดหมู่
                <input
                  value={editing.category}
                  onChange={(e) =>
                    setEditing({ ...editing, category: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-400"
                />
              </label>
              <label className="text-xs font-bold text-slate-600">
                หน่วยนับ
                <input
                  value={editing.unit}
                  onChange={(e) =>
                    setEditing({ ...editing, unit: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-400"
                />
              </label>
              <label className="text-xs font-bold text-slate-600">
                คงเหลือ
                <input
                  type="number"
                  min="0"
                  value={editing.stockQuantity}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      stockQuantity: Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-400"
                />
              </label>
              <label className="text-xs font-bold text-emerald-700">
                เพิ่มสต็อก
                <input
                  type="number"
                  min="0"
                  value={addStock || ""}
                  onChange={(e) => setAddStock(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-emerald-400"
                  placeholder="0"
                />
                <span className="mt-1 block text-[11px] font-normal text-emerald-600">
                  บวกเพิ่มจากยอดคงเหลือเดิมอัตโนมัติ
                </span>
              </label>
              <label className="text-xs font-bold text-slate-600">
                เกณฑ์ขั้นต่ำ
                <input
                  type="number"
                  min="0"
                  value={editing.minThreshold}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      minThreshold: Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-400"
                />
              </label>
              <label className="text-xs font-bold text-slate-600">
                ข้อบ่งใช้
                <input
                  value={editing.indications || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, indications: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-400"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              {!creating && <button type="button" disabled={saving} onClick={()=>{setSaveError('');setDeleteTarget(items.find(m=>m.id===editing.id)||null)}} className="mr-auto rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">ลบยา</button>}
              <button
                disabled={saving} onClick={() => setEditing(null)}
                className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[#087df5] px-4 py-2.5 text-sm font-bold text-white disabled:bg-slate-300"
              >
                <Save size={16} />
                {saving
                  ? "กำลังบันทึก"
                  : creating
                    ? "เพิ่มยาเข้าคลัง"
                    : "บันทึกการแก้ไข"}
              </button>
            </div>
            {saveError && (
              <p role="alert" className="mt-3 text-sm text-red-600">
                {saveError}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function Records({ visits }: { visits: Visit[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-left text-sm">
        <thead className="bg-[#f4f7fb] text-slate-500">
          <tr>
            {["วัน-เวลา", "นักเรียน", "อาการ", "ยาที่จ่าย", "สถานะ"].map(
              (x) => (
                <th key={x} className="px-6 py-4 text-xs">
                  {x}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {visits.length ? (
            visits.map((v) => (
              <tr key={v.id} className="border-t border-slate-100">
                <td className="px-6 py-4">
                  {new Date(v.visitedAt).toLocaleString("th-TH")}
                </td>
                <td className="px-6 py-4 font-bold">{v.student.fullName}</td>
                <td className="px-6 py-4">{v.symptoms}</td>
                <td className="px-6 py-4">
                  {v.dispensedItems.map((x) => x.medication.name).join(", ") ||
                    "-"}
                </td>
                <td className="px-6 py-4">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="p-12 text-center text-slate-400">
                ยังไม่มีประวัติการจ่ายยา
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
