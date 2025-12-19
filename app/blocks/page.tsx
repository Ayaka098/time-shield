"use client";

import { useEffect, useMemo, useState } from "react";
import { storage } from "@/lib/storage";
import { ConditionOption, PlaceOption, TimeBlock, TimeBlockType } from "@/lib/types";
import { useLocalStorageState } from "@/lib/hooks/useLocalStorageState";
import { todayKey } from "@/lib/date";

type BlockForm = {
  id: string;
  start: string;
  end: string;
  type: TimeBlockType;
  place: PlaceOption;
  availableConditions: ConditionOption[];
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  target: "date" | "weekday" | "holiday";
  title?: string;
};

const defaultForm = (target: BlockForm["target"]): BlockForm => ({
  id: crypto.randomUUID(),
  start: "07:00",
  end: "08:00",
  type: "FREE",
  place: "school",
  availableConditions: ["pc", "internet", "quiet"],
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  target,
});

const timeToMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const minutesToTime = (minutes: number) => {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
};

const adjustTime = (time: string, delta: number) => {
  const total = Math.min(24 * 60, Math.max(0, timeToMinutes(time) + delta));
  const rounded = Math.round(total / 5) * 5;
  return minutesToTime(rounded);
};

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

const sampleWeekdayBlocks: TimeBlock[] = [
  {
    id: "sample-weekday-sleep",
    date: "weekday",
    startMinutes: 0,
    endMinutes: 420,
    type: "FIXED",
    place: "home",
    availableConditions: [],
    bufferBeforeMinutes: 10,
    bufferAfterMinutes: 10,
    title: "サンプル: 睡眠",
  },
  {
    id: "sample-weekday-commute",
    date: "weekday",
    startMinutes: 420,
    endMinutes: 500,
    type: "TRANSIT",
    place: "transit",
    availableConditions: ["smartphone"],
    bufferBeforeMinutes: 5,
    bufferAfterMinutes: 5,
    title: "サンプル: 通学移動",
  },
  {
    id: "sample-weekday-focus",
    date: "weekday",
    startMinutes: 540,
    endMinutes: 720,
    type: "FREE",
    place: "school",
    availableConditions: ["pc", "internet", "quiet"],
    bufferBeforeMinutes: 5,
    bufferAfterMinutes: 5,
    title: "サンプル: 自由時間（集中）",
  },
  {
    id: "sample-weekday-evening",
    date: "weekday",
    startMinutes: 1080,
    endMinutes: 1320,
    type: "FREE",
    place: "home",
    availableConditions: ["pc", "internet"],
    bufferBeforeMinutes: 5,
    bufferAfterMinutes: 5,
    title: "サンプル: 夕方自由",
  },
];

const sampleHolidayBlocks: TimeBlock[] = [
  {
    id: "sample-holiday-sleep",
    date: "holiday",
    startMinutes: 0,
    endMinutes: 480,
    type: "FIXED",
    place: "home",
    availableConditions: [],
    bufferBeforeMinutes: 10,
    bufferAfterMinutes: 10,
    title: "サンプル: 睡眠",
  },
  {
    id: "sample-holiday-free",
    date: "holiday",
    startMinutes: 540,
    endMinutes: 900,
    type: "FREE",
    place: "home",
    availableConditions: ["pc", "internet"],
    bufferBeforeMinutes: 5,
    bufferAfterMinutes: 5,
    title: "サンプル: 自由時間",
  },
  {
    id: "sample-holiday-out",
    date: "holiday",
    startMinutes: 960,
    endMinutes: 1200,
    type: "FREE",
    place: "library",
    availableConditions: ["pc", "internet", "quiet"],
    bufferBeforeMinutes: 5,
    bufferAfterMinutes: 5,
    title: "サンプル: 図書館",
  },
];

const displayType = (type: TimeBlockType) => {
  switch (type) {
    case "FIXED":
      return "固定時間";
    case "TRANSIT":
      return "移動時間";
    case "FREE":
      return "自由時間";
    default:
      return type;
  }
};

export default function BlocksPage() {
  const [blocks, setBlocks] = useLocalStorageState<TimeBlock[]>(storage.keys.timeBlocks, []);
  const [templates, setTemplates] = useLocalStorageState<{ id: string; name: string; blocks: TimeBlock[] }[]>(
    storage.keys.blockTemplates,
    []
  );
  const initialDate = todayKey();
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [form, setForm] = useState<BlockForm>(defaultForm("date"));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  // Base templates are always present so「平日/休日」ワンタップ適用ができる
  useEffect(() => {
    const kinds: Array<
      ["weekday", "平日テンプレ", TimeBlock[]] | ["holiday", "休日テンプレ", TimeBlock[]]
    > = [
      ["weekday", "平日テンプレ", sampleWeekdayBlocks],
      ["holiday", "休日テンプレ", sampleHolidayBlocks],
    ];
    let updated = false;
    let next = [...templates];
    kinds.forEach(([id, name, sampleBlocks]) => {
      const existing = next.find((t) => t.id === id);
      if (!existing) {
        updated = true;
        next = [...next, { id, name, blocks: sampleBlocks }];
        return;
      }
      if (existing.blocks.length === 0 && sampleBlocks.length > 0) {
        updated = true;
        next = next.map((t) => (t.id === id ? { ...t, blocks: sampleBlocks } : t));
      }
    });
    if (updated) setTemplates(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () =>
      blocks
        .filter((b) => b.date === selectedDate)
        .sort((a, b) => a.startMinutes - b.startMinutes),
    [blocks, selectedDate]
  );

  const templateBlocks = (kind: "weekday" | "holiday") =>
    templates.find((t) => t.id === kind)?.blocks ?? [];

  const resetForm = (target: BlockForm["target"] = "date") => {
    setForm(defaultForm(target));
    setEditingId(null);
    setError("");
  };

  const handleSubmit = () => {
    if (!form.start || !form.end) {
      setError("開始・終了時刻を入力してください");
      return;
    }
    const startM = timeToMinutes(form.start);
    const endM = timeToMinutes(form.end);
    if (Number.isNaN(startM) || Number.isNaN(endM)) {
      setError("時刻の形式が不正です");
      return;
    }
    if (startM >= endM) {
      setError("開始は終了より前にしてください");
      return;
    }

    const newBlock: TimeBlock = {
      id: form.id,
      date: form.target === "date" ? selectedDate : form.target,
      startMinutes: startM,
      endMinutes: endM,
      type: form.type,
      place: form.place,
      availableConditions: [...form.availableConditions],
      bufferBeforeMinutes: form.bufferBeforeMinutes ?? 0,
      bufferAfterMinutes: form.bufferAfterMinutes ?? 0,
      title: form.title,
    };

    if (form.target === "date") {
      setBlocks((prev) => {
        const exists = prev.some((b) => b.id === newBlock.id);
        if (exists) {
          return prev.map((b) => (b.id === newBlock.id ? newBlock : b));
        }
        return [...prev, newBlock];
      });
    } else {
      setTemplates((prev) => {
        const tpl = prev.find((t) => t.id === form.target) ?? {
          id: form.target,
          name: form.target === "weekday" ? "平日テンプレ" : "休日テンプレ",
          blocks: [],
        };
        const exists = tpl.blocks.some((b) => b.id === newBlock.id);
        const updatedBlocks = exists
          ? tpl.blocks.map((b) => (b.id === newBlock.id ? newBlock : b))
          : [...tpl.blocks, newBlock];
        const rest = prev.filter((t) => t.id !== tpl.id);
        return [...rest, { ...tpl, blocks: updatedBlocks }];
      });
    }
    resetForm(form.target);
  };

  const handleDeleteDateBlock = (id: string) => {
    if (!confirm("このブロックを削除しますか？")) return;
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (editingId === id) resetForm("date");
  };

  const handleDeleteTemplateBlock = (id: string, target: "weekday" | "holiday") => {
    if (!confirm("テンプレのブロックを削除しますか？")) return;
    setTemplates((prev) =>
      prev.map((tpl) =>
        tpl.id === target ? { ...tpl, blocks: tpl.blocks.filter((b) => b.id !== id) } : tpl
      )
    );
    if (editingId === id) resetForm(target);
  };

  const applyTemplateToDate = (kind: "weekday" | "holiday") => {
    const tpl = templates.find((t) => t.id === kind);
    if (!tpl) return;
    const copied = tpl.blocks.map((b) => ({
      ...b,
      id: crypto.randomUUID(),
      date: selectedDate,
    }));
    setBlocks((prev) => [...prev.filter((b) => b.date !== selectedDate), ...copied]);
  };

  const applyEdit = (block: TimeBlock, target: BlockForm["target"]) => {
    setEditingId(block.id);
    setForm({
      id: block.id,
      start: minutesToTime(block.startMinutes),
      end: minutesToTime(block.endMinutes),
      type: block.type,
      place: block.place,
      availableConditions: block.availableConditions ?? [],
      bufferBeforeMinutes: block.bufferBeforeMinutes ?? 0,
      bufferAfterMinutes: block.bufferAfterMinutes ?? 0,
      title: block.title,
      target,
    });
  };

  const toggleCondition = (value: ConditionOption) => {
    setForm((prev) => {
      const exists = prev.availableConditions.includes(value);
      const next = exists
        ? prev.availableConditions.filter((c) => c !== value)
        : [...prev.availableConditions, value];
      return { ...prev, availableConditions: next };
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-white px-4 py-8 text-zinc-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-emerald-600">ブロック</p>
            <h1 className="text-2xl font-semibold text-zinc-900">テンプレ前提のブロック入力</h1>
            <p className="text-sm text-zinc-600">平日/休日テンプレを基本に、例外日だけ上書きします。</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-700" htmlFor="selected-date">
              例外日を選択
            </label>
            <input
              id="selected-date"
              type="date"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                resetForm(form.target);
              }}
            />
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => applyTemplateToDate("weekday")}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 active:translate-y-[1px]"
          >
            平日テンプレを適用
          </button>
          <button
            onClick={() => applyTemplateToDate("holiday")}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 active:translate-y-[1px]"
          >
            休日テンプレを適用
          </button>
          <span className="text-xs text-zinc-600">上書きOK。適用後にこの日だけ編集できます。</span>
        </div>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">ブロック入力</h2>
            <div className="flex flex-wrap gap-2">
              {["date", "weekday", "holiday"].map((t) => (
                <button
                  key={t}
                  className={`rounded-full px-3 py-2 text-xs font-semibold ${
                    form.target === t
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                  onClick={() => resetForm(t as BlockForm["target"])}
                >
                  {t === "date" ? "例外日" : t === "weekday" ? "平日テンプレ編集" : "休日テンプレ編集"}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700">開始</label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  step={300}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                  value={form.start}
                  onChange={(e) => setForm((prev) => ({ ...prev, start: e.target.value }))}
                />
                <div className="flex flex-col gap-1 text-xs">
                  <button
                    className="rounded-full bg-zinc-100 px-3 py-1 font-semibold text-zinc-700"
                    onClick={() => setForm((prev) => ({ ...prev, start: adjustTime(prev.start, -5) }))}
                  >
                    -5分
                  </button>
                  <button
                    className="rounded-full bg-zinc-100 px-3 py-1 font-semibold text-zinc-700"
                    onClick={() => setForm((prev) => ({ ...prev, start: adjustTime(prev.start, 5) }))}
                  >
                    +5分
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700">終了</label>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  step={300}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                  value={form.end}
                  onChange={(e) => setForm((prev) => ({ ...prev, end: e.target.value }))}
                />
                <div className="flex flex-col gap-1 text-xs">
                  <button
                    className="rounded-full bg-zinc-100 px-3 py-1 font-semibold text-zinc-700"
                    onClick={() => setForm((prev) => ({ ...prev, end: adjustTime(prev.end, -5) }))}
                  >
                    -5分
                  </button>
                  <button
                    className="rounded-full bg-zinc-100 px-3 py-1 font-semibold text-zinc-700"
                    onClick={() => setForm((prev) => ({ ...prev, end: adjustTime(prev.end, 5) }))}
                  >
                    +5分
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700">タイプ</label>
              <select
                className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                value={form.type}
                onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as TimeBlockType }))}
              >
                <option value="FIXED">固定時間</option>
                <option value="FREE">自由時間</option>
                <option value="TRANSIT">移動時間</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700">場所</label>
              <select
                className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                value={form.place}
                onChange={(e) => setForm((prev) => ({ ...prev, place: e.target.value as PlaceOption }))}
              >
                {placeOptions.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700">予定名（任意・固定用）</label>
              <input
                className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                value={form.title ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="例：授業"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-700">この時間に満たせる条件（複数選択）</label>
            <div className="flex flex-wrap gap-2">
              {conditionOptions.map((c) => {
                const active = form.availableConditions.includes(c.value);
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
            <p className="text-xs text-zinc-500">タスクが要求する条件を満たすブロックだけが候補になります。</p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700">Buffer 前（分）</label>
              <input
                type="number"
                min={0}
                step={5}
                inputMode="numeric"
                className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                value={form.bufferBeforeMinutes ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, bufferBeforeMinutes: Number(e.target.value) }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700">Buffer 後（分）</label>
              <input
                type="number"
                min={0}
                step={5}
                inputMode="numeric"
                className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                value={form.bufferAfterMinutes ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, bufferAfterMinutes: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={handleSubmit}
              className="w-full rounded-xl bg-zinc-900 py-3 text-center text-base font-semibold text-white shadow-sm transition hover:bg-zinc-800 sm:w-auto sm:px-8"
            >
              {editingId ? "更新する" : "追加する"}
            </button>
            <button
              onClick={() => resetForm(form.target)}
              className="w-full rounded-xl border border-zinc-200 bg-white py-3 text-center text-sm font-semibold text-zinc-600 sm:w-auto sm:px-6"
            >
              フォームをリセット
            </button>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">平日テンプレ</h2>
          {templateBlocks("weekday").length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">まだテンプレがありません。</p>
          ) : (
            <div className="mt-4 space-y-3">
              {templateBlocks("weekday")
                .sort((a, b) => a.startMinutes - b.startMinutes)
                .map((block) => (
                  <div
                    key={block.id}
                    className="flex flex-col gap-2 rounded-2xl border border-zinc-100 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-white px-2 py-1 text-emerald-700">
                          {displayType(block.type)}
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-zinc-700">
                          {minutesToTime(block.startMinutes)} - {minutesToTime(block.endMinutes)}
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-zinc-700">
                          場所: {placeOptions.find((p) => p.value === block.place)?.label ?? block.place}
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-zinc-700">
                          Buffer前後: {block.bufferBeforeMinutes ?? 0}/{block.bufferAfterMinutes ?? 0}分
                        </span>
                      </div>
                      {block.title && <p className="text-sm font-semibold text-zinc-900">{block.title}</p>}
                      <p className="text-xs text-zinc-600">
                        条件:{" "}
                        {(block.availableConditions ?? [])
                          .map((c) => conditionOptions.find((x) => x.value === c)?.label ?? c)
                          .join(" / ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => applyEdit(block, "weekday")}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDeleteTemplateBlock(block.id, "weekday")}
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

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">休日テンプレ</h2>
          {templateBlocks("holiday").length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">まだテンプレがありません。</p>
          ) : (
            <div className="mt-4 space-y-3">
              {templateBlocks("holiday")
                .sort((a, b) => a.startMinutes - b.startMinutes)
                .map((block) => (
                  <div
                    key={block.id}
                    className="flex flex-col gap-2 rounded-2xl border border-zinc-100 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-white px-2 py-1 text-emerald-700">
                          {displayType(block.type)}
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-zinc-700">
                          {minutesToTime(block.startMinutes)} - {minutesToTime(block.endMinutes)}
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-zinc-700">
                          場所: {placeOptions.find((p) => p.value === block.place)?.label ?? block.place}
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-zinc-700">
                          Buffer前後: {block.bufferBeforeMinutes ?? 0}/{block.bufferAfterMinutes ?? 0}分
                        </span>
                      </div>
                      {block.title && <p className="text-sm font-semibold text-zinc-900">{block.title}</p>}
                      <p className="text-xs text-zinc-600">
                        条件:{" "}
                        {(block.availableConditions ?? [])
                          .map((c) => conditionOptions.find((x) => x.value === c)?.label ?? c)
                          .join(" / ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => applyEdit(block, "holiday")}
                        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDeleteTemplateBlock(block.id, "holiday")}
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

        <section className="mb-10 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">{selectedDate} の例外ブロック</h2>
          {filtered.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">まだこの日の例外ブロックはありません。</p>
          ) : (
            <div className="mt-4 space-y-3">
              {filtered.map((block) => (
                <div
                  key={block.id}
                  className="flex flex-col gap-2 rounded-2xl border border-zinc-100 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-white px-2 py-1 text-emerald-700">
                        {displayType(block.type)}
                      </span>
                      <span className="rounded-full bg-white px-2 py-1 text-zinc-700">
                        {minutesToTime(block.startMinutes)} - {minutesToTime(block.endMinutes)}
                      </span>
                      <span className="rounded-full bg-white px-2 py-1 text-zinc-700">
                        場所: {placeOptions.find((p) => p.value === block.place)?.label ?? block.place}
                      </span>
                      <span className="rounded-full bg-white px-2 py-1 text-zinc-700">
                        Buffer前後: {block.bufferBeforeMinutes ?? 0}/{block.bufferAfterMinutes ?? 0}分
                      </span>
                    </div>
                    {block.title && <p className="text-sm font-semibold text-zinc-900">{block.title}</p>}
                    <p className="text-xs text-zinc-600">
                      条件:{" "}
                      {(block.availableConditions ?? [])
                        .map((c) => conditionOptions.find((x) => x.value === c)?.label ?? c)
                        .join(" / ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => applyEdit(block, "date")}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDeleteDateBlock(block.id)}
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
