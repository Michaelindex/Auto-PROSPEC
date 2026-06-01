import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import { ContactList } from '@/components/chat/ContactList'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { CampaignSelector } from '@/components/chat/CampaignSelector'

export function Respostas() {
  const { campaignId } = useParams()
  const [selectedContactId, setSelectedContactId] = useState(null)

  if (!campaignId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="flex flex-col items-center gap-2 mb-4">
          <MessageSquare className="h-12 w-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Respostas</h2>
          <p className="text-sm text-muted-foreground">Selecione uma campanha para ver as conversas</p>
        </div>
        <div className="w-72 border rounded-lg p-2 bg-card shadow-sm">
          <CampaignSelector />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full -m-6 overflow-hidden">
      {/* Left panel — 25% */}
      <div className="w-[280px] shrink-0 border-r flex flex-col overflow-hidden">
        <ContactList
          selectedContactId={selectedContactId}
          onSelectContact={id => setSelectedContactId(id)}
        />
      </div>

      {/* Right panel — rest */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedContactId ? (
          <ChatWindow campaignId={campaignId} contactId={selectedContactId} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <MessageSquare className="h-10 w-10 opacity-30" />
            <p className="text-sm">Selecione um contato para ver a conversa</p>
          </div>
        )}
      </div>
    </div>
  )
}
