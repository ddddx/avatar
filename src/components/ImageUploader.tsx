import React, { useCallback, useRef } from 'react';
import { decodeGif } from '../lib/gif-decoder';
import type { GifData } from '../lib/gif-decoder';

interface Props {
  onImageLoad: (img: HTMLImageElement) => void;
  onGifLoad: (gifData: GifData) => void;
}

const ImageUploader: React.FC<Props> = ({ onImageLoad, onGifLoad }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;

    if (file.type === 'image/gif') {
      // Parse GIF into frames
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        try {
          const gifData = decodeGif(buffer);
          // Show first frame as preview
          const canvas = document.createElement('canvas');
          canvas.width = gifData.width;
          canvas.height = gifData.height;
          const ctx = canvas.getContext('2d')!;
          ctx.putImageData(gifData.frames[0].imageData, 0, 0);
          setPreview(canvas.toDataURL());
          onGifLoad(gifData);
        } catch (err) {
          console.error('Failed to parse GIF:', err);
          alert('GIF 文件解析失败');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Static image — existing flow
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        setPreview(url);
        const img = new Image();
        img.onload = () => onImageLoad(img);
        img.src = url;
      };
      reader.readAsDataURL(file);
    }
  }, [onImageLoad, onGifLoad]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div
      className={`uploader ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {preview ? (
        <div className="uploader-preview">
          <img src={preview} alt="uploaded" />
          <span className="uploader-hint">点击或拖拽更换图片</span>
        </div>
      ) : (
        <div className="uploader-placeholder">
          <div className="upload-icon">📸</div>
          <p>拖拽图片到这里</p>
          <p className="sub">或点击选择文件 (支持 GIF)</p>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
