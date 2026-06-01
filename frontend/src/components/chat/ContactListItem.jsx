import { useState } from 'react'
import { cn } from '@/lib/utils'

function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(' ').filter(Boolean)
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function getInitialsBg(name) {
  const palette = [
    'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
  ]
  let hash = 0
  for (const ch of (name || '')) hash = ch.charCodeAt(0) + ((hash << 5) - hash)
  return palette[Math.abs(hash) % palette.length]
}

function ContactAvatar({ url, name, size = 'h-10 w-10' }) {
  const [err, setErr] = useState(false)
  if (url && !err) {
    return (
      <img
        src={url}
        alt={name}
        className={`${size} rounded-full object-cover shrink-0`}
        onError={() => setErr(true)}
      />
    )
  }
  return (
    <div className={`${size} rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${getInitialsBg(name)}`}>
      {getInitials(name)}
    </div>
  )
}

function TickIcon({ status, direction }) {
  if (direction !== 'out') return null
  if (status === 'read') return <span className="text-[10px] text-blue-500">✓✓</span>
  if (status === 'delivered') return <span className="text-[10px] text-muted-foreground">✓✓</span>
  return <span className="text-[10px] text-muted-foreground">✓</span>
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function ContactListItem({ contact, isActive, onClick }) {
  const {
    rawName, profilePictureUrl, lastMessage,
    lastMessageAt, lastMessageDirection, lastMessageStatus,
    unreadCount
  } = contact

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-3 hover:bg-accent transition-colors text-left border-b border-border/40',
        isActive && 'bg-accent'
      )}
    >
      <ContactAvatar url={profilePictureUrl} name={rawName} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className={cn('text-sm truncate', unreadCount > 0 ? 'font-semibold' : 'font-medium')}>
            {rawName}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {formatTime(lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <div className="flex items-center gap-1 min-w-0">
            <TickIcon status={lastMessageStatus} direction={lastMessageDirection} />
            <span className="text-xs text-muted-foreground truncate">
              {lastMessage || 'Sem mensagens'}
            </span>
          </div>
          {unreadCount > 0 && (
            <span className="shrink-0 h-5 min-w-5 bg-[#25D366] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

export { ContactAvatar, getInitials, getInitialsBg }
