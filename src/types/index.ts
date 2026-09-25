export interface User {
  id: number;
  user_id: string;
  name: string;
  email: string;
  created_at: string;
  sample_count: number;
  photo_preview?: string;
}

export interface AttendanceRecord {
  id: number;
  user_id: string;
  name: string;
  date: string;
  time: string;
  status: string;
  confidence: number;
}

export interface DashboardStats {
  totalUsers: number;
  presentToday: number;
  attendancePercentage: number;
  recentRecords: AttendanceRecord[];
  date: string;
}

export interface RecognitionResult {
  matched: boolean;
  user_id?: string;
  name?: string;
  distance?: number;
  confidence?: number;
  label?: string;
  attendanceResult?: {
    success: boolean;
    alreadyMarked: boolean;
    message: string;
    record?: AttendanceRecord;
  };
}

export type ActiveTab = 'recognition' | 'dashboard' | 'attendance' | 'register' | 'users' | 'python_project';
