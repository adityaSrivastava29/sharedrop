import { useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
type DataConnection = ReturnType<Peer['connect']>;
import { useTransferStore } from '../store/useTransferStore';

const CHUNK_SIZE = 16384; // 16KB - safe for iOS Safari
const MAX_BUFFERED = 262144; // 256KB
const LOW_THRESHOLD = 65536; // 64KB

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

interface UseWebRTCOptions {
  role: 'sender' | 'receiver';
  roomId: string;
}

export function useWebRTC({ role, roomId }: UseWebRTCOptions) {
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const cleanedUpRef = useRef(false);

  const store = useTransferStore;

  const acquireWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch {
        // Non-critical - ignore
      }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release();
    wakeLockRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    if (cleanedUpRef.current) return;
    cleanedUpRef.current = true;
    releaseWakeLock();
    connRef.current?.close();
    peerRef.current?.destroy();
    connRef.current = null;
    peerRef.current = null;
  }, [releaseWakeLock]);

  const sendFile = useCallback(
    async (file: File) => {
      const conn = connRef.current;
      if (!conn || !conn.open) return;

      store.getState().setConnectionStatus('transferring');
      await acquireWakeLock();

      // Send metadata as JSON string
      conn.send(
        JSON.stringify({
          type: 'metadata',
          name: file.name,
          size: file.size,
          mimeType: file.type,
        })
      );

      // Send file in chunks with backpressure
      let offset = 0;
      const dc = conn.dataChannel;
      if (dc) {
        dc.bufferedAmountLowThreshold = LOW_THRESHOLD;
      }

      const sendNextChunks = () => {
        while (offset < file.size) {
          if (dc && dc.bufferedAmount > MAX_BUFFERED) {
            dc.onbufferedamountlow = () => {
              dc.onbufferedamountlow = null;
              sendNextChunks();
            };
            return;
          }

          const end = Math.min(offset + CHUNK_SIZE, file.size);
          const slice = file.slice(offset, end);
          offset = end;

          slice.arrayBuffer().then((buf) => {
            conn.send(buf);
            store.getState().updateProgress(offset);

            if (offset >= file.size) {
              conn.send(JSON.stringify({ type: 'end' }));
              store.getState().setConnectionStatus('completed');
              releaseWakeLock();
            }
          });
        }
      };

      sendNextChunks();
    },
    [store, acquireWakeLock, releaseWakeLock]
  );

  const cancelTransfer = useCallback(() => {
    cleanup();
    store.getState().reset();
  }, [cleanup, store]);

  useEffect(() => {
    cleanedUpRef.current = false;

    const setupConnection = (conn: DataConnection) => {
      connRef.current = conn;

      conn.on('open', () => {
        if (role === 'sender') {
          store.getState().setConnectionStatus('connected');
          // Auto-send if file is already selected
          const file = store.getState().file;
          if (file) {
            sendFile(file);
          }
        } else {
          store.getState().setConnectionStatus('connecting');
        }
      });

      conn.on('close', () => {
        const status = store.getState().connectionStatus;
        if (status === 'transferring') {
          store
            .getState()
            .setConnectionStatus(
              'error',
              'Transfer interrupted. Connection was lost.'
            );
        } else if (status !== 'completed') {
          store
            .getState()
            .setConnectionStatus('error', 'The other device disconnected.');
        }
      });

      conn.on('error', (err) => {
        store
          .getState()
          .setConnectionStatus('error', err.message || 'Connection error.');
      });

      if (role === 'receiver') {
        const chunks: ArrayBuffer[] = [];

        conn.on('data', async (data) => {
          if (typeof data === 'string') {
            const msg = JSON.parse(data);
            if (msg.type === 'metadata') {
              store.getState().setFileMetadata({
                name: msg.name,
                size: msg.size,
                type: msg.mimeType,
              });
              store.getState().setConnectionStatus('transferring');
              await acquireWakeLock();
            } else if (msg.type === 'end') {
              const meta = store.getState().fileMetadata;
              const blob = new Blob(chunks, {
                type: meta?.type || 'application/octet-stream',
              });
              const url = URL.createObjectURL(blob);

              // Trigger download
              const a = document.createElement('a');
              a.href = url;
              a.download = meta?.name || 'download';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);

              store.getState().setConnectionStatus('completed');
              releaseWakeLock();

              setTimeout(() => URL.revokeObjectURL(url), 60000);
            }
          } else {
            // Binary chunk
            const buf =
              data instanceof ArrayBuffer
                ? data
                : (data as Blob).arrayBuffer
                  ? await (data as Blob).arrayBuffer()
                  : data;
            chunks.push(buf as ArrayBuffer);
            const totalReceived = chunks.reduce(
              (sum, c) => sum + c.byteLength,
              0
            );
            store.getState().updateProgress(totalReceived);
          }
        });
      }
    };

    if (role === 'sender') {
      // Sender: register with the room ID as peer ID, wait for receiver
      const peer = new Peer(roomId, {
        config: { iceServers: ICE_SERVERS },
      });
      peerRef.current = peer;

      peer.on('open', () => {
        store.getState().setConnectionStatus('waiting');
      });

      peer.on('connection', (conn) => {
        store.getState().setConnectionStatus('connecting');
        setupConnection(conn);
      });

      peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          store
            .getState()
            .setConnectionStatus(
              'error',
              'Room ID is already in use. Please try again.'
            );
        } else if (err.type === 'network' || err.type === 'server-error') {
          store
            .getState()
            .setConnectionStatus(
              'error',
              'Cannot reach signaling server. Check your connection.'
            );
        } else {
          store
            .getState()
            .setConnectionStatus(
              'error',
              err.message || 'Connection failed.'
            );
        }
      });

      peer.on('disconnected', () => {
        const status = store.getState().connectionStatus;
        if (status !== 'completed' && status !== 'error') {
          // Try to reconnect once
          peer.reconnect();
        }
      });
    } else {
      // Receiver: connect to sender's peer ID
      const peer = new Peer({
        config: { iceServers: ICE_SERVERS },
      });
      peerRef.current = peer;

      peer.on('open', () => {
        store.getState().setConnectionStatus('connecting');
        const conn = peer.connect(roomId, {
          reliable: true,
          serialization: 'none',
        });
        setupConnection(conn);
      });

      peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') {
          store
            .getState()
            .setConnectionStatus(
              'error',
              'Room not found. The sender may have disconnected.'
            );
        } else if (err.type === 'network' || err.type === 'server-error') {
          store
            .getState()
            .setConnectionStatus(
              'error',
              'Cannot reach signaling server. Check your connection.'
            );
        } else {
          store
            .getState()
            .setConnectionStatus(
              'error',
              err.message || 'Connection failed.'
            );
        }
      });
    }

    // Re-acquire wake lock on visibility change
    const handleVisibility = () => {
      if (
        document.visibilityState === 'visible' &&
        store.getState().connectionStatus === 'transferring'
      ) {
        acquireWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      cleanup();
    };
  }, [role, roomId, store, sendFile, acquireWakeLock, releaseWakeLock, cleanup]);

  return { sendFile, cancelTransfer, disconnect: cleanup };
}
