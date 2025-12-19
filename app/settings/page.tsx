"use client";

import { useRef, useState } from "react";
import { storage } from "@/lib/storage";
import { AppState, SessionLog, Task, TimeBlock } from "@/lib/types";
import { useLocalStorageState } from "@/lib/hooks/useLocalStorageState";
import { getISOWeekKey, todayKey } from "@/lib/date";

type BackupPayload = {
  tasks: Task[];
  blocks: TimeBlock[];
  appState: AppState;
  sessionLogs: SessionLog[];
  weeklyProgress: AppState["weeklyProgress"];
  blockTemplates: { id: string; name: string; blocks: TimeBlock[] }[];
};

export default function SettingsPage() {
  const [tasks, setTasks] = useLocalStorageState<Task[]>(storage.keys.tasks, []);
  const [blocks, setBlocks] = useLocalStorageState<TimeBlock[]>(storage.keys.timeBlocks, []);
  const [appState, setAppState] = useLocalStorageState<AppState>(storage.keys.appState, {
    mode: "NORMAL",
    selectedDate: "",
    weeklyProgress: {},
  });
  const [logs, setLogs] = useLocalStorageState<SessionLog[]>(storage.keys.sessionLogs, []);
  const [templates, setTemplates] = useLocalStorageState<{ id: string; name: string; blocks: TimeBlock[] }[]>(
    storage.keys.blockTemplates,
    [],
  );
  const [error, setError] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleExport = () => {
    const payload: BackupPayload = {
      tasks,
      blocks,
      appState,
      sessionLogs: logs,
      weeklyProgress: appState.weeklyProgress,
      blockTemplates: templates,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timeshield-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    setError("");
    const raw = textareaRef.current?.value;
    if (!raw) {
      setError("JSONを入力してください");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as BackupPayload;
      if (!parsed.tasks || !parsed.blocks) {
        setError("形式が不正です。tasks/blocksが見つかりません");
        return;
      }
      setTasks(parsed.tasks);
      setBlocks(parsed.blocks);
      setLogs(parsed.sessionLogs ?? []);
      setTemplates(parsed.blockTemplates ?? []);
      setAppState(parsed.appState ?? appState);
      alert("データを復元しました");
    } catch {
      setError("JSONのパースに失敗しました");
    }
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result?.toString() ?? "";
      if (textareaRef.current) textareaRef.current.value = text;
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (!confirm("すべてのデータを初期化しますか？")) return;
    setTasks([]);
    setBlocks([]);
    setLogs([]);
    setTemplates([]);
    setAppState({
      mode: "NORMAL",
      selectedDate: "",
      weeklyProgress: {},
      energySavingCount: 0,
      shortageDays: [],
    });
    alert("データを初期化しました");
  };

  const today = todayKey();
  const weekKey = getISOWeekKey(today);
  const sessionsWeek = logs.filter((l) => getISOWeekKey(l.date) === weekKey);
  const mustCount = sessionsWeek.filter((l) => tasks.find((t) => t.id === l.taskId)?.type === "MUST").length;
  const shouldCount = sessionsWeek.filter((l) => tasks.find((t) => t.id === l.taskId)?.type === "SHOULD").length;
  const energyCount = appState.energySavingCount ?? 0;
  const shortageDays = appState.shortageDays ?? [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-8 text-zinc-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header>
          <p className="text-sm text-slate-600">設定 / バックアップ</p>
          <h1 className="text-2xl font-semibold text-zinc-900">データのエクスポート・インポート</h1>
          <p className="text-sm text-zinc-600">
            タスク・ブロック・進捗・ログをJSONでバックアップできます。復元は上書きされます。
          </p>
        </header>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">エクスポート</h2>
          <button
            onClick={handleExport}
            className="mt-3 w-full rounded-xl bg-zinc-900 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
          >
            JSONをダウンロード
          </button>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">インポート</h2>
          <div className="mt-3 flex flex-col gap-3">
            <textarea
              ref={textareaRef}
              className="min-h-[160px] w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
              placeholder="ここにJSONを貼り付け"
            />
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="application/json"
                onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)}
                className="text-sm text-zinc-600"
              />
              <button
                onClick={handleImport}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
              >
                復元する
              </button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">初期化</h2>
          <p className="text-sm text-zinc-600">データが壊れた場合に使ってください。すべて消去されます。</p>
          <button
            onClick={handleReset}
            className="mt-3 w-full rounded-xl border border-red-200 bg-red-50 py-3 text-center text-sm font-semibold text-red-700 shadow-sm hover:bg-red-100"
          >
            全データを初期化
          </button>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">簡易統計（ローカル）</h2>
          <div className="mt-3 space-y-2 text-sm text-zinc-700">
            <p>今週の開始回数 MUST: {mustCount} 回</p>
            <p>今週の開始回数 SHOULD: {shouldCount} 回</p>
            <p>省エネにした回数: {energyCount} 回</p>
            <p>SHORTAGE が出た日数: {shortageDays.length} 日</p>
          </div>
        </section>
      </div>
    </main>
  );
}
