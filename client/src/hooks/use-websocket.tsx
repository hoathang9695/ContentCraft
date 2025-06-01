
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface BadgeCounts {
  realUsers?: number;
  pages?: number;
  groups?: number;
}

export function useWebSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [badgeCounts, setBadgeCounts] = useState<BadgeCounts>({});
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Kết nối đến WebSocket server
    const newSocket = io(window.location.origin, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    // Lắng nghe badge updates
    newSocket.on('badge-update', (data: BadgeCounts) => {
      console.log('Received badge update:', data);
      setBadgeCounts(data);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
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
    isConnected
  };
}
