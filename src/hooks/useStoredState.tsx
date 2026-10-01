import { useEffect, useState } from "react";

/** State aus dem localStorage, der bei jeder Änderung zurückgeschrieben wird. */
export function useStoredState<T>(key: string, load: (raw: unknown) => T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return load(raw ? JSON.parse(raw) : null);
    } catch {
      return load(null);
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error("Konnte Scans nicht speichern", err);
    }
  }, [key, value]);

  return [value, setValue] as const;
}
