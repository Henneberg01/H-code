# M19.16 B1 — generelle kryptografiske tegn i H-Code

Oprindelig status 2026-10-19: konkret design til ejergennemgang.
Aktuel status 2026-10-20: ejeren har bedt os tage de tekniske valg og arbejde
videre. B1-kandidaten er implementeret og verificeret med lokal Rust-kompilering
og compilerparitet på Linux; Windows og hosted CI er fortsat udestående. Se `docs/M19-16-CRYPTO.md` for faktisk testevidens.

## Formål og afgrænsning

H-Code skal udtrykke mere reel, generel programmering med færre tegn.
B1 leverer derfor fire typede kerneoperationer, som udvikleren kan kombinere
med egne funktioner. Ingen operation implementerer login, cookies,
sessionsrotation, brugeridentiteter eller webshopregler.

Det uændrede Canonical16-krav er `issue/rotate/revoke a signed session using
deterministic fixture identity`. B0 i PR #72 indeholder en uafhængig
korrekthedsreference, ikke et H-Code-program. B1 er en nødvendig del af
sprogimplementeringen; B2 skal skrive sessionsalgoritmen i H-Code, og B3
skal bevise hele opgaven. Dækning forbliver 15/20, og ingen samlet
70 %-konklusion følger af B1.

Normativ retning: `JFH-CODE-PRINCIPLES.md`. Det oprindelige register,
historiske programmer, biblioteker og benchmarkbaselines ændres ikke.

## Undersøgt udgangspunkt

- Baseline: PR #72, commit `20aa8d699e2f0c630648f4a7a1dcbcbfa3d8b278`.
- Lokal Node v24.19.0: de 10 B0-kontrakttests og alle 168
  `npm test`-tests består. Dette er ikke en ny Rust- eller Windows-kørsel.
- Lexer, AST, checker og emitter er i `compiler/src/`; den uafhængige
  reference er `prototype/src/hcode.mjs`.
- `executeAsync` genafvikler synkron kode efter ventende HTTP-, fil- og
  sleep-effekter. En tilfældighedseffekt må derfor ikke kaldes igen ved replay.
- `⤊` har en eksisterende ren CAS-reducergrænse og typer kun body/status
  samt valgfri contentType. Cookie-headere er endnu ikke en del af kontrakten.
- Der findes ingen kryptografiske kerneoperationer eller en host-key-grant.

## Tilgange og valg

1. **Valgt: generelle kernetegn med eksplicit host-tilladelse.** Giver præcis
   typekontrol og kompakt kilde, bruger platformens kryptografiske primitiver
   og udstiller aldrig nøglematerialet som en H-Code-værdi.
2. En ren H-Code-pakke med egen SHA/HMAC-implementering ville øge
   udviklerskrevet kode, kræve manglende byteoperationer og indføre en ny
   kryptografisk implementering. Det indgår ikke i B1.
3. En færdig session/login-operation ville skjule applikationslogikken og
   stride mod projektets universelle formål. Den vælges ikke.

## Primær syntaks og typer

Alle fire tegn er NFC/NFKC-stabile og findes ikke i den undersøgte
kerne-symbolregistrering. Implementeringen skal også kontrollere alle
eksisterende pakkeeksporter for kollision før reservation.

| Tegn | Sekundært ASCII-alias | Typet betydning |
|---|---|---|
| `⌁text` | `sha256_text` | `String → String`: SHA-256 af præcise UTF-8-bytes, 64 små hextegn |
| `⊩(key,message)` | `hmac_sign` | `(String,String) → String`: HMAC-SHA256 med host-nøglens alias, 43 kanoniske base64url-tegn |
| `⊨(key,message,mac)` | `hmac_verify` | `(String,String,String) → Bool`: verificér præcis samme MAC med konstanttids-byte-sammenligning |
| `⚄bytes` | `random_id` | `Number → String`: OS-CSPRNG med angivet byteantal, kanonisk base64url uden padding |

`key` er et offentligt alias, eksempelvis `"session"`; det er aldrig
nøglemateriale. Ingen operation til at læse eller serialisere nøglen findes.
Hvert tegn får egen AST-/typed-AST-betydning; aliases giver identisk AST og
semantik. Disse operationer kan ikke redefineres af importerede pakker.

Eksempel på den foreslåede kilde, med host-grant og uden sessionsmakro:

```hcode
≔ id←⚄24
≔ message←"hcode-session/v1/"+id
≔ mac←⊩("session",message)
⎙(⊨("session",message,mac))
≔ digest←⌁id
```

Eksemplet logger kun verifikationsresultatet. Domænepræfiks og algoritmen,
som senere bruger tegnene, forbliver synlig H-Code-kilde. `⌁` af et
sessions-ID kan senere bruges som vedvarende identifikator uden at lagre
bearer-tokenet.

## Data og fejlkontrakt

- Hash og HMAC bruger runtime-Stringens præcise UTF-8-bytes. Ingen implicit
  Unicode-normalisering tilføjes til kryptografien. Kildesprogets eksisterende
  NFC-normalisering af literal-kilde ændres ikke; runtime-input kan bevare
  forskellige kanoniske former.
- Beskeder er højst 65.536 UTF-8-bytes; uparrede surrogater og overskridelse
  af grænsen afvises før host-kald. Tom besked er gyldig.
- `mac` skal være præcis 43 base64url-tegn, decode til 32 bytes og re-encode
  til nøjagtig samme tekst. Forkert længde, padding, alfabet, kanoniske
  padding-bits eller forkert MAC giver `⊥`. Begge runtimegrænser udfører
  samme validering. Ingen sammenligning af MAC-tekst via `≡` bruges.
- Gyldige 32-byte-MAC'er sammenlignes med platformens
  `timingSafeEqual`; dette er ikke en garanti om konstant køretid for
  parseren, tilladelseskontrol eller hele programmet.
- Manglende rettighed, ukendt alias eller defekt host-grant er en fejl,
  også når MAC-inputtet er ugyldigt. Rettigheder kontrolleres før signering
  eller verifikation; en manglende nøgle må ikke ligne en forkert signatur.
- Tilfældighed kræver et helt byteantal fra 16 til 64 inklusive. `⚄24`
  giver 32 base64url-tegn. `NaN`, uendelighed, brøker og værdier udenfor
  intervallet afvises før entropy-kald. Ingen `Math.random`-fallback.
- Fejltekster må ikke indeholde nøglemateriale, besked, MAC, genererede ID'er
  eller hele grant-konfigurationen. Host-fejl får en stabil, renset fejltekst.

## Host-ejerskab og effektgrænser

Referenceinterpreteren får en eksplicit, trusted `cryptoHost` i
`execute`/`executeAsync`-options. En separat Node-referenceadapter bruger
`node:crypto`; den tager egne kopier af nøgler ved oprettelse og har ingen
metode til at udlevere dem til H-Code. Ingen ambient process-rettighed
opstår ved at importere interpretermodulet.

Den kompilerede Node-CLI får en ny eksplicit grant fra
`HCODE_CRYPTO_GRANTS`. Det er et versioneret JSON-objekt:

```json
{"version":1,"keys":{"session":{"hex":"<host supplied hex>","sign":true,"verify":true}},"random":true}
```

Grants afvises, hvis struktur/version er forkert, aliases ikke matcher
`[A-Za-z][A-Za-z0-9_.-]{0,63}`, der er over 32 aliases, en rettighed ikke
er Bool, eller hexnøglen ikke er 16–128 bytes med fuldt gyldigt lige-langt
hexinput. Grants behandles med egne/prototypefrie opslag; ingen nedarvede
properties giver tilladelse. En anbefalet sessionsnøgle er 32 bytes;
20-byte-nøgler understøttes til bl.a. RFC4231 kendt-svar-tests.
Der er ingen standardnøgle eller automatisk tilfældighedstilladelse.

CLI-grant læses og snapshots ved programstart, og bliver ikke indlejret i
genereret ESM, lockfiler eller diagnostics. Fravær af grant er tilladt for
hashing og programmer uden kryptografiske effekter. En anvendt sign/verify/
random-operation fejler uden den relevante rettighed. Secret manager,
nøglerotation og produktionsdeploy er særskilt host-arbejde, ikke B1.

`⌁` er ren og kan bruges i rene pakker. `⊩`, `⊨` og `⚄` har host-effekt
og afvises i rene låste pakker, CAS-reducers og begge sorteringsnøglers
rene evaluering. Rust håndhæver kendte direkte og transitive tilfælde;
runtimegrænser afviser også indirekte funktionskald. Guard-tilstand
gendannes efter fejl. Eksisterende grænser må ikke svækkes for at få
sessionsdemoen til at virke.

## Replay og ressourceforbrug

Referenceinterpreteren får en separat tilfældighedsjournal ejet af ét
`executeAsync`-kald. Et besøg registrerer indeks, byteantal og host-resultat.
Et replay genbruger resultatet ved samme indeks og byteantal og kalder ikke
OS-entropikilden igen. Uoverensstemmende replay afvises. Journalen lever
ikke på tværs af kørsler eller klienter.

Maksimalt 64 nye tilfældighedsoperationer og 4.096 entropy-bytes pr.
kørsel. Budgettet og journalen lever udenfor replay-løkken; et afvist kald
bruger ingen entropy. Hash, sign og verify tæller hver som ét normalt
runtime-step og har ovenstående inputgrænse. Den kompilerede runtime har
samme tilfældighedsbudget uden behov for replay.

## Implementeringsflader efter designgodkendelse

- `compiler/src/lexer.rs`, `ast.rs`, `parser.rs`, `checker.rs`:
  kerne-token, aritet, typer, effektregler, transitive audits og finalisering.
- `compiler/src/codegen.rs` og ny `compiler/src/crypto_prelude.js`:
  særskilt lowering, fuld traversal af nye AST-noder og betinget linkage.
  Rene programmer må ikke få indlejret key-grant- eller entropy-adgang.
- `prototype/src/hcode.mjs` og ny `prototype/src/crypto-reference.mjs`:
  selvstændig parsing/evaluering, host-kontrakt, effektkontrol og journal.
- Dedikerede Rust-, Node- og integrationstests samt docs/symbolregistrering.
  Ingen ændring af de frosne Canonical16-referencefiler.

## Accepttests til implementeringsplanen

1. Glyph/ASCII giver samme AST, typer og output. Forkert aritet og typer
   afvises i Rust og reference; eksisterende pakker må ikke miste egne tegn.
2. `⌁"abc"` giver den kendte SHA-256
   `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`.
   Tom tekst og forskellige runtime-Unicode-former testes særskilt.
3. HMAC matcher RFC4231 case 1 (`0b` gentaget 20 gange, `Hi There`) og
   B0-sessionens faktiske uændrede domain/message/key-kombination. Forventede
   resultater må ikke beregnes af den H-Code-runtime, som testes.
4. Verifikation accepterer korrekt MAC og afviser ændret besked, anden
   nøgle, alle malformed-former og noncanonical sidste base64url-tegn.
5. Manglende grant, verify-only/sign-only alias, ukendt alias, forkert
   version/schema/hex, prototype-opslag og for store grants fejler lukket.
6. Både statisk kendte og indirekte effekter i rene pakker, sorteringsnøgler
   og CAS-reducers afvises før host-kald; hash forbliver tilladt.
7. Entropygrænser 16 og 64, ugyldige 15/65/brøk-værdier, 64-kaldsbudget,
   canonical output, host-resultatvalidering og fejl uden hemmelige data.
8. `⚄` før og mellem mindst to ventende HTTP/sleep-effekter: to faktiske
   source-kald giver præcis to host-kald, stabile ID'er ved replay og samme
   efterfølgende kontrolflow. En ny kørsel må ikke genbruge journalen.
9. Ændring af oprindelig host-key-buffer efter snapshot ændrer ikke en
   igangværende kørsels resultat. Ingen key-literal må findes i bygget ESM.
10. Input på præcis 65.536 UTF-8-bytes accepteres; 65.537 og lone surrogate
    afvises før crypto-host-kald; empty-message HMAC er gyldig.
11. Positive og negative compiler→Node-resultater sammenlignes med den
    uafhængige reference på Windows og Ubuntu. Kør derefter eksisterende
    Node-, Studio-, Rust- og relevante canonical-regressioner.
12. Mål sign- og alias-kilden samt genereret ESM separat på samme eksempel.
    Ingen fortolkning af glyph-vs-alias som TypeScript-benchmark eller 70 %.

## B2-afhængigheder og åben projektstatus

B1 alene kan ikke implementere hele sessionopgaven. B2 skal særskilt
designe request-Cookie/response-Set-Cookie, trusted tid, entropy udenfor
genkørte transaktioner, nøgle-snapshot i en eksplicit handlerkontekst og
atomisk persistent issue/rotate/revoke skrevet i H-Code. Det er ikke
tilstrækkeligt at kalde det eksisterende HTTP-svar en cookiekanal eller
tillade vilkårlige effekter inde i CAS-reduceren.

B0's frosne oracle er reference for de beskrevne fixturekontrakter; nye
adversarielle krav skal være additive og versionsførte, ikke en stille
overskrivning af baseline. B3 må først hæve dækningen efter faktisk
Rust/JS/TypeScript/API/persistens-paritet og de krævede platformchecks.

Næste trin efter ejerens designreview er en konkret RED→GREEN
implementeringsplan for B1. Dette dokument ændrer ingen runtimeadfærd.
