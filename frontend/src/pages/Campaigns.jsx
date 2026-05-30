import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CampaignCard } from '@/components/CampaignCard'
import { getCampaigns } from '@/services/api'
import { useCampaignsStore } from '@/store/useCampaignsStore'
import { toast } from 'sonner'

export function Campaigns() {
  const { campaigns, setCampaigns } = useCampaignsStore()
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const res = await getCampaigns()
      setCampaigns(res.data)
    } catch { toast.error('Erro ao carregar') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Campanhas</h1>
        <Button asChild>
          <Link to="/campaigns/new"><Plus className="h-4 w-4 mr-2" />Nova Campanha</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground mb-4">Nenhuma campanha encontrada.</p>
          <Button asChild><Link to="/campaigns/new"><Plus className="h-4 w-4 mr-2" />Criar campanha</Link></Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map(c => <CampaignCard key={c.id} campaign={c} onUpdate={load} />)}
        </div>
      )}
    </div>
  )
}
