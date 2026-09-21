# PRODUCT.md — personal-calendar

register: product

## Product purpose

Un calendario personale a **doppio fuso orario Singapore ↔ Roma** per una sola
persona (Andrea), che vive a Singapore ma lavora da remoto per un'azienda
italiana e studia in un'università italiana. Il problema centrale non è
"vedere gli impegni": è **conciliare due orologi**. Un meeting di lavoro o una
lezione fissati in ora di Roma cadono in un momento diverso della giornata di
Singapore, e Andrea deve capire a colpo d'occhio se collidono con il resto
della sua giornata locale.

Ogni istante è ancorato due volte: *quando* (istante UTC assoluto) e *dove*
(fuso di origine). L'asse principale è Singapore; Roma è sempre leggibile in
parallelo.

## Users

Un utente reale, singolo. Usa l'app da un monitor desktop largo alla scrivania
durante la giornata lavorativa, e dal telefono in mobilità. Conosce a memoria
i propri impegni: non gli serve essere "guidato", gli serve **densità di
informazione affidabile e immediata**.

## Le tre sorgenti

- **Lavoro** — feed ICS Outlook, sola lettura, sincronizzato da una Edge
  Function. Ancorato a `Europe/Rome`.
- **Università** — importato da un foglio Excel che Andrea fornisce;
  inserito nel DB come sorgente `universita`, sola lettura. Ancorato a
  `Europe/Rome` (lezioni in Italia). *(Sostituisce il vecchio piano di leggere
  un feed ICS ateneo, mai trovato.)*
- **Personale** — l'unica sorgente scrivibile: Andrea crea/modifica/elimina.

## Tono e carattere

Strumento, non vetrina. Linguaggio iOS/Apple: sobrio, tabellare, tipografia di
sistema, niente decorazione fine a sé stessa. La personalità sta nella
**chiarezza del doppio fuso**, non in orpelli. Deve sembrare un'app di sistema
ben fatta, non una web-app generica.

## Anti-references

- Le web-app calendario generiche con card ovunque e gradienti.
- Il "cruscotto SaaS" con metrica gigante e statistiche di contorno.
- Qualsiasi cosa che faccia dire "questo l'ha fatto un'AI".

## Principi strategici

1. **Il fuso è il prodotto.** Ogni schermata deve rendere il rapporto
   Singapore↔Roma leggibile senza calcoli mentali.
2. **Densità onesta.** Preferire informazione vera e compatta a spazi vuoti
   decorativi. Su desktop largo lo spazio si riempie di *giorni*, non di aria.
3. **Sola lettura vs scrivibile è visibile.** Lavoro e università non si
   toccano; personale sì. La differenza deve essere ovvia.
4. **Affidabilità prima di tutto.** Stato di sync sempre visibile; un errore di
   rete non deve far sembrare l'app rotta.
