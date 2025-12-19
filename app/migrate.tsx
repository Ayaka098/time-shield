"use client";

import { useEffect, useRef } from "react";
import { storage } from "@/lib/storage";
import { ConditionOption, PlaceOption, Task, TimeBlock } from "@/lib/types";

const defaultPlaces: PlaceOption[] = ["home"];
const defaultConditions: ConditionOption[] = [];

const mapLegacyBlock = (block: any): TimeBlock => {
  const legacyType = block.type as string;
  let type: TimeBlock["type"] = "FREE";
  if (legacyType === "FIXED") type = "FIXED";
  if (legacyType === "FLEX_MOVE" || legacyType === "TRANSIT") type = "TRANSIT";

  const placeRaw = (block.place as PlaceOption) ?? "home";
  const place: PlaceOption = placeRaw === "anywhere" ? "transit" : placeRaw;
  const availableConditions: ConditionOption[] = [];
  if (block.internetAvailable) availableConditions.push("internet");
  if ((block.focusLevel ?? 0) >= 1) availableConditions.push("quiet");
  if (place === "school" || place === "library") availableConditions.push("pc");

  return {
    id: block.id ?? crypto.randomUUID(),
    date: block.date ?? "weekday",
    startMinutes: block.startMinutes ?? 0,
    endMinutes: block.endMinutes ?? 0,
    type,
    place,
    availableConditions,
    bufferBeforeMinutes: block.bufferBeforeMinutes ?? 0,
    bufferAfterMinutes: block.bufferAfterMinutes ?? 0,
    title: block.meta?.title ?? block.title,
  };
};

const mapLegacyTask = (task: any): Task => ({
  ...task,
  allowedPlaces: task.allowedPlaces && task.allowedPlaces.length ? task.allowedPlaces : defaultPlaces,
  requiredConditions: task.requiredConditions ?? defaultConditions,
});

export default function Migrate() {
  const migratedRef = useRef(false);

  useEffect(() => {
    if (migratedRef.current) return;
    migratedRef.current = true;

    try {
      const tasks = storage.loadTasks([]);
      const blocks = storage.loadTimeBlocks([]);
      const blockTemplates = storage.loadBlockTemplates([]);

      const migratedTasks = tasks.map(mapLegacyTask);
      const migratedBlocks = blocks.map(mapLegacyBlock);
      const migratedTemplates = blockTemplates.map((tpl) => ({
        ...tpl,
        blocks: tpl.blocks.map(mapLegacyBlock),
      }));

      storage.saveTasks(migratedTasks);
      storage.saveTimeBlocks(migratedBlocks);
      storage.saveBlockTemplates(migratedTemplates);
    } catch {
      // 変換失敗時もアプリ継続
    }
  }, []);

  return null;
}
