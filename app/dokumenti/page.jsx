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
const tipLabel = (v) => TIPOVI.find((t) => t.v === v)?.l || v
const eur = (n) => `${(Number(n) || 0).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

// tip dokumenta -> kategorija troška
function tipUKategoriju(tip) {
  if (tip === 'otpremnica_hrana') return 'hrana'
  if (tip === 'otpremnica_pilici') return 'pilici'
  if (tip === 'otpremnica_lijekovi') return 'lijekovi'
  if (tip === 'otkupni_blok' || tip === 'vagarski_list') return 'prihod_otkup'
  if (tip === 'racun_rezije') return 'ostalo'
  return 'ostalo'
}
const jeUlaz = (kat) => kat !== 'prihod_otkup' && kat !== 'prihod_ostalo'

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// pročitaj datoteku kao base64 (za PDF — šalje se cijela)
function citajBase64(file, mediaType) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ base64: String(reader.result).split(',')[1], mediaType })
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

// smanji sliku i vrati base64 (manje za slanje AI-u, brže i jeftinije)
function smanjiSliku(file, maxDim = 1600, quality = 0.8) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) { resolve(null); return }
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        const scale = Math.min(1, maxDim / Math.max(width, height))
        width = Math.round(width * scale); height = Math.round(height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' })
      }
      img.onerror = () => resolve(null)
      img.src = reader.result
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

export default function Dokumenti() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [gosp, setGosp] = useState(null)
  const [dokumenti, setDokumenti] = useState([])
  const [turnusi, setTurnusi] = useState([])
  const [jata, setJata] = useState([])
  const [urls, setUrls] = useState({})
  const [greska, setGreska] = useState('')

  // forma
  const [file, setFile] = useState(null)
  const [tip, setTip] = useState('otpremnica_hrana')
  const [busy, setBusy] = useState('')

  // odabir za knjiženje (po dokumentu)
  const [izborTurnus, setIzborTurnus] = useState({})
  const [izborJato, setIzborJato] = useState({})

  useEffect(() => {
    ucitaj()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function ucitaj() {
    setLoading(true)
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) { router.push('/login'); return }
    setUserId(sess.session.user.id)

    const { data: g } = await supabase.from('gospodarstvo').select('*').limit(1).single()
    setGosp(g || null)

    const { data: d } = await supabase.from('dokument').select('*').order('kreirano', { ascending: false })
    setDokumenti(d || [])

    const { data: t } = await supabase.from('turnus').select('*, objekt(naziv)').order('datum_useljenja', { ascending: false })
    setTurnusi(t || [])

    const { data: j } = await supabase.from('jato').select('*')
    setJata(j || [])

    const map = {}
    for (const dok of d || []) {
      const { data: signed } = await supabase.storage.from('dokumenti').createSignedUrl(dok.datoteka_url, 3600)
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
    setBusy('upload')
    try {
      // 1. upload originala u storage
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${gosp.id}/${uuid()}.${ext}`
      const { error: upErr } = await supabase.storage.from('dokumenti').upload(path, file, { upsert: false })
      if (upErr) throw upErr

      // 2. kreiraj dokument red
      const { data: dok, error: insErr } = await supabase.from('dokument').insert({
        gospodarstvo_id: gosp.id, tip, status: 'novo', datoteka_url: path, izvor: 'foto',
      }).select().single()
      if (insErr) throw insErr

      // 3. AI prepoznavanje (slike i PDF)
      let aiSadrzaj = null
      if (file.type.startsWith('image/')) aiSadrzaj = await smanjiSliku(file)
      else if (file.type === 'application/pdf') aiSadrzaj = await citajBase64(file, 'application/pdf')

      if (aiSadrzaj) {
        setBusy('ai')
        const res = await fetch('/api/dokument-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(aiSadrzaj),
        })
        const out = await res.json()
        if (out.data) {
          await supabase.from('dokument').update({
            status: 'prepoznato',
            ai_podaci: out.data,
            tip: out.data.tip || tip,
            datum_dokumenta: out.data.datum || null,
          }).eq('id', dok.id)
        } else {
          setGreska('AI nije uspio pročitati: ' + (out.error || 'nepoznato'))
        }
      }

      setFile(null)
      const inp = document.getElementById('fileInput')
      if (inp) inp.value = ''
      ucitaj()
    } catch (err) {
      setGreska(err.message || 'Greška kod spremanja.')
    } finally {
      setBusy('')
    }
  }

  // pokreni AI čitanje na već spremljenom dokumentu (iz storagea)
  async function procitaj(dok) {
    setGreska('')
    setBusy('ai-' + dok.id)
    try {
      const url = urls[dok.id]
      if (!url) throw new Error('Datoteka nije dostupna.')
      const resp = await fetch(url)
      const blob = await resp.blob()
      const jePdf = dok.datoteka_url.toLowerCase().endsWith('.pdf') || blob.type === 'application/pdf'
      const sadrzaj = jePdf ? await citajBase64(blob, 'application/pdf') : await smanjiSliku(blob)
      if (!sadrzaj) throw new Error('Format datoteke nije podržan za čitanje.')

      const res = await fetch('/api/dokument-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sadrzaj),
      })
      const out = await res.json()
      if (out.data) {
        await supabase.from('dokument').update({
          status: 'prepoznato',
          ai_podaci: out.data,
          tip: out.data.tip || dok.tip,
          datum_dokumenta: out.data.datum || null,
        }).eq('id', dok.id)
        ucitaj()
      } else {
        setGreska('AI nije uspio: ' + (out.error || 'nepoznato'))
      }
    } catch (err) {
      setGreska(err.message || 'Greška kod čitanja.')
    } finally {
      setBusy('')
    }
  }

  async function knjizi(dok) {
    setGreska('')
    const turnusId = izborTurnus[dok.id]
    if (!turnusId) { setGreska('Odaberi turnus prije knjiženja.'); return }
    const jatoId = izborJato[dok.id] || null
    const ai = dok.ai_podaci || {}
    const kat = tipUKategoriju(dok.tip)
    const smjer = jeUlaz(kat) ? 'ulaz' : 'izlaz'
    const datum = dok.datum_dokumenta || ai.datum || new Date().toISOString().slice(0, 10)

    let stavke = Array.isArray(ai.stavke) ? ai.stavke.filter((s) => s.iznos != null) : []
    // ako nema stavki s iznosom, a postoji ukupno -> jedna stavka
    if (stavke.length === 0 && ai.ukupno != null) {
      stavke = [{ opis: tipLabel(dok.tip), iznos: ai.ukupno, kolicina: null, jedinica: null }]
    }
    if (stavke.length === 0) { setGreska('Nema iznosa za knjiženje.'); return }

    setBusy('knjizi-' + dok.id)
    try {
      const redovi = stavke.map((s) => ({
        gospodarstvo_id: gosp.id, turnus_id: turnusId, jato_id: jatoId,
        datum, smjer, kategorija: kat,
        opis: s.opis || tipLabel(dok.tip),
        kolicina: s.kolicina != null ? Number(s.kolicina) : null,
        jedinica: s.jedinica || null,
        iznos: Number(s.iznos),
        dokument_id: dok.id,
      }))
      const { error: trErr } = await supabase.from('transakcija').insert(redovi)
      if (trErr) throw trErr

      await supabase.from('dokument').update({
        status: 'potvrdeno', turnus_id: turnusId, jato_id: jatoId,
        potvrdio_id: userId, potvrdeno_kada: new Date().toISOString(),
      }).eq('id', dok.id)

      ucitaj()
    } catch (err) {
      setGreska(err.message || 'Greška kod knjiženja.')
    } finally {
      setBusy('')
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
            <input id="fileInput" type="file" accept="image/*,application/pdf" capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <label>Tip (ako AI promaši, ispravi kasnije)</label>
            <select value={tip} onChange={(e) => setTip(e.target.value)}>
              {TIPOVI.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
            {greska && <div className="greska">{greska}</div>}
            <button type="submit" disabled={!!busy}>
              {busy === 'upload' ? 'Spremam…' : busy === 'ai' ? '🤖 Čitam dokument…' : '+ Spremi i pročitaj'}
            </button>
          </form>
          <p className="muted" style={{ marginTop: 10 }}>
            Nakon spremanja AI pročita sliku i predloži podatke. Ti odabereš turnus i potvrdiš prije knjiženja.
          </p>
        </div>

        {/* Arhiva */}
        <div className="card">
          <h2>Spremljeno ({dokumenti.length})</h2>
          {dokumenti.length === 0 && <p className="muted">Još nema dokumenata.</p>}
          {dokumenti.map((d) => {
            const ai = d.ai_podaci || {}
            const slikaUrl = urls[d.id]
            const jeSlika = d.datoteka_url.match(/\.(jpg|jpeg|png|webp|gif)$/i)
            return (
              <div className="list-item" key={d.id}>
                <div style={{ display: 'flex', gap: 12 }}>
                  {slikaUrl && jeSlika ? (
                    <a href={slikaUrl} target="_blank" rel="noreferrer">
                      <img src={slikaUrl} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--rub)' }} />
                    </a>
                  ) : (
                    <a href={slikaUrl} target="_blank" rel="noreferrer" style={{ width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--siva)', borderRadius: 8, border: '1px solid var(--rub)', textDecoration: 'none' }}>📄</a>
                  )}
                  <div style={{ flex: 1 }}>
                    <div className="naziv">{tipLabel(d.tip)}</div>
                    <div className="muted">
                      {d.datum_dokumenta || ai.datum || 'bez datuma'}
                      {ai.dobavljac ? ` · ${ai.dobavljac}` : ''} · <span className="badge">{d.status}</span>
                    </div>
                    <button className="link" style={{ color: '#b91c1c', padding: 0 }} onClick={() => obrisi(d)}>obriši</button>
                  </div>
                </div>

                {/* AI prijedlog + knjiženje */}
                {d.status === 'prepoznato' && (
                  <div style={{ marginTop: 10, background: 'var(--siva)', borderRadius: 10, padding: 12 }}>
                    <div className="muted" style={{ marginBottom: 6 }}>🤖 Prepoznato (provjeri pa potvrdi):</div>
                    {Array.isArray(ai.stavke) && ai.stavke.length > 0 ? (
                      ai.stavke.map((s, i) => (
                        <div key={i} style={{ fontSize: 14 }}>
                          • {s.opis || '—'}{s.kolicina != null ? ` · ${s.kolicina} ${s.jedinica || ''}` : ''}{s.iznos != null ? ` · ${eur(s.iznos)}` : ''}
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: 14 }}>Ukupno: {ai.ukupno != null ? eur(ai.ukupno) : '—'}</div>
                    )}

                    <label>Knjiži u turnus</label>
                    <select value={izborTurnus[d.id] || ''} onChange={(e) => setIzborTurnus({ ...izborTurnus, [d.id]: e.target.value })}>
                      <option value="">— odaberi turnus —</option>
                      {turnusi.map((t) => (
                        <option key={t.id} value={t.id}>{t.objekt ? t.objekt.naziv : 'Objekt'} · {t.datum_useljenja}</option>
                      ))}
                    </select>

                    {izborTurnus[d.id] && jata.filter((j) => j.turnus_id === izborTurnus[d.id]).length > 0 && (
                      <>
                        <label>Kanal (opcionalno)</label>
                        <select value={izborJato[d.id] || ''} onChange={(e) => setIzborJato({ ...izborJato, [d.id]: e.target.value })}>
                          <option value="">— cijeli turnus —</option>
                          {jata.filter((j) => j.turnus_id === izborTurnus[d.id]).map((j) => (
                            <option key={j.id} value={j.id}>{j.model === 'kooperacija' ? 'Kooperacija' : 'Vlastiti'}</option>
                          ))}
                        </select>
                      </>
                    )}

                    <button onClick={() => knjizi(d)} disabled={busy === 'knjizi-' + d.id}>
                      {busy === 'knjizi-' + d.id ? 'Knjižim…' : '✓ Potvrdi i knjiži u troškove'}
                    </button>
                  </div>
                )}

                {d.status === 'novo' && (
                  <div style={{ marginTop: 8 }}>
                    <button className="sek" onClick={() => procitaj(d)} disabled={busy === 'ai-' + d.id}>
                      {busy === 'ai-' + d.id ? '🤖 Čitam…' : '🤖 Pročitaj (AI)'}
                    </button>
                    {busy === 'ai-' + d.id && <div className="muted">Trenutak, šaljem AI-u…</div>}
                    {greska && <div className="greska">{greska}</div>}
                  </div>
                )}

                {d.status === 'potvrdeno' && (
                  <div className="muted" style={{ marginTop: 6 }}>✓ Proknjiženo u troškove turnusa.</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
