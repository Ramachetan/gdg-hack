export function shortId(prefix = ""): string {
  const r = Math.random().toString(36).slice(2, 10);
  return prefix ? `${prefix}-${r}` : r;
}

export const sessionId = shortId("demo-session");
export const userId = "demo-user";
