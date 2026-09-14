/** Attach server clock fields so clients sync animations to the same round. */

export function withRealtimeSync(state, extra = {}) {
  const now = Date.now();
  return {
    ...state,
    ...extra,
    serverTime: now,
  };
}
