// Retry a download a couple of times before giving up, so one dropped request
// on a slow school or mobile connection does not stop the whole game.
// 3 attempts in all: waits 0.8 s, then 2 s between them. If the last one
// fails too, the recipe card shows a "Try again" button (ui.showTutorial).
const DELAYS = [800, 2000];

export async function withRetry(load, label = '') {
  for (let attempt = 0; ; attempt++) {
    try {
      return await load();
    } catch (err) {
      if (attempt >= DELAYS.length) throw err;
      console.warn(`[VK] retrying ${label} (${attempt + 1}/${DELAYS.length})`, err?.message || err);
      await new Promise((r) => setTimeout(r, DELAYS[attempt]));
    }
  }
}
