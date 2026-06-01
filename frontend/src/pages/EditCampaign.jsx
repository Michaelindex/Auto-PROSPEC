import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Plus, Trash2, ChevronLeft, X, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCampaign, updateCampaign } from '@/services/api'
import { toast } from 'sonner'

const API_BASE = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

export function EditCampaign() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    contactDelayMinSec: 30,
    contactDelayMaxSec: 90,
    msgDelayMinSec: 5,
    msgDelayMaxSec: 15,
    simulateTyping: true,
    stopOnReply: true,
    imageCaption: ''
  })
  const [messages, setMessages] = useState([])
  const [currentImageUrl, setCurrentImageUrl] = useState(null)  // URL da imagem atual no servidor
  const [newImageFile, setNewImageFile] = useState(null)         // nova imagem selecionada
  const [newImagePreview, setNewImagePreview] = useState(null)   // preview da nova
  const [removeImage, setRemoveImage] = useState(false)          // flag para remover

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
          contactDelayMinSec: c.contactDelayMinSec,
          contactDelayMaxSec: c.contactDelayMaxSec,
          msgDelayMinSec: c.msgDelayMinSec,
          msgDelayMaxSec: c.msgDelayMaxSec,
          simulateTyping: c.simulateTyping,
          stopOnReply: c.stopOnReply,
          imageCaption: c.imageCaption || ''
        })
        if (c.imageUrl) setCurrentImageUrl(`${API_BASE}${c.imageUrl}`)
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

  function handleNewImage(e) {
    const file = e.target.files[0]
    if (!file) return
    setNewImageFile(file)
    setNewImagePreview(URL.createObjectURL(file))
    setRemoveImage(false)
  }

  function handleRemoveImage() {
    setCurrentImageUrl(null)
    setNewImageFile(null)
    setNewImagePreview(null)
    setRemoveImage(true)
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
    if (Number(form.contactDelayMinSec) >= Number(form.contactDelayMaxSec)) return toast.error('Delay mínimo de troca de contato deve ser menor que o máximo')
    if (Number(form.msgDelayMinSec) >= Number(form.msgDelayMaxSec)) return toast.error('Delay mínimo entre mensagens deve ser menor que o máximo')
    if (messages.length === 0) return toast.error('Adicione pelo menos uma mensagem')
    if (messages.some(m => m.variations.every(v => !v.content.trim()))) {
      return toast.error('Todas as mensagens precisam de pelo menos uma variação com conteúdo')
    }

    setSaving(true)
    try {
      const fd = new FormData()
      if (newImageFile) fd.append('image', newImageFile)
      fd.append('data', JSON.stringify({
        name: form.name,
        contactDelayMinSec: Number(form.contactDelayMinSec),
        contactDelayMaxSec: Number(form.contactDelayMaxSec),
        msgDelayMinSec: Number(form.msgDelayMinSec),
        msgDelayMaxSec: Number(form.msgDelayMaxSec),
        simulateTyping: form.simulateTyping,
        stopOnReply: form.stopOnReply,
        imageCaption: form.imageCaption || null,
        removeImage,
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

        {/* Image */}
        <Card>
          <CardHeader><CardTitle className="text-base">Imagem (enviada com a 1ª mensagem)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Preview da imagem atual ou nova */}
            {(newImagePreview || currentImageUrl) && !removeImage && (
              <div className="relative inline-block">
                <img
                  src={newImagePreview || currentImageUrl}
                  alt="Imagem da campanha"
                  className="max-h-40 rounded-lg object-cover border"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                  title="Remover imagem"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                {newImageFile && (
                  <span className="block text-xs text-green-600 mt-1">Nova imagem selecionada</span>
                )}
              </div>
            )}

            {!newImagePreview && !currentImageUrl && !removeImage && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ImageIcon className="h-4 w-4" /> Sem imagem
              </div>
            )}

            {removeImage && (
              <p className="text-sm text-red-500">Imagem será removida ao salvar.</p>
            )}

            <div>
              <Label>{currentImageUrl && !removeImage ? 'Trocar imagem' : 'Adicionar imagem'} (PNG/JPG, máx 5MB)</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="mt-1"
                onChange={handleNewImage}
              />
            </div>

            {(newImageFile || (currentImageUrl && !removeImage)) && (
              <div>
                <Label>Legenda</Label>
                <Input
                  className="mt-1"
                  placeholder="Legenda da imagem (opcional)"
                  value={form.imageCaption}
                  onChange={e => updateField('imageCaption', e.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Send settings */}
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

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(`/campaigns/${id}`)}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar Alterações'}</Button>
        </div>
      </form>
    </div>
  )
}
