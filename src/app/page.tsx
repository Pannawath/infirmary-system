'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  HeartPulse,
  Pill,
  Users,
  Search,
  PlusCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileText,
  Bed,
  BarChart3,
  Calendar,
  Phone,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface Student {
  id: string;
  studentCode: string;
  fullName: string;
  gradeLevel: string;
  classroom: string;
  allergies: string | null;
  chronicDiseases: string | null;
  guardianPhone: string | null;
}

interface Medication {
  id: string;
  name: string;
  category: string;
  unit: string;
  stockQuantity: number;
  minThreshold: number;
  indications: string | null;
}

interface DispensedMedicineItem {
  medicationId: string;
  name: string;
  quantity: number;
  unit: string;
  instructions: string;
}

interface VisitRecord {
  id: string;
  symptoms: string;
  bodyTemperature: number | null;
  bloodPressure: string | null;
  pulseRate: number | null;
  bedRest: boolean;
  treatmentNotes: string | null;
  visitedAt: string;
  student: Student;
  dispensedItems: {
    id: string;
    quantity: number;
    instructions: string | null;
    medication: Medication;
  }[];
}

interface SummaryData {
  totalVisits: number;
  todayVisits: number;
  totalStudents: number;
  lowStockCount: number;
}

export default function InfirmaryApp() {
  const [activeTab, setActiveTab] = useState<'walkin' | 'records' | 'inventory' | 'reports'>('walkin');

  // Search and selected student
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Form states
  const [symptoms, setSymptoms] = useState('');
  const [bodyTemp, setBodyTemp] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [pulseRate, setPulseRate] = useState('');
  const [bedRest, setBedRest] = useState(false);
  const [treatmentNotes, setTreatmentNotes] = useState('');

  // Medication Dispensing State
  const [medications, setMedications] = useState<Medication[]>([]);
  const [selectedMedId, setSelectedMedId] = useState('');
  const [dispenseQty, setDispenseQty] = useState(1);
  const [dispenseInstructions, setDispenseInstructions] = useState('');
  const [dispenseList, setDispenseList] = useState<DispensedMedicineItem[]>([]);

  // History & Summary State
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    totalVisits: 0,
    todayVisits: 0,
    totalStudents: 0,
    lowStockCount: 0,
  });
  const [topMeds, setTopMeds] = useState<{ name: string; totalDispensed: number; unit: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch initial medications & summary
  useEffect(() => {
    fetchMedications();
    fetchSummary();
    fetchVisits();
  }, []);

  // Search students debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/students?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error(err);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchMedications = async () => {
    try {
      const res = await fetch('/api/medications');
      if (res.ok) {
        const data = await res.json();
        setMedications(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch('/api/reports/summary');
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setTopMeds(data.topMedications || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVisits = async () => {
    try {
      const res = await fetch('/api/visits');
      if (res.ok) {
        const data = await res.json();
        setVisits(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMedicationToCart = () => {
    if (!selectedMedId) return;
    const med = medications.find((m) => m.id === selectedMedId);
    if (!med) return;

    if (dispenseQty > med.stockQuantity) {
      setStatusMessage({ type: 'error', text: `สต็อกยาไม่เพียงพอ (คงเหลือ ${med.stockQuantity} ${med.unit})` });
      return;
    }

    setDispenseList((prev) => [
      ...prev,
      {
        medicationId: med.id,
        name: med.name,
        quantity: dispenseQty,
        unit: med.unit,
        instructions: dispenseInstructions || med.indications || '',
      },
    ]);

    setSelectedMedId('');
    setDispenseQty(1);
    setDispenseInstructions('');
    setStatusMessage(null);
  };

  const handleRemoveMedication = (index: number) => {
    setDispenseList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      setStatusMessage({ type: 'error', text: 'กรุณาเลือกนักเรียนผู้เข้ารับการรักษา' });
      return;
    }
    if (!symptoms.trim()) {
      setStatusMessage({ type: 'error', text: 'กรุณากรอกอาการของผู้ป่วย' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudent.id,
          symptoms,
          bodyTemperature: bodyTemp ? parseFloat(bodyTemp) : null,
          bloodPressure,
          pulseRate: pulseRate ? parseInt(pulseRate, 10) : null,
          bedRest,
          bedRestStart: bedRest ? new Date().toISOString() : null,
          treatmentNotes,
          dispensedMedicines: dispenseList,
        }),
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'บันทึกการรักษาและตัดสต็อกยาสำเร็จเรียบร้อย!' });
        // Reset form
        setSelectedStudent(null);
        setSearchQuery('');
        setSymptoms('');
        setBodyTemp('');
        setBloodPressure('');
        setPulseRate('');
        setBedRest(false);
        setTreatmentNotes('');
        setDispenseList([]);
        // Refresh records & stats
        fetchSummary();
        fetchVisits();
        fetchMedications();
      } else {
        const errorData = await res.json();
        setStatusMessage({ type: 'error', text: errorData.error || 'เกิดข้อผิดพลาดในการบันทึก' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-emerald-900 text-white flex flex-col shrink-0 border-r border-emerald-950">
        <div className="p-6 border-b border-emerald-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-700/80 rounded-xl shadow-inner">
              <HeartPulse className="w-7 h-7 text-emerald-300 animate-pulse" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight tracking-wide">ห้องพยาบาล</h1>
              <p className="text-xs text-emerald-300 font-medium">School Infirmary</p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-1.5 flex-1 text-sm font-medium">
          <button
            onClick={() => setActiveTab('walkin')}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-lg transition-colors ${
              activeTab === 'walkin'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-emerald-100/80 hover:bg-emerald-800/60 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4 text-emerald-300" />
            <span>ตรวจรักษา / Walk-in</span>
          </button>

          <button
            onClick={() => setActiveTab('records')}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-lg transition-colors ${
              activeTab === 'records'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-emerald-100/80 hover:bg-emerald-800/60 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4 text-emerald-300" />
            <span>ประวัติการรักษา ({visits.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-lg transition-colors ${
              activeTab === 'inventory'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-emerald-100/80 hover:bg-emerald-800/60 hover:text-white'
            }`}
          >
            <Pill className="w-4 h-4 text-emerald-300" />
            <span>คลังเวชภัณฑ์ & ยา</span>
            {summary.lowStockCount > 0 && (
              <span className="ml-auto bg-amber-500 text-slate-900 text-xs px-1.5 py-0.5 rounded-full font-bold">
                {summary.lowStockCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-lg transition-colors ${
              activeTab === 'reports'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-emerald-100/80 hover:bg-emerald-800/60 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-300" />
            <span>สถิติและรายงานสรุป</span>
          </button>
        </nav>

        <div className="p-4 border-t border-emerald-800/80 text-xs text-emerald-300/80">
          <p className="font-semibold text-emerald-100">สถานะระบบ</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>SQLite Local Database</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {/* Top Metric Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {activeTab === 'walkin' && 'ระบบตรวจรักษาและจ่ายยา (Walk-in Clinic)'}
                {activeTab === 'records' && 'ประวัติและเวชระเบียนการรักษา'}
                {activeTab === 'inventory' && 'ทะเบียนและสถานะสต็อกเวชภัณฑ์'}
                {activeTab === 'reports' && 'สรุปสถิติประจำภาคเรียน'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                บันทึกการรักษา อาการคัดกรอง และประวัติการจ่ายยาสำหรับบุคลากรทางการศึกษา
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-1.5 rounded-lg text-sm font-medium">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>วันนี้: <strong>{summary.todayVisits}</strong> ราย</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 text-slate-700 px-3.5 py-1.5 rounded-lg text-sm font-medium">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span>รวมทั้งหมด: <strong>{summary.totalVisits}</strong> ราย</span>
              </div>
            </div>
          </div>
        </header>

        <div className="p-8">
          {/* Status Alert Banner */}
          {statusMessage && (
            <div
              className={`mb-6 p-4 rounded-xl flex items-center gap-3 border ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <p className="text-sm font-medium">{statusMessage.text}</p>
            </div>
          )}

          {/* TAB 1: WALKIN CLINIC FORM */}
          {activeTab === 'walkin' && (
            <form onSubmit={handleSaveVisit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Student Search & Triage */}
              <div className="lg:col-span-7 space-y-6">
                {/* 1. Student Identification */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">1</span>
                    ค้นหาและเลือกข้อมูลนักเรียน
                  </h3>

                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      placeholder="พิมพ์เลขประจำตัว (เช่น 50101) หรือชื่อ-นามสกุล..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50/50"
                    />
                  </div>

                  {/* Search dropdown results */}
                  {searchResults.length > 0 && !selectedStudent && (
                    <div className="mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
                      {searchResults.map((stu) => (
                        <div
                          key={stu.id}
                          onClick={() => {
                            setSelectedStudent(stu);
                            setSearchResults([]);
                            setSearchQuery(`${stu.studentCode} - ${stu.fullName}`);
                          }}
                          className="p-3 hover:bg-emerald-50/60 cursor-pointer transition-colors flex items-center justify-between"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {stu.fullName} <span className="text-xs text-slate-500">({stu.studentCode})</span>
                            </p>
                            <p className="text-xs text-slate-500">
                              ชั้น {stu.gradeLevel}/{stu.classroom}
                            </p>
                          </div>
                          {stu.allergies && stu.allergies !== 'ไม่มี' && (
                            <span className="bg-rose-100 text-rose-800 text-xs px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" /> แพ้ยา: {stu.allergies}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Selected Student Card */}
                  {selectedStudent && (
                    <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-base font-bold text-slate-900">{selectedStudent.fullName}</p>
                          <p className="text-xs text-slate-600 mt-0.5">
                            รหัสนักเรียน: <strong>{selectedStudent.studentCode}</strong> | ชั้น: <strong>{selectedStudent.gradeLevel}/{selectedStudent.classroom}</strong>
                          </p>
                          {selectedStudent.guardianPhone && (
                            <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" /> ผู้ปกครอง: {selectedStudent.guardianPhone}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStudent(null);
                            setSearchQuery('');
                          }}
                          className="text-xs text-rose-600 hover:text-rose-700 underline font-medium"
                        >
                          เปลี่ยนคน
                        </button>
                      </div>

                      {/* Medical Alert Badge */}
                      {selectedStudent.allergies && selectedStudent.allergies !== 'ไม่มี' && (
                        <div className="mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 text-xs font-semibold">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>แจ้งเตือนประวัติการแพ้: {selectedStudent.allergies}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Triage & Symptoms */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">2</span>
                    การคัดกรองและบันทึกอาการ
                  </h3>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      อาการเบื้องต้น / สาเหตุที่มาห้องพยาบาล <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="เช่น ปวดศีรษะ ไข้สูง มีแผลถลอกที่หัวเข่า ปวดประจำเดือน..."
                      value={symptoms}
                      onChange={(e) => setSymptoms(e.target.value)}
                      className="w-full p-3 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-slate-50/50"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">อุณหภูมิ (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="36.5"
                        value={bodyTemp}
                        onChange={(e) => setBodyTemp(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">ความดัน (mmHg)</label>
                      <input
                        type="text"
                        placeholder="120/80"
                        value={bloodPressure}
                        onChange={(e) => setBloodPressure(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">ชีพจร (bpm)</label>
                      <input
                        type="number"
                        placeholder="80"
                        value={pulseRate}
                        onChange={(e) => setPulseRate(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-800">
                      <input
                        type="checkbox"
                        checked={bedRest}
                        onChange={(e) => setBedRest(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                      />
                      <Bed className="w-4 h-4 text-emerald-600" />
                      <span>ให้นอนพักในห้องพยาบาล</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">การปฐมพยาบาล / บันทึกเพิ่มเติม</label>
                    <input
                      type="text"
                      placeholder="เช่น ล้างแผลสดด้วยน้ำเกลือ ทายาเบตาดีน ประคบเย็น..."
                      value={treatmentNotes}
                      onChange={(e) => setTreatmentNotes(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Medication Dispensing */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">3</span>
                    การจ่ายยาและตัดสต็อก
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">เลือกรายการยา</label>
                      <select
                        value={selectedMedId}
                        onChange={(e) => setSelectedMedId(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                      >
                        <option value="">-- เลือกยาจากคลัง --</option>
                        {medications.map((m) => (
                          <option key={m.id} value={m.id} disabled={m.stockQuantity <= 0}>
                            {m.name} (คงเหลือ: {m.stockQuantity} {m.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-1">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">จำนวนจ่าย</label>
                        <input
                          type="number"
                          min="1"
                          value={dispenseQty}
                          onChange={(e) => setDispenseQty(parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">วิธีรับประทาน</label>
                        <input
                          type="text"
                          placeholder="เช่น 1 เม็ด หลังอาหารทันที"
                          value={dispenseInstructions}
                          onChange={(e) => setDispenseInstructions(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddMedicationToCart}
                      disabled={!selectedMedId}
                      className="w-full py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <PlusCircle className="w-4 h-4" /> เพิ่มรายการยา
                    </button>
                  </div>

                  {/* Dispensing Items List */}
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-600 mb-2">รายการยาที่จะจ่าย ({dispenseList.length}):</p>
                    {dispenseList.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-lg">
                        ยังไม่มีการเลือกยา (ไม่ต้องจ่ายยาหากเป็นการปฐมพยาบาลอย่างเดียว)
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {dispenseList.map((item, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100 flex items-center justify-between text-xs">
                            <div>
                              <p className="font-bold text-emerald-950">{item.name}</p>
                              <p className="text-emerald-700">จำนวน: {item.quantity} {item.unit} | {item.instructions}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveMedication(idx)}
                              className="text-rose-600 hover:text-rose-800 font-bold ml-2 text-xs"
                            >
                              ลบ
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Action Card */}
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedStudent}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  {isSubmitting ? 'กำลังบันทึกข้อมูล...' : 'บันทึกการรักษาและตัดสต็อกยา'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: VISIT RECORDS */}
          {activeTab === 'records' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm">ประวัติการเข้ารับการรักษาล่าสุด</h3>
                <span className="text-xs text-slate-500">แสดงสูงสุด 50 รายการล่าสุด</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">วัน-เวลา</th>
                      <th className="px-4 py-3">นักเรียน</th>
                      <th className="px-4 py-3">ชั้น</th>
                      <th className="px-4 py-3">อาการ</th>
                      <th className="px-4 py-3">สัญญาณชีพ</th>
                      <th className="px-4 py-3">ยาที่จ่าย</th>
                      <th className="px-4 py-3">การนอนพัก</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visits.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(v.visitedAt).toLocaleString('th-TH')}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                          {v.student.fullName}
                          <span className="block text-xs text-slate-400 font-normal">{v.student.studentCode}</span>
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {v.student.gradeLevel}/{v.student.classroom}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-800 max-w-xs">{v.symptoms}</td>
                        <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                          {v.bodyTemperature && <span>{v.bodyTemperature}°C </span>}
                          {v.bloodPressure && <span>BP: {v.bloodPressure} </span>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {v.dispensedItems.length > 0 ? (
                            <ul className="list-disc list-inside text-emerald-800 font-medium">
                              {v.dispensedItems.map((item) => (
                                <li key={item.id}>
                                  {item.medication.name} ({item.quantity} {item.medication.unit})
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-slate-400 italic">ไม่มียา</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {v.bedRest ? (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
                              นอนพัก
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: INVENTORY */}
          {activeTab === 'inventory' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 text-sm">รายการเวชภัณฑ์และสถานะสต็อก</h3>
                <span className="text-xs text-slate-500">ทั้งหมด {medications.length} รายการ</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">ชื่อเวชภัณฑ์ / ยา</th>
                      <th className="px-4 py-3">หมวดหมู่</th>
                      <th className="px-4 py-3">สต็อกคงเหลือ</th>
                      <th className="px-4 py-3">เกณฑ์ขั้นต่ำ</th>
                      <th className="px-4 py-3">สรรพคุณ / ข้อบ่งใช้</th>
                      <th className="px-4 py-3">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {medications.map((m) => {
                      const isLow = m.stockQuantity <= m.minThreshold;
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-900">{m.name}</td>
                          <td className="px-4 py-3 text-xs">{m.category}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            {m.stockQuantity} {m.unit}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {m.minThreshold} {m.unit}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">{m.indications || '-'}</td>
                          <td className="px-4 py-3 text-xs">
                            {isLow ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold flex items-center gap-1 w-fit">
                                <AlertTriangle className="w-3 h-3" /> ใกล้หมด
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                                ปกติ
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: REPORTS & STATISTICS */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ผู้ป่วยวันนี้</p>
                  <p className="text-3xl font-extrabold text-emerald-600 mt-2">{summary.todayVisits}</p>
                </div>
                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ยอดรวมผู้รับการรักษา</p>
                  <p className="text-3xl font-extrabold text-slate-900 mt-2">{summary.totalVisits}</p>
                </div>
                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ฐานข้อมูลนักเรียน</p>
                  <p className="text-3xl font-extrabold text-slate-900 mt-2">{summary.totalStudents}</p>
                </div>
                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ยาที่ใกล้หมดสต็อก</p>
                  <p className="text-3xl font-extrabold text-amber-600 mt-2">{summary.lowStockCount}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                <h3 className="font-bold text-slate-900 text-base mb-4">5 อันดับยาที่จ่ายมากที่สุด</h3>
                <div className="space-y-3">
                  {topMeds.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-sm text-slate-800">{item.name}</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-700">
                        {item.totalDispensed} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
