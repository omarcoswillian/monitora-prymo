'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Lock, Building2, AlertCircle, Eye, EyeOff } from 'lucide-react'

function ClientLoginForm() {
  const [clientName, setClientName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Send client name as "email" — the auth-options will resolve it
      const result = await signIn('credentials', {
        email: clientName.trim(),
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Acesso ou senha incorretos')
      } else {
        router.push('/')
        router.refresh()
      }
    } catch {
      setError('Erro ao fazer login. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-card">
      <div className="login-header">
        <h1>Prymo Monitora</h1>
        <p>Portal do Cliente</p>
      </div>

      <form onSubmit={handleSubmit} className="login-form">
        {error && (
          <div className="login-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="clientName">Acesso</label>
          <div className="input-with-icon">
            <Building2 size={18} className="input-icon" />
            <input
              id="clientName"
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nome da sua empresa"
              required
              className="input"
              autoComplete="username"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="password">Senha</label>
          <div className="input-with-icon">
            <Lock size={18} className="input-icon" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
              className="input"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary btn-login"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

export default function ClientLoginPage() {
  return (
    <div className="login-container">
      <Suspense fallback={
        <div className="login-card">
          <div className="login-header">
            <h1>Prymo Monitora</h1>
            <p>Carregando...</p>
          </div>
        </div>
      }>
        <ClientLoginForm />
      </Suspense>
    </div>
  )
}
