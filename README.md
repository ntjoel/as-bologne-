# A.S. Bologne

Sito web della squadra A.S. Bologne per calendario, disponibilita, presenze,
statistiche, rosa, staff e galleria fotografica.

- Produzione: <https://project-zxasn.vercel.app>
- Hosting frontend: Vercel
- Database, autenticazione futura e file: Supabase
- Frontend: HTML, CSS e JavaScript senza processo di build

## Stato importante

Il sito in produzione e operativo, ma l'audit del 14 giugno 2026 ha rilevato
problemi di sicurezza critici:

- la password amministrativa e presente nel JavaScript pubblico;
- le policy Supabase consentono scritture anonime sulle tabelle gestionali;
- dati non affidabili vengono inseriti nel DOM tramite `innerHTML`, con rischio
  di stored XSS;
- le risposte di disponibilita sono leggibili pubblicamente e possono essere
  sovrascritte senza identificare il giocatore.

La chiave `anon` di Supabase puo essere pubblica per progettazione. La sicurezza
deve pero essere garantita da Supabase Auth e da policy RLS restrittive. Non
basta nascondere la pagina `/admin`.

Prima di modificare le policy in produzione, seguire il piano coordinato
descritto nell'audit: bloccare subito le scritture romperebbe il pannello admin
attuale.

Nel repository e stata preparata la migrazione
`20260614_disponibilita_whatsapp.sql`, insieme al nuovo frontend, per:

- accesso admin con sola password visibile e identita tecnica Supabase Auth;
- disponibilita di giocatori e staff con conferma visiva e telefono raccolto se
  manca;
- scadenza della raccolta disponibilita;
- telefoni conservati in una tabella privata;
- messaggi WhatsApp precompilati per il gruppo o per singole persone.

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
style.css                      Stili condivisi
vercel.json                    Routing Vercel
supabase_setup.sql             Schema iniziale storico
aggiungi_staff_maglia.sql      Migrazione staff e maglia
aggiungi_impostazioni.sql      Migrazione impostazioni/logo
20260614_disponibilita_whatsapp.sql
                               Auth, telefoni, disponibilita, scadenze
20260630_disponibilita_staff_telefono_opzionale.sql
                               Staff in disponibilita e telefono opzionale
autorizza_admin.sql            Autorizza l'account tecnico nel pannello
popola_dati.sql                Dati dimostrativi, non usare in produzione
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
