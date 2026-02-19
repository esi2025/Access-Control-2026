
export interface RawRecord {
  Row: number;
  CodePersonel: string | number;
  Description: string;
  Timestamp2: string;
  Datestamp: string;
}

export interface AttendanceEntry {
  time: string;
  date: string;
  description: string;
}

export interface PersonAttendance {
  id: string;
  name: string;
  entries: AttendanceEntry[];
  dailyLogs: Record<string, AttendanceEntry[]>;
  /** Optional property added during traffic analysis */
  highTrafficDays?: number;
}

export interface AnalysisResults {
  totalDays: number;
  highTrafficDaysCount: number;
  highTrafficDaysDetails: Record<string, AttendanceEntry[]>;
}