import { useRef, useState, useCallback } from 'react';
import { Upload, File as FileIcon } from 'lucide-react';

interface FileSelectorProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function FileSelector({ onFileSelected, disabled }: FileSelectorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      setSelectedFile(file);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      <div
        className={`drop-zone rounded-2xl p-8 text-center cursor-pointer transition-all ${
          dragActive ? 'active' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={!disabled ? handleDrop : (e) => e.preventDefault()}
      >
        {selectedFile ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-primary-500/20 flex items-center justify-center">
              <FileIcon className="w-7 h-7 text-primary-400" />
            </div>
            <div>
              <p className="text-surface-100 font-semibold truncate max-w-[250px]">
                {selectedFile.name}
              </p>
              <p className="text-surface-400 text-sm">
                {formatSize(selectedFile.size)}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-surface-700 flex items-center justify-center">
              <Upload className="w-7 h-7 text-surface-400" />
            </div>
            <div>
              <p className="text-surface-200 font-medium">
                Drop a file here or click to browse
              </p>
              <p className="text-surface-500 text-sm mt-1">
                Any file type, any size
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
