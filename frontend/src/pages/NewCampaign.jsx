import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Upload, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createCampaign, uploadContacts, getContacts } from '@/services/api'
import { toast } from 'sonner'

const FLOW_MODES = [
  { value: 'sequential_per_contact', label: 'Sequencial por contato', desc: 'Cada contato recebe todas as mensagens antes do próximo' },
  { value: 'broadcast', label: 'Broadcast', desc: 'Todos recebem msg1, depois todos msg2...' },
  { value: 'shuffled', label: 'Embaralhado', desc: 'Intercalado entre contatos e mensagens' }
]

export function NewCampaign() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [csvResult, setCsvResult] = useState(null)
  const [selectedContactIds, setSelectedContactIds] = useState([])
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)

  const [form, setForm] = useState({
    name: '',
    flowMode: 'sequential_per_contact',
    contactDelayMinSec: 30,
    contactDelayMaxSec: 90,
    msgDelayMinSec: 5,
    msgDelayMaxSec: 15,
    simulateTyping: true,
    stopOnReply: true,
    scheduledAt: '',
    imageCaption: '',
    whenToSend: 'now'
  })

  const [messages, setMessages] = useState([
    { order: 1, variations: [{ content: '' }] }
  ])

  function updateField(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleCSVUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const res = await uploadContacts(file)
      setCsvResult(res.data)
      setSelectedContactIds(res.data.savedContactIds)
      toast.success(`${res.data.mobile} contatos importados!`)
    } catch {
      toast.error('Erro ao processar CSV')
    }
  }

  function handleImageChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
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
      i === msgIdx ? {
        ...msg,
        variations: msg.variations.map((v, vi) => vi === varIdx ? { ...v, content } : v)
      } : msg
    ))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Nome obrigatório')
    if (selectedContactIds.length === 0) return toast.error('Selecione contatos')
    if (Number(form.contactDelayMinSec) >= Number(form.contactDelayMaxSec)) return toast.error('Delay mínimo de troca de contato deve ser menor que o máximo')
    if (Number(form.msgDelayMinSec) >= Number(form.msgDelayMaxSec)) return toast.error('Delay mínimo entre mensagens deve ser menor que o máximo')
    if (messages.some(m => m.variations.every(v => !v.content.trim()))) return toast.error('Todas as mensagens precisam de pelo menos uma variação com conteúdo')

    setLoading(true)
    try {
      const fd = new FormData()
      if (imageFile) fd.append('image', imageFile)

      const data = {
        name: form.name,
        flowMode: form.flowMode,
        contactDelayMinSec: Number(form.contactDelayMinSec),
        contactDelayMaxSec: Number(form.contactDelayMaxSec),
        msgDelayMinSec: Number(form.msgDelayMinSec),
        msgDelayMaxSec: Number(form.msgDelayMaxSec),
        simulateTyping: form.simulateTyping,
        stopOnReply: form.stopOnReply,
        scheduledAt: form.whenToSend === 'scheduled' && form.scheduledAt ? form.scheduledAt : null,
        imageCaption: form.imageCaption || null,
        messages,
        contactIds: selectedContactIds
      }

      fd.append('data', JSON.stringify(data))
      const res = await createCampaign(fd)
      toast.success('Campanha criada!')
      navigate(`/campaigns/${res.data.id}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao criar campanha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Nova Campanha</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Informações Básicas</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nome da campanha *</Label>
              <Input className="mt-1" placeholder="Ex: Prospecção Janeiro" value={form.name} onChange={e => updateField('name', e.target.value)} />
            </div>
            <div>
              <Label>Modo de fluxo *</Label>
              <div className="mt-2 space-y-2">
                {FLOW_MODES.map(m => (
                  <label key={m.value} className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border hover:bg-accent transition-colors">
                    <input type="radio" name="flowMode" value={m.value} checked={form.flowMode === m.value} onChange={() => updateField('flowMode', m.value)} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{m.label}</p>
                      <p className="text-xs text-muted-foreground">{m.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card>
          <CardHeader><CardTitle className="text-base">Contatos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Upload CSV (nome, numero)</Label>
              <Input type="file" accept=".csv" className="mt-1" onChange={handleCSVUpload} />
            </div>
            {csvResult && (
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <p className="font-medium">Resultado do CSV:</p>
                <p>✅ <strong>{csvResult.mobile}</strong> celulares importados</p>
                <p>❌ <strong>{csvResult.landline}</strong> fixos descartados</p>
                <p>⚠️ <strong>{csvResult.invalid}</strong> inválidos</p>
                <p>🔁 <strong>{csvResult.duplicates}</strong> duplicados</p>
              </div>
            )}
            {selectedContactIds.length > 0 && (
              <p className="text-sm text-green-600 font-medium">{selectedContactIds.length} contatos selecionados</p>
            )}
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

        {/* Media */}
        <Card>
          <CardHeader><CardTitle className="text-base">Mídia (opcional)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Imagem (enviada com a primeira mensagem, máx 5MB)</Label>
              <Input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1" onChange={handleImageChange} />
            </div>
            {imagePreview && (
              <img src={imagePreview} alt="Preview" className="max-h-40 rounded-lg object-cover" />
            )}
            {imageFile && (
              <div>
                <Label>Legenda da imagem</Label>
                <Input className="mt-1" placeholder="Legenda (opcional)" value={form.imageCaption} onChange={e => updateField('imageCaption', e.target.value)} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Send Settings */}
        <Card>
          <CardHeader><CardTitle className="text-base">Configurações de Envio</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Delay para trocar de contato (segundos)</Label>
              <p className="text-xs text-muted-foreground mb-2">Tempo de espera antes de começar o próximo contato — sorteado aleatoriamente nesta faixa.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Mínimo</Label>
                  <Input type="number" className="mt-1" min={1} value={form.contactDelayMinSec} onChange={e => updateField('contactDelayMinSec', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Máximo</Label>
                  <Input type="number" className="mt-1" min={2} value={form.contactDelayMaxSec} onChange={e => updateField('contactDelayMaxSec', e.target.value)} />
                </div>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Delay entre mensagens do mesmo contato (segundos)</Label>
              <p className="text-xs text-muted-foreground mb-2">Tempo de espera entre uma mensagem e a próxima para o mesmo contato — sorteado aleatoriamente nesta faixa.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Mínimo</Label>
                  <Input type="number" className="mt-1" min={1} value={form.msgDelayMinSec} onChange={e => updateField('msgDelayMinSec', e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Máximo</Label>
                  <Input type="number" className="mt-1" min={2} value={form.msgDelayMaxSec} onChange={e => updateField('msgDelayMaxSec', e.target.value)} />
                </div>
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
          </CardContent>
        </Card>

        {/* Scheduling */}
        <Card>
          <CardHeader><CardTitle className="text-base">Quando disparar</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border hover:bg-accent">
                <input type="radio" name="when" value="now" checked={form.whenToSend === 'now'} onChange={() => updateField('whenToSend', 'now')} />
                <span className="text-sm font-medium">Disparar agora</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border hover:bg-accent">
                <input type="radio" name="when" value="scheduled" checked={form.whenToSend === 'scheduled'} onChange={() => updateField('whenToSend', 'scheduled')} />
                <span className="text-sm font-medium">Agendar para</span>
              </label>
            </div>
            {form.whenToSend === 'scheduled' && (
              <Input type="datetime-local" value={form.scheduledAt} onChange={e => updateField('scheduledAt', e.target.value)} />
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Criando...' : (form.whenToSend === 'scheduled' ? 'Agendar Campanha' : 'Criar e Iniciar')}
          </Button>
        </div>
      </form>
    </div>
  )
}
