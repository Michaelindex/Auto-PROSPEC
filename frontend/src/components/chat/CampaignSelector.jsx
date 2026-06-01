import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/store/useChatStore'
import { getChatSummary } from '@/services/api'

export function CampaignSelector() {
  const navigate = useNavigate()
  const { campaignId } = useParams()
  const { campaignsSummary, setCampaignsSummary, setTotalUnread } = useChatStore()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    getChatSummary()
      .then(res => {
        setCampaignsSummary(res.data.campaigns)
        setTotalUnread(res.data.totalUnread)
      })
      .catch(() => {})
  }, [])

  const current = campaignsSummary.find(c => c.campaignId === campaignId)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-accent rounded-md transition-colors"
      >
        <span className="truncate">{current?.name || 'Selecionar campanha'}</span>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {(current?.unreadCount ?? 0) > 0 && (
            <span className="h-5 min-w-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center px-1">
              {current.unreadCount}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 z-50 bg-popover border rounded-md shadow-lg max-h-64 overflow-y-auto mt-1">
            {campaignsSummary.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Nenhuma campanha</p>
            ) : (
              campaignsSummary.map(c => (
                <button
                  key={c.campaignId}
                  onClick={() => { navigate(`/respostas/${c.campaignId}`); setOpen(false) }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent text-left transition-colors',
                    c.campaignId === campaignId && 'bg-accent'
                  )}
                >
                  <span className="truncate">{c.name}</span>
                  {c.unreadCount > 0 && (
                    <span className="ml-2 h-5 min-w-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center px-1 shrink-0">
                      {c.unreadCount}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
