import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Megaphone, Users, Settings, MessageSquare } from 'lucide-react'
import { ConnectionStatus } from './ConnectionStatus'
import { ModeSwitch } from './ModeSwitch'
import { QRCodeModal } from './QRCodeModal'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/campaigns', label: 'Campanhas', icon: Megaphone },
  { to: '/contacts', label: 'Contatos', icon: Users },
  { to: '/settings', label: 'Configurações', icon: Settings }
]

export function Layout() {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 border-r bg-card flex flex-col shrink-0">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-[#25D366] flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-none">WA Campaign</p>
              <p className="text-xs text-muted-foreground">Sender</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b bg-card px-6 flex items-center justify-between shrink-0">
          <div />
          <div className="flex items-center gap-4">
            <ModeSwitch />
            <ConnectionStatus />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>

      <QRCodeModal />
    </div>
  )
}
