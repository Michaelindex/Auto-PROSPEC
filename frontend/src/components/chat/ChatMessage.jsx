import { cn } from '@/lib/utils'

const API_BASE = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

function mediaSrc(path) {
  if (!path) return path
  return path.startsWith('http') ? path : `${API_BASE}${path}`
}

function TickIcon({ status }) {
  if (status === 'read') return <span className="text-[10px] text-blue-400">✓✓</span>
  if (status === 'delivered') return <span className="text-[10px] opacity-60">✓✓</span>
  return <span className="text-[10px] opacity-60">✓</span>
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function ChatMessage({ message }) {
  const isOut = message.direction === 'out'

  return (
    <div className={cn('flex mb-1.5', isOut ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[72%] rounded-lg px-3 py-2 text-sm shadow-sm',
          isOut
            ? 'bg-[#dcf8c6] dark:bg-[#005c4b] rounded-br-sm'
            : 'bg-card border rounded-bl-sm'
        )}
      >
        {message.mediaType === 'image' && message.mediaPath && (
          <img
            src={mediaSrc(message.mediaPath)}
            alt="imagem"
            className="rounded max-w-[240px] mb-1 cursor-pointer"
            onClick={() => window.open(mediaSrc(message.mediaPath), '_blank')}
          />
        )}

        {message.content && (
          <p className="whitespace-pre-wrap break-words leading-snug">{message.content}</p>
        )}
        {message.mediaCaption && !message.content && (
          <p className="whitespace-pre-wrap break-words text-xs opacity-80 mt-0.5">{message.mediaCaption}</p>
        )}

        {message.isAutomated && (
          <span className="block text-[10px] opacity-50 italic mt-0.5">[automático]</span>
        )}

        <div className={cn('flex items-center gap-1 mt-1', isOut ? 'justify-end' : 'justify-start')}>
          <span className="text-[10px] opacity-50">{formatTime(message.sentAt)}</span>
          {isOut && <TickIcon status={message.status} />}
        </div>
      </div>
    </div>
  )
}
