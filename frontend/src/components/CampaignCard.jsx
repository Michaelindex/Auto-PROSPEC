import { Link } from 'react-router-dom'
import { Play, Pause, RotateCcw, ExternalLink } from 'lucide-react'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Progress } from './ui/progress'
import { StatusBadge } from './StatusBadge'
import { startCampaign, pauseCampaign, resumeCampaign } from '@/services/api'
import { toast } from 'sonner'

export function CampaignCard({ campaign, onUpdate }) {
  const total = campaign.totalContacts || 1
  const done = (campaign.sentCount || 0) + (campaign.failedCount || 0)
  const pct = Math.round((done / total) * 100)

  async function handleStart() {
    try { await startCampaign(campaign.id); onUpdate?.() }
    catch (e) { toast.error(e.response?.data?.error || 'Erro ao iniciar') }
  }

  async function handlePause() {
    try { await pauseCampaign(campaign.id); onUpdate?.() }
    catch { toast.error('Erro ao pausar') }
  }

  async function handleResume() {
    try { await resumeCampaign(campaign.id); onUpdate?.() }
    catch { toast.error('Erro ao retomar') }
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{campaign.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {campaign.flowMode === 'sequential_per_contact' && 'Sequencial'}
              {campaign.flowMode === 'broadcast' && 'Broadcast'}
              {campaign.flowMode === 'shuffled' && 'Embaralhado'}
            </p>
          </div>
          <StatusBadge status={campaign.status} />
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{done} / {campaign.totalContacts} contatos</span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center mb-4">
          <div>
            <p className="text-lg font-bold text-green-600">{campaign.sentCount}</p>
            <p className="text-xs text-muted-foreground">Enviados</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-500">{campaign.failedCount}</p>
            <p className="text-xs text-muted-foreground">Falhas</p>
          </div>
          <div>
            <p className="text-lg font-bold text-blue-500">{campaign.repliedCount}</p>
            <p className="text-xs text-muted-foreground">Respostas</p>
          </div>
        </div>

        <div className="flex gap-2">
          {campaign.status === 'draft' && (
            <Button size="sm" className="flex-1" onClick={handleStart}>
              <Play className="h-3 w-3 mr-1" /> Iniciar
            </Button>
          )}
          {campaign.status === 'running' && (
            <Button size="sm" variant="outline" className="flex-1" onClick={handlePause}>
              <Pause className="h-3 w-3 mr-1" /> Pausar
            </Button>
          )}
          {['paused', 'paused_daily_limit'].includes(campaign.status) && (
            <Button size="sm" className="flex-1" onClick={handleResume}>
              <RotateCcw className="h-3 w-3 mr-1" /> Retomar
            </Button>
          )}
          <Button size="sm" variant="ghost" asChild>
            <Link to={`/campaigns/${campaign.id}`}>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
