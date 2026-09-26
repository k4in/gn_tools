import { useEffect, useState } from "react";

/**
 * Aktuelle Uhrzeit für Planer und Scan-Auswertung. Angezeigt werden nur
 * Minuten, aktualisiert wird trotzdem sekündlich, damit Minuten- und
 * Tickwechsel ohne Verzögerung erscheinen.
 */
export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
