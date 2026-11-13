export const GOLDEN_FRAMES: readonly number[];
export const GOLDEN_SSIM_MIN: number;
export class StillsUsageError extends Error {}
export function splitArgs(argv: readonly string[], valueFlags: readonly string[]): string[];
export interface StillsRequest {
  frames?: string | true;
  shot?: string | true;
  every?: string | true;
  golden?: boolean;
}
export function selectFrames(req: StillsRequest, shots: readonly { id: string; from: number; to: number }[], total: number): number[];
export function stillName(frame: number): string;
export function resolveOutDir(root: string, requested?: string | true): string;
export function sheetColumns(n: number, requested?: string | true): number;
