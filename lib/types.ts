// ドメインモデルの型定義。時間は分単位（5分刻み前提）で扱う。
export type TaskType = "MUST" | "SHOULD";
export type TaskPriority = "HIGH" | "MED" | "LOW";
export type StarterType = "SETUP" | "OPEN_APP" | "MICRO_ACTION";
export type DeviceType = "smartphone" | "pc" | "either";
export type PlaceType = "home" | "school" | "anywhere";
export type FocusLevel = 0 | 1 | 2;
export type Mode = "NORMAL" | "ENERGY_SAVING";

export interface Task {
  id: string;
  title: string;
  type: TaskType;
  priority: TaskPriority;
  estimatedMinutes: number;
  deadline?: string; // ISO文字列（MUSTのみ必須）
  starterStep: string; // 最初の一手（短文）
  starterType: StarterType;
  requiresInternet: boolean;
  requiresSeated: boolean;
  oneHandOk: boolean;
  device: DeviceType;
  place: PlaceType;
  deepFocusPreferred: boolean;
  shouldPolicy?: {
    minPerWeekSessions: number;
  };
  status?: {
    archived?: boolean;
    lastDoneAt?: string;
  };
}

export type TimeBlockType = "FIXED" | "STABLE" | "UNSTABLE" | "FLEX_MOVE";

export interface TimeBlock {
  id: string;
  date: string; // YYYY-MM-DD
  startMinutes: number; // 0-1435, 5分刻み想定
  endMinutes: number; // startMinutes < endMinutes
  type: TimeBlockType;
  place: PlaceType;
  internetAvailable: boolean;
  seatedLikely: boolean;
  focusLevel: FocusLevel;
  meta?: {
    title?: string;
  };
  forFlexMove?: {
    earliestDepartureMinutes?: number;
    latestDepartureMinutes?: number;
  };
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
