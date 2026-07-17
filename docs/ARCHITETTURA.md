# Architettura e dati

Documento aggiornato il 17 luglio 2026.

## Panoramica

```text
Browser
  |
  | HTTPS
  v
Vercel Static Hosting
  |-- index.html + app.js
  |-- admin.html + admin.js
  |-- style.css + immagini locali
  |
  | Supabase JavaScript SDK con chiave anon
  v
Supabase
  |-- PostgreSQL
  |-- Row Level Security
  |-- Edge Function "notifica-whatsapp-partita"
  `-- Storage bucket "foto"
```

Il browser comunica direttamente con Supabase per dati e file. Per l'invio
WhatsApp automatico viene aggiunta una Edge Function server-side, necessaria per
non esporre il token WhatsApp nel codice pubblico.

## Componenti frontend

### Pagina pubblica

`index.html` contiene la struttura delle schede. `app.js`:

- carica calendario e risultati;
- registra e legge disponibilita;
- aggrega presenze e statistiche;
- carica la galleria;
- applica il logo configurato.

### Pagina amministrativa

`admin.html` contiene form ed elenchi amministrativi. `admin.js`:

- esegue il login con Supabase Auth;
- usa temporaneamente l'identita tecnica fissa `j.ntiegoun@gmail.com`, mentre
  l'interfaccia richiede soltanto la password;
- verifica nel database che l'utente appartenga a `admin_users`;
- crea, modifica ed elimina partite;
- gestisce rosa, staff e presenze;
- carica foto e logo;
- aggiorna risultati e statistiche;
- invoca la Edge Function WhatsApp dopo la creazione di una partita, se
  configurata.

La versione pubblicata prima della migrazione del 14 giugno 2026 usava invece
una password nel browser. Il codice corrente non contiene piu quella password,
ma usa ancora un'unica e-mail tecnica incorporata nel frontend. La protezione
diventa effettiva soltanto se migrazione, account autorizzato e policy RLS sono
stati applicati nell'ambiente Supabase attivo.

### Stili e dipendenze

`style.css` e condiviso da entrambe le pagine.

Dipendenze caricate a runtime:

- Supabase JavaScript da `esm.sh`;
- Tabler Icons da jsDelivr;
- font Oswald da Google Fonts.

La Edge Function fissa Supabase JS alla versione `2.45.4`; i due frontend
caricano invece `@supabase/supabase-js@2`. Anche Tabler Icons usa una versione
mobile. Un aggiornamento esterno puo quindi cambiare il comportamento senza un
commit nel repository.

## Modello dati

### `matches`

Contiene calendario e risultato:

- `data`;
- `avversario`;
- `tipo`: `Casa` o `Trasferta`;
- `orario`;
- `campo`;
- `scadenza_disponibilita`;
- `risultato`;
- `stato`: `futura` o `passata`.

Il risultato e salvato come testo. Non esistono vincoli che garantiscano il
formato o la coerenza tra risultato e stato.

### `giocatori`

Contiene sia giocatori sia staff:

- nome;
- posizione;
- numero abituale;
- foto;
- stato attivo;
- tipo;
- ruolo.

La tabella iniziale viene estesa dallo script
`aggiungi_staff_maglia.sql`.

I telefoni non sono salvati qui, perche questa tabella e letta dal sito
pubblico.

### `contatti_giocatori`

Tabella privata, accessibile solo agli amministratori autenticati:

- riferimento alla persona in `giocatori`, giocatore o staff;
- telefono con prefisso internazionale;
- consenso/attivazione WhatsApp;
- data dell'ultimo aggiornamento.

La pagina pubblica non legge questa tabella. Se il contatto manca, una funzione
PostgreSQL puo salvare il telefono comunicato durante la risposta.

### `contatti_ospiti_disponibilita`

Tabella privata usata per le persone che rispondono scegliendo `Je ne suis pas
dans la liste`:

- partita;
- nome scritto nella disponibilita;
- telefono facoltativo;
- data dell'ultimo aggiornamento.

La risposta pubblica resta in `disponibilita`; il telefono rimane separato per
non esporlo nelle letture pubbliche.

### `statistiche`

Una riga per persona e partita:

- presenza;
- numero di maglia della partita;
- gol;
- assist;
- gialli;
- rossi.

La coppia `match_id, giocatore_id` e univoca.

### `disponibilita`

Contiene:

- partita;
- nome scritto o selezionato;
- risposta si/no;
- data di creazione.

Le nuove risposte includono anche `giocatore_id`. La scrittura pubblica diretta
viene sostituita dalle funzioni:

- `registra_disponibilita_giocatore`;
- `registra_disponibilita_ospite`.

Le funzioni verificano scadenza e persona attiva, ma non verificano che chi
invia la risposta sia realmente quella persona. La conferma di foto o iniziali
e solo un passaggio dell'interfaccia e puo essere aggirata chiamando direttamente
la RPC. Quando il contatto manca, la RPC pubblica puo inoltre registrare il
telefono fornito dal visitatore. Questa limitazione deve essere risolta con
account giocatore, link personale firmato o verifica server equivalente.

Per gli ospiti il telefono e facoltativo e viene salvato solo se inserito.

La coppia `match_id, nome` e univoca ma sensibile a maiuscole, spazi e varianti
del nome. Per le persone registrate sarebbe preferibile usare sempre
`giocatore_id`.

### `foto`

Collega una partita all'URL pubblico di un file e a una didascalia.
L'eliminazione della riga non elimina automaticamente l'oggetto nello Storage.

### `impostazioni`

Tabella chiave-valore usata al momento per `logo_url`.

### `notifiche_whatsapp`

Log privato degli invii automatici via Edge Function:

- partita;
- persona notificata;
- telefono usato;
- stato: `inviato`, `errore` o `saltato`;
- dettaglio tecnico o identificativo del messaggio;
- data dell'invio.

La tabella e accessibile solo agli amministratori autenticati. La Edge Function
la scrive con chiave server.

## Relazioni

```text
matches 1 ---- N statistiche N ---- 1 giocatori
matches 1 ---- N disponibilita
matches 1 ---- N foto
giocatori 1 -- 0..1 contatti_giocatori
matches 1 ---- N contatti_ospiti_disponibilita
matches 1 ---- N notifiche_whatsapp
auth.users 1 -- 0..1 admin_users
```

Le foreign key collegate a `matches` e `giocatori` usano `ON DELETE CASCADE`.

## Stato osservato in produzione

Il 14 giugno 2026, tramite le API pubbliche, erano leggibili:

- 6 partite;
- 35 persone in rosa/staff;
- 185 record statistici;
- 37 risposte di disponibilita;
- 4 record fotografici.

Questi numeri servono solo come riferimento storico dell'audit e cambieranno
con l'uso. La revisione del 17 luglio 2026 ha esaminato il repository, ma non ha
eseguito una nuova lettura o modifica dei dati di produzione.

## Routing e deploy

`vercel.json` riscrive `/admin` verso `/admin.html`.

Il link WhatsApp usa `?match=ID`: il sito apre direttamente la scheda
disponibilita della partita.

Il repository GitHub e collegato a Vercel. Il flusso atteso e:

```text
commit -> push GitHub -> Preview/Production Deployment Vercel
```

Il frontend pubblicato il 14 giugno 2026 corrispondeva ai file locali; la
differenza iniziale di hash dipendeva solo dai terminatori di riga CRLF/LF.

## Debito strutturale

Gli script SQL rappresentano una cronologia manuale, non un sistema di
migrazioni completo:

1. `supabase_setup.sql`;
2. `aggiungi_staff_maglia.sql`;
3. `aggiungi_impostazioni.sql`;
4. `20260614_disponibilita_whatsapp.sql`;
5. `20260630_disponibilita_staff_telefono_opzionale.sql`;
6. `20260630_notifiche_whatsapp_automatiche.sql`.

`supabase_setup.sql` da solo non ricostruisce lo schema corrente e le istruzioni
`CREATE POLICY` non sono tutte rieseguibili senza errore. Serve una baseline
versionata e un ambiente di staging.

## Architettura obiettivo

La versione preparata mantiene il frontend statico e aggiunge:

- Supabase Auth per gli amministratori;
- tabella dei ruoli admin;
- RLS che consente scritture gestionali solo agli admin autenticati;
- disponibilita con conferma visiva della persona e raccolta telefono se manca;
- scadenza delle risposte controllata anche nel database;
- contatti telefonici in una tabella privata;
- Edge Function per invio automatico WhatsApp con token conservato come segreto.

Restano consigliati:

- account giocatore o link personale firmato per verificare l'identita;
- Edge Function per rate limiting e operazioni sensibili;
- eliminazione dei restanti usi di `innerHTML` con dati dinamici;
- idempotenza per evitare invii WhatsApp duplicati;
- Storage con policy distinte per lettura e scrittura;
- staging separato dalla produzione;
- migrazioni SQL versionate e testate.
