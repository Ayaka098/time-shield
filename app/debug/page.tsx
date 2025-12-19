"use client";

import { useState } from "react";
import { storage } from "@/lib/storage";
import { AppState, ConditionOption, PlaceOption, Task, TimeBlock } from "@/lib/types";
import { todayKey } from "@/lib/date";

const sampleTasks: Task[] = [
  {
    id: crypto.randomUUID(),
    title: "PC集中タスク (学校/図書館)",
    type: "MUST",
    priority: "HIGH",
    estimatedMinutes: 60,
    deadline: todayKey(),
    allowedPlaces: ["school", "library"],
    requiredConditions: ["pc", "internet", "quiet"],
    status: {},
  },
  {
    id: crypto.randomUUID(),
    title: "移動中でもできるスマホタスク",
    type: "SHOULD",
    priority: "MED",
    estimatedMinutes: 20,
    shouldPolicy: { minPerWeekSessions: 1 },
    allowedPlaces: ["transit", "home"],
    requiredConditions: ["smartphone"],
    status: {},
  },
  {
    id: crypto.randomUUID(),
    title: "家でゆるタスク",
    type: "SHOULD",
    priority: "LOW",
    estimatedMinutes: 30,
    shouldPolicy: { minPerWeekSessions: 1 },
    allowedPlaces: ["home"],
    requiredConditions: [],
    status: {},
  },
  {
    id: crypto.randomUUID(),
    title: "どこでもOK PCタスク",
    type: "MUST",
    priority: "MED",
    estimatedMinutes: 45,
    deadline: todayKey(),
    allowedPlaces: ["home", "school", "library"],
    requiredConditions: ["pc"],
    status: {},
  },
];

const sampleBlocksWeekday: TimeBlock[] = [
  {
    id: "debug-weekday-sleep",
    date: "weekday",
    startMinutes: 0,
    endMinutes: 420,
    type: "FIXED",
    place: "home",
    availableConditions: [],
    bufferBeforeMinutes: 10,
    bufferAfterMinutes: 10,
    title: "睡眠(平日)",
  },
  {
    id: "debug-weekday-commute",
    date: "weekday",
    startMinutes: 420,
    endMinutes: 500,
    type: "TRANSIT",
    place: "transit",
    availableConditions: ["smartphone"],
    bufferBeforeMinutes: 5,
    bufferAfterMinutes: 5,
    title: "通学",
  },
  {
    id: "debug-weekday-focus",
    date: "weekday",
    startMinutes: 540,
    endMinutes: 720,
    type: "FREE",
    place: "school",
    availableConditions: ["pc", "internet", "quiet"],
    bufferBeforeMinutes: 5,
    bufferAfterMinutes: 5,
    title: "学校 自由",
  },
];

const sampleBlocksHoliday: TimeBlock[] = [
  {
    id: "debug-holiday-sleep",
    date: "holiday",
    startMinutes: 0,
    endMinutes: 480,
    type: "FIXED",
    place: "home",
    availableConditions: [],
    bufferBeforeMinutes: 10,
    bufferAfterMinutes: 10,
    title: "睡眠(休日)",
  },
  {
    id: "debug-holiday-home",
    date: "holiday",
    startMinutes: 540,
    endMinutes: 960,
    type: "FREE",
    place: "home",
    availableConditions: ["pc", "internet"],
    bufferBeforeMinutes: 5,
    bufferAfterMinutes: 5,
    title: "家 自由",
  },
];

const sampleAppState: AppState = {
  mode: "NORMAL",
  selectedDate: todayKey(),
  weeklyProgress: {},
};

export default function DebugPage() {
  const [message, setMessage] = useState<string>("");
  if (process.env.NODE_ENV !== "development") {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900">
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-100">
          <p className="text-sm text-zinc-600">Debugページは開発環境のみ有効です。</p>
        </div>
      </main>
    );
  }

  const setMsg = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 2000);
  };

  const handleSampleTasks = () => {
    storage.saveTasks(sampleTasks);
    setMsg("サンプルタスクを投入しました");
  };

  const handleSampleTemplates = () => {
    storage.saveBlockTemplates([
      { id: "weekday", name: "平日テンプレ", blocks: sampleBlocksWeekday },
      { id: "holiday", name: "休日テンプレ", blocks: sampleBlocksHoliday },
    ]);
    setMsg("サンプルテンプレを投入しました");
  };

  const handleReset = () => {
    if (!confirm("全データを初期化しますか？")) return;
    storage.saveTasks([]);
    storage.saveTimeBlocks([]);
    storage.saveBlockTemplates([]);
    storage.saveSessionLogs([]);
    storage.saveAppState(sampleAppState);
    setMsg("全データを初期化しました");
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white px-4 py-8 text-zinc-900">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-600">Debug</p>
            <h1 className="text-2xl font-semibold text-zinc-900">クイック投入ツール</h1>
          </div>
        </header>

        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">ワンタップ操作</h2>
          <div className="mt-4 grid grid-cols-1 gap-3">
            <button
              onClick={handleSampleTasks}
              className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 active:translate-y-[1px]"
            >
              サンプルタスクを投入
            </button>
            <button
              onClick={handleSampleTemplates}
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 active:translate-y-[1px]"
            >
              平日/休日テンプレを投入
            </button>
            <button
              onClick={handleReset}
              className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-500 active:translate-y-[1px]"
            >
              全データ初期化
            </button>
          </div>
          {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
          <p className="mt-3 text-xs text-zinc-500">
            開発用。現データは上書きされます。必要に応じて Settings でバックアップしてから実行してください。
          </p>
        </div>
      </div>
    </main>
  );
}
