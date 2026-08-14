import { Job } from "../types/deliveryLog";

/**
 * Calculates time duration string (e.g. "1h 30m" or "45m") between start and stop times (HH:MM).
 * Supports overnight shifts automatically.
 */
export function calcTotal(start: string, stop: string): string {
  if (!start || !stop) return "";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = stop.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // Overnight shift compensation rule
  if (mins === 0) return "0m";
  const hours = Math.floor(mins / 60);
  const remainderMins = mins % 60;
  if (hours === 0) return `${remainderMins}m`;
  if (remainderMins === 0) return `${hours}h`;
  return `${hours}h ${remainderMins}m`;
}

/**
 * Parses minutes from a total duration string like "1h 30m", "45m", "1.5", etc.
 */
export function parseTotalMinutes(totalStr: string): number {
  if (!totalStr) return 0;
  const hMatch = totalStr.match(/(\d+)\s*h/i);
  const mMatch = totalStr.match(/(\d+)\s*m/i);
  if (hMatch || mMatch) {
    const hours = hMatch ? Number(hMatch[1]) : 0;
    const mins = mMatch ? Number(mMatch[1]) : 0;
    return hours * 60 + mins;
  }
  const num = parseFloat(totalStr);
  if (!isNaN(num) && num > 0) {
    if (num > 15) return Math.round(num);
    return Math.round(num * 60);
  }
  return 0;
}

/**
 * Sums up total drive times across all jobs in a delivery log.
 */
export function sumTimes(jobs: Job[]): string {
  let totalMins = 0;
  jobs.forEach((j) => {
    const displayTotal =
      j.totalTime !== undefined && j.totalTime !== ""
        ? j.totalTime
        : calcTotal(j.startTime, j.stopTime);
    if (displayTotal) {
      totalMins += parseTotalMinutes(displayTotal);
    }
  });
  if (totalMins <= 0) return "—";
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Formats ISO date string (YYYY-MM-DD) into user-friendly date format.
 */
export function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
