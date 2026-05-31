import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Plus, Trash2, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCampaign, updateCampaign } from '@/services/api'
import { toast } from 'sonner'

export function EditCampaign() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    minDelaySec: 30,
    maxDelaySec: 90,
    simulateTyping: true,
    stopOnReply: true,
    imageCaption: ''
  })
  const [messages, setMessages] = useState([])

  useEffect(() => {
    async function load() {
      try {
        const res = await getCampaign(id)
        const c = res.data
        if (!['draft', 'paused'].includes(c.status)) {
          toast.error('Só é possível editar campanhas pausadas ou em rascunho')
          navigate(`/campaigns/${id}`)
          return
        }
        setForm({
          name: c.name,
          minDelaySec: c.minDelaySec,
          maxDelaySec: c.maxDelaySec,
          simulateTyping: c.simulateTyping,
          stopOnReply: c.stopOnReply,
          imageCaption: c.imageCaption || ''
        })
        setMessages(
          (c.messages || []).map(m => ({
            order: m.order,
            variations: m.variations.map(v => ({ content: v.content }))
          }))
        )
      } catch {
        toast.error('Erro ao carregar campanha')
        navigate('/')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  function updateField(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function addMessage() {
    setMessages(m => [...m, { order: m.length + 1, variations: [{ content: '' }] }])
  }

  function removeMessage(idx) {
    setMessages(m => m.filter((_, i) => i !== idx).map((msg, i) => ({ ...msg, order: i + 1 })))
  }

  function addVariation(msgIdx) {
    setMessages(m => m.map((msg, i) =>
      i === msgIdx ? { ...msg, variations: [...msg.variations, { content: '' }] } : msg
    ))
  }

  function removeVariation(msgIdx, varIdx) {
    setMessages(m => m.map((msg, i) =>
      i === msgIdx ? { ...msg, variations: msg.variations.filter((_, vi) => vi !== varIdx) } : msg
    ))
  }

  function updateVariation(msgIdx, varIdx, content) {
    setMessages(m => m.map((msg, i) =>
      i === msgIdx
        ? { ...msg, variations: msg.variations.map((v, vi) => vi === varIdx ? { ...v, content } : v) }
        : msg
    ))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Nome obrigatório')
    if (Number(form.minDelaySec) >= Number(form.maxDelaySec)) return toast.error('Delay mínimo deve ser menor que máximo')
    if (messages.length === 0) return toast.error('Adicione pelo menos uma mensagem')
    if (messages.some(m => m.variations.every(v => !v.content.trim()))) {
      return toast.error('Todas as mensagens precisam de pelo menos uma variação com conteúdo')
    }

    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('data', JSON.stringify({
        name: form.name,
        minDelaySec: Number(form.minDelaySec),
        maxDelaySec: Number(form.maxDelaySec),
        simulateTyping: form.simulateTyping,
        stopOnReply: form.stopOnReply,
        imageCaption: form.imageCaption || null,
        messages
      }))
      await updateCampaign(id, fd)
      toast.success('Campanha atualizada!')
      navigate(`/campaigns/${id}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/campaigns/${id}`}><ChevronLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-2xl font-bold">Editar Campanha</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic */}
        <Card>
          <CardHeader><CardTitle className="text-base">Informações Básicas</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nome da campanha *</Label>
              <Input className="mt-1" value={form.name} onChange={e => updateField('name', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Messages */}
        <Card>
          <CardHeader><CardTitle className="text-base">Mensagens em Sequência</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {messages.map((msg, mi) => (
              <div key={mi} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">Mensagem {msg.order}</p>
                  {messages.length > 1 && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeMessage(mi)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
                {msg.variations.map((v, vi) => (
                  <div key={vi} className="flex gap-2">
                    <Textarea
                      className="flex-1"
                      placeholder={`Variação ${vi + 1} — use {nome} para personalizar`}
                      value={v.content}
                      onChange={e => updateVariation(mi, vi, e.target.value)}
                      rows={3}
                    />
                    {msg.variations.length > 1 && (
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeVariation(mi, vi)}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" onClick={() => addVariation(mi)}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar variação
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addMessage}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar mensagem
            </Button>
          </CardContent>
        </Card>

        {/* Send settings */}
        <Card>
          <CardHeader><CardTitle className="text-base">Configurações de Envio</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Delay mínimo (segundos)</Label>
                <Input type="number" className="mt-1" min={5} value={form.minDelaySec} onChange={e => updateField('minDelaySec', e.target.value)} />
              </div>
              <div>
                <Label>Delay máximo (segundos)</Label>
                <Input type="number" className="mt-1" min={10} value={form.maxDelaySec} onChange={e => updateField('maxDelaySec', e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Simular digitando</Label>
              <Switch checked={form.simulateTyping} onCheckedChange={v => updateField('simulateTyping', v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Parar se cliente responder</Label>
              <Switch checked={form.stopOnReply} onCheckedChange={v => updateField('stopOnReply', v)} />
            </div>
            <div>
              <Label>Legenda da imagem</Label>
              <Input className="mt-1" placeholder="Legenda (opcional)" value={form.imageCaption} onChange={e => updateField('imageCaption', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(`/campaigns/${id}`)}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar Alterações'}</Button>
        </div>
      </form>
    </div>
  )
}
