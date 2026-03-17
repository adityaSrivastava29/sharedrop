import { useTransferStore } from '../store/useTransferStore';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatSpeed(bps: number): string {
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '';
  if (seconds < 60) return `${Math.ceil(seconds)}s remaining`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${mins}m ${secs}s remaining`;
}

export function ProgressBar() {
  const { progress, fileMetadata, connectionStatus } = useTransferStore();

  return (
    <div className="space-y-3">
      {fileMetadata && (
        <div className="text-center">
          <p className="text-surface-100 font-semibold truncate">
            {fileMetadata.name}
          </p>
          <p className="text-surface-400 text-sm">
            {formatSize(progress.bytesTransferred)} / {formatSize(progress.totalBytes)}
          </p>
        </div>
      )}

      <div className="progress-track h-3">
        <div
          className="progress-fill"
          style={{ width: `${progress.percentage}%` }}
        />
      </div>

      <div className="flex justify-between text-sm text-surface-400">
        <span>{Math.round(progress.percentage)}%</span>
        {connectionStatus === 'transferring' && progress.speedBps > 0 && (
          <span>{formatSpeed(progress.speedBps)}</span>
        )}
        {connectionStatus === 'transferring' && (
          <span>{formatEta(progress.etaSeconds)}</span>
        )}
        {connectionStatus === 'completed' && (
          <span className="text-success-400">Complete!</span>
        )}
      </div>
    </div>
  );
}
