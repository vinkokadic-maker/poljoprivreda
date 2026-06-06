'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

// kategorije transakcija (smjer se izvodi iz kategorije)
const KATEGORIJE = [
  { v: 'pilici', l: 'Pilići (nabava)', smjer: 'ulaz' },
  { v: 'hrana', l: 'Hrana', smjer: 'ulaz' },
  { v: 'lijekovi', l: 'Lijekovi / vitamini', smjer: 'ulaz' },
  { v: 'struja', l: 'Struja', smjer: 'ulaz' },
  { v: 'plin', l: 'Plin / grijanje', smjer: 'ulaz' },
  { v: 'stelja', l: 'Stelja', smjer: 'ulaz' },
  { v: 'veterinar', l: 'Veterinar', smjer: 'ulaz' },
  { v: 'rad', l: 'Rad / ljudi', smjer: 'ulaz' },
  { v: 'pilici_radnicima', l: 'Pilići radnicima (utovar)', smjer: 'ulaz' },
  { v: 'ostalo', l: 'Ostali trošak', smjer: 'ulaz' },
  { v: 'prihod_otkup', l: 'Prihod — otkup', smjer: 'izlaz' },
  { v: 'prihod_ostalo', l: 'Prihod — ostalo', smjer: 'izlaz' },
]
const katLabel = (v) => KATEGORIJE.find((k) => k.v === v)?.l || v
const eur = (n) => `${(Number(n) || 0).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`

export default function TurnusDetalj() {
  const router = useRouter()
  const params = useParams()
  const turnusId = params.id

  const [loading, setLoading] = useState(true)
  const [turnus, setTurnus] = useState(null)
  const [unosi, setUnosi] = useState([])
  const [jata, setJata] = useState([])
  const [transakcije, setTransakcije] = useState([])
  const [partneri, setPartneri] = useState([])
  const [greska, setGreska] = useState('')

  // dnevni unos
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10))
  const [uginuca, setUginuca] = useState('')
  const [tezina, setTezina] = useState('')
  const [voda, setVoda] = useState('')
  const [temp, setTemp] = useState('')
  const [vlaga, setVlaga] = useState('')

  // jato
  const [jModel, setJModel] = useState('kooperacija')
  const [jDobavljac, setJDobavljac] = useState('')
  const [jKupac, setJKupac] = useState('')
  const [jBroj, setJBroj] = useState('')
  const [jCijenaPilica, setJCijenaPilica] = useState('')
  const [jCijenaOtkup, setJCijenaOtkup] = useState('')

  // transakcija
  const [tKat, setTKat] = useState('hrana')
  const [tKolicina, setTKolicina] = useState('')
  const [tJedinica, setTJedinica] = useState('kg')
  const [tCijena, setTCijena] = useState('')
  const [tIznos, setTIznos] = useState('')
  const [tOpis, setTOpis] = useState('')
  const [tJato, setTJato] = useState('')
  const [tDatum, setTDatum] = useState(new Date().toISOString().slice(0, 10))

  // količina × cijena → iznos (automatski)
  function osvjeziIznos(kol, cij) {
    const k = parseFloat(kol), c = parseFloat(cij)
    if (!isNaN(k) && !isNaN(c)) setTIznos((k * c).toFixed(2))
  }

  useEffect(() => {
    ucitaj()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function ucitaj() {
    setLoading(true)
    const { data: sess } = await supabase.auth.getSession()
    if (!sess.session) { router.push('/login'); return }

    const { data: t } = await supabase.from('turnus').select('*, objekt(naziv)').eq('id', turnusId).single()
    setTurnus(t || null)

    const { data: u } = await supabase.from('dnevni_unos').select('*').eq('turnus_id', turnusId).order('datum', { ascending: false })
    setUnosi(u || [])

    const { data: j } = await supabase.from('jato').select('*').eq('turnus_id', turnusId).order('model')
    setJata(j || [])

    const { data: tr } = await supabase.from('transakcija').select('*').eq('turnus_id', turnusId).order('datum', { ascending: false })
    setTransakcije(tr || [])

    const { data: p } = await supabase.from('partner').select('*').order('naziv')
    setPartneri(p || [])

    setLoading(false)
  }

  const partnerNaziv = (id) => partneri.find((p) => p.id === id)?.naziv || '—'
  const jatoNaziv = (j) => `${j.model === 'kooperacija' ? 'Kooperacija' : 'Vlastiti'}${j.dobavljac_id ? ' · ' + partnerNaziv(j.dobavljac_id) : ''}`
  const jatoNazivById = (id) => {
    const j = jata.find((x) => x.id === id)
    return j ? jatoNaziv(j) : null
  }

  function danStarosti(d) {
    if (!turnus?.datum_useljenja) return null
    const diff = Math.round((new Date(d) - new Date(turnus.datum_useljenja)) / 86400000) + 1
    return diff > 0 ? diff : null
  }

  async function dodajUnos(e) {
    e.preventDefault(); setGreska('')
    if (!turnus) return
    const { error } = await supabase.from('dnevni_unos').insert({
      gospodarstvo_id: turnus.gospodarstvo_id, turnus_id: turnusId, datum,
      dan_starosti: danStarosti(datum),
      uginuca: uginuca ? Number(uginuca) : 0,
      prosj_tezina_g: tezina ? Number(tezina) : null,
      voda_l: voda ? Number(voda) : null,
      temperatura_c: temp ? Number(temp) : null,
      vlaga_posto: vlaga ? Number(vlaga) : null,
    })
    if (error) { setGreska(error.code === '23505' ? 'Za taj datum već postoji unos.' : error.message); return }
    setUginuca(''); setTezina(''); setVoda(''); setTemp(''); setVlaga('')
    ucitaj()
  }

  async function dodajJato(e) {
    e.preventDefault(); setGreska('')
    if (!turnus || !jBroj) { setGreska('Upiši broj useljenih.'); return }
    const { error } = await supabase.from('jato').insert({
      gospodarstvo_id: turnus.gospodarstvo_id, turnus_id: turnusId, model: jModel,
      dobavljac_id: jDobavljac || null, kupac_id: jKupac || null,
      broj_useljenih: Number(jBroj),
      cijena_pilica: jCijenaPilica ? Number(jCijenaPilica) : null,
      cijena_otkupa_kg: jCijenaOtkup ? Number(jCijenaOtkup) : null,
    })
    if (error) { setGreska(error.message); return }
    setJBroj(''); setJCijenaPilica(''); setJCijenaOtkup(''); setJDobavljac(''); setJKupac('')
    ucitaj()
  }

  async function dodajTransakciju(e) {
    e.preventDefault(); setGreska('')
    if (!turnus || !tIznos) { setGreska('Upiši iznos.'); return }
    const kat = KATEGORIJE.find((k) => k.v === tKat)
    const { error } = await supabase.from('transakcija').insert({
      gospodarstvo_id: turnus.gospodarstvo_id, turnus_id: turnusId,
      jato_id: tJato || null, datum: tDatum, smjer: kat.smjer, kategorija: tKat,
      kolicina: tKolicina ? Number(tKolicina) : null,
      jedinica: tKolicina ? tJedinica : null,
      opis: tOpis || null, iznos: Number(tIznos),
    })
    if (error) { setGreska(error.message); return }
    setTKolicina(''); setTCijena(''); setTIznos(''); setTOpis(''); setTJato('')
    ucitaj()
  }

  async function obrisiUnos(id) { await supabase.from('dnevni_unos').delete().eq('id', id); ucitaj() }
  async function obrisiJato(id) { await supabase.from('jato').delete().eq('id', id); ucitaj() }
  async function obrisiTrans(id) { await supabase.from('transakcija').delete().eq('id', id); ucitaj() }

  async function odjava() { await supabase.auth.signOut(); router.push('/login') }

  if (loading) return <div className="center muted">Učitavam…</div>
  if (!turnus) return <div className="center muted">Turnus nije pronađen.</div>

  // izračuni
  const ukupnoUginuca = unosi.reduce((s, u) => s + (u.uginuca || 0), 0)
  const zadnjaTezina = unosi.find((u) => u.prosj_tezina_g != null)?.prosj_tezina_g
  const prihod = transakcije.filter((t) => t.smjer === 'izlaz').reduce((s, t) => s + Number(t.iznos), 0)
  const trosak = transakcije.filter((t) => t.smjer === 'ulaz').reduce((s, t) => s + Number(t.iznos), 0)
  const zarada = prihod - trosak

  // zarada po kanalu
  const poKanalu = jata.map((j) => {
    const tr = transakcije.filter((t) => t.jato_id === j.id)
    const p = tr.filter((t) => t.smjer === 'izlaz').reduce((s, t) => s + Number(t.iznos), 0)
    const c = tr.filter((t) => t.smjer === 'ulaz').reduce((s, t) => s + Number(t.iznos), 0)
    return { id: j.id, naziv: jatoNaziv(j), zarada: p - c }
  })

  return (
    <>
      <div className="topbar">
        <span>🐔 {turnus.objekt ? turnus.objekt.naziv : 'Turnus'}</span>
        <Link className="link" style={{ color: '#fff' }} href="/">← Natrag</Link>
      </div>

      <div className="wrap">
        <h1>Turnus</h1>

        {/* ZARADA */}
        <div className="card" style={{ background: zarada >= 0 ? '#e8f5e9' : '#fde8e8' }}>
          <h2>Zarada turnusa</h2>
          <div style={{ fontSize: 30, fontWeight: 800, color: zarada >= 0 ? 'var(--zelena-tamna)' : '#b91c1c' }}>{eur(zarada)}</div>
          <div className="muted">Prihod {eur(prihod)} − Trošak {eur(trosak)}</div>
          {poKanalu.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {poKanalu.map((k) => (
                <div key={k.id} className="muted">{k.naziv}: <b>{eur(k.zarada)}</b></div>
              ))}
            </div>
          )}
        </div>

        {/* OSNOVNO */}
        <div className="card">
          <div className="muted">Objekt: <b>{turnus.objekt ? turnus.objekt.naziv : '—'}</b></div>
          <div className="muted">Useljeno: <b>{turnus.datum_useljenja}</b> · <span className="badge">{turnus.status}</span></div>
          <div className="row" style={{ marginTop: 12 }}>
            <div><div className="muted">Uginuća</div><div style={{ fontSize: 20, fontWeight: 700 }}>{ukupnoUginuca}</div></div>
            <div><div className="muted">Zadnja težina</div><div style={{ fontSize: 20, fontWeight: 700 }}>{zadnjaTezina != null ? `${zadnjaTezina} g` : '—'}</div></div>
            <div><div className="muted">Dnevnih unosa</div><div style={{ fontSize: 20, fontWeight: 700 }}>{unosi.length}</div></div>
          </div>
        </div>

        {/* KANALI / JATA */}
        <div className="card">
          <h2>Kanali (jata)</h2>
          {jata.length === 0 && <p className="muted">Dodaj kanale — npr. Vindija (kooperacija) i vlastiti pilići drugog dobavljača.</p>}
          {jata.map((j) => (
            <div className="list-item" key={j.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="naziv">{jatoNaziv(j)}</span>
                <button className="link" style={{ color: '#b91c1c' }} onClick={() => obrisiJato(j.id)}>obriši</button>
              </div>
              <div className="muted">
                {j.broj_useljenih} kom
                {j.cijena_pilica != null ? ` · pile ${eur(j.cijena_pilica)}` : ''}
                {j.cijena_otkupa_kg != null ? ` · otkup ${eur(j.cijena_otkupa_kg)}/kg` : ''}
                {j.kupac_id ? ` · kupac: ${partnerNaziv(j.kupac_id)}` : ''}
              </div>
            </div>
          ))}
          <form onSubmit={dodajJato}>
            <label>Vrsta kanala</label>
            <select value={jModel} onChange={(e) => setJModel(e.target.value)}>
              <option value="kooperacija">Kooperacija (npr. Vindija)</option>
              <option value="vlastiti">Vlastiti (drugi dobavljač, svoja prodaja)</option>
            </select>
            <div className="row">
              <div>
                <label>Dobavljač</label>
                <select value={jDobavljac} onChange={(e) => setJDobavljac(e.target.value)}>
                  <option value="">—</option>
                  {partneri.map((p) => <option key={p.id} value={p.id}>{p.naziv}</option>)}
                </select>
              </div>
              <div>
                <label>Kupac</label>
                <select value={jKupac} onChange={(e) => setJKupac(e.target.value)}>
                  <option value="">—</option>
                  {partneri.map((p) => <option key={p.id} value={p.id}>{p.naziv}</option>)}
                </select>
              </div>
            </div>
            <label>Broj useljenih pilića</label>
            <input type="number" value={jBroj} onChange={(e) => setJBroj(e.target.value)} placeholder="npr. 21000" />
            <div className="row">
              <div>
                <label>Cijena pileta (€)</label>
                <input type="number" step="0.01" value={jCijenaPilica} onChange={(e) => setJCijenaPilica(e.target.value)} />
              </div>
              <div>
                <label>Otkup €/kg</label>
                <input type="number" step="0.01" value={jCijenaOtkup} onChange={(e) => setJCijenaOtkup(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="sek">+ Dodaj kanal</button>
          </form>
        </div>

        {/* TROŠKOVI I PRIHODI */}
        <div className="card">
          <h2>Troškovi i prihodi</h2>
          {transakcije.length === 0 && <p className="muted">Upiši troškove (pilići, hrana, struja…) i prihod od otkupa.</p>}
          {transakcije.map((t) => (
            <div className="list-item" key={t.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="naziv" style={{ color: t.smjer === 'izlaz' ? 'var(--zelena-tamna)' : 'inherit' }}>
                  {t.smjer === 'izlaz' ? '+ ' : '− '}{eur(t.iznos)}
                </span>
                <button className="link" style={{ color: '#b91c1c' }} onClick={() => obrisiTrans(t.id)}>obriši</button>
              </div>
              <div className="muted">
                {katLabel(t.kategorija)} · {t.datum}
                {t.kolicina != null ? ` · ${t.kolicina} ${t.jedinica || ''}` : ''}
                {t.jato_id ? ` · ${jatoNazivById(t.jato_id)}` : ''}
                {t.opis ? ` · ${t.opis}` : ''}
              </div>
            </div>
          ))}
          <form onSubmit={dodajTransakciju}>
            <label>Kategorija</label>
            <select value={tKat} onChange={(e) => setTKat(e.target.value)}>
              {KATEGORIJE.map((k) => <option key={k.v} value={k.v}>{k.l}{k.smjer === 'izlaz' ? ' (prihod)' : ''}</option>)}
            </select>
            <div className="row">
              <div style={{ flex: 2 }}>
                <label>Količina</label>
                <input type="number" step="0.01" value={tKolicina}
                  onChange={(e) => { setTKolicina(e.target.value); osvjeziIznos(e.target.value, tCijena) }}
                  placeholder="npr. 12000" />
              </div>
              <div>
                <label>Jed.</label>
                <select value={tJedinica} onChange={(e) => setTJedinica(e.target.value)}>
                  <option value="kg">kg</option>
                  <option value="kom">kom</option>
                  <option value="t">t</option>
                  <option value="L">L</option>
                  <option value="vreća">vreća</option>
                  <option value="kom.">paušal</option>
                </select>
              </div>
            </div>
            <div className="row">
              <div>
                <label>Cijena / {tJedinica} (€)</label>
                <input type="number" step="0.0001" value={tCijena}
                  onChange={(e) => { setTCijena(e.target.value); osvjeziIznos(tKolicina, e.target.value) }}
                  placeholder="npr. 0,52" />
              </div>
              <div>
                <label>Iznos (€)</label>
                <input type="number" step="0.01" value={tIznos} onChange={(e) => setTIznos(e.target.value)} placeholder="0,00" />
              </div>
            </div>
            <label>Datum</label>
            <input type="date" value={tDatum} onChange={(e) => setTDatum(e.target.value)} />
            {jata.length > 0 && (
              <>
                <label>Kanal (opcionalno)</label>
                <select value={tJato} onChange={(e) => setTJato(e.target.value)}>
                  <option value="">— cijeli turnus —</option>
                  {jata.map((j) => <option key={j.id} value={j.id}>{jatoNaziv(j)}</option>)}
                </select>
              </>
            )}
            <label>Opis (opcionalno)</label>
            <input value={tOpis} onChange={(e) => setTOpis(e.target.value)} placeholder="npr. otpremnica br. 123" />
            {greska && <div className="greska">{greska}</div>}
            <button type="submit">+ Spremi stavku</button>
          </form>
        </div>

        {/* DNEVNI UNOSI */}
        <div className="card">
          <h2>Dnevni unos</h2>
          <form onSubmit={dodajUnos}>
            <label>Datum</label>
            <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} required />
            <div className="row">
              <div><label>Uginuća (kom)</label><input type="number" value={uginuca} onChange={(e) => setUginuca(e.target.value)} placeholder="0" /></div>
              <div><label>Prosj. težina (g)</label><input type="number" value={tezina} onChange={(e) => setTezina(e.target.value)} placeholder="npr. 850" /></div>
            </div>
            <div className="row">
              <div><label>Voda (L)</label><input type="number" value={voda} onChange={(e) => setVoda(e.target.value)} /></div>
              <div><label>Temp. (°C)</label><input type="number" value={temp} onChange={(e) => setTemp(e.target.value)} /></div>
              <div><label>Vlaga (%)</label><input type="number" value={vlaga} onChange={(e) => setVlaga(e.target.value)} /></div>
            </div>
            <button type="submit" className="sek">+ Spremi unos</button>
          </form>

          {unosi.map((u) => (
            <div className="list-item" key={u.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="naziv">{u.datum}{u.dan_starosti ? ` · ${u.dan_starosti}. dan` : ''}</span>
                <button className="link" style={{ color: '#b91c1c' }} onClick={() => obrisiUnos(u.id)}>obriši</button>
              </div>
              <div className="muted">
                {u.uginuca ? `† ${u.uginuca}` : '† 0'}
                {u.prosj_tezina_g != null ? ` · ${u.prosj_tezina_g} g` : ''}
                {u.voda_l != null ? ` · ${u.voda_l} L` : ''}
                {u.temperatura_c != null ? ` · ${u.temperatura_c}°C` : ''}
                {u.vlaga_posto != null ? ` · ${u.vlaga_posto}%` : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
