
export const JALALI_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
];

export const getDaysInMonth = (month: number, year: number) => {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  // Simplified leap year check for common Jalali years
  const isLeap = [1403, 1407, 1411, 1415].includes(year);
  return isLeap ? 30 : 29; 
};

export const parseJalaliDate = (dateStr: string) => {
  // Format: DD/MM/YYYY
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  return {
    day: parseInt(parts[0]),
    month: parseInt(parts[1]),
    year: parseInt(parts[2])
  };
};

/**
 * تبدیل تاریخ عددی اکسل (Serial Date) به رشته شمسی DD/MM/YYYY
 */
export const excelSerialToJalali = (serial: any): string => {
  if (typeof serial !== 'number') return String(serial || '');
  
  // اکسل مبنا را ۳۰ دسامبر ۱۸۹۹ در نظر می‌گیرد
  const baseDate = new Date(1899, 11, 30);
  const targetDate = new Date(baseDate.getTime() + (serial * 24 * 60 * 60 * 1000));
  
  // استفاده از فرمت تقویم فارسی مرورگر
  const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(targetDate);
  const year = parts.find(p => p.type === 'year')?.value || '1404';
  const month = parts.find(p => p.type === 'month')?.value || '01';
  const day = parts.find(p => p.type === 'day')?.value || '01';
  
  // تبدیل اعداد فارسی به انگلیسی برای سازگاری با بقیه منطق برنامه
  const farsiToEn = (s: string) => s.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
  
  return `${farsiToEn(day)}/${farsiToEn(month)}/${farsiToEn(year)}`;
};
