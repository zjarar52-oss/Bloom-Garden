
import { Moment, GardenState } from './types';

const API_URL = 'http://localhost:3001/api';
// BroadcastChannel 用于在服务器未启动时，依然能实现多标签页实时同步
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('cloud_sync') : null;

export const dbClient = {
  saveMoments: async (moments: Moment[]) => {
    try {
      await fetch(`${API_URL}/moments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(moments)
      });
    } catch (e) {
      // 容灾机制：如果服务器断开，自动降级为本地跨窗口同步
      localStorage.setItem('cloud_moments', JSON.stringify(moments));
      channel?.postMessage({ type: 'MOMENTS', payload: moments });
    }
  },
  
  saveGarden: async (garden: GardenState) => {
    try {
      await fetch(`${API_URL}/garden`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(garden)
      });
    } catch (e) {
      localStorage.setItem('cloud_garden', JSON.stringify(garden));
      channel?.postMessage({ type: 'GARDEN', payload: garden });
    }
  },
  
  setupSync: (onMoments: (m: Moment[]) => void, onGarden: (g: GardenState) => void) => {
    let evtSource: EventSource | null = null;
    let serverConnected = false;

    // 容灾降级加载函数
    const loadFallback = () => {
      const m = localStorage.getItem('cloud_moments');
      if (m) onMoments(JSON.parse(m));
      const g = localStorage.getItem('cloud_garden');
      if (g) onGarden(JSON.parse(g));
      else onGarden({ roses: [], streak: 0, lastCollectionDate: null });
    };

    try {
      // 尝试连接 SSE 实现实时云端推送
      evtSource = new EventSource(`${API_URL}/stream`);
      
      evtSource.onmessage = (e) => {
        serverConnected = true;
        const data = JSON.parse(e.data);
        if (data.type === 'INIT') {
          if (data.payload.moments) onMoments(data.payload.moments);
          if (data.payload.garden?.lastCollectionDate !== undefined) onGarden(data.payload.garden || { roses: [], streak: 0, lastCollectionDate: null });
        } else if (data.type === 'MOMENTS') {
          onMoments(data.payload);
        } else if (data.type === 'GARDEN') {
          onGarden(data.payload);
        }
      };

      evtSource.onerror = () => {
        if (!serverConnected) loadFallback();
      };
    } catch (e) {
      loadFallback();
    }

    // 设置容灾频道的监听
    if (channel) {
      channel.onmessage = (e) => {
        if (e.data.type === 'MOMENTS') onMoments(e.data.payload);
        if (e.data.type === 'GARDEN') onGarden(e.data.payload);
      };
    }

    return () => {
      evtSource?.close();
      channel?.close();
    };
  }
};
