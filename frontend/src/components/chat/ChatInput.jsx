import { useState, useRef } from 'react'
import { Paperclip, Send, X, Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'

const MEDIA_TYPES = [
  { label: 'Imagem', icon: Image, accept: 'image/jpeg,image/png,image/webp' }
]

export function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('')
  const [media, setMedia] = useState(null)
  const [caption, setCaption] = useState('')
  const [showMediaMenu, setShowMediaMenu] = useState(false)
  const [acceptFilter, setAcceptFilter] = useState('*')
  const fileInputRef = useRef(null)

  function pickMedia(accept) {
    setAcceptFilter(accept)
    setShowMediaMenu(false)
    setTimeout(() => fileInputRef.current?.click(), 50)
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const type = file.type.startsWith('image/') ? 'image'
      : file.type.startsWith('video/') ? 'video'
      : file.type.startsWith('audio/') ? 'audio'
      : 'document'
    const preview = type === 'image' ? URL.createObjectURL(file) : null
    setMedia({ file, preview, type })
    e.target.value = ''
  }

  function removeMedia() {
    if (media?.preview) URL.revokeObjectURL(media.preview)
    setMedia(null)
    setCaption('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    if (disabled || (!text.trim() && !media)) return
    onSend({ text: text.trim(), media, caption })
    setText('')
    removeMedia()
  }

  const canSend = !disabled && (text.trim().length > 0 || !!media)

  return (
    <div className="border-t bg-card p-3 space-y-2 shrink-0">
      {media && (
        <div className="flex items-start gap-2 p-2 bg-muted rounded-md">
          {media.preview ? (
            <img src={media.preview} alt="" className="h-14 w-14 object-cover rounded shrink-0" />
          ) : (
            <div className="h-14 w-14 flex items-center justify-center bg-background rounded text-2xl shrink-0">
              {media.type === 'document' ? '📄' : media.type === 'audio' ? '🎵' : '🎬'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{media.file.name}</p>
            {(media.type === 'image' || media.type === 'video') && (
              <Input
                placeholder="Legenda (opcional)"
                value={caption}
                onChange={e => setCaption(e.target.value)}
                className="mt-1 h-7 text-xs"
              />
            )}
          </div>
          <button onClick={removeMedia} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowMediaMenu(o => !o)}
            className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground transition-colors"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          {showMediaMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMediaMenu(false)} />
              <div className="absolute bottom-full left-0 mb-1 bg-popover border rounded-md shadow-lg py-1 w-36 z-50">
                {MEDIA_TYPES.map(({ label, icon: Icon, accept }) => (
                  <button
                    key={label}
                    onClick={() => pickMedia(accept)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={acceptFilter}
          onChange={handleFile}
          className="hidden"
        />

        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem..."
          rows={1}
          className="flex-1 min-h-[36px] max-h-24 resize-none text-sm py-2"
          disabled={disabled}
        />

        <Button
          type="button"
          onClick={submit}
          disabled={!canSend}
          size="sm"
          className="h-9 w-9 p-0 shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
