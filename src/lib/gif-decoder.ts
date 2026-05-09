import { GifReader } from 'omggif';

export interface GifFrameData {
  imageData: ImageData;
  delay: number; // milliseconds per frame
}

export interface GifData {
  frames: GifFrameData[];
  width: number;
  height: number;
}

/**
 * Parse a GIF file (as ArrayBuffer) into individual RGBA frames.
 * Properly handles GIF disposal methods to avoid black flash artifacts.
 */
export function decodeGif(buffer: ArrayBuffer): GifData {
  const bytes = new Uint8Array(buffer);
  const reader = new GifReader(bytes);
  const numFrames = reader.numFrames();
  const width = reader.width;
  const height = reader.height;

  // Use a persistent canvas to correctly compose frames according to disposal methods
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  // Temporary canvas for decoding individual frames
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d')!;

  const frames: GifFrameData[] = [];

  for (let i = 0; i < numFrames; i++) {
    const frameInfo = reader.frameInfo(i);

    // Decode frame into a temporary buffer
    const rgba = new Uint8ClampedArray(width * height * 4);
    reader.decodeAndBlitFrameRGBA(i, rgba);

    // Save current canvas state before drawing (for disposal=3: restore to previous)
    let savedImageData: ImageData | null = null;
    if (frameInfo.disposal === 3) {
      savedImageData = ctx.getImageData(0, 0, width, height);
    }

    // Create ImageData from decoded frame and draw it to the temp canvas
    const frameImageData = new ImageData(rgba, width, height);
    tempCtx.clearRect(0, 0, width, height);
    tempCtx.putImageData(frameImageData, 0, 0);

    // Composite the frame onto the main canvas at its position
    // omggif's decodeAndBlitFrameRGBA already places pixels at correct (x,y),
    // but we draw the full canvas-sized buffer to handle it correctly
    ctx.drawImage(tempCanvas, 0, 0);

    // Capture the complete composed frame
    const composedImageData = ctx.getImageData(0, 0, width, height);
    // GIF delay is in centiseconds (1/100s), convert to ms
    // Minimum delay of 20ms to avoid crazy-fast frames (browsers use 100ms for delay=0)
    const delay = Math.max(frameInfo.delay * 10, 20);
    frames.push({ imageData: composedImageData, delay });

    // Apply disposal method for next frame
    switch (frameInfo.disposal) {
      case 0: // No disposal specified - leave as is (same as 1)
      case 1: // Do not dispose - leave frame in place
        // Nothing to do, canvas keeps current state
        break;
      case 2: // Restore to background color
        ctx.clearRect(frameInfo.x, frameInfo.y, frameInfo.width, frameInfo.height);
        break;
      case 3: // Restore to previous
        if (savedImageData) {
          ctx.putImageData(savedImageData, 0, 0);
        }
        break;
    }
  }

  return { frames, width, height };
}
