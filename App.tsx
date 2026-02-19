
import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileUp, 
  Search, 
  Users, 
  Clock, 
  AlertCircle,
  FileSpreadsheet,
  Download,
  Trophy,
  Activity,
  FileDown,
  LogIn,
  LogOut,
  CalendarDays,
  CheckCircle2,
  XCircle,
  Settings2,
  Home,
  ShieldAlert,
  Smartphone,
  DownloadCloud,
  HelpCircle,
  Info
} from 'lucide-react';
import { RawRecord, PersonAttendance, AttendanceEntry } from './types.ts';
import Calendar from './components/Calendar.tsx';
import { parseJalaliDate, JALALI_MONTHS, excelSerialToJalali, getDaysInMonth } from './utils/jalali.ts';

const excelTimeToSeconds = (time: any): number => {
  if (typeof time === 'number') return Math.round(time * 24 * 3600);
  if (typeof time === 'string' && time.includes(':')) {
    const parts = time.split(':');
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + (parts[2] ? parseInt(parts[2]) : 0);
  }
  return 0;
};

const secondsToHHMMSS = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatFriendlyJalaliDate = (dateStr: string) => {
  const parsed = parseJalaliDate(dateStr);
  if (!parsed) return dateStr;
  return `${parsed.day} ${JALALI_MONTHS[parsed.month - 1]} ${parsed.year}`;
};

const App: React.FC = () => {
  const [rawParsedData, setRawParsedData] = useState<Record<string, PersonAttendance>>({});
  const [mergeInterval, setMergeInterval] = useState<number>(5);
  const [trafficLimit, setTrafficLimit] = useState<number>(2);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('PWA: Install prompt is ready');
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      setShowInstallGuide(true);
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const bstr = event.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json<RawRecord>(ws);

        const initialProcessed: Record<string, PersonAttendance> = {};

        rawData.forEach((row) => {
          const id = String(row.CodePersonel || '');
          const description = String(row.Description || '');
          const timeSeconds = excelTimeToSeconds(row.Timestamp2);
          
          let datestamp = '';
          const rawDate = row.Datestamp;
          if (typeof rawDate === 'number') {
            datestamp = excelSerialToJalali(rawDate);
          } else if (typeof rawDate === 'string') {
            datestamp = /^\d+$/.test(rawDate.trim()) ? excelSerialToJalali(Number(rawDate.trim())) : rawDate.trim();
          }

          const nameMatch = description.match(/Valid credential (.*?) \(/);
          const name = nameMatch ? nameMatch[1].trim() : `شخص ${id}`;

          if (!initialProcessed[id]) {
            initialProcessed[id] = { id, name, entries: [], dailyLogs: {} };
          }

          const entry: AttendanceEntry = {
            time: secondsToHHMMSS(timeSeconds),
            date: datestamp,
            description: description
          };

          if (!initialProcessed[id].dailyLogs[datestamp]) {
            initialProcessed[id].dailyLogs[datestamp] = [];
          }
          initialProcessed[id].dailyLogs[datestamp].push(entry);
        });

        setRawParsedData(initialProcessed);
        setSelectedPersonId(null);
      } catch (err) {
        alert("خطا در پردازش فایل اکسل.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const processedData = useMemo(() => {
    const finalProcessed: Record<string, PersonAttendance> = {};
    const intervalSeconds = mergeInterval * 60;

    Object.keys(rawParsedData).forEach(id => {
      const person = rawParsedData[id];
      const newDailyLogs: Record<string, AttendanceEntry[]> = {};

      Object.keys(person.dailyLogs).forEach(date => {
        const dayEntries = [...person.dailyLogs[date]].sort((a, b) => excelTimeToSeconds(a.time) - excelTimeToSeconds(b.time));
        const mergedEntries: AttendanceEntry[] = [];
        if (dayEntries.length > 0) {
          let currentGroup = dayEntries[0];
          for (let i = 1; i < dayEntries.length; i++) {
            const nextEntry = dayEntries[i];
            const diffSeconds = excelTimeToSeconds(nextEntry.time) - excelTimeToSeconds(currentGroup.time);
            if (diffSeconds < intervalSeconds) {
              currentGroup = nextEntry;
            } else {
              mergedEntries.push(currentGroup);
              currentGroup = nextEntry;
            }
          }
          mergedEntries.push(currentGroup);
        }
        newDailyLogs[date] = mergedEntries;
      });

      finalProcessed[id] = { ...person, dailyLogs: newDailyLogs, entries: Object.values(newDailyLogs).flat() };
    });
    return finalProcessed;
  }, [rawParsedData, mergeInterval]);

  const highTrafficPeople = useMemo(() => {
    return (Object.values(processedData) as PersonAttendance[])
      .map(p => ({ ...p, highTrafficDays: Object.values(p.dailyLogs).filter(entries => entries.length > trafficLimit).length }))
      .filter(p => (p.highTrafficDays ?? 0) > 0)
      .sort((a, b) => (b.highTrafficDays ?? 0) - (a.highTrafficDays ?? 0));
  }, [processedData, trafficLimit]);

  const filteredPeople = useMemo(() => {
    if (!searchTerm) return highTrafficPeople;
    const lowerSearch = searchTerm.toLowerCase();
    return highTrafficPeople.filter(p => p.name.toLowerCase().includes(lowerSearch) || p.id.toLowerCase().includes(lowerSearch));
  }, [highTrafficPeople, searchTerm]);

  const selectedPerson = useMemo(() => selectedPersonId ? processedData[selectedPersonId] : null, [processedData, selectedPersonId]);

  const selectedPersonStats = useMemo(() => {
    if (!selectedPerson) return null;
    const dailyLogs = selectedPerson.dailyLogs;
    const highTrafficDaysEntries = (Object.entries(dailyLogs) as [string, AttendanceEntry[]][])
      .filter(([_, entries]) => entries.length > trafficLimit)
      .sort((a, b) => b[1].length - a[1].length);

    const firstDateStr = Object.keys(dailyLogs)[0] || "01/01/1404";
    const parsed = parseJalaliDate(firstDateStr);
    const year = parsed?.year || 1404;
    const month = parsed?.month || 1;

    const activeDaysMap: Record<string, number> = {};
    (Object.entries(dailyLogs) as [string, AttendanceEntry[]][]).forEach(([date, entries]) => { activeDaysMap[date] = entries.length; });

    let counts = { no: 0, normal: 0, high: 0 };
    const daysInMonth = getDaysInMonth(month, year);
    for (let day = 1; day <= daysInMonth; day++) {
      const count = activeDaysMap[`${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`] || 0;
      if (count === 0) counts.no++;
      else if (count <= trafficLimit) counts.normal++;
      else counts.high++;
    }

    return { totalDays: daysInMonth, highTrafficCount: highTrafficDaysEntries.length, highTrafficDetails: highTrafficDaysEntries, activeDaysMap, year, month, summary: counts };
  }, [selectedPerson, trafficLimit]);

  const exportHighTrafficReport = () => {
    const reportData = highTrafficPeople.map(p => ({ 'نام': p.name, 'کد': p.id, 'روزهای پرتردد': p.highTrafficDays, 'کل حضور': Object.keys(p.dailyLogs).length }));
    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "Personnel_Report.xlsx");
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 overflow-x-hidden" dir="rtl">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="bg-blue-600 p-2 rounded-lg">
              <FileSpreadsheet className="text-white w-6 h-6" />
            </div>
            <div className="text-right">
              <h1 className="text-lg font-bold text-slate-800">تحلیلگر هوشمند تردد</h1>
              <p className="text-[10px] text-slate-500 font-medium">واحد فناوری اطلاعات عمران آذرستان</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
             <button 
                onClick={handleInstallClick}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all shadow-md active:scale-95 text-xs ${deferredPrompt ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white animate-bounce' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
             >
                <Smartphone size={16} />
                <span>{deferredPrompt ? 'نصب برنامه' : 'راهنمای نصب'}</span>
             </button>

             <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <Settings2 size={16} className="text-slate-400" />
                <input type="number" min="1" className="w-14 bg-transparent text-center font-black text-sm outline-none" value={mergeInterval} onChange={(e) => setMergeInterval(Number(e.target.value))} />
                <span className="text-[10px] text-slate-400 font-bold">دقیقه</span>
             </div>

             <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <ShieldAlert size={16} className="text-orange-400" />
                <input type="number" min="1" className="w-14 bg-transparent text-center font-black text-sm outline-none" value={trafficLimit} onChange={(e) => setTrafficLimit(Number(e.target.value))} />
                <span className="text-[10px] text-slate-400 font-bold">بار</span>
             </div>

             {Object.keys(rawParsedData).length > 0 && (
               <button onClick={exportHighTrafficReport} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 shadow-md text-xs flex items-center gap-2">
                  <FileDown size={18} />
                  <span>گزارش</span>
               </button>
             )}
             
             <label className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl cursor-pointer hover:bg-blue-700 shadow-md active:scale-95 text-xs font-bold">
                <FileUp size={18} />
                <span>بارگذاری</span>
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
             </label>
          </div>
        </div>

        {showInstallGuide && (
          <div className="absolute top-full right-4 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-blue-100 p-4 z-50 animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-black text-slate-800 text-sm">راهنمای نصب دستی</h4>
              <button onClick={() => setShowInstallGuide(false)} className="text-slate-400 hover:text-red-500"><XCircle size={18} /></button>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed text-right">
              ۱. در مرورگر روی آیکون <strong className="text-blue-600">سه نقطه</strong> کلیک کنید.<br/>
              ۲. گزینه <strong className="text-blue-600">Install App</strong> را پیدا کنید.<br/>
              ۳. دکمه <strong className="text-blue-600">Install</strong> را بزنید.
            </p>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        {!Object.keys(rawParsedData).length ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 shadow-sm mx-auto max-w-2xl">
            <div className="bg-blue-50 p-6 rounded-full mb-6 text-blue-400"><Download size={48} /></div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">در انتظار بارگذاری داده‌ها</h2>
            <p className="text-slate-500 text-center px-6 text-sm">فایل اکسل را جهت استخراج خودکار لیست افراد پرتردد بارگذاری نمایید.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <div className="relative mb-4">
                  <Search className="absolute right-3 top-2.5 text-slate-400" size={18} />
                  <input type="text" placeholder="جستجو..." className="w-full pr-10 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  <div className="flex justify-between items-center mb-2 px-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">لیست پرترددها</p>
                    <span className="bg-orange-100 text-orange-600 text-[10px] px-2 py-0.5 rounded-full font-bold">{filteredPeople.length} نفر</span>
                  </div>
                  {filteredPeople.map(person => (
                    <button key={person.id} onDoubleClick={() => setSelectedPersonId(person.id)} className={`w-full text-right p-3 rounded-xl flex items-center justify-between transition-all border group ${selectedPersonId === person.id ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-700 border-slate-50 hover:border-blue-200 hover:bg-blue-50/50'}`}>
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${selectedPersonId === person.id ? 'bg-blue-500' : 'bg-slate-100 group-hover:bg-blue-100'}`}><Users size={14} /></div>
                        <div>
                          <div className="font-bold text-xs leading-tight">{person.name}</div>
                          <div className={`text-[9px] mt-0.5 ${selectedPersonId === person.id ? 'text-blue-100' : 'text-slate-400'}`}>کد: {person.id}</div>
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${selectedPersonId === person.id ? 'bg-white/20' : 'bg-orange-100 text-orange-600'}`}>{person.highTrafficDays} روز</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-8">
              {!selectedPerson ? (
                <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center shadow-sm">
                  <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600"><Trophy size={32} /></div>
                  <h3 className="text-xl font-bold text-slate-800">تحلیل هوشمند عمران آذرستان</h3>
                  <p className="text-slate-500 mt-2 text-sm">روی نام فرد در لیست سمت راست <strong className="text-blue-600">دبل کلیک</strong> کنید تا جزئیات دقیق ماهانه را مشاهده کنید.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex justify-start">
                     <button onClick={() => setSelectedPersonId(null)} className="flex items-center gap-2 bg-white text-slate-600 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all font-bold text-xs shadow-sm"><Home size={16} className="text-blue-600" /> بازگشت</button>
                  </div>
                  
                  <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex items-center gap-5 flex-row-reverse">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white text-2xl font-black">{selectedPerson.name[0]}</div>
                    <div className="text-right flex-1">
                      <h2 className="text-xl font-black text-slate-800">{selectedPerson.name}</h2>
                      <div className="flex gap-2 mt-1 justify-end">
                        <span className="text-slate-500 text-[9px] bg-slate-100 px-2 py-0.5 rounded-full font-bold">کد: {selectedPerson.id}</span>
                        <span className="text-orange-600 text-[9px] bg-orange-50 px-2 py-0.5 rounded-full font-bold">{selectedPersonStats?.highTrafficCount} روز بحرانی</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-4">
                        <Calendar year={selectedPersonStats?.year || 1404} month={selectedPersonStats?.month || 1} activeDays={selectedPersonStats?.activeDaysMap || {}} limit={trafficLimit} />
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                            <div className="flex items-center gap-2 border-b border-slate-50 pb-2"><CalendarDays size={16} className="text-blue-600" /><h4 className="text-[11px] font-black text-slate-700">خلاصه وضعیت ماهانه</h4></div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center"><XCircle size={14} className="text-slate-400 mb-1" /><span className="text-[14px] font-black text-slate-800">{selectedPersonStats?.summary.no}</span><span className="text-[8px] font-bold text-slate-500">بدون تردد</span></div>
                                <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-100 flex flex-col items-center"><CheckCircle2 size={14} className="text-emerald-500 mb-1" /><span className="text-[14px] font-black text-emerald-800">{selectedPersonStats?.summary.normal}</span><span className="text-[8px] font-bold text-emerald-600">مجاز</span></div>
                                <div className="bg-red-50 p-2 rounded-xl border border-red-100 flex flex-col items-center"><AlertCircle size={14} className="text-red-500 mb-1" /><span className="text-[14px] font-black text-red-800">{selectedPersonStats?.summary.high}</span><span className="text-[8px] font-bold text-red-600">غیرمجاز</span></div>
                            </div>
                        </div>
                    </div>

                    {selectedPersonStats && selectedPersonStats.highTrafficDetails.length > 0 && (
                      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                        <div className="p-4 border-b border-slate-100 bg-orange-50/20 text-center flex items-center justify-center gap-2"><AlertCircle size={18} className="text-orange-500" /><h3 className="font-bold text-slate-800 text-xs uppercase">تحلیل زمانی</h3></div>
                        <div className="divide-y divide-slate-50 overflow-y-auto custom-scrollbar flex-1 max-h-[400px]">
                          {selectedPersonStats.highTrafficDetails.map(([date, entries]) => (
                            <div key={date} className="p-4 hover:bg-slate-50/30 transition-colors flex flex-col items-center">
                              <span className="font-bold text-slate-800 bg-white border border-slate-200 px-3 py-1 rounded-lg text-[10px] shadow-sm mb-3">{formatFriendlyJalaliDate(date)}</span>
                              <div className="grid grid-cols-2 gap-2 w-full">
                                {[...entries].sort((a,b) => String(a.time).localeCompare(String(b.time))).map((entry, idx) => (
                                  <div key={idx} className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${idx % 2 === 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-sky-50 border-sky-100 text-sky-700'}`}>
                                    <div className="flex items-center gap-1">
                                      {idx % 2 === 0 ? <LogIn size={10} /> : <LogOut size={10} />}
                                      <span className="text-[10px] font-black">{entry.time}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 px-4 py-2 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-[9px] font-bold">
           <div className="text-slate-600">عمران آذرستان - ICT Dept</div>
           <p className="text-slate-400 uppercase tracking-widest">PWA Version 2.8</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
