import { Badge } from './ui/badge'
import { cn } from '@/lib/utils'

const STATUS_CONFIG = {
  draft:              { label: 'Rascunho',     color: 'bg-gray-100 text-gray-700 border-gray-300' },
  scheduled:          { label: 'Agendado',     color: 'bg-blue-100 text-blue-700 border-blue-300' },
  queued:             { label: 'Na Fila',      color: 'bg-purple-100 text-purple-700 border-purple-300' },
  running:            { label: 'Rodando',      color: 'bg-green-100 text-green-700 border-green-300 animate-pulse-slow' },
  pausing:            { label: 'Pausando...',  color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  paused:             { label: 'Pausado',      color: 'bg-orange-100 text-orange-700 border-orange-300' },
  paused_daily_limit: { label: 'Limite diário',color: 'bg-orange-100 text-orange-700 border-orange-300' },
  completed:          { label: 'Concluído',    color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  failed:             { label: 'Falhou',       color: 'bg-red-100 text-red-700 border-red-300' },
  cancelled:          { label: 'Cancelado',    color: 'bg-gray-100 text-gray-500 border-gray-300' }
}

export function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || { label: status, color: 'bg-gray-100 text-gray-700' }
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', config.color)}>
      {config.label}
    </span>
  )
}
