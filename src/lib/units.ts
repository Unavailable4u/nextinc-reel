// 1 unit = 1 centimetre, Y up, the desk top is y = 0 (guide 02, "World units and coordinates").

export const CM = 1;
export const MM = 0.1;
export const INCH = 2.54;

export const deg = (d: number): number => (d * Math.PI) / 180;
export const toDeg = (r: number): number => (r * 180) / Math.PI;
export const mm = (v: number): number => v * MM;
export const inch = (v: number): number => v * INCH;

/** A trade hardcover: 6 x 9 in. The book is 15.2 x 22.9 cm in code, as in life. */
export const BOOK_TRIM = { w: 15.2, h: 22.9 } as const;
