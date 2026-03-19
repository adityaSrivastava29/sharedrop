import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Keyboard } from 'lucide-react';

interface QRScannerProps {
  onScan: (roomId: string) => void;
  onError?: (error: string) => void;
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  onScanRef.current = onScan;
  onErrorRef.current = onError;

  const [mode, setMode] = useState<'camera' | 'manual'>('manual');
  const [manualId, setManualId] = useState('');
  const [cameraError, setCameraError] = useState(false);

  const extractRoomId = useCallback((text: string): string => {
    try {
      const url = new URL(text);
      const parts = url.pathname.split('/');
      const receiveIdx = parts.indexOf('receive');
      if (receiveIdx !== -1 && parts[receiveIdx + 1]) {
        return parts[receiveIdx + 1];
      }
    } catch {
      // Not a URL
    }
    return text;
  }, []);

  useEffect(() => {
    if (mode !== 'camera') return;

    let mounted = true;
    const scannerId = 'qr-reader';

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (!mounted) return;
            const roomId = extractRoomId(decodedText);
            onScanRef.current(roomId);
            scanner.stop().catch(() => {});
          },
          () => {
            // Ignore scan failures (no QR found in frame)
          }
        );
      } catch {
        if (mounted) {
          setCameraError(true);
          setMode('manual');
          onErrorRef.current?.('Camera access denied. Please enter the room ID manually.');
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      scannerRef.current?.stop().catch(() => {});
      scannerRef.current = null;
    };
  }, [mode, extractRoomId]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = manualId.trim();
    if (!trimmed) return;
    onScan(extractRoomId(trimmed));
  };

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-2 justify-center">
        <button
          onClick={() => !cameraError && setMode('camera')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
            mode === 'camera'
              ? 'bg-primary-500/20 text-primary-400'
              : 'glass text-surface-400 hover:text-surface-200'
          } ${cameraError ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={cameraError}
        >
          <Camera className="w-4 h-4" />
          Scan QR
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
            mode === 'manual'
              ? 'bg-primary-500/20 text-primary-400'
              : 'glass text-surface-400 hover:text-surface-200'
          }`}
        >
          <Keyboard className="w-4 h-4" />
          Enter ID
        </button>
      </div>

      {mode === 'camera' ? (
        <div
          id="qr-reader"
          className="rounded-xl overflow-hidden mx-auto"
          style={{ maxWidth: 300 }}
        />
      ) : (
        <form onSubmit={handleManualSubmit} className="space-y-3">
          <input
            type="text"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            placeholder="Paste room ID or link..."
            className="w-full px-4 py-3 rounded-xl glass text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            type="submit"
            disabled={!manualId.trim()}
            className="w-full py-3 rounded-xl gradient-primary text-white font-semibold disabled:opacity-50 transition-opacity"
          >
            Join Room
          </button>
        </form>
      )}
    </div>
  );
}
