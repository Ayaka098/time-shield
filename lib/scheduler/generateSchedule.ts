import {
  AppState,
  ConditionOption,
  ScheduleItem,
  SessionLog,
  Task,
  TaskPriority,
  TimeBlock,
} from "../types";

type GenerateParams = {
  tasks: Task[];
  blocks: TimeBlock[];
  date: string; // YYYY-MM-DD
  mode: AppState["mode"];
  weeklyProgress: AppState["weeklyProgress"];
  sessionLogs?: SessionLog[];
  debug?: boolean;
};

type Slot = {
  start: number;
  end: number;
  blockId: string | null;
  blockType: TimeBlock["type"] | null;
  place?: TimeBlock["place"];
  availableConditions?: ConditionOption[];
};

const SLOT_MINUTES = 5;

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const toTime = (minutes: number) => {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
};

const splitBlocksIntoSlots = (blocks: TimeBlock[], date: string): Slot[] => {
  const slots: Slot[] = [];

  blocks
    .filter((b) => b.date === date)
    .sort((a, b) => a.startMinutes - b.startMinutes)
    .forEach((block) => {
      const bufferBefore = block.bufferBeforeMinutes ?? 0;
      const bufferAfter = block.bufferAfterMinutes ?? 0;
      const usableStart =
        block.type === "FIXED" ? Math.max(0, block.startMinutes - bufferBefore) : block.startMinutes + bufferBefore;
      const usableEnd =
        block.type === "FIXED" ? Math.min(24 * 60, block.endMinutes + bufferAfter) : block.endMinutes - bufferAfter;

      if (block.type === "FIXED") {
        slots.push({
          start: usableStart,
          end: usableEnd,
          blockId: block.id,
          blockType: "FIXED",
          place: block.place,
          availableConditions: block.availableConditions,
        });
        return;
      }

      let cursor = usableStart;
      while (cursor < usableEnd) {
        const next = Math.min(cursor + SLOT_MINUTES, usableEnd);
        slots.push({
          start: cursor,
          end: next,
          blockId: block.id,
          blockType: block.type,
          place: block.place,
          availableConditions: block.availableConditions,
        });
        cursor = next;
      }
    });

  return slots;
};

const priorityScore: Record<TaskPriority, number> = {
  HIGH: 3,
  MED: 2,
  LOW: 1,
};

const sortMustTasks = (tasks: Task[], startedIds: Set<string>) =>
  tasks
    .filter((t) => t.type === "MUST")
    .sort((a, b) => {
      const aStarted = startedIds.has(a.id) ? 1 : 0;
      const bStarted = startedIds.has(b.id) ? 1 : 0;
      if (aStarted !== bStarted) return aStarted - bStarted; // startedは後ろ
      const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      return priorityScore[b.priority] - priorityScore[a.priority];
    });

const sortShouldTasks = (
  tasks: Task[],
  weeklyProgress: AppState["weeklyProgress"],
  startedIds: Set<string>
) =>
  tasks
    .filter((t) => t.type === "SHOULD")
    .sort((a, b) => {
      const aStarted = startedIds.has(a.id) ? 1 : 0;
      const bStarted = startedIds.has(b.id) ? 1 : 0;
      if (aStarted !== bStarted) return aStarted - bStarted; // startedは後ろ
      const getRemaining = (task: Task) => {
        const key = task.shouldPolicy?.minPerWeekSessions ?? 0;
        if (!key) return 0;
        // weeklyProgress は weekKey -> taskId -> { sessionsDone }
        const weekEntries = Object.values(weeklyProgress);
        if (!weekEntries.length) return key;
        // 適当なキーから取得（ここでは最新週を優先）
        const latestWeek = weekEntries[weekEntries.length - 1];
        const progress = latestWeek?.[task.id]?.sessionsDone ?? 0;
        return Math.max(0, key - progress);
      };
      const ra = getRemaining(a);
      const rb = getRemaining(b);
      if (ra !== rb) return rb - ra; // 未達が多いほう優先
      return priorityScore[b.priority] - priorityScore[a.priority];
    });

const canPlaceOnSlot = (slot: Slot, task: Task) => {
  if (!slot.place) return { ok: false, reason: "場所が不一致" as const };
  const allowedPlaces = task.allowedPlaces?.length ? task.allowedPlaces : ["school", "library", "home", "transit"];
  if (!allowedPlaces.includes(slot.place)) return { ok: false, reason: "場所が不一致" as const };
  const available = new Set(slot.availableConditions ?? []);
  const required = task.requiredConditions ?? [];
  const ok = required.every((c) => available.has(c));
  if (!ok) return { ok: false, reason: "条件が不足" as const };
  return { ok: true as const };
};

const energyScore = (task: Task) => {
  // 手軽さを簡易スコア化。スマホ・静か不要・通信不要ならスコア高。
  let score = 0;
  const cond = new Set(task.requiredConditions ?? []);
  if (!cond.has("pc")) score += 2;
  if (cond.has("smartphone")) score += 1;
  if (!cond.has("quiet")) score += 1;
  if (!cond.has("internet")) score += 1;
  if (task.allowedPlaces.includes("transit")) score += 1;
  return score;
};

export const generateSchedule = ({
  tasks,
  blocks,
  date,
  mode,
  weeklyProgress,
  sessionLogs = [],
  debug = false,
}: GenerateParams): { items: ScheduleItem[]; overdueRisk: boolean; debugInfo?: DebugEntry[] } => {
  const slots = splitBlocksIntoSlots(blocks, date);
  const debugLogs: DebugEntry[] = [];

  const fixedItems: ScheduleItem[] = slots
    .filter((s) => s.blockType === "FIXED")
    .map((slot) => ({
      id: `fixed-${slot.blockId}-${slot.start}`,
      date,
      start: toTime(slot.start),
      end: toTime(slot.end),
      kind: "FIXED" as const,
      blockId: slot.blockId ?? undefined,
    }));

  const availableSlots = slots.filter((s) => s.blockType !== "FIXED");

  const dateLogs = sessionLogs.filter((l) => l.date === date);
  const startedIds = new Set(dateLogs.map((l) => l.taskId));

  const mustTasks = sortMustTasks(tasks, startedIds);
  const shouldTasks = sortShouldTasks(tasks, weeklyProgress, startedIds);
  if (mode === "ENERGY_SAVING") {
    mustTasks.sort((a, b) => energyScore(b) - energyScore(a));
    shouldTasks.sort((a, b) => energyScore(b) - energyScore(a));
  }

  const items: ScheduleItem[] = [];
  let remainingSlots = [...availableSlots];

  const placeTask = (task: Task) => {
    const needed = Math.ceil(task.estimatedMinutes / SLOT_MINUTES);
    const pickedSlots: Slot[] = [];
    let matchedSlots = 0;
    let lastRejectReason: string | undefined;

    for (const slot of remainingSlots) {
      const res = canPlaceOnSlot(slot, task);
      if (!res.ok) {
        lastRejectReason = res.reason;
        continue;
      }
      matchedSlots += 1;
      pickedSlots.push(slot);
      if (pickedSlots.length >= needed) break;
    }

    if (pickedSlots.length < needed) {
      if (debug) {
        debugLogs.push({
          taskId: task.id,
          title: task.title,
          placed: false,
          reason:
            matchedSlots === 0
              ? lastRejectReason ?? "条件を満たすスロットなし"
              : "一致スロットはあるが時間が不足",
          matchedSlots,
          neededSlots: needed,
          usedSlots: [],
        });
      }
      return { placed: false, used: [] as Slot[] };
    }

    // consume slots
    const usedIds = new Set(pickedSlots.map((s) => `${s.blockId}-${s.start}-${s.end}`));
    remainingSlots = remainingSlots.filter(
      (s) => !usedIds.has(`${s.blockId}-${s.start}-${s.end}`)
    );

    const item: ScheduleItem = {
      id: `task-${task.id}-${pickedSlots[0].start}`,
      date,
      start: toTime(pickedSlots[0].start),
      end: toTime(pickedSlots[pickedSlots.length - 1].end),
      kind: "TASK",
      taskId: task.id,
      blockId: pickedSlots[0].blockId ?? undefined,
      modeTag: mode,
    };
    items.push(item);

    if (debug) {
      debugLogs.push({
        taskId: task.id,
        title: task.title,
        placed: true,
        reason: `一致スロット: ${pickedSlots.length} / 必要 ${needed}`,
        matchedSlots,
        neededSlots: needed,
        usedSlots: pickedSlots.map((s) => ({
          start: toTime(s.start),
          end: toTime(s.end),
          place: s.place,
          blockId: s.blockId ?? undefined,
          conditions: s.availableConditions ?? [],
        })),
      });
    }

    return { placed: true, used: pickedSlots };
  };

  let overdueRisk = false;

  const availableMinutes = remainingSlots.reduce((acc, s) => acc + (s.end - s.start), 0);
  const mustMinutes = mustTasks.reduce((acc, t) => acc + t.estimatedMinutes, 0);
  const isBusy = availableMinutes > 0 && mustMinutes / availableMinutes >= 0.8;

  // 1) MUST
  const mustNotPlaced: Task[] = [];
  mustTasks.forEach((task) => {
    const res = placeTask(task);
    if (!res.placed) {
      mustNotPlaced.push(task);
    }
  });

  // 2) SHOULD (最低量だけ：ここでは1セッション=30分固定) 繁忙時は縮小/スキップ
  const baseShouldSessionMinutes = 30;
  const busyMultiplier = isBusy ? 0 : 1; // 繁忙ならスキップ（罪悪感ゼロ）
  shouldTasks.forEach((task) => {
    if ((task.shouldPolicy?.minPerWeekSessions ?? 0) <= 0) return;
    const minutes = Math.floor(baseShouldSessionMinutes * busyMultiplier);
    if (minutes <= 0) return;
    const minimalTask: Task = { ...task, estimatedMinutes: minutes };
    const res = placeTask(minimalTask);
    if (res.placed && isBusy) {
      const last = items[items.length - 1];
      if (last) last.modeTag = "DUTY_PRIORITY";
    }
  });

  if (mustNotPlaced.length) {
    const shortageMinutes = mustNotPlaced.reduce(
      (acc, t) => acc + Math.max(0, t.estimatedMinutes),
      0
    );
    overdueRisk = true;
    items.push({
      id: `shortage-${date}`,
      date,
      start: toTime(24 * 60 - 5),
      end: toTime(24 * 60),
      kind: "SHORTAGE",
      shortageMinutes,
      reason: `MUSTがあと${shortageMinutes}分不足`,
      modeTag: mode,
      overdueRisk: true,
    });
  }

  // sort output (fixed + tasks + shortage) by start time
  const merged = [...fixedItems, ...items].sort((a, b) => {
    const aStart = toMinutes(a.start);
    const bStart = toMinutes(b.start);
    return aStart - bStart;
  });

  return { items: merged, overdueRisk, debugInfo: debug ? debugLogs : undefined };
};

type DebugEntry = {
  taskId: string;
  title: string;
  placed: boolean;
  reason?: string;
  matchedSlots?: number;
  neededSlots?: number;
  usedSlots: {
    start: string;
    end: string;
    place?: string;
    blockId?: string;
    conditions?: string[];
  }[];
};
