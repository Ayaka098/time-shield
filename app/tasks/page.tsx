"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { storage } from "@/lib/storage";
import { ConditionOption, PlaceOption, Task, TaskType } from "@/lib/types";
import { priorityLabel, taskTypeLabel } from "@/lib/labels";
import { useLocalStorageState } from "@/lib/hooks/useLocalStorageState";
import { getISOWeekKey, todayKey } from "@/lib/date";

const placeOptions: { value: PlaceOption; label: string }[] = [
  { value: "school", label: "学校" },
  { value: "library", label: "図書館" },
  { value: "home", label: "家" },
  { value: "transit", label: "移動中" },
];

const conditionOptions: { value: ConditionOption; label: string }[] = [
  { value: "pc", label: "PC" },
  { value: "smartphone", label: "スマホ" },
  { value: "quiet", label: "静かな環境" },
  { value: "internet", label: "通信あり" },
];

const roundTo5 = (value: number) => Math.max(5, Math.round(value / 5) * 5);

const defaultTask = (type: TaskType): Task => ({
  id: crypto.randomUUID(),
  title: "",
  type,
  priority: "MED",
  estimatedMinutes: 25,
  deadline: type === "MUST" ? new Date().toISOString().slice(0, 10) : undefined,
  allowedPlaces: ["school", "library", "home"],
  requiredConditions: [],
  shouldPolicy: type === "SHOULD" ? { minPerWeekSessions: 1 } : undefined,
  status: {},
});

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

  const togglePlace = (place: PlaceOption) => {
    setForm((prev) => {
      const exists = prev.allowedPlaces.includes(place);
      const next = exists ? prev.allowedPlaces.filter((p) => p !== place) : [...prev.allowedPlaces, place];
      return { ...prev, allowedPlaces: next };
    });
  };

  const toggleCondition = (cond: ConditionOption) => {
    setForm((prev) => {
      const exists = prev.requiredConditions.includes(cond);
      const next = exists ? prev.requiredConditions.filter((c) => c !== cond) : [...prev.requiredConditions, cond];
      return { ...prev, requiredConditions: next };
    });
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return alert("タイトルを入力してください");
    if (form.type === "MUST" && !form.deadline) return alert("締切を入力してください");
    if (form.type === "SHOULD" && !form.shouldPolicy?.minPerWeekSessions) {
      return alert("週の最低回数を入力してください");
    }
    if (!form.allowedPlaces.length) return alert("できる場所を1つ以上選んでください");

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
    setForm({
      ...task,
      allowedPlaces: task.allowedPlaces ?? ["school", "library", "home"],
      requiredConditions: task.requiredConditions ?? [],
    });
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
            <p className="text-xs text-zinc-600">ここでタスクを1件入れると自動で時間に配置されます。</p>
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
                  <option value="MUST">{taskTypeLabel.MUST}</option>
                  <option value="SHOULD">{taskTypeLabel.SHOULD}</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-700">目安時間（分）</label>
                <input
                  type="number"
                  min={5}
                  step={5}
                  inputMode="numeric"
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                  value={form.estimatedMinutes || ""}
                  onChange={(e) =>
                    handleChange(
                      "estimatedMinutes",
                      roundTo5(Number.isNaN(Number(e.target.value)) ? 0 : Number(e.target.value))
                    )
                  }
                />
                <div className="flex gap-2 text-xs text-zinc-600">
                  <button
                    className="rounded-full bg-zinc-100 px-3 py-1 font-semibold text-zinc-700"
                    onClick={() =>
                      handleChange("estimatedMinutes", roundTo5((form.estimatedMinutes ?? 5) - 5))
                    }
                  >
                    -5分
                  </button>
                  <button
                    className="rounded-full bg-zinc-100 px-3 py-1 font-semibold text-zinc-700"
                    onClick={() =>
                      handleChange("estimatedMinutes", roundTo5((form.estimatedMinutes ?? 5) + 5))
                    }
                  >
                    +5分
                  </button>
                  <span className="self-center">5分刻みで自動調整</span>
                </div>
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
              <label className="text-sm font-medium text-zinc-700">できる場所（複数選択）</label>
              <div className="flex flex-wrap gap-2">
                {placeOptions.map((p) => {
                  const active = form.allowedPlaces.includes(p.value);
                  return (
                    <button
                      key={p.value}
                      type="button"
                      className={`rounded-full px-3 py-2 text-sm font-semibold transition duration-150 active:scale-95 ${
                        active
                          ? "bg-sky-600 text-white shadow-sm hover:bg-sky-500"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                      onClick={() => togglePlace(p.value)}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-zinc-500">1タップでON/OFF。最低1つ選択。</p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700">必要条件（複数選択）</label>
              <div className="flex flex-wrap gap-2">
                {conditionOptions.map((c) => {
                  const active = form.requiredConditions.includes(c.value);
                  return (
                    <button
                      key={c.value}
                      type="button"
                      className={`rounded-full px-3 py-2 text-sm font-semibold transition duration-150 active:scale-95 ${
                        active
                          ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-500"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                      onClick={() => toggleCondition(c.value)}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-zinc-500">書かせない/開かせない。必要なものだけON。</p>
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
                          task.type === "MUST" ? "bg-orange-100 text-orange-700" : "bg-sky-100 text-sky-700"
                        }`}
                      >
                        {taskTypeLabel[task.type]}
                      </span>
                      {task.type === "MUST" && task.deadline && (
                        <span className="rounded-full bg-white px-2 py-1 text-red-600">締切 {task.deadline}</span>
                      )}
                      {task.type === "SHOULD" && task.shouldPolicy && (
                        <span className="rounded-full bg-white px-2 py-1 text-sky-700">
                          週{task.shouldPolicy.minPerWeekSessions}回
                        </span>
                      )}
                      {task.type === "SHOULD" && (
                        <span className="rounded-full bg-white px-2 py-1 text-sky-700">
                          今週: {appState.weeklyProgress?.[weekKey]?.[task.id]?.sessionsDone ?? 0}/
                          {task.shouldPolicy?.minPerWeekSessions ?? 0}
                        </span>
                      )}
                      <span className="rounded-full bg-white px-2 py-1 text-zinc-700">
                        優先度 {priorityLabel[task.priority]}
                      </span>
                      <span className="rounded-full bg-white px-2 py-1 text-zinc-700">
                        目安 {task.estimatedMinutes}分
                      </span>
                    </div>
                    <p className="text-base font-semibold text-zinc-900">{task.title}</p>
                    <p className="text-sm text-zinc-600">
                      できる場所:{" "}
                      {(task.allowedPlaces ?? []).length
                        ? (task.allowedPlaces ?? [])
                            .map((p) => placeOptions.find((x) => x.value === p)?.label ?? p)
                            .join(" / ")
                        : "未設定"}
                    </p>
                    <p className="text-sm text-zinc-600">
                      条件:{" "}
                      {(task.requiredConditions ?? []).length
                        ? (task.requiredConditions ?? [])
                            .map((c) => conditionOptions.find((x) => x.value === c)?.label ?? c)
                            .join(" / ")
                        : "なし"}
                    </p>
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
