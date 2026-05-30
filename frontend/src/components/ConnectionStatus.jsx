import { Wifi, WifiOff, Loader2 } from 'lucide-react'
import { useWhatsAppStore } from '@/store/useWhatsAppStore'
import { cn } from '@/lib/utils'

export function ConnectionStatus() {
  const { connected, phone, connecting } = useWhatsAppStore()

  if (connecting) {
    return (
      <div className="flex items-center gap-2 text-yellow-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Conectando...</span>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-2', connected ? 'text-green-500' : 'text-red-500')}>
      {connected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
      <span className="text-sm">
        {connected ? (phone ? `+${phone}` : 'Conectado') : 'Desconectado'}
      </span>
    </div>
  )
}
