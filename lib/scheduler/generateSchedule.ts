import { AppState, ScheduleItem, SessionLog, Task, TaskPriority, TimeBlock } from "../types";

type GenerateParams = {
  tasks: Task[];
  blocks: TimeBlock[];
  date: string; // YYYY-MM-DD
  mode: AppState["mode"];
  weeklyProgress: AppState["weeklyProgress"];
  sessionLogs?: SessionLog[];
};

type Slot = {
  start: number;
  end: number;
  blockId: string | null;
  blockType: TimeBlock["type"] | null;
  place?: TimeBlock["place"];
  internetAvailable?: boolean;
  seatedLikely?: boolean;
  focusLevel?: TimeBlock["focusLevel"];
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

const splitBlocksIntoSlots = (
  blocks: TimeBlock[],
  date: string,
  consumed: { start: number; end: number }[] = []
): Slot[] => {
  const slots: Slot[] = [];

  blocks
    .filter((b) => b.date === date)
    .sort((a, b) => a.startMinutes - b.startMinutes)
    .forEach((block) => {
      if (block.type === "FIXED") {
        slots.push({
          start: block.startMinutes,
          end: block.endMinutes,
          blockId: block.id,
          blockType: "FIXED",
        });
        return;
      }

      let cursor = block.startMinutes;
      while (cursor < block.endMinutes) {
        const next = Math.min(cursor + SLOT_MINUTES, block.endMinutes);
        const overlapsConsumed = consumed.some((c) => !(next <= c.start || cursor >= c.end));
        if (!overlapsConsumed) {
          slots.push({
            start: cursor,
            end: next,
            blockId: block.id,
            blockType: block.type,
            place: block.place,
            internetAvailable: block.internetAvailable,
            seatedLikely: block.seatedLikely,
            focusLevel: block.focusLevel,
          });
        }
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

const canPlaceOnUnstable = (slot: Slot, task: Task) => {
  if (slot.blockType !== "UNSTABLE") return true;
  if (!slot.internetAvailable && task.requiresInternet) return false;
  if (!slot.seatedLikely && task.requiresSeated) return false;
  if (task.device === "pc") return false;
  if (!slot.seatedLikely && !task.oneHandOk) return false;
  return true;
};

const energyScore = (task: Task) => {
  let score = 0;
  if (task.oneHandOk) score += 2;
  if (!task.requiresSeated) score += 1;
  if (!task.requiresInternet) score += 1;
  if (task.device !== "pc") score += 1;
  if (!task.deepFocusPreferred) score += 1;
  return score;
};

const sumDeepFocusMinutes = (tasks: Task[]) =>
  tasks.filter((t) => t.deepFocusPreferred).reduce((acc, t) => acc + t.estimatedMinutes, 0);

export const generateSchedule = ({
  tasks,
  blocks,
  date,
  mode,
  weeklyProgress,
  sessionLogs = [],
}: GenerateParams): { items: ScheduleItem[]; overdueRisk: boolean } => {
  const moveItems: ScheduleItem[] = [];
  const consumedByMove: { start: number; end: number }[] = [];
  const flexBlocks = blocks.filter((b) => b.date === date && b.type === "FLEX_MOVE");
  const deepFocusTotal = sumDeepFocusMinutes(tasks);
  const moveDuration = 30; // 分

  flexBlocks.forEach((flex) => {
    const early = deepFocusTotal >= 90;
    const startBase = early
      ? flex.forFlexMove?.earliestDepartureMinutes ?? flex.startMinutes
      : flex.forFlexMove?.latestDepartureMinutes ?? Math.max(flex.startMinutes, flex.endMinutes - moveDuration);
    const start = Math.min(Math.max(startBase, flex.startMinutes), flex.endMinutes);
    const end = Math.min(start + moveDuration, flex.endMinutes);
    consumedByMove.push({ start, end });
    moveItems.push({
      id: `move-${flex.id}`,
      date,
      start: toTime(start),
      end: toTime(end),
      kind: "MOVE",
      blockId: flex.id,
      modeTag: early ? mode : undefined,
      reason: early ? "集中タスクが多いので早めに学校へ" : "移動時間を確保しました",
    });
  });

  const slots = splitBlocksIntoSlots(blocks, date, consumedByMove);

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

    for (const slot of remainingSlots) {
      if (!canPlaceOnUnstable(slot, task)) continue;
      pickedSlots.push(slot);
      if (pickedSlots.length >= needed) break;
    }

    if (pickedSlots.length < needed) {
      return { placed: false, used: [] as Slot[] };
    }

    // consume slots
    const usedIds = new Set(pickedSlots.map((s) => `${s.blockId}-${s.start}-${s.end}`));
    remainingSlots = remainingSlots.filter(
      (s) => !usedIds.has(`${s.blockId}-${s.start}-${s.end}`)
    );

    items.push({
      id: `task-${task.id}-${pickedSlots[0].start}`,
      date,
      start: toTime(pickedSlots[0].start),
      end: toTime(pickedSlots[pickedSlots.length - 1].end),
      kind: "TASK",
      taskId: task.id,
      blockId: pickedSlots[0].blockId ?? undefined,
      modeTag: mode,
    });

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
  const merged = [...fixedItems, ...moveItems, ...items].sort((a, b) => {
    const aStart = toMinutes(a.start);
    const bStart = toMinutes(b.start);
    return aStart - bStart;
  });

  return { items: merged, overdueRisk };
};
