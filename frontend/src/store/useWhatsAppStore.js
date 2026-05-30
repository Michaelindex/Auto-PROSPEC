import { create } from 'zustand'

export const useWhatsAppStore = create((set) => ({
  connected: false,
  phone: null,
  qr: null,
  connecting: true,

  setStatus: ({ connected, phone, qr }) => set({ connected, phone: phone || null, qr: qr || null, connecting: false }),
  setQR: (qr) => set({ qr, connected: false, connecting: false }),
  setConnected: (phone) => set({ connected: true, phone, qr: null, connecting: false }),
  setDisconnected: () => set({ connected: false, phone: null, connecting: false }),
  setConnecting: () => set({ connecting: true })
}))
