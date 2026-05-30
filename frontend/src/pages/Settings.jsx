import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getSettings, updateSettings, logoutWhatsApp } from '@/services/api'
import { useSettingsStore } from '@/store/useSettingsStore'
import { toast } from 'sonner'

export function Settings() {
  const { settings, setSettings } = useSettingsStore()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await getSettings()
        setSettings(res.data)
        setForm(res.data)
      } catch { toast.error('Erro ao carregar configurações') }
    }
    load()
  }, [])

  function updateField(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await updateSettings(form)
      setSettings(res.data)
      setForm(res.data)
      toast.success('Configurações salvas!')
    } catch { toast.error('Erro ao salvar') }
    finally { setSaving(false) }
  }

  async function handleLogout() {
    if (!confirm('Desconectar o WhatsApp? Será necessário escanear o QR code novamente.')) return
    try {
      await logoutWhatsApp()
      toast.success('WhatsApp desconectado')
    } catch { toast.error('Erro ao desconectar') }
  }

  if (!form) return <p className="text-center py-8 text-muted-foreground">Carregando...</p>

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Modo de Operação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Em modo <strong>Teste</strong>, todas as mensagens são enviadas para o número de teste configurado no .env.
            Em modo <strong>Produção</strong>, os números reais recebem as mensagens.
          </p>
          <div className="flex gap-3">
            <button
              className={`flex-1 py-3 rounded-lg border-2 font-medium transition-all ${
                form.mode === 'test' ? 'border-yellow-400 bg-yellow-50 text-yellow-800' : 'border-muted'
              }`}
              onClick={() => updateField('mode', 'test')}
            >
              🧪 Teste
            </button>
            <button
              className={`flex-1 py-3 rounded-lg border-2 font-medium transition-all ${
                form.mode === 'production' ? 'border-red-400 bg-red-50 text-red-800' : 'border-muted'
              }`}
              onClick={() => updateField('mode', 'production')}
            >
              🚀 Produção
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Campanhas Simultâneas</CardTitle></CardHeader>
        <CardContent>
          <Label>Máximo de campanhas rodando ao mesmo tempo</Label>
          <Input
            type="number" min={1} max={10} className="mt-1 w-32"
            value={form.maxConcurrentCampaigns}
            onChange={e => updateField('maxConcurrentCampaigns', Number(e.target.value))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Limite Diário</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Ativar limite diário de mensagens</Label>
            <Switch checked={form.dailyLimitEnabled} onCheckedChange={v => updateField('dailyLimitEnabled', v)} />
          </div>
          {form.dailyLimitEnabled && (
            <div>
              <Label>Limite de mensagens por dia</Label>
              <Input
                type="number" min={1} className="mt-1 w-40"
                value={form.dailyLimitValue}
                onChange={e => updateField('dailyLimitValue', Number(e.target.value))}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Delays Padrão</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Delay mínimo padrão (s)</Label>
              <Input type="number" min={5} className="mt-1" value={form.defaultMinDelaySec} onChange={e => updateField('defaultMinDelaySec', Number(e.target.value))} />
            </div>
            <div>
              <Label>Delay máximo padrão (s)</Label>
              <Input type="number" min={10} className="mt-1" value={form.defaultMaxDelaySec} onChange={e => updateField('defaultMaxDelaySec', Number(e.target.value))} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>Simular digitando por padrão</Label>
            <Switch checked={form.simulateTyping} onCheckedChange={v => updateField('simulateTyping', v)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-between">
        <Button variant="destructive" onClick={handleLogout}>Desconectar WhatsApp</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar Configurações'}</Button>
      </div>
    </div>
  )
}
