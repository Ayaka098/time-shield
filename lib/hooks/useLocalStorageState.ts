import { useEffect, useState } from "react";

// localStorageと同期する薄いカスタムフック。初期描画はdefaultValueで固定し、
// マウント後にブラウザの値を反映する。
export function useLocalStorageState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Hydration完了を示すフラグ。ここでのみ同期的に立てる。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsHydrated(true);
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    try {
      setValue(JSON.parse(raw) as T);
    } catch {
      // パースに失敗した場合は既存の値を維持
    }
  }, [key]);

  useEffect(() => {
    if (!isHydrated) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 保存に失敗した場合もアプリを止めない
    }
  }, [isHydrated, key, value]);

  return [value, setValue, isHydrated] as const;
}
