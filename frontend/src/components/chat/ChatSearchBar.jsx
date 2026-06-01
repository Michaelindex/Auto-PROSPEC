import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'unread', label: 'Não lidos' },
  { key: 'read', label: 'Lidos' }
]

export function ChatSearchBar({ search, onSearch, filter, onFilter }) {
  return (
    <div className="p-2 border-b space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar contato..."
          value={search}
          onChange={e => onSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>
      <div className="flex gap-1">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => onFilter(f.key)}
            className={cn(
              'flex-1 py-1 text-xs rounded-md transition-colors',
              filter === f.key
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent text-muted-foreground'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  )
}
