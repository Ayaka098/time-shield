import { AppState, SessionLog, Task, TimeBlock } from "./types";

const storageKeys = {
  tasks: "timeshield.tasks",
  timeBlocks: "timeshield.timeBlocks",
  appState: "timeshield.appState",
  sessionLogs: "timeshield.sessionLogs",
  blockTemplates: "timeshield.blockTemplates",
} as const;

const isBrowser = typeof window !== "undefined";

const safeParse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const loadItem = <T>(key: string, fallback: T): T => {
  if (!isBrowser) return fallback;
  const raw = window.localStorage.getItem(key);
  return safeParse<T>(raw, fallback);
};

const saveItem = <T>(key: string, value: T) => {
  if (!isBrowser) return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

export const createDefaultAppState = (today: Date = new Date()): AppState => ({
  mode: "NORMAL",
  selectedDate: today.toISOString().slice(0, 10),
  weeklyProgress: {},
  energySavingCount: 0,
  shortageDays: [],
});

export const storage = {
  keys: storageKeys,
  loadTasks: (fallback: Task[] = []) => loadItem<Task[]>(storageKeys.tasks, fallback),
  saveTasks: (tasks: Task[]) => saveItem<Task[]>(storageKeys.tasks, tasks),
  loadTimeBlocks: (fallback: TimeBlock[] = []) =>
    loadItem<TimeBlock[]>(storageKeys.timeBlocks, fallback),
  saveTimeBlocks: (blocks: TimeBlock[]) => saveItem<TimeBlock[]>(storageKeys.timeBlocks, blocks),
  loadAppState: (fallback?: AppState) =>
    loadItem<AppState>(storageKeys.appState, fallback ?? createDefaultAppState()),
  saveAppState: (appState: AppState) => saveItem<AppState>(storageKeys.appState, appState),
  loadSessionLogs: (fallback: SessionLog[] = []) =>
    loadItem<SessionLog[]>(storageKeys.sessionLogs, fallback),
  saveSessionLogs: (logs: SessionLog[]) => saveItem<SessionLog[]>(storageKeys.sessionLogs, logs),
  loadBlockTemplates: (
    fallback: { id: string; name: string; blocks: TimeBlock[] }[] = [],
  ) => loadItem(storageKeys.blockTemplates, fallback),
  saveBlockTemplates: (templates: { id: string; name: string; blocks: TimeBlock[] }[]) =>
    saveItem(storageKeys.blockTemplates, templates),
};
