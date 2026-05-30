import { create } from 'zustand'

export const useSettingsStore = create((set) => ({
  settings: null,
  setSettings: (settings) => set({ settings })
}))
