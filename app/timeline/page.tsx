"use client";

import { useMemo, useState } from "react";
import { generateSchedule } from "@/lib/scheduler/generateSchedule";
import { ScheduleItem, SessionLog, Task, TimeBlock } from "@/lib/types";
import { storage } from "@/lib/storage";
import { useLocalStorageState } from "@/lib/hooks/useLocalStorageState";
import { minutesFromTime, todayKey } from "@/lib/date";
import { priorityLabel, taskTypeLabel, statusLabel, modeTagLabel } from "@/lib/labels";

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
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"list" | "calendar" | "week">("list");
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);

  const scheduleResult = useMemo(
    () =>
      generateSchedule({
        tasks,
        blocks,
        date: selectedDate,
        mode: appState.mode,
        weeklyProgress: appState.weeklyProgress,
        sessionLogs: logs,
        debug: debugMode,
      }),
    [tasks, blocks, selectedDate, appState.mode, appState.weeklyProgress, logs, debugMode]
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

  const dayStart = 6 * 60;
  const dayEnd = 24 * 60;
  const dayTotal = dayEnd - dayStart;
  const toY = (minutes: number) => Math.max(0, Math.min(dayTotal, minutes - dayStart));

  const addDays = (date: string, diff: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + diff);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(selectedDate, i)), [selectedDate]);
  const weekRangeLabel = `${weekDates[0].slice(5).replace("-", "/")} 〜 ${weekDates[6].slice(5).replace("-", "/")}`;

  const weekResults = useMemo(
    () =>
      weekDates.map((d) =>
        generateSchedule({
          tasks,
          blocks,
          date: d,
          mode: appState.mode,
          weeklyProgress: appState.weeklyProgress,
          sessionLogs: logs,
          debug: debugMode,
        })
      ),
    [weekDates, tasks, blocks, appState.mode, appState.weeklyProgress, logs, debugMode]
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 to-white px-4 py-8 text-zinc-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-indigo-600">タイムライン</p>
            <h1 className="text-2xl font-semibold text-zinc-900">自動配置結果</h1>
            <p className="text-xs text-zinc-600">今日の配置と7日分の混雑具合を確認できます。</p>
            {scheduleResult.overdueRisk && (
              <p className="text-xs font-semibold text-red-600">
                MUSTが不足しています。今日の時間を調整してください。
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            <div className="flex overflow-hidden rounded-full border border-indigo-200 text-xs font-semibold">
              {[
                { key: "list", label: "リスト表示" },
                { key: "calendar", label: "Day表示" },
                { key: "week", label: "Week表示" },
              ].map((v) => (
                <button
                  key={v.key}
                  onClick={() => setViewMode(v.key as "list" | "calendar" | "week")}
                  className={`px-3 py-2 transition ${viewMode === v.key ? "bg-indigo-600 text-white" : "bg-white text-indigo-700"}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-indigo-700">
              <input
                type="checkbox"
                checked={debugMode}
                onChange={(e) => setDebugMode(e.target.checked)}
              />
              Debug表示
            </label>
          </div>
        </header>

        {debugMode && scheduleResult.debugInfo && (
          <section className="rounded-2xl border border-indigo-100 bg-white/80 p-4 text-sm text-zinc-800 shadow-sm">
            <p className="text-xs font-semibold text-indigo-700">配置デバッグ</p>
            <div className="mt-2 space-y-2">
              {scheduleResult.debugInfo.map((d) => (
                <div key={d.taskId} className="rounded-xl border border-indigo-50 bg-indigo-50/60 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className={`rounded-full px-2 py-1 ${d.placed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {d.placed ? "配置" : "未配置"}
                    </span>
                    <span className="rounded-full bg-white px-2 py-1 text-indigo-700">{d.title}</span>
                    <span className="rounded-full bg-white px-2 py-1 text-zinc-700">
                      マッチ {d.matchedSlots ?? 0}/{d.neededSlots ?? "-"}
                    </span>
                  </div>
                  {d.reason && <p className="mt-1 text-xs text-zinc-700">理由: {d.reason}</p>}
                  {d.usedSlots && d.usedSlots.length > 0 && (
                    <p className="mt-1 text-xs text-zinc-600">
                      使用スロット:{" "}
                      {d.usedSlots
                        .map((s) => `${s.start}-${s.end} (${s.place ?? "?"}) [${(s.conditions ?? []).join(",")}]`)
                        .join(" / ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">{selectedDate} のタイムライン</h2>
          {annotatedItems.length === 0 ? (
            <div className="mt-3 space-y-2 text-sm text-zinc-700">
              <p>まだスケジュールがありません。</p>
              <p className="text-xs text-zinc-500">
                まずは平日/休日テンプレを設定し、タスクを1件追加すると自動で配置されます。
              </p>
            </div>
          ) : viewMode === "list" ? (
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
                        <span className="rounded-full bg-white px-2 py-1 text-blue-700">
                          モード: {modeTagLabel[item.modeTag]}
                        </span>
                      )}
                      {item.status && (
                        <span className="rounded-full bg-white px-2 py-1 text-purple-700">
                          {statusLabel[item.status]}
                        </span>
                      )}
                      {nowBadge && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">現在</span>}
                      {item.kind === "TASK" && item.taskId && (
                        <>
                          <span className="rounded-full bg-white px-2 py-1 text-emerald-700">
                            {taskTypeLabel[tasksMap.get(item.taskId)?.type ?? "MUST"]}
                          </span>
                          <span className="rounded-full bg-white px-2 py-1 text-emerald-700">
                            優先度 {priorityLabel[tasksMap.get(item.taskId)?.priority ?? "MED"]}
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
                        {blocksMap.get(item.blockId)?.title ?? "固定予定"}
                      </p>
                    )}
                    {item.reason && <p className="text-sm text-zinc-700">{item.reason}</p>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="relative h-[1080px] overflow-y-auto rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                <div className="relative h-full">
                  {/* 時刻目盛り */}
                  {[...Array(19)].map((_, idx) => {
                    const minute = dayStart + idx * 60;
                    const y = (minute - dayStart);
                    const label = `${Math.floor(minute / 60).toString().padStart(2, "0")}:00`;
                    return (
                      <div key={minute} className="absolute left-0 right-0" style={{ top: y }}>
                        <div className="flex items-center gap-2">
                          <span className="w-12 text-right text-[10px] font-semibold text-indigo-700">{label}</span>
                          <div className="h-px flex-1 bg-indigo-100" />
                        </div>
                      </div>
                    );
                  })}
                  {/* 現在時刻ライン＋周辺ハイライト */}
                  {isToday && nowMinutes >= dayStart && nowMinutes <= dayEnd && (
                    <>
                      <div
                        className="absolute left-0 right-0 z-0 rounded-lg bg-red-50/60"
                        style={{ top: toY(nowMinutes - 30), height: 60 }}
                      />
                      <div className="absolute left-0 right-0 z-10 flex items-center gap-2" style={{ top: toY(nowMinutes) }}>
                        <span className="w-12 text-right text-[10px] font-semibold text-red-600">今</span>
                        <div className="h-[2px] flex-1 bg-red-500" />
                      </div>
                    </>
                  )}
                  {/* アイテムカード */}
                  {annotatedItems.map((item) => {
                    const rawStart = minutesFromTime(item.start);
                    const rawEnd = minutesFromTime(item.end);
                    const clampedStart = Math.max(dayStart, rawStart);
                    const clampedEnd = Math.min(dayEnd, rawEnd);
                    const top = toY(clampedStart);
                    const height = Math.max(12, Math.max(0, clampedEnd - clampedStart)); // min height
                    const isNext =
                      isToday &&
                      nowMinutes <= rawEnd &&
                      (rawStart >= nowMinutes || (rawStart <= nowMinutes && rawEnd >= nowMinutes));
                    const color =
                      item.kind === "TASK"
                        ? "bg-emerald-500"
                        : item.kind === "FIXED"
                          ? "bg-orange-500"
                          : item.kind === "SHORTAGE"
                            ? "bg-red-500"
                            : "bg-indigo-400";
                    const shade =
                      item.kind === "TASK"
                        ? "bg-emerald-100 text-emerald-800"
                        : item.kind === "FIXED"
                          ? "bg-orange-100 text-orange-800"
                          : item.kind === "SHORTAGE"
                            ? "bg-red-100 text-red-800"
                            : "bg-indigo-100 text-indigo-800";
                    const title =
                      item.kind === "TASK"
                        ? tasksMap.get(item.taskId ?? "")?.title ?? "タスク"
                        : item.kind === "FIXED"
                          ? blocksMap.get(item.blockId ?? "")?.title ?? "予定"
                          : item.kind === "SHORTAGE"
                            ? "不足"
                            : labelForKind(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedItem(item)}
                        className={`absolute left-14 right-4 overflow-hidden rounded-xl ${shade} shadow-sm ring-1 ring-black/5 transition hover:shadow-md active:translate-y-[1px] ${
                          isNext ? "ring-2 ring-emerald-500" : ""
                        }`}
                        style={{ top, height }}
                      >
                        <div className="flex items-center gap-2 px-3 py-2">
                          <span className={`h-2 w-2 rounded-full ${color}`} />
                          <div className="flex-1 text-left text-xs font-semibold leading-tight">
                            <div className="flex items-center gap-1">
                              <span>{title}</span>
                              {item.kind === "TASK" && item.taskId && (
                                <span className="rounded-full bg-white/70 px-2 py-[2px] text-[10px] font-semibold">
                                  {priorityLabel[tasksMap.get(item.taskId)?.priority ?? "MED"]}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-600 flex items-center gap-1">
                              <span>{item.start} - {item.end}</span>
                              {isNext && isToday && rawStart >= nowMinutes && (
                                <span className="rounded-full bg-emerald-100 px-2 py-[1px] text-[10px] font-semibold text-emerald-700">
                                  {Math.max(1, Math.round((rawStart - nowMinutes) / 5) * 5)}分後に開始
                                </span>
                              )}
                            </div>
                            {debugMode && item.reason && (
                              <div className="mt-1 text-[10px] text-indigo-700">理由: {item.reason}</div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {selectedItem && (
                <div className="rounded-2xl border border-indigo-100 bg-white p-4 text-sm shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <span className={`rounded-full px-2 py-1 ${badgeClass(selectedItem)}`}>
                        {labelForKind(selectedItem)}
                      </span>
                      <span className="rounded-full bg-indigo-100 px-2 py-1 text-indigo-800">
                        {selectedItem.start} - {selectedItem.end}
                      </span>
                    </div>
                    <button
                      className="text-xs font-semibold text-zinc-500"
                      onClick={() => setSelectedItem(null)}
                    >
                      閉じる
                    </button>
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-zinc-800">
                    <p className="font-semibold">
                      {selectedItem.kind === "TASK" && selectedItem.taskId
                        ? tasksMap.get(selectedItem.taskId)?.title ?? "タスク"
                        : selectedItem.kind === "FIXED" && selectedItem.blockId
                          ? blocksMap.get(selectedItem.blockId)?.title ?? "予定"
                          : labelForKind(selectedItem)}
                    </p>
                    {selectedItem.kind === "TASK" && selectedItem.taskId && (
                      <>
                        <p>種別: {taskTypeLabel[tasksMap.get(selectedItem.taskId)?.type ?? "MUST"]}</p>
                        <p>優先度: {priorityLabel[tasksMap.get(selectedItem.taskId)?.priority ?? "MED"]}</p>
                        <p>
                          場所: {(tasksMap.get(selectedItem.taskId)?.allowedPlaces ?? []).join(" / ") || "未設定"}
                        </p>
                        <p>
                          条件:{" "}
                          {(tasksMap.get(selectedItem.taskId)?.requiredConditions ?? []).join(" / ") || "なし"}
                        </p>
                        <p className="text-emerald-700">
                          次の手がかり: {selectedItem.start} から {selectedItem.end} までやっておくと安心
                        </p>
                      </>
                    )}
                    {selectedItem.kind === "FIXED" && selectedItem.blockId && (
                      <p>
                        場所: {blocksMap.get(selectedItem.blockId)?.place ?? ""} / 条件:{" "}
                        {(blocksMap.get(selectedItem.blockId)?.availableConditions ?? []).join(" / ") || "なし"}
                      </p>
                    )}
                    {selectedItem.reason && <p className="text-indigo-700">理由: {selectedItem.reason}</p>}
                    {selectedItem.shortageMinutes && (
                      <p className="text-red-700">不足: {selectedItem.shortageMinutes}分</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {viewMode === "week" && (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-indigo-700">7日表示</p>
                <p className="text-sm text-zinc-700">{weekRangeLabel}</p>
              </div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <button
                      className="rounded-full bg-zinc-100 px-3 py-2 text-zinc-700 hover:bg-zinc-200 active:translate-y-[1px]"
                      onClick={() => {
                        const prev = addDays(selectedDate, -7);
                        setSelectedDate(prev);
                      }}
                    >
                      前の7日
                    </button>
                    <button
                      className="rounded-full bg-zinc-100 px-3 py-2 text-zinc-700 hover:bg-zinc-200 active:translate-y-[1px]"
                      onClick={() => {
                        const next = addDays(selectedDate, 7);
                        setSelectedDate(next);
                      }}
                    >
                      次の7日
                    </button>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      今日: {todayKey()}
                    </span>
                  </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              {tasks.length === 0 && blocks.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-600">
                  まだデータがありません。平日/休日テンプレを設定し、タスクを1件追加すると自動配置されます。
                </p>
              ) : (
                <div className="grid min-w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                  {weekResults.map((res, idx) => {
                    const date = weekDates[idx];
                    const itemsForDay = res.items.filter((i) => i.kind === "TASK");
                    const shortage = res.items.find((i) => i.kind === "SHORTAGE");
                    const dayLabel = new Date(date).toLocaleDateString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                      weekday: "short",
                    });
                    const isTodayCard = date === todayKey();
                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => {
                          setSelectedDate(date);
                          setViewMode("calendar");
                        }}
                        className={`flex h-full flex-col gap-2 rounded-2xl border p-3 text-left transition hover:shadow-sm active:translate-y-[1px] ${
                          isTodayCard ? "border-emerald-300 bg-emerald-50/60" : "border-indigo-100 bg-indigo-50/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-indigo-800">{dayLabel}</div>
                          <div className="flex items-center gap-1">
                            {shortage && (
                              <span className="rounded-full bg-red-600 px-2 py-1 text-[11px] font-semibold text-white shadow-sm">
                                不足 {shortage.shortageMinutes ?? ""}分
                              </span>
                            )}
                            {res.overdueRisk && !shortage && (
                              <span className="rounded-full bg-orange-500 px-2 py-1 text-[11px] font-semibold text-white shadow-sm">
                                注意
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2 text-xs text-zinc-800">
                          {itemsForDay.length === 0 ? (
                            <p className="text-zinc-500">予定なし</p>
                          ) : (
                            <>
                              {itemsForDay.slice(0, 3).map((item) => {
                                const task = item.taskId ? tasksMap.get(item.taskId) : undefined;
                                return (
                                  <div
                                    key={item.id}
                                    className="rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-indigo-100"
                                  >
                                    <div className="flex items-center gap-2 font-semibold">
                                      <span className="text-[11px] text-indigo-700">
                                        {item.start} - {item.end}
                                      </span>
                                      <span className="rounded-full bg-indigo-100 px-2 py-[2px] text-[10px] font-semibold text-indigo-800">
                                        {task ? taskTypeLabel[task.type] : "タスク"}
                                      </span>
                                    </div>
                                    <p className="text-sm font-semibold text-zinc-900">
                                      {task?.title ?? "タスク"}
                                    </p>
                                  </div>
                                );
                              })}
                              {itemsForDay.length > 3 && (
                                <div className="rounded-xl bg-indigo-100/60 px-3 py-2 text-[11px] font-semibold text-indigo-800">
                                  他 {itemsForDay.length - 3} 件
                                </div>
                              )}
                            </>
                          )}
                          {debugMode && res.debugInfo && res.debugInfo.some((d) => !d.placed) && (
                            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                              未配置:{" "}
                              {res.debugInfo
                                .filter((d) => !d.placed)
                                .map((d) => d.title)
                                .join(" / ")}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
