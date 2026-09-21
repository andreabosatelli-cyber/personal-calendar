import { DateTime } from 'luxon'
import { supabase } from './supabase'
import { LOCALE } from './tempo'

// La regola di ripetizione di un evento. Le occorrenze non stanno qui: sono
// righe vere in `eventi`, generate dal database (0012_ricorrenza.sql). Questo
// modulo e' solo il modo in cui la regola si scrive, si legge e si racconta.

export type UnitaRicorrenza = 'giorni' | 'settimane' | 'mesi'
export type FineRicorrenza = 'mai' | 'data' | 'conteggio'

export interface Ricorrenza {
  unita: UnitaRicorrenza
  intervallo: number
  fineTipo: FineRicorrenza
  fineData: string | null // YYYY-MM-DD, solo con fineTipo 'data'
  fineConteggio: number | null // solo con fineTipo 'conteggio'
}

export interface Serie extends Ricorrenza {
  id: string
}

// Le scelte rapide: coprono da sole quasi tutto quello che si ripete davvero.
// Tutto il resto ("ogni 10 giorni") passa da 'personalizzata'.
export type Preset = 'mai' | 'giornaliera' | 'settimanale' | 'bisettimanale' | 'mensile' | 'personalizzata'

export const PRESET: { id: Preset; label: string }[] = [
  { id: 'mai', label: 'Does not repeat' },
  { id: 'giornaliera', label: 'Daily' },
  { id: 'settimanale', label: 'Weekly' },
  { id: 'bisettimanale', label: 'Every 2 weeks' },
  { id: 'mensile', label: 'Monthly' },
  { id: 'personalizzata', label: 'Custom…' },
]

export const SENZA_FINE: Ricorrenza = {
  unita: 'settimane',
  intervallo: 1,
  fineTipo: 'mai',
  fineData: null,
  fineConteggio: null,
}

export function daPreset(p: Preset, base: Ricorrenza = SENZA_FINE): Ricorrenza {
  switch (p) {
    case 'giornaliera':
      return { ...base, unita: 'giorni', intervallo: 1 }
    case 'settimanale':
      return { ...base, unita: 'settimane', intervallo: 1 }
    case 'bisettimanale':
      return { ...base, unita: 'settimane', intervallo: 2 }
    case 'mensile':
      return { ...base, unita: 'mesi', intervallo: 1 }
    default:
      return base
  }
}

// Che preset rappresenta questa regola: serve a riaprire un evento ricorrente
// con il controllo posizionato dove l'utente lo aveva lasciato.
export function presetDi(r: Ricorrenza | null): Preset {
  if (!r) return 'mai'
  if (r.intervallo === 1 && r.unita === 'giorni') return 'giornaliera'
  if (r.intervallo === 1 && r.unita === 'settimane') return 'settimanale'
  if (r.intervallo === 2 && r.unita === 'settimane') return 'bisettimanale'
  if (r.intervallo === 1 && r.unita === 'mesi') return 'mensile'
  return 'personalizzata'
}

const SINGOLARE: Record<UnitaRicorrenza, string> = { giorni: 'day', settimane: 'week', mesi: 'month' }
const PLURALE: Record<UnitaRicorrenza, string> = { giorni: 'days', settimane: 'weeks', mesi: 'months' }

export function unitaLabel(u: UnitaRicorrenza, n: number): string {
  return n === 1 ? SINGOLARE[u] : PLURALE[u]
}

// "Every 2 weeks · until 12 Dec" — la riga che compare sotto il controllo e
// nella scheda di un evento ricorrente.
export function descriviRicorrenza(r: Ricorrenza): string {
  const ogni = r.intervallo === 1 ? `Every ${SINGOLARE[r.unita]}` : `Every ${r.intervallo} ${PLURALE[r.unita]}`
  if (r.fineTipo === 'data' && r.fineData) {
    const d = DateTime.fromISO(r.fineData).setLocale(LOCALE)
    return `${ogni} · until ${d.toFormat('d LLL yyyy')}`
  }
  if (r.fineTipo === 'conteggio' && r.fineConteggio) return `${ogni} · ${r.fineConteggio} times`
  return ogni
}

// La regola dietro un'occorrenza, per riaprirla in modifica.
export async function leggiSerie(serieId: string): Promise<Serie | null> {
  const { data } = await supabase
    .from('serie_ricorrenti')
    .select('id, unita, intervallo, fine_tipo, fine_data, fine_conteggio')
    .eq('id', serieId)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id as string,
    unita: data.unita as UnitaRicorrenza,
    intervallo: data.intervallo as number,
    fineTipo: data.fine_tipo as FineRicorrenza,
    fineData: (data.fine_data as string | null) ?? null,
    fineConteggio: (data.fine_conteggio as number | null) ?? null,
  }
}

// I tre argomenti di fine che il database si aspetta, coerenti col vincolo
// serie_fine_coerente: chi non c'entra viaggia null.
function argomentiFine(r: Ricorrenza) {
  return {
    p_unita: r.unita,
    p_intervallo: r.intervallo,
    p_fine_tipo: r.fineTipo,
    p_fine_data: r.fineTipo === 'data' ? r.fineData : null,
    p_fine_conteggio: r.fineTipo === 'conteggio' ? r.fineConteggio : null,
  }
}

// L'evento appena creato diventa il capostipite della serie.
export async function creaSerie(eventoId: string, r: Ricorrenza): Promise<void> {
  const { error } = await supabase.rpc('crea_serie', { p_evento: eventoId, ...argomentiFine(r) })
  if (error) throw error
}

// "Questa e le successive": il client ha gia' salvato i campi nuovi su questa
// occorrenza, il database taglia qui e rigenera da qui in avanti.
export async function aggiornaSerieDa(eventoId: string, r: Ricorrenza): Promise<void> {
  const { error } = await supabase.rpc('aggiorna_serie_da', { p_evento: eventoId, ...argomentiFine(r) })
  if (error) throw error
}

export async function eliminaSerieDa(eventoId: string): Promise<void> {
  const { error } = await supabase.rpc('elimina_serie_da', { p_evento: eventoId })
  if (error) throw error
}

// Toglie la ripetizione da questa occorrenza in avanti: la riga resta, le volte
// successive no.
export async function staccaSerieDa(eventoId: string): Promise<void> {
  const { error } = await supabase.rpc('stacca_serie_da', { p_evento: eventoId })
  if (error) throw error
}
