import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useTransferStore } from '../store/useTransferStore';

const CHUNK_SIZE = 16384; // 16KB - safe for iOS Safari
const MAX_BUFFERED = 262144; // 256KB
const LOW_THRESHOLD = 65536; // 64KB

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Add TURN server here for symmetric NAT traversal:
    // { urls: 'turn:your-turn-server.com', username: '...', credential: '...' },
  ],
};

const SIGNALING_URL =
  import.meta.env.VITE_SIGNALING_URL || 'http://localhost:3001';

interface UseWebRTCOptions {
  role: 'sender' | 'receiver';
  roomId: string;
}

export function useWebRTC({ role, roomId }: UseWebRTCOptions) {
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const cleanedUpRef = useRef(false);

  const store = useTransferStore;

  const acquireWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch {
        // Non-critical - ignore (unsupported on iOS Safari)
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
    dcRef.current?.close();
    pcRef.current?.close();
    socketRef.current?.disconnect();
    dcRef.current = null;
    pcRef.current = null;
    socketRef.current = null;
  }, [releaseWakeLock]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('signal:ice-candidate', {
          roomId,
          candidate: event.candidate,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        store.getState().setConnectionStatus(
          'error',
          'Could not establish connection. Devices may be on incompatible networks.'
        );
      }
    };

    pcRef.current = pc;
    return pc;
  }, [roomId, store]);

  const sendFile = useCallback(
    async (file: File) => {
      const dc = dcRef.current;
      if (!dc || dc.readyState !== 'open') return;

      store.getState().setConnectionStatus('transferring');
      await acquireWakeLock();

      // Send metadata
      dc.send(
        JSON.stringify({
          type: 'metadata',
          name: file.name,
          size: file.size,
          mimeType: file.type,
        })
      );

      // Send file in chunks with backpressure
      let offset = 0;
      dc.bufferedAmountLowThreshold = LOW_THRESHOLD;

      const sendNextChunks = () => {
        while (offset < file.size) {
          if (dc.bufferedAmount > MAX_BUFFERED) {
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
            dc.send(buf);
            store.getState().updateProgress(offset);

            if (offset >= file.size) {
              dc.send(JSON.stringify({ type: 'end' }));
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
    const socket = io(SIGNALING_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect_error', () => {
      store
        .getState()
        .setConnectionStatus(
          'error',
          'Cannot reach signaling server. Check your connection.'
        );
    });

    socket.on('error', ({ message }: { message: string }) => {
      store.getState().setConnectionStatus('error', message);
    });

    socket.on('peer:left', () => {
      const status = store.getState().connectionStatus;
      if (status !== 'completed') {
        store
          .getState()
          .setConnectionStatus('error', 'The other device disconnected.');
      }
    });

    if (role === 'sender') {
      // Sender flow
      socket.emit('room:create', { roomId });
      store.getState().setConnectionStatus('waiting');

      socket.on('peer:joined', async () => {
        store.getState().setConnectionStatus('connecting');

        const pc = createPeerConnection();
        const dc = pc.createDataChannel('file-transfer', { ordered: true });
        dcRef.current = dc;

        dc.binaryType = 'arraybuffer';

        dc.onopen = () => {
          store.getState().setConnectionStatus('connected');
          // Auto-send if file is already selected
          const file = store.getState().file;
          if (file) {
            sendFile(file);
          }
        };

        dc.onclose = () => {
          const status = store.getState().connectionStatus;
          if (status === 'transferring') {
            store
              .getState()
              .setConnectionStatus(
                'error',
                'Transfer interrupted. Connection was lost.'
              );
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('signal:offer', { roomId, offer });
      });

      socket.on(
        'signal:answer',
        async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
          await pcRef.current?.setRemoteDescription(answer);
        }
      );
    } else {
      // Receiver flow
      socket.emit('room:join', { roomId });
      store.getState().setConnectionStatus('connecting');

      socket.on(
        'signal:offer',
        async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
          const pc = createPeerConnection();

          pc.ondatachannel = (event) => {
            const dc = event.channel;
            dcRef.current = dc;
            dc.binaryType = 'arraybuffer';

            const chunks: ArrayBuffer[] = [];

            dc.onmessage = async (e) => {
              if (typeof e.data === 'string') {
                const msg = JSON.parse(e.data);
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

                  // Keep URL for manual download button
                  store.getState().setConnectionStatus('completed');
                  releaseWakeLock();

                  // Clean up URL after a delay
                  setTimeout(() => URL.revokeObjectURL(url), 60000);
                }
              } else {
                // Binary chunk
                chunks.push(e.data as ArrayBuffer);
                const totalReceived = chunks.reduce(
                  (sum, c) => sum + c.byteLength,
                  0
                );
                store.getState().updateProgress(totalReceived);
              }
            };

            dc.onclose = () => {
              const status = store.getState().connectionStatus;
              if (status === 'transferring') {
                store
                  .getState()
                  .setConnectionStatus(
                    'error',
                    'Transfer interrupted. Connection was lost.'
                  );
              }
            };
          };

          await pc.setRemoteDescription(offer);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal:answer', { roomId, answer });
        }
      );
    }

    // ICE candidate handling (both roles)
    socket.on(
      'signal:ice-candidate',
      ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        pcRef.current?.addIceCandidate(candidate);
      }
    );

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
  }, [
    role,
    roomId,
    store,
    createPeerConnection,
    sendFile,
    acquireWakeLock,
    releaseWakeLock,
    cleanup,
  ]);

  return { sendFile, cancelTransfer, disconnect: cleanup };
}
