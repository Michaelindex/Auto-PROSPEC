import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CampaignCard } from '@/components/CampaignCard'
import { getCampaigns } from '@/services/api'
import { useCampaignsStore } from '@/store/useCampaignsStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import socket from '@/services/socket'
import { toast } from 'sonner'

export function Dashboard() {
  const { campaigns, setCampaigns, updateCampaign } = useCampaignsStore()
  const { settings } = useSettingsStore()
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const res = await getCampaigns()
      setCampaigns(res.data)
    } catch {
      toast.error('Erro ao carregar campanhas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()

    function onStatusChange({ campaignId, status, metrics }) {
      updateCampaign(campaignId, { status, ...metrics })
    }
    function onProgress({ campaignId, sentCount, failedCount, totalContacts }) {
      updateCampaign(campaignId, { sentCount, failedCount, totalContacts })
    }

    socket.on('campaign:status_changed', onStatusChange)
    socket.on('campaign:progress', onProgress)

    return () => {
      socket.off('campaign:status_changed', onStatusChange)
      socket.off('campaign:progress', onProgress)
    }
  }, [])

  const running = campaigns.filter(c => ['running', 'pausing'].includes(c.status)).length
  const max = settings?.maxConcurrentCampaigns || 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <Radio className="h-4 w-4 text-green-500" />
            <span>{running} / {max} campanhas rodando</span>
          </div>
        </div>
        <Button asChild>
          <Link to="/campaigns/new">
            <Plus className="h-4 w-4 mr-2" /> Nova Campanha
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground mb-4">Nenhuma campanha criada ainda.</p>
          <Button asChild>
            <Link to="/campaigns/new"><Plus className="h-4 w-4 mr-2" /> Criar primeira campanha</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map(c => (
            <CampaignCard key={c.id} campaign={c} onUpdate={load} />
          ))}
        </div>
      )}
    </div>
  )
}
