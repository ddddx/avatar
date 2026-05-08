/* eslint-disable @typescript-eslint/no-explicit-any */
// gif.js loaded via script tag in index.html
declare const GIF: new (options?: {
  workers?: number;
  quality?: number;
  width?: number;
  height?: number;
  workerScript?: string;
  repeat?: number;
  background?: string;
  transparent?: number | null;
  debug?: boolean;
  dither?: boolean;
}) => {
  addFrame(image: CanvasRenderingContext2D | HTMLCanvasElement, options?: { delay?: number; copy?: boolean }): void;
  on(event: string, callback: (...args: any[]) => void): void;
  render(): void;
  abort(): void;
};
