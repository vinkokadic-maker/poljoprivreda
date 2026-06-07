import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(req) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!service) {
      return Response.json({ error: 'Nedostaje SUPABASE_SERVICE_ROLE_KEY na serveru.' }, { status: 500 })
    }

    // 1. Provjeri tko poziva (token iz Authorization headera)
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
    if (!token) return Response.json({ error: 'Niste prijavljeni.' }, { status: 401 })

    const pub = createClient(url, anon)
    const { data: u, error: ue } = await pub.auth.getUser(token)
    if (ue || !u?.user) return Response.json({ error: 'Neispravna prijava.' }, { status: 401 })

    // 2. Nađi gospodarstvo pozivatelja (service role -> bez RLS-a)
    const admin = createClient(url, service, { auth: { persistSession: false } })
    const { data: ja, error: je } = await admin
      .from('korisnik').select('gospodarstvo_id').eq('id', u.user.id).single()
    if (je || !ja) return Response.json({ error: 'Nemate povezano gospodarstvo.' }, { status: 403 })

    // 3. Podaci novog korisnika
    const { email, ime, lozinka, uloga } = await req.json()
    if (!email || !lozinka) {
      return Response.json({ error: 'Email i lozinka su obavezni.' }, { status: 400 })
    }
    if (String(lozinka).length < 6) {
      return Response.json({ error: 'Lozinka mora imati barem 6 znakova.' }, { status: 400 })
    }

    // 4. Kreiraj korisnika vezanog na ISTO gospodarstvo (preko metapodataka)
    const { error: ce } = await admin.auth.admin.createUser({
      email,
      password: lozinka,
      email_confirm: true, // bez potvrde maila
      user_metadata: {
        ime: ime || '',
        gospodarstvo_id: ja.gospodarstvo_id,
        uloga: uloga || 'clan',
      },
    })
    if (ce) {
      const msg = /already registered|exists/i.test(ce.message) ? 'Taj email je već registriran.' : ce.message
      return Response.json({ error: msg }, { status: 400 })
    }

    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: e?.message || 'Greška.' }, { status: 500 })
  }
}
