import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Play, Pause, RotateCcw, XCircle, Download, Trash2, ChevronLeft,
  CheckCircle2, XCircle as XIcon, MessageSquare, Users
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { StatusBadge } from '@/components/StatusBadge'
import { Input } from '@/components/ui/input'
import {
  getCampaign, getCampaignContacts, getCampaignLogs, getCampaignReplies,
  startCampaign, pauseCampaign, resumeCampaign, cancelCampaign, deleteCampaign,
  exportLogs, exportErrors
} from '@/services/api'
import { formatDate } from '@/lib/utils'
import socket from '@/services/socket'
import { toast } from 'sonner'

const MAX_LIVE_LOGS = 200

export function CampaignDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState(null)
  const [contacts, setContacts] = useState([])
  const [totalContacts, setTotalContacts] = useState(0)
  const [contactPage, setContactPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [replies, setReplies] = useState([])
  const [liveLogs, setLiveLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [tab, setTab] = useState('logs')
  const logsEndRef = useRef(null)
  // Track IDs already shown to avoid duplicates when WS fires for a log we already loaded
  const shownLogIds = useRef(new Set())

  async function load() {
    try {
      const [cRes] = await Promise.all([getCampaign(id)])
      setCampaign(cRes.data)
    } catch { toast.error('Campanha não encontrada') }
  }

  async function loadContacts(page = 1, status = '') {
    const res = await getCampaignContacts(id, { page, limit: 50, ...(status && { status }) })
    setContacts(res.data.contacts)
    setTotalContacts(res.data.total)
  }

  async function loadReplies() {
    const res = await getCampaignReplies(id)
    setReplies(res.data)
  }

  async function loadLogs() {
    setLogsLoading(true)
    try {
      // Load up to 500 most recent logs from DB
      const res = await getCampaignLogs(id, { page: 1, limit: 500 })
      const dbLogs = res.data.logs.map(log => ({
        id: log.id,
        type: log.status === 'sent' ? 'sent' : 'failed',
        phone: log.phone,
        firstName: null,
        messageOrder: log.messageOrder,
        variationContent: log.variationUsed,
        errorType: log.errorType,
        errorMessage: log.errorMessage,
        sentAt: log.sentAt
      }))
      // Register IDs so WebSocket doesn't duplicate them
      dbLogs.forEach(l => shownLogIds.current.add(l.id))
      // DB returns newest first — keep that order
      setLiveLogs(dbLogs.slice(0, MAX_LIVE_LOGS))
    } catch {
      // silently ignore
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    load()
    loadContacts()
    loadReplies()
    loadLogs()

    function onStatus({ campaignId, status }) {
      if (campaignId !== id) return
      setCampaign(c => c ? { ...c, status } : c)
    }
    function onProgress({ campaignId, sentCount, failedCount, totalContacts }) {
      if (campaignId !== id) return
      setCampaign(c => c ? { ...c, sentCount, failedCount, totalContacts } : c)
    }
    function onSent(data) {
      if (data.campaignId !== id) return
      // Use a temporary id for WS events (they won't collide with DB UUIDs)
      const wsId = `ws-${Date.now()}-${Math.random()}`
      setLiveLogs(l => [{ type: 'sent', ...data, id: wsId }, ...l].slice(0, MAX_LIVE_LOGS))
    }
    function onFailed(data) {
      if (data.campaignId !== id) return
      const wsId = `ws-${Date.now()}-${Math.random()}`
      setLiveLogs(l => [{ type: 'failed', ...data, id: wsId }, ...l].slice(0, MAX_LIVE_LOGS))
    }
    function onReply(data) {
      if (data.campaignId !== id) return
      setReplies(r => [{ ...data, receivedAt: data.receivedAt }, ...r])
    }

    socket.on('campaign:status_changed', onStatus)
    socket.on('campaign:progress', onProgress)
    socket.on('campaign:message_sent', onSent)
    socket.on('campaign:message_failed', onFailed)
    socket.on('campaign:reply_received', onReply)

    return () => {
      socket.off('campaign:status_changed', onStatus)
      socket.off('campaign:progress', onProgress)
      socket.off('campaign:message_sent', onSent)
      socket.off('campaign:message_failed', onFailed)
      socket.off('campaign:reply_received', onReply)
    }
  }, [id])

  useEffect(() => {
    loadContacts(contactPage, statusFilter)
  }, [contactPage, statusFilter])

  async function handleAction(action) {
    try {
      if (action === 'start') await startCampaign(id)
      if (action === 'pause') await pauseCampaign(id)
      if (action === 'resume') await resumeCampaign(id)
      if (action === 'cancel') {
        if (!confirm('Cancelar campanha?')) return
        await cancelCampaign(id)
      }
      if (action === 'delete') {
        if (!confirm('Excluir campanha? Esta ação é irreversível.')) return
        await deleteCampaign(id)
        navigate('/')
        return
      }
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro')
    }
  }

  if (!campaign) return <div className="text-center py-12">Carregando...</div>

  const total = campaign.totalContacts || 1
  const done = (campaign.sentCount || 0) + (campaign.failedCount || 0)
  const pct = Math.round((done / total) * 100)
  const pending = total - done

  const canEdit = ['draft', 'paused'].includes(campaign.status)
  const canStart = campaign.status === 'draft'
  const canPause = campaign.status === 'running'
  const canResume = ['paused', 'paused_daily_limit'].includes(campaign.status)
  const canCancel = ['running', 'pausing', 'queued', 'scheduled'].includes(campaign.status)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ChevronLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{campaign.name}</h1>
              <StatusBadge status={campaign.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {campaign.flowMode === 'sequential_per_contact' && 'Sequencial'} •
              Criado em {formatDate(campaign.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          {canEdit && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/campaigns/${id}/edit`}>Editar</Link>
            </Button>
          )}
          {canStart && <Button size="sm" onClick={() => handleAction('start')}><Play className="h-3 w-3 mr-1" />Iniciar</Button>}
          {canPause && <Button size="sm" variant="outline" onClick={() => handleAction('pause')}><Pause className="h-3 w-3 mr-1" />Pausar</Button>}
          {canResume && <Button size="sm" onClick={() => handleAction('resume')}><RotateCcw className="h-3 w-3 mr-1" />Retomar</Button>}
          {canCancel && <Button size="sm" variant="destructive" onClick={() => handleAction('cancel')}><XCircle className="h-3 w-3 mr-1" />Cancelar</Button>}
          <Button size="sm" variant="ghost" onClick={() => window.open(exportLogs(id))} title="Exportar logs">
            <Download className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleAction('delete')}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: campaign.totalContacts, color: 'text-foreground' },
          { label: 'Enviados', value: campaign.sentCount, color: 'text-green-600' },
          { label: 'Falhas', value: campaign.failedCount, color: 'text-red-500' },
          { label: 'Respostas', value: campaign.repliedCount, color: 'text-blue-500' },
          { label: 'Pendentes', value: pending, color: 'text-muted-foreground' }
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">{pct}%</span>
          </div>
          <Progress value={pct} />
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="border-b flex gap-1">
        {[
          { key: 'logs', label: 'Timeline ao vivo' },
          { key: 'contacts', label: `Contatos (${campaign.totalContacts})` },
          { key: 'replies', label: `Respostas (${replies.length})` }
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Live logs */}
      {tab === 'logs' && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b">
              <span className="text-xs text-muted-foreground font-medium">
                {logsLoading ? 'Carregando histórico...' : `${liveLogs.length} registro(s)`}
              </span>
              <button
                className="text-xs text-muted-foreground hover:text-foreground underline"
                onClick={loadLogs}
              >
                Recarregar
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto font-mono text-xs p-4 space-y-1">
              {logsLoading && (
                <p className="text-muted-foreground text-center py-8">Carregando logs...</p>
              )}
              {!logsLoading && liveLogs.length === 0 && (
                <p className="text-muted-foreground text-center py-8">Nenhum envio registrado ainda.</p>
              )}
              {liveLogs.map(log => (
                <div key={log.id} className={`flex items-start gap-2 ${log.type === 'sent' ? 'text-green-700' : 'text-red-600'}`}>
                  {log.type === 'sent'
                    ? <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0" />
                    : <XIcon className="h-3 w-3 mt-0.5 shrink-0" />
                  }
                  <span>
                    {log.type === 'sent'
                      ? `✅ Enviado para ${log.firstName || log.phone} (${log.phone}) — msg ${log.messageOrder} — ${new Date(log.sentAt).toLocaleTimeString('pt-BR')}`
                      : `❌ Falhou ${log.phone} — ${log.errorType || 'erro desconhecido'} — ${new Date(log.sentAt || Date.now()).toLocaleTimeString('pt-BR')}`
                    }
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contacts */}
      {tab === 'contacts' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <select
                className="text-sm border rounded px-2 py-1"
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setContactPage(1) }}
              >
                <option value="">Todos os status</option>
                {['pending', 'in_progress', 'completed', 'failed', 'replied', 'skipped'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <span className="text-sm text-muted-foreground">{totalContacts} contatos</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30">
                  <tr>
                    <th className="text-left p-3 font-medium">Nome</th>
                    <th className="text-left p-3 font-medium">Telefone</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Mensagens</th>
                    <th className="text-left p-3 font-medium">Último envio</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map(cc => (
                    <tr key={cc.id} className="border-b hover:bg-muted/20">
                      <td className="p-3">{cc.contact.firstName}</td>
                      <td className="p-3 font-mono text-xs">{cc.contact.phone}</td>
                      <td className="p-3"><StatusBadge status={cc.status} /></td>
                      <td className="p-3">{cc.currentMsgOrder}</td>
                      <td className="p-3 text-muted-foreground text-xs">{cc.lastSentAt ? formatDate(cc.lastSentAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalContacts > 50 && (
              <div className="p-3 flex gap-2 justify-center">
                <Button size="sm" variant="outline" disabled={contactPage <= 1} onClick={() => setContactPage(p => p - 1)}>Anterior</Button>
                <Button size="sm" variant="outline" disabled={contactPage * 50 >= totalContacts} onClick={() => setContactPage(p => p + 1)}>Próxima</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Replies */}
      {tab === 'replies' && (
        <Card>
          <CardContent className="p-0">
            {replies.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma resposta recebida.</p>
            ) : (
              <div className="divide-y">
                {replies.map(r => (
                  <div key={r.id} className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{r.fromName || r.fromPhone}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(r.receivedAt)}</span>
                    </div>
                    <p className="text-sm">{r.content}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
