import { useSettingsStore } from '@/store/useSettingsStore'
import { updateSettings } from '@/services/api'
import { toast } from 'sonner'

export function ModeSwitch() {
  const { settings, setSettings } = useSettingsStore()
  const isTest = settings?.mode === 'test'

  async function toggle() {
    const newMode = isTest ? 'production' : 'test'
    if (newMode === 'production') {
      if (!confirm('Tem certeza que deseja entrar em MODO PRODUÇÃO? As mensagens serão enviadas para os números reais.')) return
    }
    try {
      const res = await updateSettings({ mode: newMode })
      setSettings(res.data)
      toast.success(`Modo alterado para ${newMode === 'test' ? 'TESTE' : 'PRODUÇÃO'}`)
    } catch {
      toast.error('Erro ao alterar modo')
    }
  }

  if (!settings) return null

  return (
    <button
      onClick={toggle}
      className={`px-3 py-1.5 rounded-full text-sm font-bold border-2 transition-all ${
        isTest
          ? 'bg-yellow-100 text-yellow-800 border-yellow-400 hover:bg-yellow-200'
          : 'bg-red-100 text-red-800 border-red-400 hover:bg-red-200 animate-pulse-slow'
      }`}
    >
      {isTest ? '🧪 TESTE' : '🚀 PRODUÇÃO'}
    </button>
  )
}
