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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, callback: (...args: any[]) => void): void;
  render(): void;
  abort(): void;
};

export default GIF;
