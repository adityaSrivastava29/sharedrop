import { create } from 'zustand';

export type ConnectionStatus =
  | 'idle'
  | 'waiting'
  | 'connecting'
  | 'connected'
  | 'transferring'
  | 'completed'
  | 'error';

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
}

export interface TransferProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  speedBps: number;
  etaSeconds: number;
}

interface SpeedSample {
  timestamp: number;
  bytes: number;
}

const SPEED_WINDOW_MS = 5000;
let speedSamples: SpeedSample[] = [];

function calculateSpeed(
  bytesTransferred: number,
  totalBytes: number
): { speedBps: number; etaSeconds: number } {
  const now = Date.now();
  speedSamples.push({ timestamp: now, bytes: bytesTransferred });
  speedSamples = speedSamples.filter((s) => now - s.timestamp <= SPEED_WINDOW_MS);

  if (speedSamples.length < 2) {
    return { speedBps: 0, etaSeconds: Infinity };
  }

  const oldest = speedSamples[0];
  const bytesInWindow = bytesTransferred - oldest.bytes;
  const durationSec = (now - oldest.timestamp) / 1000;
  const speedBps = durationSec > 0 ? bytesInWindow / durationSec : 0;
  const remaining = totalBytes - bytesTransferred;
  const etaSeconds = speedBps > 0 ? remaining / speedBps : Infinity;

  return { speedBps, etaSeconds };
}

interface TransferStore {
  roomId: string | null;
  role: 'sender' | 'receiver' | null;
  connectionStatus: ConnectionStatus;
  errorMessage: string | null;
  file: File | null;
  fileMetadata: FileMetadata | null;
  progress: TransferProgress;

  setRoomId: (id: string) => void;
  setRole: (role: 'sender' | 'receiver') => void;
  setConnectionStatus: (status: ConnectionStatus, error?: string) => void;
  setFile: (file: File) => void;
  setFileMetadata: (meta: FileMetadata) => void;
  updateProgress: (bytesTransferred: number) => void;
  reset: () => void;
}

const initialProgress: TransferProgress = {
  bytesTransferred: 0,
  totalBytes: 0,
  percentage: 0,
  speedBps: 0,
  etaSeconds: 0,
};

export const useTransferStore = create<TransferStore>((set, get) => ({
  roomId: null,
  role: null,
  connectionStatus: 'idle',
  errorMessage: null,
  file: null,
  fileMetadata: null,
  progress: { ...initialProgress },

  setRoomId: (id) => set({ roomId: id }),
  setRole: (role) => set({ role }),
  setConnectionStatus: (status, error) =>
    set({ connectionStatus: status, errorMessage: error ?? null }),
  setFile: (file) =>
    set({
      file,
      fileMetadata: { name: file.name, size: file.size, type: file.type },
      progress: { ...initialProgress, totalBytes: file.size },
    }),
  setFileMetadata: (meta) =>
    set({
      fileMetadata: meta,
      progress: { ...initialProgress, totalBytes: meta.size },
    }),
  updateProgress: (bytesTransferred) => {
    const { progress } = get();
    const { speedBps, etaSeconds } = calculateSpeed(
      bytesTransferred,
      progress.totalBytes
    );
    set({
      progress: {
        bytesTransferred,
        totalBytes: progress.totalBytes,
        percentage:
          progress.totalBytes > 0
            ? Math.min(100, (bytesTransferred / progress.totalBytes) * 100)
            : 0,
        speedBps,
        etaSeconds,
      },
    });
  },
  reset: () => {
    speedSamples = [];
    set({
      roomId: null,
      role: null,
      connectionStatus: 'idle',
      errorMessage: null,
      file: null,
      fileMetadata: null,
      progress: { ...initialProgress },
    });
  },
}));
