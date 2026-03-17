import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Loader,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Download,
} from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { QRScanner } from '../components/QRScanner';
import { ProgressBar } from '../components/ProgressBar';
import { useTransferStore } from '../store/useTransferStore';
import { useWebRTC } from '../hooks/useWebRTC';

export function ReceivePage() {
  const { roomId: paramRoomId } = useParams<{ roomId?: string }>();
  const {
    connectionStatus,
    errorMessage,
    fileMetadata,
    setRoomId,
    setRole,
    reset,
  } = useTransferStore();

  const initialized = useRef(false);
  const [joinedRoomId, setJoinedRoomId] = useState<string | null>(null);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      reset();
      // Auto-join if room ID is in URL
      if (paramRoomId) {
        setRoomId(paramRoomId);
        setRole('receiver');
        setJoinedRoomId(paramRoomId);
      }
    }
  }, [paramRoomId, reset, setRoomId, setRole]);

  const handleScan = (scannedRoomId: string) => {
    setRoomId(scannedRoomId);
    setRole('receiver');
    setJoinedRoomId(scannedRoomId);
  };

  const shouldConnect = joinedRoomId && connectionStatus !== 'idle';

  return (
    <Layout showBack title="Receive Files">
      <div className="max-w-xl mx-auto animate-fade-in space-y-6">
        {!joinedRoomId && connectionStatus === 'idle' && (
          <div className="glass rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-surface-100 text-center">
              Scan sender's QR code
            </h2>
            <QRScanner onScan={handleScan} />
          </div>
        )}

        {shouldConnect && joinedRoomId && (
          <ReceiverConnection roomId={joinedRoomId} />
        )}

        {connectionStatus === 'connecting' && (
          <div className="glass rounded-2xl p-8 text-center space-y-3">
            <Loader className="w-8 h-8 text-primary-400 spinner mx-auto" />
            <p className="text-surface-200">Connecting to sender...</p>
          </div>
        )}

        {(connectionStatus === 'transferring' ||
          connectionStatus === 'connected') && (
          <div className="glass rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-surface-100 text-center">
              Receiving file...
            </h2>
            <ProgressBar />
          </div>
        )}

        {connectionStatus === 'completed' && (
          <div className="glass rounded-2xl p-8 text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-success-400 mx-auto" />
            <h2 className="text-xl font-bold text-surface-50">
              File received!
            </h2>
            {fileMetadata && (
              <p className="text-surface-400">
                {fileMetadata.name} downloaded successfully
              </p>
            )}
            <p className="text-surface-500 text-sm">
              Check your downloads folder
            </p>
            <button
              onClick={() => {
                initialized.current = false;
                setJoinedRoomId(null);
                reset();
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-primary text-white font-semibold mx-auto"
            >
              <Download className="w-4 h-4" />
              Receive another file
            </button>
          </div>
        )}

        {connectionStatus === 'error' && (
          <div className="glass rounded-2xl p-8 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-error-400 mx-auto" />
            <p className="text-error-400">{errorMessage}</p>
            <button
              onClick={() => {
                initialized.current = false;
                setJoinedRoomId(null);
                reset();
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl glass hover:bg-surface-700/50 transition-colors mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}

function ReceiverConnection({ roomId }: { roomId: string }) {
  useWebRTC({ role: 'receiver', roomId });
  return null;
}
