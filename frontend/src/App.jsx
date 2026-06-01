import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Campaigns } from './pages/Campaigns'
import { NewCampaign } from './pages/NewCampaign'
import { CampaignDetail } from './pages/CampaignDetail'
import { EditCampaign } from './pages/EditCampaign'
import { Contacts } from './pages/Contacts'
import { Settings } from './pages/Settings'
import { Respostas } from './pages/Respostas'
import { getWhatsAppStatus, getSettings, getChatSummary, markChatRead } from './services/api'
import socket from './services/socket'
import { useWhatsAppStore } from './store/useWhatsAppStore'
import { useSettingsStore } from './store/useSettingsStore'
import { useChatStore } from './store/useChatStore'

function AppBootstrap() {
  const { setStatus, setQR, setConnected, setDisconnected } = useWhatsAppStore()
  const { setSettings } = useSettingsStore()
  const {
    setCampaignsSummary, setTotalUnread,
    appendMessage, updateContactLastMessage, updateContactUnread,
    updateMessageStatus
  } = useChatStore()

  useEffect(() => {
    getWhatsAppStatus().then(res => setStatus(res.data)).catch(() => setDisconnected())
    getSettings().then(res => setSettings(res.data)).catch(() => {})
    getChatSummary().then(res => setCampaignsSummary(res.data.campaigns)).catch(() => {})

    socket.on('whatsapp:qr', ({ qr }) => setQR(qr))
    socket.on('whatsapp:connected', ({ phone }) => setConnected(phone))
    socket.on('whatsapp:disconnected', () => setDisconnected())

    socket.on('chat:new_message', ({ campaignId, contactId, message, unreadCount }) => {
      if (message.direction !== 'in') return
      const key = `${campaignId}-${contactId}`
      const store = useChatStore.getState()
      if (store.messages[key]) {
        appendMessage(key, message)
      }
      updateContactLastMessage(campaignId, contactId, message)
      updateContactUnread(campaignId, contactId, unreadCount)
    })

    socket.on('chat:message_status', ({ messageId, campaignContactId, status, deliveredAt, readAt }) => {
      const store = useChatStore.getState()
      for (const key of Object.keys(store.messages)) {
        const found = store.messages[key]?.find(m => m.id === messageId)
        if (found) {
          updateMessageStatus(key, messageId, { status, deliveredAt, readAt })
          break
        }
      }
    })

    socket.on('chat:unread_updated', ({ totalUnread, campaignId, contactId, unreadCount }) => {
      setTotalUnread(totalUnread)
      if (campaignId && contactId && unreadCount !== undefined) {
        updateContactUnread(campaignId, contactId, unreadCount)
      }
    })

    return () => {
      socket.off('whatsapp:qr')
      socket.off('whatsapp:connected')
      socket.off('whatsapp:disconnected')
      socket.off('chat:new_message')
      socket.off('chat:message_status')
      socket.off('chat:unread_updated')
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
          <Route path="/campaigns/:id/edit" element={<EditCampaign />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/respostas" element={<Respostas />} />
          <Route path="/respostas/:campaignId" element={<Respostas />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
