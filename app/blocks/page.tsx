"use client";

import { useMemo, useState } from "react";
import { storage } from "@/lib/storage";
import { FocusLevel, TimeBlock, TimeBlockType } from "@/lib/types";
import { useLocalStorageState } from "@/lib/hooks/useLocalStorageState";
import { todayKey } from "@/lib/date";

type BlockForm = {
  id: string;
  date: string;
  start: string;
  end: string;
  type: TimeBlockType;
  place: "home" | "school" | "anywhere";
  internetAvailable: boolean;
  seatedLikely: boolean;
  focusLevel: FocusLevel;
  title?: string;
  earliestDeparture?: string;
  latestDeparture?: string;
};

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

const defaultForm = (date: string): BlockForm => ({
  id: crypto.randomUUID(),
  date,
  start: "07:00",
  end: "08:00",
  type: "STABLE",
  place: "home",
  internetAvailable: true,
  seatedLikely: true,
  focusLevel: 1,
});

export default function BlocksPage() {
  const [blocks, setBlocks] = useLocalStorageState<TimeBlock[]>(storage.keys.timeBlocks, []);
  const [templates, setTemplates] = useLocalStorageState<{ id: string; name: string; blocks: TimeBlock[] }[]>(
    storage.keys.blockTemplates,
    [],
  );
  const initialDate = todayKey();
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [form, setForm] = useState<BlockForm>(defaultForm(initialDate));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  const filtered = useMemo(
    () =>
      blocks
        .filter((b) => b.date === selectedDate)
        .sort((a, b) => a.startMinutes - b.startMinutes),
    [blocks, selectedDate]
  );

  const resetForm = (date: string) => {
    setForm(defaultForm(date));
    setEditingId(null);
    setError("");
  };

  const applyEdit = (block: TimeBlock) => {
    setEditingId(block.id);
    setForm({
      id: block.id,
      date: block.date,
      start: minutesToTime(block.startMinutes),
      end: minutesToTime(block.endMinutes),
      type: block.type,
      place: block.place,
      internetAvailable: block.internetAvailable,
      seatedLikely: block.seatedLikely,
      focusLevel: block.focusLevel,
      title: block.meta?.title,
      earliestDeparture: block.forFlexMove?.earliestDepartureMinutes
        ? minutesToTime(block.forFlexMove.earliestDepartureMinutes)
        : "",
      latestDeparture: block.forFlexMove?.latestDepartureMinutes
        ? minutesToTime(block.forFlexMove.latestDepartureMinutes)
        : "",
    });
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

    const earliestM = form.earliestDeparture ? timeToMinutes(form.earliestDeparture) : undefined;
    const latestM = form.latestDeparture ? timeToMinutes(form.latestDeparture) : undefined;

    const newBlock: TimeBlock = {
      id: form.id,
      date: form.date,
      startMinutes: startM,
      endMinutes: endM,
      type: form.type,
      place: form.place,
      internetAvailable: form.internetAvailable,
      seatedLikely: form.seatedLikely,
      focusLevel: form.focusLevel,
      meta: form.type === "FIXED" && form.title ? { title: form.title } : undefined,
      forFlexMove:
        form.type === "FLEX_MOVE"
          ? {
              earliestDepartureMinutes: earliestM,
              latestDepartureMinutes: latestM,
            }
          : undefined,
    };

    setBlocks((prev) => {
      const exists = prev.some((b) => b.id === newBlock.id);
      if (exists) {
        return prev.map((b) => (b.id === newBlock.id ? newBlock : b));
      }
      return [...prev, newBlock];
    });
    resetForm(selectedDate);
  };

  const handleDelete = (id: string) => {
    if (!confirm("このブロックを削除しますか？")) return;
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (editingId === id) resetForm(selectedDate);
  };

  const saveTemplate = () => {
    const blocksForDate = blocks.filter((b) => b.date === selectedDate);
    if (!blocksForDate.length) {
      setError("この日のブロックがありません");
      return;
    }
    const name = prompt("テンプレート名を入力してください（例：登校日）");
    if (!name) return;
    const tpl = {
      id: crypto.randomUUID(),
      name,
      blocks: blocksForDate.map((b) => ({ ...b, id: crypto.randomUUID() })),
    };
    setTemplates((prev) => [...prev, tpl]);
  };

  const applyTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const copied = tpl.blocks.map((b) => ({
      ...b,
      id: crypto.randomUUID(),
      date: selectedDate,
    }));
    setBlocks((prev) => [...prev, ...copied]);
  };

  const quickAdd = (preset: "commute" | "library") => {
    const base: TimeBlock =
      preset === "commute"
        ? {
            id: crypto.randomUUID(),
            date: selectedDate,
            startMinutes: 7 * 60,
            endMinutes: 8 * 60,
            type: "UNSTABLE",
            place: "anywhere",
            internetAvailable: false,
            seatedLikely: false,
            focusLevel: 0,
          }
        : {
            id: crypto.randomUUID(),
            date: selectedDate,
            startMinutes: 14 * 60,
            endMinutes: 16 * 60,
            type: "STABLE",
            place: "school",
            internetAvailable: true,
            seatedLikely: true,
            focusLevel: 2,
          };
    setBlocks((prev) => [...prev, base]);
  };

  const displayType = (type: TimeBlockType) => {
    switch (type) {
      case "FIXED":
        return "FIXED（固定）";
      case "STABLE":
        return "STABLE（安定）";
      case "UNSTABLE":
        return "UNSTABLE（不安定）";
      case "FLEX_MOVE":
        return "FLEX_MOVE（可変移動）";
      default:
        return type;
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-white px-4 py-8 text-zinc-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-emerald-600">ブロック</p>
            <h1 className="text-2xl font-semibold text-zinc-900">今日のブロック入力</h1>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-700" htmlFor="selected-date">
              日付
            </label>
            <input
              id="selected-date"
              type="date"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                resetForm(e.target.value);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={saveTemplate}
              className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700"
            >
              この日をテンプレ保存
            </button>
            {templates.length > 0 && (
              <select
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
                onChange={(e) => {
                  if (!e.target.value) return;
                  applyTemplate(e.target.value);
                  e.target.value = "";
                }}
                defaultValue=""
              >
                <option value="">テンプレを適用</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </header>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => quickAdd("commute")}
            className="rounded-full bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700"
          >
            通学（不安定）
          </button>
          <button
            onClick={() => quickAdd("library")}
            className="rounded-full bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700"
          >
            図書館（集中）
          </button>
        </div>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">
            {editingId ? "ブロックを編集" : "新規ブロック"}
          </h2>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700">開始</label>
              <input
                type="time"
                className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                value={form.start}
                onChange={(e) => setForm((prev) => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700">終了</label>
              <input
                type="time"
                className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                value={form.end}
                onChange={(e) => setForm((prev) => ({ ...prev, end: e.target.value }))}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700">タイプ</label>
              <select
                className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                value={form.type}
                onChange={(e) => {
                  const value = e.target.value as TimeBlockType;
                  setForm((prev) => ({
                    ...prev,
                    type: value,
                    title: value === "FIXED" ? prev.title : "",
                    earliestDeparture: value === "FLEX_MOVE" ? prev.earliestDeparture : "",
                    latestDeparture: value === "FLEX_MOVE" ? prev.latestDeparture : "",
                  }));
                }}
              >
                <option value="FIXED">FIXED（固定）</option>
                <option value="STABLE">STABLE（安定）</option>
                <option value="UNSTABLE">UNSTABLE（不安定）</option>
                <option value="FLEX_MOVE">FLEX_MOVE（可変移動）</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700">場所</label>
              <select
                className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                value={form.place}
                onChange={(e) => setForm((prev) => ({ ...prev, place: e.target.value as BlockForm["place"] }))}
              >
                <option value="home">家</option>
                <option value="school">学校/自習室</option>
                <option value="anywhere">どこでも</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700">通信</label>
              <select
                className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                value={form.internetAvailable ? "yes" : "no"}
                onChange={(e) => setForm((prev) => ({ ...prev, internetAvailable: e.target.value === "yes" }))}
              >
                <option value="yes">あり</option>
                <option value="no">なし</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700">座れる可能性</label>
              <select
                className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                value={form.seatedLikely ? "yes" : "no"}
                onChange={(e) => setForm((prev) => ({ ...prev, seatedLikely: e.target.value === "yes" }))}
              >
                <option value="yes">座れそう</option>
                <option value="no">立ち/不明</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700">集中度</label>
              <select
                className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                value={form.focusLevel}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    focusLevel: Number(e.target.value) as FocusLevel,
                  }))
                }
              >
                <option value={0}>0（移動/不安定）</option>
                <option value={1}>1（通常）</option>
                <option value={2}>2（集中）</option>
              </select>
            </div>
          </div>

          {form.type === "FIXED" && (
            <div className="mt-4 flex flex-col gap-2">
              <label className="text-sm font-medium text-zinc-700">予定名（任意）</label>
              <input
                className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                value={form.title ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="例：ゼミ"
              />
            </div>
          )}

          {form.type === "FLEX_MOVE" && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-700">最早出発（任意）</label>
                <input
                  type="time"
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                  value={form.earliestDeparture ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, earliestDeparture: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-zinc-700">最遅出発（任意）</label>
                <input
                  type="time"
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm"
                  value={form.latestDeparture ?? ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, latestDeparture: e.target.value }))}
                />
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={handleSubmit}
              className="w-full rounded-xl bg-zinc-900 py-3 text-center text-base font-semibold text-white shadow-sm transition hover:bg-zinc-800 sm:w-auto sm:px-8"
            >
              {editingId ? "更新する" : "追加する"}
            </button>
            <button
              onClick={() => resetForm(selectedDate)}
              className="w-full rounded-xl border border-zinc-200 bg-white py-3 text-center text-sm font-semibold text-zinc-600 sm:w-auto sm:px-6"
            >
              フォームをリセット
            </button>
          </div>
        </section>

        <section className="mb-10 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <h2 className="text-lg font-semibold text-zinc-900">{selectedDate} のブロック</h2>
          {filtered.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">まだブロックがありません。</p>
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
                        場所: {block.place}
                      </span>
                      <span className="rounded-full bg-white px-2 py-1 text-zinc-700">
                        集中度: {block.focusLevel}
                      </span>
                    </div>
                    {block.meta?.title && (
                      <p className="text-sm font-semibold text-zinc-900">{block.meta.title}</p>
                    )}
                    {block.type === "FLEX_MOVE" && (
                      <p className="text-xs text-zinc-600">
                        出発: {block.forFlexMove?.earliestDepartureMinutes !== undefined
                          ? minutesToTime(block.forFlexMove.earliestDepartureMinutes)
                          : "未設定"}{" "}
                        / {block.forFlexMove?.latestDepartureMinutes !== undefined
                          ? minutesToTime(block.forFlexMove.latestDepartureMinutes)
                          : "未設定"}
                      </p>
                    )}
                    <p className="text-xs text-zinc-600">
                      通信: {block.internetAvailable ? "あり" : "なし"} / 座れる:{" "}
                      {block.seatedLikely ? "座れそう" : "立ち/不明"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => applyEdit(block)}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(block.id)}
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
