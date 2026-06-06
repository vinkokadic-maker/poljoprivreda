import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'

// Model za čitanje dokumenata. Po želji promijeni (npr. na jeftiniji 'claude-haiku-4-5-20251001').
// Ako javi grešku o modelu, aktualne nazive nađeš na https://docs.claude.com
const MODEL = 'claude-sonnet-4-6'

const UPUTA = `Ti čitaš slike poljoprivrednih dokumenata na hrvatskom (otpremnice, računi, vagarski listovi, otkupni blokovi).
Iz slike izvuci podatke i vrati ISKLJUČIVO JSON (bez ikakvog teksta okolo, bez markdowna) u točno ovom obliku:
{
  "tip": "<jedan od: otpremnica_hrana, otpremnica_pilici, otpremnica_lijekovi, vagarski_list, otkupni_blok, veterinarski_nalaz, racun_rezije, racun_repromaterijal, poticaji, ostalo>",
  "dobavljac": "<naziv tvrtke ili prazan string>",
  "datum": "<YYYY-MM-DD ili prazan string>",
  "stavke": [
    { "opis": "<naziv artikla>", "kolicina": <broj ili null>, "jedinica": "<kg|kom|t|L|vreća ili prazno>", "cijena": <broj ili null>, "iznos": <broj ili null> }
  ],
  "ukupno": <broj ili null>
}
Pravila: brojeve vrati kao brojeve s točkom kao decimalnim separatorom, bez valute i bez tisućica-separatora. Ako podatak ne postoji na dokumentu, stavi null ili prazan string. Ne izmišljaj vrijednosti.`

function izvuciJson(text) {
  if (!text) return null
  // ukloni eventualne ```json ... ``` ograde
  const cisto = text.replace(/```json/gi, '').replace(/```/g, '')
  const prvi = cisto.indexOf('{')
  const zadnji = cisto.lastIndexOf('}')
  if (prvi === -1 || zadnji === -1) return null
  try {
    return JSON.parse(cisto.slice(prvi, zadnji + 1))
  } catch {
    return null
  }
}

export async function POST(req) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: 'Nedostaje ANTHROPIC_API_KEY na serveru.' }, { status: 500 })
    }
    const { base64, mediaType } = await req.json()
    if (!base64) {
      return Response.json({ error: 'Nema slike za obradu.' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // PDF se šalje kao 'document', slika kao 'image'
    const jePdf = mediaType === 'application/pdf'
    const izvor = jePdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: base64 } }

    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [izvor, { type: 'text', text: UPUTA }],
        },
      ],
    })

    const text = msg.content?.[0]?.type === 'text' ? msg.content[0].text : ''
    const data = izvuciJson(text)
    if (!data) {
      return Response.json({ error: 'AI nije vratio čitljiv rezultat.', raw: text }, { status: 502 })
    }
    return Response.json({ data })
  } catch (e) {
    return Response.json({ error: e?.message || 'Greška AI obrade.' }, { status: 500 })
  }
}
