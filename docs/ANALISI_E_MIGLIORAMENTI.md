# Analisi completa e piano di miglioramento

Audit eseguito il 14 giugno 2026 sul repository e sulla produzione
<https://project-zxasn.vercel.app>.

Revisione documentale e del codice aggiornata il 23 luglio 2026. La verifica
del 23 luglio riguarda il contenuto del repository e non certifica lo stato
effettivo del database, delle policy Storage o del deployment di produzione.

Rispetto alla versione osservata il 14 giugno, il repository contiene ora:

- Supabase Auth e controllo del ruolo amministratore tramite `is_admin()`;
- migrazioni RLS che rimuovono le scritture anonime gestionali;
- contatti telefonici separati dalle tabelle pubbliche;
- scadenza delle disponibilita;
- primi interventi di escaping e uso di `textContent`;
- Edge Function e log per le notifiche WhatsApp.
- stagioni settembre/agosto con archivio non distruttivo delle statistiche.

L'audit storico riportato sotto resta utile per comprendere l'origine dei
problemi. Quando un'evidenza si riferisce alla vecchia versione, viene
considerata storica e non va interpretata automaticamente come descrizione del
codice corrente.

## Stato corrente al 23 luglio 2026

### Correzioni presenti nel repository

- La password amministrativa non e piu incorporata in `admin.js`.
- Il login usa Supabase Auth e il pannello verifica `is_admin()`.
- Le migrazioni preparano policy gestionali riservate agli admin autenticati.
- La lista delle disponibilita usa nodi DOM e `textContent`.
- Diverse viste applicano `escapeHtml()` a nomi, foto e didascalie.
- I token WhatsApp restano nella Edge Function e non nel frontend.

La presenza di queste correzioni nel repository non dimostra che le migrazioni
e le policy siano gia attive in produzione.

### Rischi ancora aperti

1. **Identita nelle disponibilita:** la conferma visiva non autentica la
   persona. Le RPC anonime permettono ancora di selezionare un giocatore e
   sostituirne la risposta; se il contatto manca, possono anche registrare il
   telefono fornito dal visitatore.
2. **Stored XSS residuo:** alcune viste interpolano ancora dati del database in
   `innerHTML` senza escaping completo, soprattutto partite, staff e alcune
   opzioni/form amministrativi.
3. **Privacy:** nomi, presenze, statistiche, fotografie e disponibilita sono
   pubblici secondo le policy e il modello attuali.
4. **Stato infrastrutturale non verificato:** occorre controllare direttamente
   RLS, policy Storage e migrazioni applicate in produzione.
5. **Affidabilita:** diverse chiamate ignorano ancora `error`; mancano test,
   CI, staging separato e una baseline SQL riproducibile.
6. **WhatsApp:** non risultano idempotenza o rate limiting applicativo; una
   richiesta ripetuta puo produrre invii duplicati.

### Priorita aggiornata

1. introdurre account giocatore o link personali firmati;
2. eliminare le interpolazioni HTML residue e gli handler inline;
3. verificare RLS e Storage con test anonimo/admin;
4. creare staging e consolidare le migrazioni;
5. aggiungere gestione errori, test e idempotenza WhatsApp;
6. completare privacy, accessibilita, prestazioni e SEO.

## Sintesi

Il progetto ha una base utile: e piccolo, leggibile, rapido da distribuire e
copre bene le necessita quotidiane di una squadra. La produzione risponde
correttamente, gli asset principali sono disponibili e l'HTML passa il
validatore W3C senza errori.

Il sito non e pero sicuro per l'uso amministrativo attuale. Le priorita sono:

1. autenticazione e autorizzazione reali;
2. eliminazione del rischio stored XSS;
3. protezione dei dati personali e delle disponibilita;
4. backup, staging e migrazioni affidabili;
5. accessibilita, gestione errori e ottimizzazione.

Le evidenze e i numeri di riga sotto descrivono la versione osservata in
produzione prima delle modifiche. Nel repository sono gia state preparate le
correzioni per autenticazione admin, RLS, contatti privati, scadenze e percorso
pubblico delle disponibilita. Diventano effettive solo dopo il rilascio
coordinato; gli altri usi di `innerHTML`, le policy Storage e il rate limiting
restano lavoro successivo.

## Ambito e verifiche

Sono stati esaminati:

- tutti i file HTML, CSS, JavaScript e SQL;
- configurazione Vercel e repository Git;
- pagina pubblica e `/admin` in produzione;
- intestazioni HTTP;
- accessibilita e responsive design dal codice;
- struttura e policy Supabase;
- dimensione degli asset;
- leggibilita pubblica delle tabelle, senza modificare dati;
- validita HTML tramite il validatore W3C.

Risultati tecnici:

- produzione HTTPS: disponibile;
- HTML pagina pubblica: 0 errori W3C;
- HTML admin: 0 errori W3C;
- asset applicativi: HTTP 200;
- `robots.txt`, `sitemap.xml`, `favicon.ico`: assenti;
- Content-Security-Policy: assente;
- `X-Content-Type-Options`: assente;
- protezione iframe esplicita: assente;
- Node.js/test runner: non presenti nell'ambiente e nel progetto;
- test automatici: assenti.

## Audit storico del 14 giugno 2026

Le sezioni da P0 a P2 conservano evidenze, numeri di riga e condizioni
osservate durante l'audit iniziale. Per lo stato del codice corrente fare
riferimento alla sezione `Stato corrente al 23 luglio 2026` sopra.

## P0 - Critico (audit storico)

### 1. Login amministrativo solo lato client

**Stato nel repository corrente:** corretto nel codice tramite Supabase Auth e
`is_admin()`; da verificare che migrazione, account e policy siano attivi in
produzione.

Evidenze:

- `admin.js:5` contiene la password;
- `admin.js:25-32` confronta la password nel browser;
- `admin.js:28` salva solo un flag in `sessionStorage`.

Qualunque visitatore puo scaricare `admin.js`, leggere la password o impostare
manualmente il flag. Inoltre il database non usa quel flag.

Correzione:

- Supabase Auth con account individuali;
- ruolo admin verificato nel database;
- RLS applicata a ogni `INSERT`, `UPDATE` e `DELETE`;
- rimozione completa della password dal repository.

Nota: la chiave Supabase `anon` e normalmente pubblica. Diventa pericolosa
quando le policy RLS autorizzano operazioni che un anonimo non dovrebbe fare.

### 2. Scritture anonime sul database

**Stato nel repository corrente:** le migrazioni contengono policy RLS
restrittive; la loro applicazione effettiva in produzione non e stata
certificata dalla revisione del 23 luglio.

Evidenze:

- `supabase_setup.sql:72-77`;
- `aggiungi_impostazioni.sql:14`.

Le policy `write_all` usano `USING (true)` e `WITH CHECK (true)`. Un utente non
deve aprire il pannello admin per modificare o cancellare dati: puo chiamare
direttamente l'API Supabase con la chiave pubblica.

Impatto:

- cancellazione calendario o rosa;
- alterazione di risultati e statistiche;
- caricamento o collegamento di contenuti non autorizzati;
- modifica del logo;
- perdita di integrita dei dati.

Correzione:

- policy di lettura pubblica solo per i dati davvero pubblici;
- scrittura riservata al ruolo `authenticated` e a utenti admin;
- policy Storage separate;
- verifica con richieste anonime che devono ricevere un rifiuto.

### 3. Stored XSS tramite `innerHTML`

**Stato nel repository corrente:** parzialmente corretto. `escapeHtml()` e
`textContent` sono usati in diverse viste, ma restano interpolazioni dinamiche
non protette.

Evidenze principali:

- `app.js:48-60`, partite;
- `app.js:104-106`, nomi delle disponibilita;
- `app.js:176-308`, giocatori e statistiche;
- `admin.js:115-129`, partite;
- `admin.js:262-369`, presenze;
- `admin.js:417-448`, rosa e staff.

Campi provenienti dal database vengono concatenati in HTML. La disponibilita
accetta anche un nome scritto da un visitatore anonimo. Un valore costruito
appositamente puo quindi essere salvato e successivamente interpretato dal
browser come markup o JavaScript.

Impatto potenziale:

- esecuzione di codice nelle pagine pubblica e admin;
- operazioni Supabase effettuate dal browser della vittima;
- furto o alterazione della sessione;
- modifica dei contenuti.

Correzione:

- creare gli elementi con `document.createElement`;
- assegnare testo con `textContent`;
- non interpolare dati negli attributi `onclick`;
- usare `addEventListener`;
- validare URL e campi al confine applicativo;
- aggiungere una CSP dopo aver rimosso handler e stili inline.

## P1 - Alto

### 4. Disponibilita senza identita e pubblicamente leggibili

Il sito mostra nomi e risposte a chiunque e consente di sovrascrivere la
risposta di una persona selezionandone il nome. Il 14 giugno 2026 erano leggibili
pubblicamente 37 risposte.

Soluzioni possibili:

- consigliata: account giocatore con Supabase Auth;
- alternativa: link personale firmato e con scadenza;
- alternativa minima: PIN individuale verificato da Edge Function.

Non salvare PIN o segreti nel JavaScript.

### 5. Privacy e conservazione

Nomi, foto, presenze, assenze e statistiche sono dati riferibili a persone. Il
sito non contiene informativa privacy, contatto del titolare, finalita,
conservazione o procedura di rimozione. Le foto e i file sostituiti possono
restare nello Storage.

Azioni:

- definire base giuridica e finalita con un referente competente;
- informare le persone al momento della raccolta;
- raccogliere e documentare le autorizzazioni necessarie per le foto;
- limitare la visibilita di disponibilita e assenze;
- definire tempi di conservazione;
- aggiungere procedura per accesso, correzione e cancellazione.

Questa e una segnalazione tecnica, non consulenza legale.

Riferimenti:

- <https://commission.europa.eu/law/law-topic/data-protection/data-protection-explained_en>
- <https://commission.europa.eu/law/law-topic/data-protection/rules-business-and-organisations/principles-gdpr/what-information-must-be-given-individuals-whose-data-collected_en>

### 6. Errori spesso ignorati

Molte query non controllano `error`. Esempi:

- `admin.js:225`, risultato salvato senza verifica;
- `admin.js:383-411`, statistiche senza feedback;
- `admin.js:542`, eliminazione statistiche ignorata;
- `admin.js:646-659`, upload parziale seguito comunque da messaggio di successo.

Il gestore puo credere che un'operazione sia riuscita quando non lo e.

Correzione:

- helper comune per stato caricamento, errore e successo;
- disabilitazione pulsanti durante le richieste;
- controllo di ogni risposta Supabase;
- messaggio con operazione fallita, senza dati tecnici sensibili;
- log tecnico centralizzato.

### 7. Backup e ambienti

Non esistono staging, test di ripristino o migrazioni formalizzate. Lo sviluppo
locale usa la produzione.

Correzione:

- progetto Supabase separato per staging;
- backup verificato prima di ogni migrazione;
- dump periodici cifrati fuori dal repository;
- prova di ripristino;
- registro delle migrazioni.

## P2 - Medio

### 8. Accessibilita

Problemi rilevati:

- `outline: none` sui campi e indicatore focus insufficiente;
- nessun focus visibile specifico sui pulsanti;
- righe partita cliccabili come `div`, non utilizzabili da tastiera;
- schede senza semantica ARIA `tablist`, `tab`, `tabpanel`;
- label senza associazione `for`;
- titoli visivi realizzati con `div` invece di heading;
- testi grigi con contrasto insufficiente.

Contrasti calcolati su bianco:

| Colore | Rapporto |
| --- | ---: |
| `#aaaaaa` | 2.32:1 |
| `#8a92a6` | 3.11:1 |
| `#7a8298` | 3.84:1 |

Per testo normale WCAG AA richiede generalmente 4.5:1.

Correzione:

- `:focus-visible` ben contrastato;
- elementi `button` o `a` per tutte le azioni;
- heading e landmark semantici;
- associazione label-campo;
- stato attivo comunicato anche con `aria-selected`;
- testi secondari piu scuri;
- test tastiera e screen reader.

Riferimenti:

- <https://www.w3.org/WAI/WCAG22/quickref/>
- <https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html>

### 9. Validazione e modello dati

Problemi:

- risultato, ora, stato, tipo, posizione e ruolo sono testo libero;
- un risultato malformato puo essere contato come sconfitta;
- mancano vincoli per numeri non negativi e cartellini;
- disponibilita basata sul nome;
- mancano `updated_at` e audit log;
- schema corrente distribuito in tre script.

Correzione:

- `gol_casa` e `gol_trasferta` come interi;
- `TIME` per l'orario;
- vincoli `CHECK`;
- foreign key al giocatore nella disponibilita;
- timestamp di aggiornamento;
- tabella stagioni;
- migrazioni versionate;
- indici sulle foreign key e sui filtri frequenti.

### 10. Upload e ciclo di vita dei file

Mancano limiti applicativi di dimensione, controllo MIME affidabile,
ridimensionamento e cancellazione degli oggetti sostituiti. Il logo locale pesa
circa 732 KB pur essendo mostrato a 48-90 px.

Correzione:

- limite di peso e dimensioni;
- JPEG/WebP/AVIF ottimizzati;
- generazione miniature;
- nomi file controllati;
- policy Storage admin-only per upload/delete;
- eliminazione coordinata database + Storage;
- `loading="lazy"` per le immagini della galleria.

### 11. Dipendenze e intestazioni di sicurezza

Dipendenze non completamente fissate:

- `@tabler/icons-webfont@latest`;
- `@supabase/supabase-js@2`.

Intestazioni mancanti:

- Content-Security-Policy;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy`;
- `Permissions-Policy`;
- protezione anti-frame tramite CSP `frame-ancestors`.

Correzione:

- fissare versioni esatte;
- valutare asset locali;
- configurare header in `vercel.json`;
- introdurre CSP inizialmente in report-only;
- rimuovere gli inline handler prima di una CSP restrittiva.

Riferimenti:

- <https://vercel.com/docs/cdn-security/security-headers>
- <https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html>

### 12. Prestazioni e scalabilita

Aspetti positivi:

- frontend statico;
- nessun framework pesante;
- pagina iniziale semplice;
- query limitate per il volume attuale.

Miglioramenti:

- ottimizzare il logo;
- rimuovere l'immagine WhatsApp non usata dal deploy;
- caricare foto con lazy loading e miniature;
- parallelizzare query indipendenti;
- evitare di ricaricare rosa e dati a ogni cambio scheda;
- filtrare le statistiche alle partite necessarie;
- aggiungere paginazione alla galleria;
- impostare cache lunga per asset versionati.

### 13. SEO e condivisione

Mancano:

- meta description;
- canonical URL;
- Open Graph;
- favicon;
- `robots.txt`;
- `sitemap.xml`;
- heading principale semantico;
- `noindex` esplicito sull'admin.

Il titolo `A.S. Bologne` e corretto ma poco descrittivo. Il sito mescola
italiano e francese, riducendo coerenza e comprensibilita.

Correzione:

- scegliere una lingua principale coerente;
- aggiungere metadati e immagine social;
- escludere `/admin` dai motori;
- rendere stagione e testi configurabili.

Riferimenti:

- <https://developers.google.com/search/docs/appearance/title-link>
- <https://developers.google.com/search/docs/appearance/snippet>

### 14. Qualita del codice e test

Il progetto non contiene:

- formatter o linter;
- test unitari;
- test end-to-end;
- CI;
- controllo automatico dei link;
- test delle migrazioni.

Prima serie di test consigliata:

1. calcolo vittoria/pareggio/sconfitta casa e trasferta;
2. validazione punteggio;
3. invio e aggiornamento disponibilita;
4. autorizzazione anonimo/admin;
5. escaping di nomi, didascalie e avversari;
6. CRUD partite;
7. upload con file valido, enorme e tipo non consentito;
8. navigazione completa da tastiera.

## Roadmap proposta

### Fase 0 - entro 24/48 ore

- backup verificato;
- creazione staging;
- migrazione Supabase Auth + ruoli admin;
- nuove RLS per tabelle e Storage;
- rimozione password dal client;
- test che le scritture anonime siano negate.

### Fase 1 - prima settimana

- eliminazione `innerHTML` sui dati dinamici;
- protezione delle disponibilita;
- gestione uniforme degli errori;
- limiti upload e pulizia file;
- informativa privacy e revisione visibilita dati;
- header di sicurezza iniziali.

### Fase 2 - entro un mese

- migrazioni consolidate;
- staging e CI;
- test automatici essenziali;
- accessibilita WCAG AA;
- ottimizzazione immagini;
- stagione configurabile e storico.

### Fase 3 - evoluzione

- account giocatori;
- notifiche e scadenze disponibilita;
- audit log amministrativo;
- dashboard con dati aggregati;
- monitoraggio errori;
- dominio personalizzato e SEO completo.

## Ordine consigliato degli interventi

Non iniziare dal restyling. L'ordine con minor rischio e:

1. backup e staging;
2. autorizzazione database;
3. autenticazione admin;
4. XSS e validazione;
5. privacy;
6. affidabilita e test;
7. accessibilita;
8. prestazioni e SEO;
9. nuove funzioni.

## Riferimenti tecnici

- Supabase Auth: <https://supabase.com/docs/guides/auth>
- Supabase RLS: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Supabase Storage: <https://supabase.com/docs/guides/storage/security/access-control>
- Supabase backup: <https://supabase.com/docs/guides/platform/backups>
- Vercel CSP: <https://vercel.com/docs/cdn-security/security-headers>
- OWASP XSS: <https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html>
- WCAG 2.2: <https://www.w3.org/WAI/WCAG22/quickref/>
- Commissione europea, protezione dati:
  <https://commission.europa.eu/law/law-topic/data-protection_en>
