import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * useWebSocket — Manages persistent WebSocket connections to the OmniSign orchestrator.
 * Handles auto-reconnection, message queuing, and connection state tracking.
 */
export default function useWebSocket(endpoint) {
  const [status, setStatus] = useState('disconnected'); // disconnected | connecting | connected
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const messageQueue = useRef([]);

  const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    const ws = new WebSocket(`${WS_BASE}${endpoint}`);

    ws.onopen = () => {
      setStatus('connected');
      // Flush queued messages
      while (messageQueue.current.length > 0) {
        const msg = messageQueue.current.shift();
        ws.send(JSON.stringify(msg));
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
      } catch {
        setLastMessage({ type: 'raw', data: event.data });
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      // Auto-reconnect after 3 seconds
      reconnectTimer.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = () => {
      setStatus('disconnected');
    };

    wsRef.current = ws;
  }, [endpoint, WS_BASE]);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    if (wsRef.current) {
      wsRef.current.onclose = null; // Prevent auto-reconnect
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      messageQueue.current.push(data);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);

  return { status, lastMessage, connect, disconnect, send };
}
