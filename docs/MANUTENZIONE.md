# Guida di manutenzione

Documento aggiornato il 14 giugno 2026.

## Responsabilita

Assegnare esplicitamente:

- un responsabile dei contenuti sportivi;
- un responsabile tecnico;
- almeno due amministratori Supabase/Vercel;
- un referente privacy per nomi, presenze e fotografie.

Per il momento il pannello usa un solo account tecnico e mostra soltanto il
campo password. Questa e una semplificazione temporanea: quando serviranno piu
amministratori, usare account individuali.

## Ambienti

### Produzione

- Vercel: `https://project-zxasn.vercel.app`
- Supabase project ref: `uiypmfkfwcvdujkvsjxp`

### Staging da creare

Creare un secondo progetto Supabase e un progetto/ambiente Vercel di preview.
Usare solo dati fittizi. Il sito locale attuale punta alla produzione e non e
quindi un ambiente di prova sicuro.

## Avvio locale

```powershell
python -m http.server 8080
```

Non servono installazione o build. Verificare che il browser consenta gli
import ES module e che la rete raggiunga i CDN e Supabase.

## Modifiche al codice

1. Aggiornare il repository locale.
2. Creare un branch descrittivo.
3. Fare la modifica piu piccola possibile.
4. Verificare pagina pubblica e admin.
5. Controllare che nessuna credenziale sia stata aggiunta.
6. Aprire la Preview Deployment Vercel.
7. Eseguire il checklist di regressione.
8. Unire su `main`.

Comandi Git di riferimento:

```powershell
git status
git diff
git add <file>
git commit -m "Descrizione modifica"
git push
```

Non usare `popola_dati.sql` in produzione: inserisce dati dimostrativi e puo
creare duplicati.

## Checklist prima del deploy

- backup database completato;
- migrazione SQL provata in staging;
- nessun dato reale incluso nel commit;
- nessuna password o chiave `service_role`;
- HTML valido;
- JavaScript senza errori in console;
- creazione, modifica ed eliminazione provate;
- comportamento verificato a 390 px e desktop;
- immagini ottimizzate;
- testo e stagione aggiornati;
- privacy e autorizzazioni rispettate.

## Backup Supabase

I backup automatici dipendono dal piano Supabase. Verificare in
`Database > Backups` che esista un backup recente e ripristinabile.

Prima di ogni migrazione importante creare anche un dump logico:

```powershell
supabase db dump --db-url "<CONNECTION_STRING>" -f schema.sql
supabase db dump --db-url "<CONNECTION_STRING>" -f data.sql --use-copy --data-only
```

Conservare i dump cifrati in uno spazio privato. Non aggiungerli a questo
repository pubblico.

Riferimenti ufficiali:

- <https://supabase.com/docs/guides/platform/backups>
- <https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore>

## Migrazioni database

Regole:

1. una migrazione per file, con data e descrizione nel nome;
2. transazione quando possibile;
3. backup prima dell'esecuzione;
4. prova su staging;
5. query di verifica dopo l'esecuzione;
6. piano di rollback scritto;
7. registrazione della migrazione applicata.

Non modificare retroattivamente una migrazione gia eseguita. Crearne una nuova.

Lo schema corrente storico richiede, nell'ordine:

```text
supabase_setup.sql
aggiungi_staff_maglia.sql
aggiungi_impostazioni.sql
20260614_disponibilita_whatsapp.sql
```

I primi tre file documentano lo schema storico. Il quarto e la migrazione
necessaria per il frontend corrente. Per nuovi ambienti questa sequenza va
sostituita in futuro con una baseline consolidata.

## Deploy e rollback Vercel

### Deploy

1. controllare la Preview Deployment;
2. unire il commit approvato su `main`;
3. attendere lo stato `Ready`;
4. aprire produzione in una finestra privata;
5. controllare asset, dati e console;
6. annotare hash del commit e ora.

### Rollback frontend

In Vercel aprire `Deployments`, selezionare l'ultima versione funzionante e
promuoverla in produzione.

Un rollback Vercel non annulla modifiche gia effettuate al database. Le
migrazioni devono avere un rollback separato o essere compatibili con entrambe
le versioni del frontend durante il rilascio.

## Rilascio coordinato sicurezza

Per distribuire la migrazione `20260614_disponibilita_whatsapp.sql`:

1. creare un progetto Supabase di staging;
2. eseguire un backup della produzione;
3. applicare la migrazione in staging;
4. creare in `Authentication > Users` l'utente
   `j.ntiegoun@gmail.com`, impostare una password robusta e attivare
   `Auto Confirm User`;
5. eseguire `autorizza_admin.sql` e verificare che restituisca
   `admin_autorizzato = true`;
6. inserire alcuni telefoni fittizi nei contatti di giocatori e staff di
   staging;
7. pubblicare il nuovo frontend solo su una Preview Deployment;
8. provare login, creazione partita, scadenza, risposta di giocatore e staff,
   richiesta telefono mancante, risposta ospite con e senza telefono e link
   WhatsApp;
9. verificare e restringere le policy del bucket Storage `foto`;
10. applicare la migrazione alla produzione;
11. creare e autorizzare l'account tecnico di produzione;
12. pubblicare immediatamente il frontend compatibile;
13. compilare i telefoni reali dal pannello admin;
14. verificare che le scritture anonime dirette siano negate.

L'ordine esatto deve essere provato in staging per evitare interruzioni.

Non pubblicare il nuovo frontend prima della migrazione: le funzioni RPC e le
colonne necessarie non esisterebbero. Non applicare la migrazione lasciando a
lungo il vecchio frontend: il vecchio pannello non avrebbe piu il permesso di
scrivere.

## WhatsApp

La versione inclusa usa i link ufficiali `wa.me` e richiede un tocco finale
dell'amministratore. Il pulsante principale apre WhatsApp con il messaggio
pronto: l'amministratore deve scegliere il gruppo della squadra e confermare
l'invio. Non usa token e non invia messaggi in background.

Per l'invio completamente automatico servono:

- account WhatsApp Business Platform;
- consenso dei giocatori;
- template approvati per i messaggi iniziati dal club;
- backend o Edge Function;
- token conservato come segreto server, mai in `admin.js`;
- log degli invii e gestione degli errori.

Riferimento per i link WhatsApp:

- <https://faq.whatsapp.com/425247423114725>

Riferimenti ufficiali:

- <https://supabase.com/docs/guides/auth>
- <https://supabase.com/docs/guides/database/postgres/row-level-security>
- <https://supabase.com/docs/guides/storage/security/access-control>

## Manutenzione Storage

Ogni mese:

- individuare file non piu referenziati dalle tabelle;
- eliminare vecchi loghi e foto sostituite, dopo il periodo di conservazione;
- controllare dimensione totale del bucket;
- verificare le policy di `storage.objects`;
- controllare che solo gli admin possano caricare o eliminare;
- verificare consenso e diritto alla rimozione delle fotografie.

## Cambio stagione

La stagione e scritta direttamente in `index.html`. Prima della nuova stagione:

1. eseguire backup completo;
2. decidere se mantenere consultabile lo storico;
3. aggiungere una vera entita `stagioni` prima di cancellare dati;
4. associare partite e statistiche alla stagione;
5. aggiornare il testo in testata;
6. archiviare o disattivare giocatori usciti;
7. testare percentuali e classifiche su una stagione vuota.

Non cancellare lo storico per riutilizzare le stesse tabelle.

## Controlli periodici

### Ogni settimana

- apertura pagine principali;
- verifica ultimo risultato;
- controllo errori di caricamento;
- conferma backup recente;
- controllo spazio Storage.

### Ogni mese

- revisione utenti admin;
- Supabase Security Advisor e Performance Advisor;
- dipendenze CDN e versioni;
- file orfani;
- dati duplicati;
- test ripristino su ambiente separato.

### Ogni stagione

- aggiornamento testi e metadati;
- revisione informativa privacy e consensi;
- archiviazione dati;
- controllo accessibilita;
- test completo del flusso admin.

## Gestione incidenti

Se dati vengono modificati o cancellati senza autorizzazione:

1. non continuare a usare il pannello;
2. annotare ora e dati coinvolti;
3. esportare log disponibili da Supabase e Vercel;
4. limitare le policy di scrittura con un piano che preservi l'operativita;
5. ripristinare da backup in un progetto separato;
6. confrontare i dati prima del ripristino in produzione;
7. valutare gli obblighi privacy con il referente competente.

Non disabilitare RLS e non pubblicare log contenenti dati personali.
