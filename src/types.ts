export type Student = {
  id: string;
  full_name: string;
  email: string | null;
  notes: string | null;
  amount_due: number;
  alert_threshold: number;
  created_at: string;
};

export type TimeSlot = {
  id: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  subject: string;
  created_at: string;
};

export type ScheduleAssignment = {
  id: string;
  time_slot_id: string;
  student_id: string;
  students?: { full_name: string } | { full_name: string }[] | null;
};

export type StudentAiChat = {
  id: string;
  student_id: string;
  created_at: string;
};

export type StudentAiMessage = {
  id: string;
  chat_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export type ProgressRecord = {
  id: string;
  student_id: string;
  subject: string;
  notes: string | null;
  record_date: string;
  created_at: string;
};
