import { cn } from '@/lib/utils'

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
            src={message.mediaPath}
            alt="imagem"
            className="rounded max-w-[240px] mb-1 cursor-pointer"
            onClick={() => window.open(message.mediaPath, '_blank')}
          />
        )}
        {message.mediaType === 'video' && message.mediaPath && (
          <video
            controls
            src={message.mediaPath}
            className="rounded max-w-[240px] mb-1"
          />
        )}
        {message.mediaType === 'audio' && message.mediaPath && (
          <audio controls src={message.mediaPath} className="w-full mb-1" />
        )}
        {message.mediaType === 'document' && message.mediaPath && (
          <a
            href={message.mediaPath}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs underline decoration-dotted mb-1 text-blue-600 dark:text-blue-400"
          >
            <span>📎</span>
            <span className="truncate max-w-[160px]">{message.mediaPath.split('/').pop()}</span>
          </a>
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
