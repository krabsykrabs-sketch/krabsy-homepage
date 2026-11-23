// Retry a download a few times before giving up, so one dropped request on a weak
// school or mobile connection does not stop the whole game. Waits 0.6 s, then 1.5 s,
// then 3 s between attempts (4 attempts in all).
const DELAYS = [600, 1500, 3000];

export async function withRetry(load, label = '') {
  for (let attempt = 0; ; attempt++) {
    try {
      return await load();
    } catch (err) {
      if (attempt >= DELAYS.length) throw err;
      console.warn(`Retrying ${label} (${attempt + 1}/${DELAYS.length})`, err?.message || err);
      await new Promise((r) => setTimeout(r, DELAYS[attempt]));
    }
  }
}
