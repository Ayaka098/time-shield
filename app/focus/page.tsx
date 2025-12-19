"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { createDefaultAppState, storage } from "@/lib/storage";
import { AppState, SessionLog, Task, TimeBlock } from "@/lib/types";
import { useLocalStorageState } from "@/lib/hooks/useLocalStorageState";
import { generateSchedule } from "@/lib/scheduler/generateSchedule";
import { getISOWeekKey, minutesFromTime, todayKey } from "@/lib/date";
import { taskTypeLabel, priorityLabel, modeLabel } from "@/lib/labels";

export default function FocusPage() {
  const [tasks, , tasksHydrated] = useLocalStorageState<Task[]>(storage.keys.tasks, []);
  const [blocks, , blocksHydrated] = useLocalStorageState<TimeBlock[]>(storage.keys.timeBlocks, []);
  const [appState, setAppState, appStateHydrated] = useLocalStorageState<AppState>(storage.keys.appState, {
    mode: "NORMAL",
    selectedDate: "",
    weeklyProgress: {},
  });
  const [sessionLogs, setSessionLogs, logsHydrated] = useLocalStorageState<SessionLog[]>(
    storage.keys.sessionLogs,
    []
  );

  const isHydrated = tasksHydrated && appStateHydrated && blocksHydrated && logsHydrated;

  useEffect(() => {
    if (!appStateHydrated) return;
    if (!appState.selectedDate) {
      setAppState(createDefaultAppState());
    }
  }, [appState, appStateHydrated, setAppState]);

  useEffect(() => {
    storage.saveAppState(appState);
  }, [appState]);

  const scheduleResult = useMemo(() => {
    if (!isHydrated || !appState.selectedDate) return null;
    return generateSchedule({
      tasks,
      blocks,
      date: appState.selectedDate,
      mode: appState.mode,
      weeklyProgress: appState.weeklyProgress,
      sessionLogs,
    });
  }, [isHydrated, tasks, blocks, appState, sessionLogs]);

  const nowMinutes = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };

  const tasksMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const annotatedItems = useMemo(() => {
    if (!scheduleResult) return [];
    const dateLogs = sessionLogs.filter((l) => l.date === appState.selectedDate);
    const logMap = new Map(dateLogs.map((l) => [l.taskId, l]));
    return scheduleResult.items.map((item) => {
      if (item.kind !== "TASK" || !item.taskId) return item;
      const log = logMap.get(item.taskId);
      if (!log) return { ...item, status: "PLANNED" as const };
      return { ...item, status: log.completed ? ("DONE" as const) : ("STARTED" as const) };
    });
  }, [scheduleResult, sessionLogs, appState.selectedDate]);

  const currentTask = useMemo(() => {
    if (!annotatedItems.length) return null;
    const now = nowMinutes();
    const tasksOnly = annotatedItems.filter((i) => i.kind === "TASK" && i.taskId);
    const pastUnfinished = tasksOnly.find((i) => {
      const startM = minutesFromTime(i.start);
      return startM <= now && i.status !== "DONE";
    });
    const future = tasksOnly.find((i) => {
      const startM = minutesFromTime(i.start);
      return startM >= now && i.status !== "DONE";
    });
    const picked = pastUnfinished ?? future ?? tasksOnly[0];
    const task = picked?.taskId ? tasksMap.get(picked.taskId) : null;
    return picked && task ? { task, item: picked } : null;
  }, [annotatedItems, tasksMap]);

  const isEnergySaving = appState.mode === "ENERGY_SAVING";

  const handleStart = (completed?: boolean) => {
    if (!currentTask?.task) return;
    const log: SessionLog = {
      id: crypto.randomUUID(),
      date: appState.selectedDate || todayKey(),
      taskId: currentTask.task.id,
      startedAt: new Date().toISOString(),
      durationMinutes: Math.max(5, currentTask.task.estimatedMinutes ?? 25),
      completed,
    };
    setSessionLogs((prev) => [...prev, log]);

    if (currentTask.task.type === "SHOULD") {
      const weekKey = getISOWeekKey(log.date);
      setAppState((prev) => {
        const existing = prev.weeklyProgress[weekKey]?.[currentTask.task.id]?.sessionsDone ?? 0;
        const next = {
          ...prev.weeklyProgress,
          [weekKey]: {
            ...(prev.weeklyProgress[weekKey] ?? {}),
            [currentTask.task.id]: { sessionsDone: existing + 1 },
          },
        };
        return { ...prev, weeklyProgress: next };
      });
    }
    alert("開始ログを記録しました");
  };

  const handleCannot = () => {
    setAppState((prev) => ({ ...prev, mode: "ENERGY_SAVING" }));
  };

  useEffect(() => {
    if (scheduleResult?.overdueRisk && appState.selectedDate) {
      setAppState((prev) => {
        const days = new Set([...(prev.shortageDays ?? []), appState.selectedDate]);
        return { ...prev, shortageDays: Array.from(days) };
      });
    }
  }, [scheduleResult?.overdueRisk, appState.selectedDate, setAppState]);

  if (!isHydrated) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white px-4 py-10 text-zinc-900">
        <div className="mx-auto flex max-w-xl flex-col gap-6">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600">TimeShield</p>
              <h1 className="text-2xl font-semibold text-zinc-900">フォーカス</h1>
            </div>
            <span className="rounded-full bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600">
              読み込み中…
            </span>
          </header>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
            <p className="text-sm text-zinc-500">今やること</p>
            <div className="mt-3 h-6 w-32 rounded-full bg-orange-100" />
            <div className="mt-4 h-10 w-full max-w-xs rounded-xl bg-zinc-100" />
          </section>

          <section className="flex flex-col gap-3">
            <div className="h-12 w-full rounded-xl bg-zinc-200" />
            <div className="h-12 w-full rounded-xl bg-orange-100" />
          </section>
        </div>
      </main>
    );
  }

  if (!tasks.length || !scheduleResult || !scheduleResult.items.length) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white px-4 py-10 text-zinc-900">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
          <p className="text-sm text-orange-600">TimeShield</p>
          <h1 className="text-2xl font-semibold text-zinc-900">タスクがありません</h1>
          <p className="text-sm text-zinc-600">まずタスクを追加して、最初の一手を決めましょう。</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href="/tasks"
              className="rounded-xl bg-zinc-900 px-5 py-3 text-base font-semibold text-white shadow-sm"
            >
              タスクを追加する
            </Link>
            <Link
              href="/blocks"
              className="rounded-xl bg-white px-5 py-3 text-base font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200"
            >
              ブロックを追加
            </Link>
            <Link
              href="/timeline"
              className="rounded-xl bg-white px-5 py-3 text-base font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200"
            >
              タイムラインを見る
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!currentTask?.task) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white px-4 py-10 text-zinc-900">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
          <p className="text-sm text-orange-600">TimeShield</p>
          <h1 className="text-2xl font-semibold text-zinc-900">今日のタスクがありません</h1>
          <p className="text-sm text-zinc-600">タスクとブロックを追加してスケジュールを生成してください。</p>
          <div className="flex gap-2">
            <Link
              href="/tasks"
              className="rounded-xl bg-zinc-900 px-5 py-3 text-base font-semibold text-white shadow-sm"
            >
              タスクを追加
            </Link>
            <Link
              href="/blocks"
              className="rounded-xl bg-white px-5 py-3 text-base font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200"
            >
              ブロックを追加
            </Link>
            <Link
              href="/timeline"
              className="rounded-xl bg-white px-5 py-3 text-base font-semibold text-zinc-900 shadow-sm ring-1 ring-zinc-200"
            >
              タイムラインを見る
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white px-4 py-10 text-zinc-900">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm text-orange-600">TimeShield</p>
            <h1 className="text-2xl font-semibold text-zinc-900">フォーカス</h1>
            {scheduleResult?.overdueRisk && (
              <p className="mt-1 text-xs font-semibold text-red-600">
                MUSTが不足しています。今日の予定を見直してください。
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
              {isEnergySaving ? `${modeLabel.ENERGY_SAVING}モード` : `${modeLabel.NORMAL}モード`}
            </span>
            {isEnergySaving && (
              <button
                onClick={() => setAppState((prev) => ({ ...prev, mode: "NORMAL" }))}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700"
              >
                通常に戻す
              </button>
            )}
          </div>
        </header>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
          <p className="text-sm text-zinc-500">今やること</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
              {taskTypeLabel[currentTask.task.type]}
            </span>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
              優先度: {priorityLabel[currentTask.task.priority]}
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-bold leading-tight text-zinc-950 sm:text-3xl">
            {currentTask.task.title}
          </h2>

          {currentTask.item && (
            <div className="mt-6 rounded-2xl bg-orange-50 px-4 py-3">
              <p className="text-xs font-semibold text-orange-700">次の開始時刻</p>
              <p className="mt-2 text-lg font-semibold text-zinc-900">{currentTask.item.start}</p>
              <p className="mt-2 text-sm text-orange-700">
                できる場所: {(currentTask.task.allowedPlaces ?? []).join(" / ")}
              </p>
              <p className="text-sm text-orange-700">
                条件:{" "}
                {(currentTask.task.requiredConditions ?? []).length
                  ? currentTask.task.requiredConditions.join(" / ")
                  : "なし"}
              </p>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <button
            onClick={() => handleStart(false)}
            className="w-full rounded-xl bg-zinc-900 py-4 text-center text-lg font-semibold text-white shadow-sm transition hover:bg-zinc-800"
          >
            開始した
          </button>
          <button
            onClick={() => handleStart(true)}
            className="w-full rounded-xl border border-emerald-200 bg-emerald-50 py-4 text-center text-lg font-semibold text-emerald-700 transition hover:bg-emerald-100"
          >
            完了した
          </button>
          <button
            onClick={handleCannot}
            className="w-full rounded-xl border border-orange-200 bg-white py-4 text-center text-lg font-semibold text-orange-700 transition hover:bg-orange-50"
          >
            今は無理
          </button>
          <div className="flex flex-wrap justify-center gap-2 pt-2 text-sm font-semibold text-orange-700">
            <Link className="rounded-full bg-orange-100 px-3 py-2" href="/tasks">
              タスクを追加
            </Link>
            <Link className="rounded-full bg-orange-100 px-3 py-2" href="/blocks">
              今日のブロックを入れる
            </Link>
            <Link className="rounded-full bg-orange-100 px-3 py-2" href="/timeline">
              タイムラインを見る
            </Link>
          </div>
          <p className="text-center text-xs text-zinc-500">
            「今は無理」で省エネモードに切り替わります。重いタスクは後回し。
          </p>
        </section>
      </div>
    </main>
  );
}
