import { create } from 'zustand';

import { clearMapboxToken } from '@/lib/mapbox-token';
import { getBaseApiUrl, setBaseApiUrl } from '@/lib/storage/app';

interface ServerUrlState {
  url: string;
  setUrl: (url: string) => Promise<void>;
  getUrl: () => Promise<string>;
}

export const useServerUrlStore = create<ServerUrlState>((set) => ({
  url: '',
  setUrl: async (url: string) => {
    await setBaseApiUrl(url);
    // A Mapbox token handed out by the previous server must not carry over to another one.
    clearMapboxToken();
    set({ url });
  },
  getUrl: async () => {
    const url = await getBaseApiUrl();
    set({ url });
    return url;
  },
}));
