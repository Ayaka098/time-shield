"use client";

import { useMemo, useState } from "react";
import { generateSchedule } from "@/lib/scheduler/generateSchedule";
import { ScheduleItem, SessionLog, Task, TimeBlock } from "@/lib/types";
import { storage } from "@/lib/storage";
import { useLocalStorageState } from "@/lib/hooks/useLocalStorageState";
import { minutesFromTime, todayKey } from "@/lib/date";

const labelForKind = (item: ScheduleItem) => {
  switch (item.kind) {
    case "FIXED":
      return "固定";
    case "TASK":
      return "タスク";
    case "MOVE":
      return "移動";
    case "GAP":
      return "空き";
    case "SHORTAGE":
      return "不足";
    default:
      return item.kind;
  }
};

const badgeClass = (item: ScheduleItem) => {
  switch (item.kind) {
    case "FIXED":
      return "bg-orange-100 text-orange-700";
    case "TASK":
      return "bg-emerald-100 text-emerald-700";
    case "MOVE":
      return "bg-blue-100 text-blue-700";
    case "GAP":
      return "bg-zinc-100 text-zinc-600";
    case "SHORTAGE":
      return "bg-red-100 text-red-700";
    default:
      return "bg-zinc-100 text-zinc-600";
  }
};

const pad = (n: number) => n.toString().padStart(2, "0");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function TimelinePage() {
  const [tasks] = useLocalStorageState<Task[]>(storage.keys.tasks, []);
  const [blocks] = useLocalStorageState<TimeBlock[]>(storage.keys.timeBlocks, []);
  const [appState] = useLocalStorageState(storage.keys.appState, {
    mode: "NORMAL",
    selectedDate: today(),
    weeklyProgress: {},
  });
  const [logs] = useLocalStorageState<SessionLog[]>(storage.keys.sessionLogs, []);
  const [selectedDate, setSelectedDate] = useState<string>(today());

  const scheduleResult = useMemo(
    () =>
      generateSchedule({
        tasks,
        blocks,
        date: selectedDate,
        mode: appState.mode,
        weeklyProgress: appState.weeklyProgress,
        sessionLogs: logs,
      }),
    [tasks, blocks, selectedDate, appState.mode, appState.weeklyProgress, logs]
  );

  const tasksMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const blocksMap = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);

  const annotatedItems = useMemo(() => {
    const dateLogs = logs.filter((l) => l.date === selectedDate);
    return scheduleResult.items.map((item) => {
      if (item.kind !== "TASK" || !item.taskId) return item;
      const log = dateLogs.find((l) => l.taskId === item.taskId);
      if (!log) return { ...item, status: "PLANNED" as const };
      return { ...item, status: log.completed ? ("DONE" as const) : ("STARTED" as const) };
    });
  }, [logs, scheduleResult.items, selectedDate]);

  const now = new Date();
  const isToday = selectedDate === todayKey();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 to-white px-4 py-8 text-zinc-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-indigo-600">タイムライン</p>
            <h1 className="text-2xl font-semibold text-zinc-900">自動配置結果</h1>
            {scheduleResult.overdueRisk && (
              <p className="text-xs font-semibold text-red-600">
                MUSTが不足しています。今日の時間を調整してください。
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-700" htmlFor="date">
              日付
            </label>
            <input
              id="date"
              type="date"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </header>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">{selectedDate} のタイムライン</h2>
          {annotatedItems.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">まだスケジュールがありません。</p>
          ) : (
            <div className="mt-4 space-y-3">
              {annotatedItems.map((item) => {
                const nowBadge =
                  isToday && minutesFromTime(item.start) <= nowMinutes && minutesFromTime(item.end) > nowMinutes;
                return (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded-2xl border border-zinc-100 bg-indigo-50 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className={`rounded-full px-2 py-1 ${badgeClass(item)}`}>{labelForKind(item)}</span>
                    <span className="rounded-full bg-white px-2 py-1 text-zinc-700">
                      {item.start} - {item.end}
                    </span>
                    {item.modeTag && (
                      <span className="rounded-full bg-white px-2 py-1 text-blue-700">モード: {item.modeTag}</span>
                    )}
                    {item.status && (
                      <span className="rounded-full bg-white px-2 py-1 text-purple-700">{item.status}</span>
                    )}
                    {nowBadge && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">現在</span>}
                    {item.kind === "TASK" && item.taskId && (
                      <>
                        <span className="rounded-full bg-white px-2 py-1 text-emerald-700">
                          {tasksMap.get(item.taskId)?.type ?? ""}
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-emerald-700">
                          優先度 {tasksMap.get(item.taskId)?.priority ?? ""}
                        </span>
                      </>
                    )}
                    {item.kind === "FIXED" && item.blockId && (
                      <span className="rounded-full bg-white px-2 py-1 text-orange-700">予定</span>
                    )}
                    {item.kind === "SHORTAGE" && item.shortageMinutes !== undefined && (
                      <span className="rounded-full bg-white px-2 py-1 text-red-700">
                        不足 {item.shortageMinutes}分
                      </span>
                    )}
                  </div>
                  {item.kind === "TASK" && item.taskId && (
                    <p className="text-base font-semibold text-zinc-900">
                      {tasksMap.get(item.taskId)?.title ?? "タスク"}
                    </p>
                  )}
                  {item.kind === "FIXED" && item.blockId && (
                    <p className="text-base font-semibold text-zinc-900">
                      {blocksMap.get(item.blockId)?.meta?.title ?? "固定予定"}
                    </p>
                  )}
                  {item.reason && <p className="text-sm text-zinc-700">{item.reason}</p>}
                </div>
              );
            })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
