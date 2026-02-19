
import React from 'react';
import { JALALI_MONTHS, getDaysInMonth } from '../utils/jalali';

interface CalendarProps {
  year: number;
  month: number;
  activeDays: Record<string, number>; // dateStr -> count
  limit: number; // The traffic limit before considered critical
}

const Calendar: React.FC<CalendarProps> = ({ year, month, activeDays, limit }) => {
  const daysCount = getDaysInMonth(month, year);
  const days = Array.from({ length: daysCount }, (_, i) => i + 1);

  return (
    <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 max-w-[320px] mx-auto">
      <div className="flex flex-col items-center mb-3 gap-1">
        <h3 className="text-sm font-bold text-slate-700">
          حضور در {JALALI_MONTHS[month - 1]} {year}
        </h3>
        <div className="flex gap-2 text-[8px] font-bold uppercase">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-slate-100 border border-slate-200 rounded-sm"></div>
            <span className="text-slate-500">بدون تردد</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-emerald-400 border border-emerald-500 rounded-sm"></div>
            <span className="text-emerald-700">مجاز (تا {limit})</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-red-600 rounded-sm"></div>
            <span className="text-red-600 font-bold">بحرانی (بیش از {limit})</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map(d => (
          <div key={d} className="text-center text-slate-300 font-bold py-0.5 text-[9px]">{d}</div>
        ))}
        {days.map(day => {
          const dateKey = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
          const count = activeDays[dateKey] || 0;
          
          let bgColor = 'bg-slate-100'; 
          let textColor = 'text-black'; 
          let borderColor = 'border-slate-200/50';
          let extraLabel = null;
          let opacity = 'opacity-40';

          if (count > 0) {
            opacity = 'opacity-100';
            if (count > limit) {
              bgColor = 'bg-red-600'; 
              textColor = 'text-yellow-300'; 
              borderColor = 'border-red-700 shadow-md scale-105 z-10';
              extraLabel = <span className="text-[5px] font-black uppercase leading-none mt-0.5">بحرانی</span>;
            } else {
              bgColor = 'bg-emerald-400'; 
              textColor = 'text-black'; 
              borderColor = 'border-emerald-500 shadow-xs';
            }
          }

          return (
            <div
              key={day}
              className={`aspect-square flex flex-col items-center justify-center rounded-md border transition-all text-[10px] ${bgColor} ${textColor} ${borderColor} ${opacity}`}
            >
              <span className="font-bold">{day}</span>
              {count > 0 && <span className="text-[6px] font-black">{count} بار</span>}
              {extraLabel}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Calendar;
