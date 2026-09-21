// Tipi che rispecchiano lo schema SQL (supabase/migrations/0001_schema.sql).

export type Origine = 'lavoro' | 'universita' | 'personale' | 'viaggi'

export interface Evento {
  id: string
  utente_id: string
  origine: Origine
  titolo: string
  descrizione: string | null
  luogo: string | null
  inizio_utc: string // ISO, istante assoluto
  fine_utc: string // ISO, istante assoluto
  fuso_origine: string // IANA, dove è ancorato l'orario
  tutto_il_giorno: boolean
  id_esterno: string | null
  stato: 'confermato' | 'in_attesa'
  richiedente: string | null
  link_video: string | null
  // Chi ha materialmente creato la riga: diverso da utente_id solo quando un
  // delegato prenota sul calendario di qualcun altro (0009).
  creato_da: string | null
  // A quale serie ricorrente appartiene questa occorrenza (0012). null =
  // evento singolo. Le occorrenze sono righe vere: qui c'e' solo il legame.
  serie_id: string | null
  creato_il: string
  aggiornato_il: string
  // Solo lato client: da quale calendario condiviso arriva questo evento.
  // Non esiste nel database, lo attacca chi carica i dati.
  condiviso?: { proprietarioId: string; nome: string; indice: number; soloOccupato: boolean }
}

export interface PosizioneGiorno {
  utente_id: string
  giorno: string // YYYY-MM-DD
  fuso: string // IANA
  etichetta: string
}

export interface Preferenze {
  utente_id: string
  fuso_base: string // IANA: l'asse su cui e' disegnato il calendario
  etichetta_base: string
  // Secondo fuso mostrato a fianco. null = calendario mono-fuso.
  fuso_riferimento: string | null
  etichetta_riferimento: string | null
  // Nome mostrato a chi apre il link pubblico di prenotazione.
  nome_visualizzato: string | null
  // Rinomina delle quattro categorie: solo gli slot che l'utente ha cambiato.
  nomi_categorie: Partial<Record<Origine, string>>
  ufficio_inizio: number
  ufficio_fine: number
  // Anticipo del promemoria push, in minuti. null = nessun promemoria.
  promemoria_minuti: number | null
  // Il feed ICS appartiene a un account solo: la sync e' un privilegio, non
  // il default (vedi 0008_multiutente.sql e la Edge Function).
  sync_abilitato: boolean
  onboarding_fatto: boolean
  token_condivisione: string
  ultimo_sync: Record<string, { quando: string; conteggio?: number; errore?: string }>
}
