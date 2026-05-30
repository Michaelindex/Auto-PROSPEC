import { useEffect, useState } from 'react'
import { Search, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { getContacts, deleteContact, uploadContacts } from '@/services/api'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'

export function Contacts() {
  const [contacts, setContacts] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [csvResult, setCsvResult] = useState(null)
  const limit = 50

  async function load() {
    setLoading(true)
    try {
      const res = await getContacts({ search, page, limit })
      setContacts(res.data.contacts)
      setTotal(res.data.total)
    } catch { toast.error('Erro ao carregar contatos') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search, page])

  async function handleDelete(id) {
    if (!confirm('Excluir contato?')) return
    try {
      await deleteContact(id)
      toast.success('Contato excluído')
      load()
    } catch { toast.error('Erro ao excluir') }
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const res = await uploadContacts(file)
      setCsvResult(res.data)
      toast.success(`${res.data.mobile} contatos importados`)
      load()
    } catch { toast.error('Erro ao importar CSV') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contatos ({total})</h1>
        <label className="cursor-pointer">
          <Button variant="outline" asChild>
            <span><Upload className="h-4 w-4 mr-2" />Importar CSV</span>
          </Button>
          <input type="file" accept=".csv" className="hidden" onChange={handleUpload} />
        </label>
      </div>

      {csvResult && (
        <div className="p-3 bg-muted rounded-lg text-sm">
          ✅ {csvResult.mobile} celulares • ❌ {csvResult.landline} fixos • ⚠️ {csvResult.invalid} inválidos
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : contacts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhum contato encontrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="text-left p-3 font-medium">Nome</th>
                  <th className="text-left p-3 font-medium">Telefone</th>
                  <th className="text-left p-3 font-medium">Importado em</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr key={c.id} className="border-b hover:bg-muted/20">
                    <td className="p-3">
                      <p className="font-medium">{c.firstName}</p>
                      <p className="text-xs text-muted-foreground">{c.rawName}</p>
                    </td>
                    <td className="p-3 font-mono text-xs">{c.phone}</td>
                    <td className="p-3 text-xs text-muted-foreground">{formatDate(c.createdAt)}</td>
                    <td className="p-3">
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {total > limit && (
            <div className="p-3 flex gap-2 justify-center">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <span className="text-sm text-muted-foreground self-center">{page} / {Math.ceil(total / limit)}</span>
              <Button size="sm" variant="outline" disabled={page * limit >= total} onClick={() => setPage(p => p + 1)}>Próxima</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
