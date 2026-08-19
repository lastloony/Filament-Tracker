import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { Login } from './pages/Login'
import { FilamentList } from './pages/FilamentList'
import { FilamentForm } from './pages/FilamentForm'
import { Stats } from './pages/Stats'
import { Settings } from './pages/Settings'
import { logout as apiLogout, me } from './api/auth'

type AuthState = 'checking' | 'authenticated' | 'anonymous'

function App() {
  const [authState, setAuthState] = useState<AuthState>('checking')

  useEffect(() => {
    me()
      .then(() => setAuthState('authenticated'))
      .catch(() => setAuthState('anonymous'))
  }, [])

  return (
    <BrowserRouter>
      {authState === 'checking' && (
        <div className="center-screen">
          <p>Загрузка...</p>
        </div>
      )}

      {authState === 'anonymous' && (
        <div className="center-screen">
          <Login onSuccess={() => setAuthState('authenticated')} />
        </div>
      )}

      {authState === 'authenticated' && (
        <div className="app">
          <nav>
            <div className="nav-links">
              <Link to="/filaments">Филамент</Link>
              <Link to="/stats">Статистика</Link>
              <Link to="/settings">Настройки</Link>
            </div>
            <button
              type="button"
              onClick={async () => {
                await apiLogout()
                setAuthState('anonymous')
              }}
            >
              Выйти
            </button>
          </nav>
          <main>
            <Routes>
              <Route path="/" element={<Navigate to="/filaments" replace />} />
              <Route path="/filaments" element={<FilamentList />} />
              <Route path="/filaments/new" element={<FilamentForm />} />
              <Route path="/filaments/:id/edit" element={<FilamentForm />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      )}
    </BrowserRouter>
  )
}

export default App
