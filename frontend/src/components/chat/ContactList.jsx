import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { CampaignSelector } from './CampaignSelector'
import { ChatSearchBar } from './ChatSearchBar'
import { ContactListItem } from './ContactListItem'
import { getChatContacts } from '@/services/api'
import { useChatStore } from '@/store/useChatStore'

export function ContactList({ selectedContactId, onSelectContact }) {
  const { campaignId } = useParams()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const { contacts, setContacts } = useChatStore()

  const load = useCallback(async () => {
    if (!campaignId) return
    setLoading(true)
    try {
      const res = await getChatContacts(campaignId, { limit: 500 })
      setContacts(campaignId, res.data.contacts)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { load() }, [load])

  const allContacts = Object.values(contacts[campaignId] || {})

  const filtered = allContacts
    .filter(c => {
      if (!search) return true
      const q = search.toLowerCase()
      return c.rawName.toLowerCase().includes(q) || c.phone.includes(q)
    })
    .filter(c => {
      if (filter === 'unread') return c.unreadCount > 0
      if (filter === 'read') return c.unreadCount === 0
      return true
    })
    .sort((a, b) => {
      if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
      return tb - ta
    })

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b shrink-0">
        <CampaignSelector />
      </div>
      <ChatSearchBar
        search={search}
        onSearch={setSearch}
        filter={filter}
        onFilter={setFilter}
      />
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {search || filter !== 'all' ? 'Nenhum resultado' : 'Nenhum contato'}
          </div>
        ) : (
          filtered.map(contact => (
            <ContactListItem
              key={contact.contactId}
              contact={contact}
              isActive={contact.contactId === selectedContactId}
              onClick={() => onSelectContact(contact.contactId)}
            />
          ))
        )}
      </div>
    </div>
  )
}
