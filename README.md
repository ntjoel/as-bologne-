# A.S. Bologne

Sito web della squadra A.S. Bologne per calendario, disponibilita, presenze,
statistiche, rosa, staff e galleria fotografica.

La stagione sportiva va dal 1 settembre al 31 agosto. Dal primo accesso dopo
il 1 settembre il sito crea automaticamente la nuova stagione, mostra i
conteggi correnti a zero e conserva le statistiche precedenti nell'archivio.

- Produzione: <https://project-zxasn.vercel.app>
- Hosting frontend: Vercel
- Database, autenticazione e file: Supabase
- Frontend: HTML, CSS e JavaScript senza processo di build

## Stato importante

Stato della revisione del 23 luglio 2026:

- il frontend nel repository usa Supabase Auth e verifica il ruolo tramite
  `is_admin()`; la vecchia password amministrativa incorporata nel JavaScript
  non e piu presente;
- le migrazioni preparate rimuovono le scritture anonime dalle tabelle
  gestionali e le riservano agli amministratori autenticati;
- alcuni dati dinamici sono gia protetti con `escapeHtml()` o `textContent`, ma
  restano interpolazioni non sicure in `innerHTML`, in particolare nelle liste
  di partite e in alcune viste statistiche/amministrative;
- la conferma visiva della persona nella scheda disponibilita non costituisce
  una verifica dell'identita: un visitatore puo ancora selezionare un'altra
  persona e sostituirne la risposta;
- nomi e risposte di disponibilita restano leggibili pubblicamente;
- policy Storage, stato effettivo delle migrazioni in produzione e negazione
  delle scritture anonime devono essere verificati direttamente su Supabase.

La chiave `anon` di Supabase puo essere pubblica per progettazione. La sicurezza
dipende dalle policy RLS, dalle funzioni RPC e dalle policy Storage, non dalla
segretezza della pagina `/admin`.

Non considerare una correzione SQL attiva solo perche il relativo file e
presente nel repository. Prima di ogni rilascio seguire il piano coordinato in
`docs/MANUTENZIONE.md` e verificarne l'applicazione in staging e produzione.

Nel repository e stata preparata la migrazione
`20260614_disponibilita_whatsapp.sql`, insieme al nuovo frontend, per:

- accesso admin con sola password visibile e identita tecnica Supabase Auth;
- disponibilita di giocatori e staff con conferma visiva e telefono raccolto se
  manca;
- telefono facoltativo per persone fuori lista, salvato in tabella privata;
- scadenza della raccolta disponibilita;
- telefoni conservati in una tabella privata;
- messaggi WhatsApp precompilati per il gruppo o per singole persone;
- Edge Function Supabase per invio WhatsApp automatico, da attivare con
  credenziali WhatsApp Business Platform salvate come segreti server.

Questi file non devono essere distribuiti separatamente. Seguire la procedura
di rilascio descritta in `docs/MANUTENZIONE.md`.

## Documentazione

- [Manuale di utilizzo](docs/MANUALE_UTENTE.md)
- [Guida di manutenzione](docs/MANUTENZIONE.md)
- [Architettura e dati](docs/ARCHITETTURA.md)
- [Audit e piano di miglioramento](docs/ANALISI_E_MIGLIORAMENTI.md)

## Avvio locale

Non aprire direttamente `index.html` con `file://`, perche usa moduli
JavaScript. Avviare un server HTTP dalla cartella del progetto:

```powershell
python -m http.server 8080
```

Aprire poi:

- sito pubblico: <http://localhost:8080>
- pannello admin: <http://localhost:8080/admin.html>

L'ambiente locale usa attualmente lo stesso progetto Supabase della produzione:
qualsiasi operazione amministrativa modifica dati reali. Per sviluppi futuri e
necessario creare un progetto Supabase separato di staging.

## Struttura

```text
index.html                     Pagina pubblica
app.js                         Logica del sito pubblico
admin.html                     Pannello amministrativo
admin.js                       Logica amministrativa
season.mjs                     Calcolo e caricamento delle stagioni
style.css                      Stili condivisi
vercel.json                    Routing Vercel
supabase_setup.sql             Schema iniziale storico
aggiungi_staff_maglia.sql      Migrazione staff e maglia
aggiungi_impostazioni.sql      Migrazione impostazioni/logo
20260614_disponibilita_whatsapp.sql
                               Auth, telefoni, disponibilita, scadenze
20260630_disponibilita_staff_telefono_opzionale.sql
                               Staff in disponibilita e telefono opzionale
20260630_notifiche_whatsapp_automatiche.sql
                               Log degli invii WhatsApp automatici
20260723_stagioni_archivio_automatico.sql
                               Stagioni settembre/agosto e archivio automatico
autorizza_admin.sql            Autorizza l'account tecnico nel pannello
popola_dati.sql                Dati dimostrativi, non usare in produzione
supabase/functions/            Edge Functions Supabase
tests/                         Test automatici del calcolo stagione
docs/                          Documentazione operativa e tecnica
```

## Regola di rilascio

Ogni modifica deve seguire questa sequenza:

1. backup del database e verifica del ripristino;
2. prova in staging con dati non reali;
3. controllo delle pagine pubblica e admin da desktop e telefono;
4. commit su un branch e revisione delle differenze;
5. Preview Deployment Vercel;
6. merge su `main` e verifica della produzione;
7. annotazione di data, commit e migrazioni applicate.

Non inserire password, `service_role` key o credenziali del database nel
repository.
