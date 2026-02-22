import { create } from 'zustand';
import { settingsAPI } from '@/lib/api';

interface Settings {
  id: string;
  companyName: string;
  companyLogo: string | null;
  dieselPrice: number;
}

interface SettingsStore {
  settings: Settings | null;
  loading: boolean;
  fetchSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: null,
  loading: false,
  
  fetchSettings: async () => {
    try {
      set({ loading: true });
      const data = await settingsAPI.get();
      set({ settings: data, loading: false });
    } catch (error) {
      console.error('Error fetching settings:', error);
      set({ loading: false });
    }
  },
}));
