import { supabase } from './supabase'
import { applicaConfig, fusoDelBrowser, nomeDaFuso } from './tempo'
import type { Preferenze } from './types'

// La riga `preferenze` è ciò che rende l'app di questo utente diversa da quella
// di chiunque altro: dove sta, quale secondo fuso vuole a fianco (se ne vuole
// uno), come chiama le sue categorie, se può sincronizzare un feed esterno.
// La crea il trigger `su_nuovo_utente` alla registrazione.

// Legge la riga dell'utente. Se manca — trigger non ancora applicato su un
// progetto vecchio, riga cancellata a mano — la ricrea invece di lasciare l'app
// bloccata sul caricamento: senza preferenze non c'è calendario da disegnare.
export async function caricaPreferenze(): Promise<Preferenze | null> {
  const { data } = await supabase.from('preferenze').select('*').maybeSingle()
  if (data) return data as Preferenze

  const { data: utente } = await supabase.auth.getUser()
  if (!utente.user) return null
  const fuso = fusoDelBrowser()
  const { data: creata } = await supabase
    .from('preferenze')
    .insert({ utente_id: utente.user.id, fuso_base: fuso, etichetta_base: nomeDaFuso(fuso) })
    .select()
    .maybeSingle()
  return (creata as Preferenze) ?? null
}

// Scrive le colonne cambiate. Il filtro su utente_id NON è ridondante con la
// RLS: PostgREST rifiuta a priori un UPDATE senza WHERE
// ("21000: UPDATE requires a WHERE clause"), quindi senza `.eq` la scrittura
// fallisce con un 400 anche se la policy la permetterebbe.
export async function salvaPreferenze(utenteId: string, patch: Partial<Preferenze>): Promise<void> {
  const { error } = await supabase.from('preferenze').update(patch).eq('utente_id', utenteId)
  if (error) throw error
}

// Riversa le preferenze nello specchio a runtime di tempo.ts, da cui leggono le
// funzioni pure (geometria della griglia, formati, nomi delle categorie).
export function applicaPreferenze(p: Preferenze): void {
  applicaConfig({
    riferimento: p.fuso_riferimento,
    etichettaRiferimento: p.etichetta_riferimento ?? (p.fuso_riferimento ? nomeDaFuso(p.fuso_riferimento) : ''),
    ufficioInizio: p.ufficio_inizio,
    ufficioFine: p.ufficio_fine,
    nomiCategorie: p.nomi_categorie ?? {},
  })
}
