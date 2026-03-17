import { useCallback, useEffect, useRef } from 'react';
import { Loader, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { FileSelector } from '../components/FileSelector';
import { QRGenerator } from '../components/QRGenerator';
import { ProgressBar } from '../components/ProgressBar';
import { useTransferStore } from '../store/useTransferStore';
import { useWebRTC } from '../hooks/useWebRTC';

export function SendPage() {
  const {
    roomId,
    connectionStatus,
    errorMessage,
    file,
    setRoomId,
    setRole,
    setFile,
    setConnectionStatus,
    reset,
  } = useTransferStore();

  const initialized = useRef(false);

  // Generate room ID on mount
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      reset();
    }
  }, [reset]);

  const handleFileSelected = useCallback(
    (selectedFile: File) => {
      const id = crypto.randomUUID();
      setRoomId(id);
      setRole('sender');
      setFile(selectedFile);
      setConnectionStatus('waiting');
    },
    [setRoomId, setRole, setFile, setConnectionStatus]
  );

  // Only activate WebRTC when we have a room ID and are in sender role
  const shouldConnect = roomId && connectionStatus !== 'idle';

  return (
    <Layout showBack title="Send Files">
      <div className="max-w-xl mx-auto animate-fade-in space-y-6">
        {connectionStatus === 'idle' && (
          <div className="glass rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-surface-100 mb-4 text-center">
              Select a file to share
            </h2>
            <FileSelector onFileSelected={handleFileSelected} />
          </div>
        )}

        {shouldConnect && roomId && <SenderConnection roomId={roomId} />}

        {connectionStatus === 'waiting' && roomId && (
          <div className="glass rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-surface-100 text-center">
              Scan to receive
            </h2>
            <QRGenerator
              value={`${window.location.origin}${import.meta.env.BASE_URL}receive/${roomId}`}
            />
            {file && (
              <p className="text-surface-400 text-sm text-center">
                Waiting for receiver to scan...
              </p>
            )}
            <div className="flex justify-center">
              <div className="w-2 h-2 rounded-full bg-primary-400 animate-pulse-soft" />
            </div>
          </div>
        )}

        {connectionStatus === 'connecting' && (
          <div className="glass rounded-2xl p-8 text-center space-y-3">
            <Loader className="w-8 h-8 text-primary-400 spinner mx-auto" />
            <p className="text-surface-200">Establishing connection...</p>
          </div>
        )}

        {(connectionStatus === 'transferring' ||
          connectionStatus === 'connected') && (
          <div className="glass rounded-2xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-surface-100 text-center">
              Sending file...
            </h2>
            <ProgressBar />
          </div>
        )}

        {connectionStatus === 'completed' && (
          <div className="glass rounded-2xl p-8 text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-success-400 mx-auto" />
            <h2 className="text-xl font-bold text-surface-50">
              File sent successfully!
            </h2>
            <button
              onClick={() => {
                initialized.current = false;
                reset();
              }}
              className="px-6 py-3 rounded-xl gradient-primary text-white font-semibold"
            >
              Send another file
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

function SenderConnection({ roomId }: { roomId: string }) {
  useWebRTC({ role: 'sender', roomId });
  return null;
}
