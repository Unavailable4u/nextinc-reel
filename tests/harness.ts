export type Case = { name: string; fn: () => void | Promise<void> };
export const cases: Case[] = [];
export const test = (name: string, fn: () => void | Promise<void>): void => {
  cases.push({ name, fn });
};
export function eq<T>(a: T, b: T, msg = ""): void {
  if (a !== b) throw new Error(`${msg} expected ${String(b)}, got ${String(a)}`);
}
export function near(a: number, b: number, tol: number, msg = ""): void {
  if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg} expected ${b} +- ${tol}, got ${a}`);
}
export function truthy(v: unknown, msg = "expected truthy"): void {
  if (!v) throw new Error(msg);
}
export function throws(fn: () => unknown, contains: string, msg = ""): void {
  try {
    fn();
  } catch (e) {
    const m = (e as Error).message;
    if (!m.includes(contains)) throw new Error(`${msg} error message "${m}" does not contain "${contains}"`);
    return;
  }
  throw new Error(`${msg} expected an error containing "${contains}", but nothing was thrown`);
}
