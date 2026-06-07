'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [gosp, setGosp] = useState(null)
  const [objekti, setObjekti] = useState([])
  const [turnusi, setTurnusi] = useState([])
  const [partneri, setPartneri] = useState([])
  const [korisnici, setKorisnici] = useState([])
  const [greska, setGreska] = useState('')

  // forma za članove
  const [clanIme, setClanIme] = useState('')
  const [clanEmail, setClanEmail] = useState('')
  const [clanLozinka, setClanLozinka] = useState('')
  const [clanBusy, setClanBusy] = useState(false)
  const [clanPoruka, setClanPoruka] = useState('')

  // forme
  const [objektNaziv, setObjektNaziv] = useState('')
  const [objektKapacitet, setObjektKapacitet] = useState('')
  const [turObjektId, setTurObjektId] = useState('')
  const [turDatum, setTurDatum] = useState('')
  const [partnerNaziv, setPartnerNaziv] = useState('')
  const [partnerTip, setPartnerTip] = useState('dobavljac')

  useEffect(() => {
    ucitaj()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function ucitaj() {
    setLoading(true)
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) {
      router.push('/login')
      return
    }
    const { data: g } = await supabase.from('gospodarstvo').select('*').limit(1).single()
    setGosp(g || null)

    const { data: o } = await supabase.from('objekt').select('*').order('naziv')
    setObjekti(o || [])

    const { data: t } = await supabase
      .from('turnus')
      .select('*, objekt(naziv)')
      .order('datum_useljenja', { ascending: false })
    setTurnusi(t || [])

    const { data: p } = await supabase.from('partner').select('*').order('naziv')
    setPartneri(p || [])

    const { data: k } = await supabase.from('korisnik').select('*').order('kreirano')
    setKorisnici(k || [])

    setLoading(false)
  }

  async function dodajClana(e) {
    e.preventDefault()
    setClanPoruka('')
    setGreska('')
    if (!clanEmail || !clanLozinka) { setGreska('Email i lozinka su obavezni.'); return }
    setClanBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/dodaj-korisnika', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ ime: clanIme, email: clanEmail, lozinka: clanLozinka }),
      })
      const out = await res.json()
      if (out.ok) {
        setClanPoruka(`Korisnik ${clanEmail} je dodan. Neka se prijavi s tom lozinkom.`)
        setClanIme(''); setClanEmail(''); setClanLozinka('')
        ucitaj()
      } else {
        setGreska(out.error || 'Greška kod dodavanja.')
      }
    } catch (err) {
      setGreska(err.message || 'Greška kod dodavanja.')
    } finally {
      setClanBusy(false)
    }
  }

  async function dodajPartnera(e) {
    e.preventDefault()
    setGreska('')
    if (!gosp) return
    const { error } = await supabase.from('partner').insert({
      gospodarstvo_id: gosp.id,
      naziv: partnerNaziv,
      tip: partnerTip,
    })
    if (error) { setGreska(error.message); return }
    setPartnerNaziv('')
    ucitaj()
  }

  async function dodajObjekt(e) {
    e.preventDefault()
    setGreska('')
    if (!gosp) return
    const { error } = await supabase.from('objekt').insert({
      gospodarstvo_id: gosp.id,
      naziv: objektNaziv,
      kapacitet: objektKapacitet ? Number(objektKapacitet) : null,
    })
    if (error) { setGreska(error.message); return }
    setObjektNaziv('')
    setObjektKapacitet('')
    ucitaj()
  }

  async function dodajTurnus(e) {
    e.preventDefault()
    setGreska('')
    if (!gosp || !turObjektId || !turDatum) {
      setGreska('Odaberi objekt i datum useljenja.')
      return
    }
    const { error } = await supabase.from('turnus').insert({
      gospodarstvo_id: gosp.id,
      objekt_id: turObjektId,
      datum_useljenja: turDatum,
      status: 'aktivan',
    })
    if (error) { setGreska(error.message); return }
    setTurObjektId('')
    setTurDatum('')
    ucitaj()
  }

  async function odjava() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return <div className="center muted">Učitavam…</div>
  }

  return (
    <>
      <div className="topbar">
        <span>🐔 {gosp ? gosp.naziv : 'Poljoprivreda'}</span>
        <button className="link" style={{ color: '#fff' }} onClick={odjava}>Odjava</button>
      </div>

      <div className="wrap">
        <h1>Pregled</h1>

        <Link href="/dokumenti" className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'inherit', textDecoration: 'none' }}>
          <span className="naziv">📄 Dokumenti (arhiva)</span>
          <span className="muted" style={{ fontSize: 20 }}>›</span>
        </Link>

        {greska && <div className="greska">{greska}</div>}

        {/* OBJEKTI */}
        <div className="card">
          <h2>Objekti (peradarnici)</h2>
          {objekti.length === 0 && <p className="muted">Još nema objekata. Dodaj prvi ispod.</p>}
          {objekti.map((o) => (
            <div className="list-item" key={o.id}>
              <span className="naziv">{o.naziv}</span>
              {o.kapacitet ? <span className="muted"> · kapacitet {o.kapacitet}</span> : null}
            </div>
          ))}

          <form onSubmit={dodajObjekt}>
            <label>Naziv novog objekta</label>
            <input value={objektNaziv} onChange={(e) => setObjektNaziv(e.target.value)} placeholder="npr. Objekt 1" required />
            <label>Kapacitet (broj pilića)</label>
            <input type="number" value={objektKapacitet} onChange={(e) => setObjektKapacitet(e.target.value)} placeholder="npr. 22000" />
            <button type="submit" className="sek">+ Dodaj objekt</button>
          </form>
        </div>

        {/* TURNUSI */}
        <div className="card">
          <h2>Turnusi</h2>
          {turnusi.length === 0 && <p className="muted">Još nema turnusa.</p>}
          {turnusi.map((t) => (
            <Link className="list-item" key={t.id} href={`/turnus/${t.id}`} style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  <span className="naziv">{t.objekt ? t.objekt.naziv : 'Objekt'}</span>
                  <span className="muted"> · useljeno {t.datum_useljenja}</span>{' '}
                  <span className="badge">{t.status}</span>
                </span>
                <span className="muted" style={{ fontSize: 20 }}>›</span>
              </div>
            </Link>
          ))}

          <form onSubmit={dodajTurnus}>
            <label>Objekt</label>
            <select value={turObjektId} onChange={(e) => setTurObjektId(e.target.value)}>
              <option value="">— odaberi objekt —</option>
              {objekti.map((o) => (
                <option key={o.id} value={o.id}>{o.naziv}</option>
              ))}
            </select>
            <label>Datum useljenja</label>
            <input type="date" value={turDatum} onChange={(e) => setTurDatum(e.target.value)} />
            <button type="submit" className="sek">+ Dodaj turnus</button>
          </form>
        </div>

        {/* PARTNERI */}
        <div className="card">
          <h2>Partneri (dobavljači / kupci)</h2>
          {partneri.length === 0 && <p className="muted">Dodaj npr. Vindiju i kupce — koristit ćeš ih u kanalima turnusa.</p>}
          {partneri.map((p) => (
            <div className="list-item" key={p.id}>
              <span className="naziv">{p.naziv}</span>
              <span className="muted"> · {p.tip}</span>
            </div>
          ))}
          <form onSubmit={dodajPartnera}>
            <label>Naziv partnera</label>
            <input value={partnerNaziv} onChange={(e) => setPartnerNaziv(e.target.value)} placeholder="npr. Vindija" required />
            <label>Tip</label>
            <select value={partnerTip} onChange={(e) => setPartnerTip(e.target.value)}>
              <option value="kooperant">Kooperant (npr. Vindija)</option>
              <option value="dobavljac">Dobavljač</option>
              <option value="kupac">Kupac</option>
              <option value="ostalo">Ostalo</option>
            </select>
            <button type="submit" className="sek">+ Dodaj partnera</button>
          </form>
        </div>

        {/* ČLANOVI */}
        <div className="card">
          <h2>Članovi (pristup farmi)</h2>
          {korisnici.map((k) => (
            <div className="list-item" key={k.id}>
              <span className="naziv">{k.ime || k.email}</span>
              <span className="muted"> · {k.uloga}{k.ime ? ` · ${k.email}` : ''}</span>
            </div>
          ))}
          <form onSubmit={dodajClana}>
            <label>Ime nove osobe</label>
            <input value={clanIme} onChange={(e) => setClanIme(e.target.value)} placeholder="npr. Marijan" />
            <label>Email</label>
            <input type="email" value={clanEmail} onChange={(e) => setClanEmail(e.target.value)} placeholder="osoba@email.com" />
            <label>Početna lozinka (min. 6 znakova)</label>
            <input value={clanLozinka} onChange={(e) => setClanLozinka(e.target.value)} placeholder="lozinka koju mu javiš" />
            {clanPoruka && <div className="muted" style={{ marginTop: 8, color: 'var(--zelena-tamna)' }}>{clanPoruka}</div>}
            <button type="submit" className="sek" disabled={clanBusy}>{clanBusy ? 'Dodajem…' : '+ Dodaj člana'}</button>
          </form>
          <p className="muted" style={{ marginTop: 8 }}>
            Osoba dobije pristup svim podacima farme. Javi joj email i lozinku — promijenit će je nakon prijave.
          </p>
        </div>
      </div>
    </>
  )
}
