import { Mode, ModeTag, TaskPriority, TaskType } from "./types";

export const taskTypeLabel: Record<TaskType, string> = {
  MUST: "MUST（締切）",
  SHOULD: "SHOULD（成長）",
};

export const priorityLabel: Record<TaskPriority, string> = {
  HIGH: "高",
  MED: "中",
  LOW: "低",
};

export const statusLabel: Record<"PLANNED" | "STARTED" | "DONE" | "SKIPPED", string> = {
  PLANNED: "予定",
  STARTED: "進行中",
  DONE: "完了",
  SKIPPED: "スキップ",
};

export const modeLabel: Record<Mode, string> = {
  NORMAL: "通常",
  ENERGY_SAVING: "省エネ",
};

export const modeTagLabel: Record<ModeTag, string> = {
  NORMAL: "通常",
  ENERGY_SAVING: "省エネ",
  DUTY_PRIORITY: "義務優先",
};
