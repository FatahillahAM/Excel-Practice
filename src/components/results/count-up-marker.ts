/**
 * One-shot marker for the Score Badge count-up (3.7). The exam screen sets
 * it right before it moves to Results on the client, so the count starts
 * before the score was ever painted. A hard load of Results (server HTML
 * already showing the final score) finds no marker and skips the count, so
 * the score never drops from its final value to 0.
 */
const KEY = "excel-practice.results-count-up";

/** Called by the exam screen with the Results path it is about to open. */
export function markResultsCountUp(path: string): void {
  try {
    window.sessionStorage.setItem(KEY, path);
  } catch {
    // Storage blocked: Results shows the final score at once.
  }
}

/** Reads and clears the marker; `true` only when it names the page now open. */
export function takeResultsCountUp(): boolean {
  try {
    const path = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return path !== null && path === window.location.pathname;
  } catch {
    return false;
  }
}
