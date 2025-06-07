import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface BadgeCounts {
  realUsers?: number;
  pages?: number;
  groups?: number;
  supportRequests?: number;
  feedbackRequests?: number;
  verificationRequests?: number;
  tickRequests?: number;
  totalRequests?: number;
}

export function useWebSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [badgeCounts, setBadgeCounts] = useState<BadgeCounts>({});
  const [hasInitialData, setHasInitialData] = useState(false);

  // Load cached badge counts from localStorage on mount
  useEffect(() => {
    const cached = localStorage.getItem('badgeCounts');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        console.log('Loaded cached badge counts:', parsed);

        // Force reset verification counts if they exist but shouldn't
        if (parsed.verificationRequests && parsed.verificationRequests > 0) {
          console.log('Clearing potentially stale verification count');
          delete parsed.verificationRequests;
          localStorage.setItem('badgeCounts', JSON.stringify(parsed));
        }

        setBadgeCounts(parsed);
        setHasInitialData(true);
      } catch (error) {
        console.error('Error parsing cached badge counts:', error);
        localStorage.removeItem('badgeCounts');
      }
    }
  }, []);

  useEffect(() => {
    // Kết nối đến WebSocket server
    const newSocket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      forceNew: true
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected:', newSocket.id);
      setIsConnected(true);

      // Request initial badge counts khi kết nối
      newSocket.emit('request-badge-counts');
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      // Không reset hasInitialData khi disconnect để giữ badge counts
      // setHasInitialData(false);
    });

    // Lắng nghe badge updates
    newSocket.on('badge-update', (newBadgeCounts: BadgeCounts) => {
        console.log('Received badge update via WebSocket:', newBadgeCounts);

        // Update state immediately
        setBadgeCounts(prev => ({ ...prev, ...newBadgeCounts }));

        // Persist to localStorage for immediate availability on page load
        if (typeof window !== 'undefined') {
          const updatedCounts = { ...badgeCounts, ...newBadgeCounts };
          localStorage.setItem('badgeCounts', JSON.stringify(updatedCounts));
          localStorage.setItem('badgeCountsTimestamp', Date.now().toString());
        }

        // Force re-render by triggering a small state change
        setTimeout(() => {
          setBadgeCounts(current => ({ ...current }));
        }, 50);
      });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
    });

    setSocket(newSocket);

    // Cleanup khi component unmount
    return () => {
      newSocket.close();
    };
  }, []);

  return {
    socket,
    badgeCounts, // Luôn return badgeCounts (đã có localStorage persistence)
    isConnected,
    hasInitialData
  };
}