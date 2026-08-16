import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Breadcrumbs } from './Breadcrumbs'

/** Coquille de layout principale — englobe toutes les pages sauf `/login`. */
export function AppShell(): JSX.Element {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-50">
      <Header />
      <Breadcrumbs />
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
