'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

const TIPOVI = [
  { v: 'otpremnica_hrana', l: 'Otpremnica — hrana' },
  { v: 'otpremnica_pilici', l: 'Otpremnica — pilići' },
  { v: 'otpremnica_lijekovi', l: 'Otpremnica — lijekovi' },
  { v: 'vagarski_list', l: 'Vagarski list' },
  { v: 'otkupni_blok', l: 'Otkupni blok' },
  { v: 'veterinarski_nalaz', l: 'Veterinarski nalaz' },
  { v: 'racun_rezije', l: 'Račun — režije' },
  { v: 'racun_repromaterijal', l: 'Račun — repromaterijal' },
  { v: 'poticaji', l: 'Poticaji' },
  { v: 'ostalo', l: 'Ostalo' },
]

function tipLabel(v) {
  return TIPOVI.find((t) => t.v === v)?.l || v
}

// Radi i izvan https (npr. lokalna mreža http://192.168...),
// gdje crypto.randomUUID nije dostupan.
function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export default function Dokumenti() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [gosp, setGosp] = useState(null)
  const [dokumenti, setDokumenti] = useState([])
  const [urls, setUrls] = useState({}) // id -> signed url
  const [greska, setGreska] = useState('')

  // forma
  const [file, setFile] = useState(null)
  const [tip, setTip] = useState('otpremnica_hrana')
  const [datumDok, setDatumDok] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    ucitaj()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function ucitaj() {
    setLoading(true)
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) { router.push('/login'); return }

    const { data: g } = await supabase.from('gospodarstvo').select('*').limit(1).single()
    setGosp(g || null)

    const { data: d } = await supabase
      .from('dokument')
      .select('*')
      .order('kreirano', { ascending: false })
    setDokumenti(d || [])

    // signed URL-ovi za pregled (bucket je privatan)
    const map = {}
    for (const dok of d || []) {
      const { data: signed } = await supabase
        .storage.from('dokumenti')
        .createSignedUrl(dok.datoteka_url, 3600)
      if (signed) map[dok.id] = signed.signedUrl
    }
    setUrls(map)
    setLoading(false)
  }

  async function spremi(e) {
    e.preventDefault()
    setGreska('')
    if (!gosp) return
    if (!file) { setGreska('Odaberi ili slikaj dokument.'); return }
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const naziv = `${uuid()}.${ext}`
      const path = `${gosp.id}/${naziv}`

      const { error: upErr } = await supabase
        .storage.from('dokumenti')
        .upload(path, file, { upsert: false })
      if (upErr) throw upErr

      const { error: insErr } = await supabase.from('dokument').insert({
        gospodarstvo_id: gosp.id,
        tip,
        status: 'novo',
        datum_dokumenta: datumDok || null,
        datoteka_url: path,
        izvor: 'foto',
      })
      if (insErr) throw insErr

      setFile(null)
      setDatumDok('')
      // reset file inputa
      const inp = document.getElementById('fileInput')
      if (inp) inp.value = ''
      ucitaj()
    } catch (err) {
      setGreska(err.message || 'Greška kod spremanja.')
    } finally {
      setUploading(false)
    }
  }

  async function obrisi(dok) {
    await supabase.storage.from('dokumenti').remove([dok.datoteka_url])
    await supabase.from('dokument').delete().eq('id', dok.id)
    ucitaj()
  }

  if (loading) return <div className="center muted">Učitavam…</div>

  return (
    <>
      <div className="topbar">
        <span>📄 Dokumenti</span>
        <Link className="link" style={{ color: '#fff' }} href="/">← Natrag</Link>
      </div>

      <div className="wrap">
        <h1>Arhiva dokumenata</h1>

        {/* Novi dokument */}
        <div className="card">
          <h2>Novi dokument</h2>
          <form onSubmit={spremi}>
            <label>Slikaj ili odaberi</label>
            <input
              id="fileInput"
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <label>Tip dokumenta</label>
            <select value={tip} onChange={(e) => setTip(e.target.value)}>
              {TIPOVI.map((t) => (
                <option key={t.v} value={t.v}>{t.l}</option>
              ))}
            </select>
            <label>Datum na dokumentu (opcionalno)</label>
            <input type="date" value={datumDok} onChange={(e) => setDatumDok(e.target.value)} />

            {greska && <div className="greska">{greska}</div>}
            <button type="submit" disabled={uploading}>
              {uploading ? 'Spremam…' : '+ Spremi dokument'}
            </button>
          </form>
          <p className="muted" style={{ marginTop: 10 }}>
            Na mobitelu „Slikaj ili odaberi" otvara kameru. Automatsko prepoznavanje teksta dolazi kasnije.
          </p>
        </div>

        {/* Arhiva */}
        <div className="card">
          <h2>Spremljeno ({dokumenti.length})</h2>
          {dokumenti.length === 0 && <p className="muted">Još nema dokumenata.</p>}
          {dokumenti.map((d) => (
            <div className="list-item" key={d.id}>
              <div style={{ display: 'flex', gap: 12 }}>
                {urls[d.id] && d.datoteka_url.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                  <a href={urls[d.id]} target="_blank" rel="noreferrer">
                    <img src={urls[d.id]} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--rub)' }} />
                  </a>
                ) : (
                  <a href={urls[d.id]} target="_blank" rel="noreferrer" style={{ width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--siva)', borderRadius: 8, border: '1px solid var(--rub)', textDecoration: 'none' }}>📄</a>
                )}
                <div style={{ flex: 1 }}>
                  <div className="naziv">{tipLabel(d.tip)}</div>
                  <div className="muted">
                    {d.datum_dokumenta ? d.datum_dokumenta : 'bez datuma'} · <span className="badge">{d.status}</span>
                  </div>
                  <button className="link" style={{ color: '#b91c1c', padding: 0 }} onClick={() => obrisi(d)}>obriši</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
