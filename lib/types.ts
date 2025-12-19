// ドメインモデルの型定義。時間は分単位（5分刻み前提）で扱う。
export type TaskType = "MUST" | "SHOULD";
export type TaskPriority = "HIGH" | "MED" | "LOW";
export type PlaceOption = "school" | "library" | "home" | "transit";
export type ConditionOption = "pc" | "smartphone" | "quiet" | "internet";
export type Mode = "NORMAL" | "ENERGY_SAVING";

export interface Task {
  id: string;
  title: string;
  type: TaskType;
  priority: TaskPriority;
  estimatedMinutes: number;
  deadline?: string; // ISO文字列（MUSTのみ必須）
  allowedPlaces: PlaceOption[]; // できる場所の候補
  requiredConditions: ConditionOption[]; // 必要条件
  shouldPolicy?: {
    minPerWeekSessions: number;
  };
  status?: {
    archived?: boolean;
    lastDoneAt?: string;
  };
}

export type TimeBlockType = "FIXED" | "FREE" | "TRANSIT";

export interface TimeBlock {
  id: string;
  date: string; // YYYY-MM-DD
  startMinutes: number; // 0-1435, 5分刻み想定
  endMinutes: number; // startMinutes < endMinutes
  type: TimeBlockType;
  place: PlaceOption;
  availableConditions: ConditionOption[]; // このブロックで満たせる条件
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  title?: string; // 固定予定名など
}

export type ScheduleItemKind = "FIXED" | "TASK" | "MOVE" | "GAP" | "SHORTAGE";
export type ModeTag = "NORMAL" | "ENERGY_SAVING" | "DUTY_PRIORITY";

export interface ScheduleItem {
  id: string;
  date: string; // YYYY-MM-DD
  startMinutes: number;
  endMinutes: number;
  kind: ScheduleItemKind;
  taskId?: string;
  blockId?: string;
  modeTag?: ModeTag;
  reason?: string;
  overdueRisk?: boolean;
  shortageMinutes?: number; // SHORTAGEの場合の不足時間など
  status?: "PLANNED" | "STARTED" | "DONE" | "SKIPPED";
}

export type WeeklyProgress = Record<
  string,
  Record<
    string,
    {
      sessionsDone: number;
    }
  >
>;

export interface AppState {
  mode: Mode;
  selectedDate: string;
  lastGeneratedAt?: string;
  weeklyProgress: WeeklyProgress;
  energySavingCount?: number;
  shortageDays?: string[];
}

export interface SessionLog {
  id: string;
  date: string; // YYYY-MM-DD
  taskId: string;
  startedAt: string; // ISO
  durationMinutes: number;
  completed?: boolean;
}
