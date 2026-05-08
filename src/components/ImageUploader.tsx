import React, { useCallback, useRef } from 'react';

interface Props {
  onImageLoad: (img: HTMLImageElement) => void;
}

const ImageUploader: React.FC<Props> = ({ onImageLoad }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setPreview(url);
      const img = new Image();
      img.onload = () => onImageLoad(img);
      img.src = url;
    };
    reader.readAsDataURL(file);
  }, [onImageLoad]);

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
          <p className="sub">或点击选择文件</p>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
