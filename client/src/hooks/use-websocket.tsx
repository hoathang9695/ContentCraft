
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface BadgeCounts {
  realUsers?: number;
  pages?: number;
  groups?: number;
  supportRequests?: number;
  feedbackRequests?: number;
  totalRequests?: number;
}

export function useWebSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [badgeCounts, setBadgeCounts] = useState<BadgeCounts>({});
  const [isConnected, setIsConnected] = useState(false);
  const [hasInitialData, setHasInitialData] = useState(false);

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
    newSocket.on('badge-update', (data: BadgeCounts) => {
      console.log('Received badge update via WebSocket:', data);
      setBadgeCounts(data);
      setHasInitialData(true);
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
    badgeCounts,
    isConnected,
    hasInitialData
  };
}
