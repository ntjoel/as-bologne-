# Manuale di utilizzo

Documento aggiornato il 23 luglio 2026.

## Accesso

Il sito pubblico e disponibile su:

<https://project-zxasn.vercel.app>

Il pannello amministrativo e disponibile su:

<https://project-zxasn.vercel.app/admin>

La versione preparata nel repository usa Supabase Auth. Questa protezione
diventa effettiva solo dopo avere applicato la migrazione
`20260614_disponibilita_whatsapp.sql`, creato l'utente amministratore e
pubblicato insieme il nuovo frontend. Fino a quel rilascio coordinato, il
pannello di produzione non deve essere considerato protetto.

Per entrare nel nuovo pannello:

1. aprire `/admin`;
2. scrivere la password amministratore;
3. premere `Acceder`.

L'e-mail tecnica viene inserita automaticamente dal sito e non viene richiesta
alla persona che usa il pannello.

## Sito pubblico

### Partite

La scheda `Partite` mostra:

- numero di incontri giocati;
- vittorie, pareggi e sconfitte;
- data, avversario, orario, campo e risultato.

Selezionando una partita si apre la scheda delle disponibilita per
quell'incontro.

Il risultato deve essere sempre inserito nel formato:

```text
gol squadra di casa-gol squadra in trasferta
```

Esempi:

- A.S. Bologne in casa, vittoria 2-1: `2-1`;
- A.S. Bologne in trasferta, vittoria 1-3: `1-3`.

Questa convenzione e necessaria per calcolare correttamente vittorie e
sconfitte.

### Disponibilita

1. Aprire `Dispo`.
2. Selezionare la partita.
3. Selezionare il proprio nome. Anche lo staff appare nella lista.
4. Controllare la foto o le iniziali e premere `Oui, c'est moi`.
5. Se il club non ha ancora il tuo numero, scrivere il telefono completo con
   prefisso internazionale.
6. Premere il grande pulsante verde `Disponible` oppure rosso `Pas dispo`.
7. Controllare il messaggio di conferma.

> **Limite attuale:** la foto, le iniziali e il pulsante `Oui, c'est moi`
> aiutano a evitare errori, ma non verificano l'identita. Chi conosce il sito
> puo selezionare un'altra persona e sostituirne la risposta. Non comunicare
> tramite questo flusso informazioni diverse da disponibilita e telefono; in
> caso di risposta sospetta contattare il responsabile della squadra.

Se il nome non e presente, scegliere l'opzione per una persona non in elenco e
inserire nome e cognome. Il telefono WhatsApp e facoltativo, ma senza telefono
il club non potra inviare le prossime notifiche a quella persona.

Una nuova risposta per la stessa partita e lo stesso nome sostituisce quella
precedente. Questo comportamento permette di correggere una risposta, ma finche
non viene introdotta una verifica dell'identita consente anche modifiche da
parte di terzi.

Il telefono completo non viene letto dalla pagina pubblica. Se manca, viene
salvato tramite una funzione del database nella tabella privata dei contatti.
Per le persone fuori lista viene salvato in una tabella privata collegata alla
risposta, cosi il responsabile puo ricopiarlo nella scheda della persona.
Poiche il flusso pubblico non autentica la persona, il responsabile deve
verificare un nuovo numero con l'interessato prima di usarlo per comunicazioni
automatiche.

Se appare `Reponses fermees`, la data limite e passata e bisogna contattare
direttamente il responsabile della squadra.

### Statistiche

La scheda `Stats` contiene:

- `Evenements`: partecipazione agli eventi, dove tutte le partite giocate
  nello stesso giorno contano come un solo evento;
- `Matches`: presenza per partita, totale e percentuale;
- `Buts & Passes`: gol, assist e contributi totali;
- `Cartons`: cartellini gialli e rossi.

Toccando o cliccando il nome/foto di un giocatore si apre la sua scheda
dettagliata con partecipazione agli eventi, partite giocate, gol, assist,
cartellini e riepilogo partita per partita.

Il numero mostrato nella tabella presenze rappresenta la maglia utilizzata in
quella partita. Il segno di spunta indica una presenza senza numero registrato.

#### Archivio delle stagioni

La stagione corrente va dal 1 settembre al 31 agosto. Il 1 settembre il sito
passa automaticamente alla nuova stagione:

- calendario e conteggi correnti ripartono da zero;
- le vecchie partite e statistiche non vengono cancellate;
- nella scheda `Stats`, il menu `Saison des statistiques` permette di scegliere
  una stagione conclusa e consultare presenze, gol, assist e cartellini.

Un giocatore uscito dalla rosa viene disattivato se possiede statistiche, cosi
resta visibile negli archivi delle stagioni in cui ha partecipato.

### Foto

La scheda `Photos` raggruppa le immagini per partita.

Per vedere meglio una foto:

1. toccare o cliccare la miniatura;
2. usare `+` e `-` per zoomare;
3. usare `100%` per tornare alla dimensione normale;
4. usare `Telecharger` per scaricare la foto;
5. premere `X` o il tasto `Esc` per chiudere.

Le fotografie sono pubbliche. Il download puo aprire la foto in una nuova
scheda se il browser blocca il salvataggio diretto.

L'ultima foto caricata viene usata automaticamente come sfondo leggero del
sito. Quando si carica una nuova foto, lo sfondo si aggiorna al prossimo
caricamento della pagina.

## Pannello amministrativo

### Aggiungere una partita

1. Aprire `Matches`.
2. Inserire data e avversario.
3. Scegliere `Domicile` o `Exterieur`.
4. Inserire ora e campo.
5. Inserire `Fin des reponses`, cioe data e ora dopo le quali non si puo piu
   rispondere.
6. Premere `Ajouter au calendrier`.
7. Verificare che la partita compaia nell'elenco.
8. Se la spunta WhatsApp automatica e attiva e l'API e configurata, il sito
   prova a inviare le notifiche a giocatori e staff.
9. Nel pannello WhatsApp che si apre, controllare il risultato dell'invio. Se
   l'API non e pronta, usare il pulsante per inviare al gruppo oppure ai
   singoli giocatori.

Usare nomi coerenti per campo e avversario per evitare duplicati visivi.

Il messaggio WhatsApp contiene avversario, data, ora, campo, scadenza e un link
che apre direttamente la partita.

### Modificare o eliminare una partita

Nell'elenco partite:

- usare la matita per cambiare data, avversario, sede, ora o risultato;
- usare il cestino per eliminare la partita.

L'eliminazione rimuove dal database anche statistiche, disponibilita e righe
foto collegate. I file gia caricati nello Storage possono invece rimanere
orfani e devono essere controllati manualmente.

### Registrare un risultato

1. Selezionare la partita.
2. Inserire il punteggio nel formato casa-trasferta, per esempio `2-1`.
3. Premere `Enregistrer`.

Il salvataggio imposta lo stato della partita su `passata`.

### Gestire presenze e statistiche

1. Aprire `Presences`.
2. Selezionare la partita.
3. Impostare ogni giocatore o membro dello staff come presente o assente.
4. Per i giocatori presenti, compilare:
   - numero di maglia;
   - gol;
   - assist;
   - gialli;
   - rossi.

I campi vengono salvati al cambio di valore. Dopo la compilazione, ricaricare
la pagina e controllare alcuni record per confermare il salvataggio.

Il pulsante `Télécharger PDF joueurs` e disponibile solo nel pannello
amministratore. Prima del download, usare `Saison à exporter` per scegliere la
stagione corrente oppure una stagione archiviata.

Il PDF contiene:

- codice della stagione;
- riepilogo generale della squadra;
- partecipazione agli eventi e alle partite;
- gol, assist e cartellini;
- dettaglio partita per partita di ogni giocatore;
- stagione e numero di pagina nel pie di pagina.

Il nome del file contiene il codice della stagione, per esempio
`as-bologne-statistiques-2025-2026-2026-09-01.pdf`.

### Gestire giocatori e staff

Per aggiungere una persona:

1. aprire `Joueurs`;
2. inserire il nome completo;
3. scegliere `Joueur` oppure `Staff`;
4. per un giocatore, indicare posizione e numero abituale;
5. per lo staff, indicare il ruolo;
6. se disponibile, inserire il telefono WhatsApp completo di prefisso
   internazionale, per esempio `+33`, `+39` o `+225`;
7. selezionare la casella WhatsApp solo se la persona accetta i messaggi del
   club;
8. aggiungere una foto facoltativa;
9. premere `Ajouter`.

La modifica consente di cambiare nome, tipo, posizione, numero, ruolo e foto.
Consente anche di correggere il telefono WhatsApp.

Il telefono serve per preparare il messaggio WhatsApp personale. Se manca, la
persona potra inserirlo quando risponde alla disponibilita.

### Inviare le notifiche WhatsApp

Dopo la creazione di una partita il pannello `Prevenir tout le monde` si apre
automaticamente.

- `Envoi automatique a tous` usa la Edge Function Supabase e WhatsApp Business
  Platform per inviare ai contatti che hanno telefono e consenso attivo;
- `Envoyer a tous sur WhatsApp` apre WhatsApp con il messaggio pronto e
  permette di scegliere il gruppo della squadra;
- `Envoyer` vicino a una persona apre direttamente la conversazione con lei;
- `Telephone manquant` indica che la scheda della persona deve essere
  completata.

L'invio automatico funziona solo dopo la configurazione tecnica: account
WhatsApp Business Platform, consenso dei destinatari, template approvato,
segreti della Edge Function e migrazione dei log. Se questa configurazione
manca, la partita viene comunque creata e resta disponibile l'invio manuale.

Prima di premere nuovamente l'invio automatico dopo un errore o un rallentamento,
controllare il log: il sistema non garantisce ancora l'idempotenza e una
richiesta ripetuta puo inviare due volte lo stesso messaggio.

Prima di eliminare una persona, verificare che non sia un omonimo. La
cancellazione elimina anche le sue statistiche storiche.

### Caricare fotografie

1. Aprire `Photos`.
2. Selezionare la partita.
3. Scegliere una o piu immagini.
4. Inserire una didascalia facoltativa.
5. Premere `Envoyer les photos`.
6. Verificare le immagini nell'elenco e nel sito pubblico.

La foto piu recente diventa anche lo sfondo leggero del sito e del pannello
admin.

Per eliminare una foto non desiderata, aprire `Photos`, trovare la miniatura
nell'elenco `Photos existantes`, premere il cestino rosso e confermare. La foto
viene rimossa dal sito; se era usata come sfondo, al prossimo caricamento verra
usata un'altra foto recente disponibile.

Formato operativo consigliato:

- JPEG o WebP;
- lato lungo massimo 1600 px;
- peso consigliato inferiore a 500 KB;
- niente dati sensibili visibili nell'immagine.

Il campo `accept="image/*"` non e un controllo di sicurezza: prima della
migrazione prevista, verificare manualmente tipo e dimensione dei file.

### Cambiare il logo

1. Aprire `Reglages`.
2. Selezionare un PNG, JPEG o WebP quadrato.
3. Premere `Changer le logo`.
4. ricaricare sia il sito pubblico sia il pannello admin.

Dimensione consigliata: 256 x 256 px, inferiore a 100 KB.

## Controllo dopo ogni aggiornamento

Verificare sempre:

1. apertura del sito senza errori;
2. conteggio delle partite;
3. visualizzazione dell'ultima partita;
4. invio di una disponibilita di prova autorizzata;
5. apertura delle quattro sezioni statistiche;
6. caricamento delle foto;
7. accesso e uscita dall'admin;
8. corretto funzionamento da telefono.

## Problemi comuni

### Il sito mostra elenchi vuoti

- controllare lo stato del progetto Supabase;
- aprire gli strumenti sviluppatore del browser e cercare errori rossi;
- verificare che le policy RLS consentano l'operazione prevista;
- non disabilitare RLS come soluzione permanente.

### Un salvataggio sembra riuscito ma i dati non cambiano

Alcune operazioni attuali non mostrano correttamente gli errori. Ricaricare la
pagina e controllare il record. Annotare ora, operazione e schermata per la
diagnosi.

### Una foto non appare

- verificare che il bucket `foto` esista;
- controllare le policy di `storage.objects`;
- controllare formato e peso del file;
- verificare che la riga nella tabella `foto` contenga un URL valido.

### Statistiche di vittoria errate

Controllare che il punteggio sia nel formato casa-trasferta e contenga solo due
numeri separati da un trattino.
