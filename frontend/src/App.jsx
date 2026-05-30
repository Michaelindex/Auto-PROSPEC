import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Campaigns } from './pages/Campaigns'
import { NewCampaign } from './pages/NewCampaign'
import { CampaignDetail } from './pages/CampaignDetail'
import { Contacts } from './pages/Contacts'
import { Settings } from './pages/Settings'
import { getWhatsAppStatus, getSettings } from './services/api'
import socket from './services/socket'
import { useWhatsAppStore } from './store/useWhatsAppStore'
import { useSettingsStore } from './store/useSettingsStore'

function AppBootstrap() {
  const { setStatus, setQR, setConnected, setDisconnected } = useWhatsAppStore()
  const { setSettings } = useSettingsStore()

  useEffect(() => {
    // Load initial state
    getWhatsAppStatus().then(res => {
      setStatus(res.data)
    }).catch(() => setDisconnected())

    getSettings().then(res => setSettings(res.data)).catch(() => {})

    // Socket events
    socket.on('whatsapp:qr', ({ qr }) => setQR(qr))
    socket.on('whatsapp:connected', ({ phone }) => setConnected(phone))
    socket.on('whatsapp:disconnected', () => setDisconnected())

    return () => {
      socket.off('whatsapp:qr')
      socket.off('whatsapp:connected')
      socket.off('whatsapp:disconnected')
    }
  }, [])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AppBootstrap />
      <Toaster position="top-right" richColors />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/new" element={<NewCampaign />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
