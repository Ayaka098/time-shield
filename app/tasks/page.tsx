"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { storage } from "@/lib/storage";
import { Task, TaskPriority, TaskType } from "@/lib/types";
import { useLocalStorageState } from "@/lib/hooks/useLocalStorageState";
import { todayKey, getISOWeekKey } from "@/lib/date";

const priorities: TaskPriority[] = ["HIGH", "MED", "LOW"];
const starterTypes = [
  { value: "SETUP", label: "セットアップ" },
  { value: "OPEN_APP", label: "アプリを開く" },
  { value: "MICRO_ACTION", label: "小さな一手" },
];

const defaultTask = (type: TaskType): Task => ({
  id: crypto.randomUUID(),
  title: "",
  type,
  priority: "MED",
  estimatedMinutes: 25,
  deadline: type === "MUST" ? new Date().toISOString().slice(0, 10) : undefined,
  starterStep: "",
  starterType: "OPEN_APP",
  requiresInternet: true,
  requiresSeated: false,
  oneHandOk: true,
  device: "either",
  place: "anywhere",
  deepFocusPreferred: false,
  shouldPolicy: type === "SHOULD" ? { minPerWeekSessions: 1 } : undefined,
  status: {},
});

const starterSuggestions = [
  "資料を開く",
  "机に座る",
  "提出ページを開く",
  "ノートPCを開いてアウトラインを書く",
  "ブラウザでタブを1つ開く",
];

export default function TasksPage() {
  const [tasks, setTasks] = useLocalStorageState<Task[]>(storage.keys.tasks, []);
  const [appState] = useLocalStorageState(storage.keys.appState, {
    mode: "NORMAL",
    selectedDate: todayKey(),
    weeklyProgress: {},
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Task>(defaultTask("MUST"));

  const handleChange = (key: keyof Task, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleTypeChange = (value: TaskType) => {
    const base = { ...form, type: value };
    if (value === "MUST") {
      base.deadline = base.deadline ?? new Date().toISOString().slice(0, 10);
      base.shouldPolicy = undefined;
    } else {
      base.deadline = undefined;
      base.shouldPolicy = base.shouldPolicy ?? { minPerWeekSessions: 1 };
    }
    setForm(base);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return alert("タイトルを入力してください");
    if (!form.starterStep.trim()) return alert("最初の一手を入力してください");
    if (form.type === "MUST" && !form.deadline) return alert("締切を入力してください");
    if (form.type === "SHOULD" && !form.shouldPolicy?.minPerWeekSessions) {
      return alert("週の最低回数を入力してください");
    }

    const isEditing = tasks.some((t) => t.id === form.id);
    setTasks((prev) => {
      if (isEditing) {
        return prev.map((t) => (t.id === form.id ? { ...form } : t));
      }
      return [...prev, { ...form }];
    });
    setEditingId(isEditing ? form.id : null);
    setForm(defaultTask("MUST"));
  };

  const handleEdit = (task: Task) => {
    setEditingId(task.id);
    setForm({ ...task });
  };

  const handleDelete = (id: string) => {
    if (!confirm("削除してもよいですか？")) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setForm(defaultTask("MUST"));
    }
  };

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => a.title.localeCompare(b.title));
  }, [tasks]);
  const weekKey = useMemo(() => getISOWeekKey(todayKey()), []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-white px-4 py-8 text-zinc-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm text-sky-600">タスク</p>
            <h1 className="text-2xl font-semibold text-zinc-900">タスク管理</h1>
          </div>
          <Link
            href="/focus"
            className="rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-sky-700"
          >
            フォーカスへ
          </Link>
        </header>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">
            {editingId ? "タスクを編集" : "新規タスク"}
          </h2>
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700">タイトル</label>
              <input
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm"
                value={form.title}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="例：研究レポートの骨子を固める"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-700">種類</label>
                <select
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                  value={form.type}
                  onChange={(e) => handleTypeChange(e.target.value as TaskType)}
                >
                  <option value="MUST">MUST（締切あり）</option>
                  <option value="SHOULD">SHOULD（成長枠）</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-700">優先度</label>
                <select
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                  value={form.priority}
                  onChange={(e) => handleChange("priority", e.target.value as TaskPriority)}
                >
                  {priorities.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-700">目安時間（分）</label>
                <input
                  type="number"
                  min={5}
                  step={5}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                  value={form.estimatedMinutes}
                  onChange={(e) => handleChange("estimatedMinutes", Number(e.target.value))}
                />
              </div>
            </div>

            {form.type === "MUST" && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-700">締切</label>
                <input
                  type="date"
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                  value={form.deadline ?? ""}
                  onChange={(e) => handleChange("deadline", e.target.value)}
                />
              </div>
            )}

            {form.type === "SHOULD" && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-700">週の最低回数</label>
                <input
                  type="number"
                  min={0}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                  value={form.shouldPolicy?.minPerWeekSessions ?? 0}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      shouldPolicy: { minPerWeekSessions: Number(e.target.value) },
                    }))
                  }
                />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700">最初の一手</label>
              <textarea
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm"
                rows={3}
                value={form.starterStep}
                onChange={(e) => handleChange("starterStep", e.target.value)}
                placeholder="例：ノートPCを開いてアウトラインを3行書く"
              />
              <select
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                defaultValue=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) handleChange("starterStep", v);
                  e.target.value = "";
                }}
              >
                <option value="">よく使う一手を挿入</option>
                {starterSuggestions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-700">最初の一手タイプ</label>
                <select
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                  value={form.starterType}
                  onChange={(e) => handleChange("starterType", e.target.value)}
                >
                  {starterTypes.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-700">深い集中向き</label>
                <select
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                  value={form.deepFocusPreferred ? "yes" : "no"}
                  onChange={(e) => handleChange("deepFocusPreferred", e.target.value === "yes")}
                >
                  <option value="no">いいえ</option>
                  <option value="yes">はい</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-700">デバイス</label>
                <select
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                  value={form.device}
                  onChange={(e) => handleChange("device", e.target.value)}
                >
                  <option value="either">どちらでも</option>
                  <option value="pc">PC</option>
                  <option value="smartphone">スマホ</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-700">通信</label>
                <select
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                  value={form.requiresInternet ? "yes" : "no"}
                  onChange={(e) => handleChange("requiresInternet", e.target.value === "yes")}
                >
                  <option value="yes">必要</option>
                  <option value="no">不要</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-700">座り</label>
                <select
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                  value={form.requiresSeated ? "yes" : "no"}
                  onChange={(e) => handleChange("requiresSeated", e.target.value === "yes")}
                >
                  <option value="no">不要</option>
                  <option value="yes">必要</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-700">片手OK</label>
                <select
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                  value={form.oneHandOk ? "yes" : "no"}
                  onChange={(e) => handleChange("oneHandOk", e.target.value === "yes")}
                >
                  <option value="yes">はい</option>
                  <option value="no">いいえ</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-700">場所</label>
                <select
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                  value={form.place}
                  onChange={(e) => handleChange("place", e.target.value)}
                >
                  <option value="anywhere">どこでも</option>
                  <option value="home">家</option>
                  <option value="school">学校/自習室</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleSubmit}
                className="w-full rounded-xl bg-zinc-900 py-3 text-center text-base font-semibold text-white shadow-sm transition hover:bg-zinc-800"
              >
                {editingId ? "更新する" : "追加する"}
              </button>
              {editingId && (
                <button
                  onClick={() => {
                    setEditingId(null);
                    setForm(defaultTask("MUST"));
                  }}
                  className="w-full rounded-xl border border-zinc-200 bg-white py-3 text-center text-sm font-semibold text-zinc-600"
                >
                  新規作成に切り替え
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="mb-10 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">タスク一覧</h2>
          {sortedTasks.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">まだタスクがありません。</p>
          ) : (
            <div className="mt-4 space-y-3">
              {sortedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex flex-col gap-2 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <span
                        className={`rounded-full px-2 py-1 ${
                          task.type === "MUST"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-sky-100 text-sky-700"
                        }`}
                      >
                        {task.type}
                      </span>
                      <span className="rounded-full bg-white px-2 py-1 text-zinc-700">
                        優先度: {task.priority}
                      </span>
                      {task.type === "MUST" && task.deadline && (
                        <span className="rounded-full bg-white px-2 py-1 text-red-600">
                          締切 {task.deadline}
                        </span>
                      )}
                    {task.type === "SHOULD" && task.shouldPolicy && (
                      <span className="rounded-full bg-white px-2 py-1 text-sky-700">
                        週{task.shouldPolicy.minPerWeekSessions}回
                      </span>
                    )}
                    {task.type === "SHOULD" && (
                      <span className="rounded-full bg-white px-2 py-1 text-sky-700">
                        今週:{" "}
                        {appState.weeklyProgress?.[weekKey]?.[task.id]?.sessionsDone ?? 0}/
                        {task.shouldPolicy?.minPerWeekSessions ?? 0}
                      </span>
                    )}
                  </div>
                    <p className="text-base font-semibold text-zinc-900">{task.title}</p>
                    <p className="text-sm text-zinc-600">最初の一手：{task.starterStep}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(task)}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
