import { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { getChatMessages, sendChatMessage, markChatRead } from '@/services/api'
import { useChatStore } from '@/store/useChatStore'
import { getInitials, getInitialsBg } from './ContactListItem'

function Avatar({ url, name }) {
  const [err, setErr] = useState(false)
  if (url && !err) {
    return (
      <img src={url} alt={name} className="h-9 w-9 rounded-full object-cover shrink-0" onError={() => setErr(true)} />
    )
  }
  return (
    <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${getInitialsBg(name)}`}>
      {getInitials(name)}
    </div>
  )
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Hoje'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR')
}

function DateSeparator({ date }) {
  return (
    <div className="flex items-center my-4">
      <div className="flex-1 h-px bg-border" />
      <span className="mx-3 text-xs text-muted-foreground bg-background px-2 py-0.5 rounded-full border">
        {formatDateLabel(date)}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

function buildItems(msgs) {
  const items = []
  let lastDate = null
  for (const msg of msgs) {
    const dateStr = new Date(msg.sentAt).toDateString()
    if (dateStr !== lastDate) {
      items.push({ type: 'date', date: msg.sentAt, key: `date-${msg.sentAt}-${msg.id}` })
      lastDate = dateStr
    }
    items.push({ type: 'msg', data: msg, key: msg.id })
  }
  return items
}

export function ChatWindow({ campaignId, contactId }) {
  const { contacts, messages, hasMore, setMessages, appendMessage, prependMessages, updateContactUnread, updateContactLastMessage } = useChatStore()
  const contact = contacts[campaignId]?.[contactId]
  const key = `${campaignId}-${contactId}`
  const msgs = messages[key] || []

  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const pageRef = useRef(1)
  const loadingMoreRef = useRef(false)
  const containerRef = useRef(null)
  const bottomRef = useRef(null)
  const prevMsgCountRef = useRef(0)

  const loadPage = useCallback(async (page) => {
    setLoading(true)
    try {
      const res = await getChatMessages(campaignId, contactId, { page, limit: 50 })
      const { messages: newMsgs, hasMore: more } = res.data
      if (page === 1) {
        setMessages(key, newMsgs, more)
      } else {
        prependMessages(key, newMsgs, more)
      }
    } finally {
      setLoading(false)
    }
  }, [campaignId, contactId, key])

  useEffect(() => {
    if (!campaignId || !contactId) return
    pageRef.current = 1
    loadPage(1).then(() => {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 30)
    })
    markChatRead(campaignId, contactId).then(() => {
      updateContactUnread(campaignId, contactId, 0)
    }).catch(() => {})
  }, [campaignId, contactId])

  // Auto-scroll to bottom when new messages arrive (only if already near bottom)
  useEffect(() => {
    const el = containerRef.current
    if (!el || msgs.length === 0) return
    if (msgs.length > prevMsgCountRef.current && pageRef.current === 1) {
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
      if (isNearBottom || prevMsgCountRef.current === 0) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }
    prevMsgCountRef.current = msgs.length
  }, [msgs.length])

  function handleScroll() {
    const el = containerRef.current
    if (!el || !hasMore[key] || loading || loadingMoreRef.current) return
    if (el.scrollTop < 80) {
      loadingMoreRef.current = true
      const prevHeight = el.scrollHeight
      const nextPage = pageRef.current + 1
      loadPage(nextPage).then(() => {
        pageRef.current = nextPage
        loadingMoreRef.current = false
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight - prevHeight
          }
        })
      }).catch(() => { loadingMoreRef.current = false })
    }
  }

  async function handleSend({ text, media, caption }) {
    if (sending) return
    setSending(true)
    try {
      const fd = new FormData()
      if (text) fd.append('content', text)
      if (media) {
        fd.append('media', media.file)
        if (caption) fd.append('mediaCaption', caption)
      }
      const res = await sendChatMessage(campaignId, contactId, fd)
      appendMessage(key, res.data.message)
      updateContactLastMessage(campaignId, contactId, res.data.message)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  if (!contact) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Carregando...
      </div>
    )
  }

  const items = buildItems(msgs)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-card shrink-0">
        <Avatar url={contact.profilePictureUrl} name={contact.rawName} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate leading-tight">{contact.rawName}</p>
          <p className="text-xs text-muted-foreground">{contact.phone}</p>
        </div>
        <Link
          to={`/campaigns/${campaignId}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Ver campanha"
        >
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      {/* Messages Area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-2"
      >
        {loading && pageRef.current > 1 && (
          <div className="text-center text-xs text-muted-foreground py-2">Carregando mais...</div>
        )}
        {loading && pageRef.current === 1 && msgs.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">Carregando...</div>
        )}
        {items.map(item =>
          item.type === 'date' ? (
            <DateSeparator key={item.key} date={item.date} />
          ) : (
            <ChatMessage key={item.key} message={item.data} />
          )
        )}
        {msgs.length === 0 && !loading && (
          <div className="text-center text-xs text-muted-foreground py-8">
            Nenhuma mensagem ainda
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={sending} />
    </div>
  )
}
