'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [lozinka, setLozinka] = useState('')
  const [ime, setIme] = useState('')
  const [nazivGosp, setNazivGosp] = useState('')
  const [greska, setGreska] = useState('')
  const [poruka, setPoruka] = useState('')
  const [busy, setBusy] = useState(false)

  async function posalji(e) {
    e.preventDefault()
    setGreska('')
    setPoruka('')
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password: lozinka,
          options: { data: { ime, naziv_gospodarstva: nazivGosp } },
        })
        if (error) throw error
        // Ako je potvrda emaila isključena, korisnik je odmah prijavljen.
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          router.push('/')
        } else {
          setPoruka('Račun je kreiran. Ako traži potvrdu, provjeri email, pa se prijavi.')
          setMode('login')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: lozinka,
        })
        if (error) throw error
        router.push('/')
      }
    } catch (err) {
      setGreska(err.message || 'Greška. Pokušaj ponovno.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="wrap">
      <div className="center">
        <div style={{ width: '100%' }}>
          <h1 style={{ textAlign: 'center', color: 'var(--zelena-tamna)' }}>
            🐔 Poljoprivreda
          </h1>
          <div className="card">
            <h2>{mode === 'login' ? 'Prijava' : 'Registracija'}</h2>
            <form onSubmit={posalji}>
              {mode === 'signup' && (
                <>
                  <label>Tvoje ime</label>
                  <input value={ime} onChange={(e) => setIme(e.target.value)} placeholder="npr. Ivan" />
                  <label>Naziv gospodarstva</label>
                  <input value={nazivGosp} onChange={(e) => setNazivGosp(e.target.value)} placeholder="npr. OPG Kadić" />
                </>
              )}
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <label>Lozinka</label>
              <input type="password" value={lozinka} onChange={(e) => setLozinka(e.target.value)} required minLength={6} />

              {greska && <div className="greska">{greska}</div>}
              {poruka && <div className="muted" style={{ marginTop: 8 }}>{poruka}</div>}

              <button type="submit" disabled={busy}>
                {busy ? 'Trenutak…' : mode === 'login' ? 'Prijavi se' : 'Registriraj se'}
              </button>
            </form>
          </div>
          <div style={{ textAlign: 'center' }}>
            {mode === 'login' ? (
              <span className="muted">
                Nemaš račun?{' '}
                <button className="link" onClick={() => setMode('signup')}>Registriraj se</button>
              </span>
            ) : (
              <span className="muted">
                Već imaš račun?{' '}
                <button className="link" onClick={() => setMode('login')}>Prijavi se</button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
