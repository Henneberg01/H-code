# H-Code — samlet masterplan M0–M59 (Compact Syntax Engine / universelt programmeringssprog)

**Version:** 2.0 — 17. oktober 2026  
**Status:** plan til ejerens gennemgang; intet i M10–M59 er påstået implementeret  
**Projekt:** **H-Code**, et selvstændigt tegnbaseret programmeringssprog inspireret af Morse/SOS-princippet om informationstæthed — **ikke** FastSell-platformen  
**Ejer/attribution:** Jonas Fogh Henneberg, operating as Fastsell.net, CVR 46614887, Danmark (bekræft formelle registre før juridisk offentliggørelse)  
**Licens:** Apache License 2.0 for offentliggjort H-Code Core/Studio-kilde; særskilte rettigheder til officielt H-Code-navn/logo jf. `TRADEMARKS.md`

## Ufravigelig produktvision

H-Code skal være et **nyt, generelt programmeringssprog**, hvor **Unicode-tegn er den rigtige primære kildekodesyntaks**: ét tegn kan være én præcist defineret, typesikker og inspicerbar operation. Almindelige tekstaliaser er sekundære, tilgængelige skrivemåder med **samme** betydning. Sproget skal kunne udvikles til komplette webshops, SaaS, AI-løsninger, 2D/3D-spil, mobile apps, desktopprogrammer og systemsoftware. Intet må reduceres til hardcodede FastSell-funktioner, hemmelige makroer eller AI-prompts. Programmer kan kompileres og køres **uden** AI.

**Forskningsmål (ikke verificerede resultater):** ≥70 % færre Unicode-kodepunkter i **udviklerens egen** kildekode sammenlignet med idiomatisk TypeScript på **alle 20** relevante, funktionsækvivalente benchmarkopgaver (median som primær score); 2–5× kortere udviklingstid; 25 % lavere AI-tokenforbrug. Dette er hypotese, ikke garanti; ingen markedsføring af målene som opnået før uafhængig, gentaget måling.

**Separat obligatorisk regnskab:** UTF-8-bytes; brugerforfattede bibliotekskilder; genbrugte afhængigheder, lockfiler og kompilerede bundles; runtime/compile-time, CPU/hukommelse; bruger- og AI-tid; korrekthed. Besparelse i synlige tegn er **ikke** automatisk mindre fil eller hurtigere program. Programspecifikke biblioteker skal med i forfattet kilde; velkendte offentlige biblioteker tæller som dependencies og skal oplyses på begge sider.

## Gældende historik og re-baselining

- M0–M9 er tidligere udviklet **i prototype- eller betaomfang** og deres allerede færdigmeldte arbejde/commit-historik **renummereres ikke**. Se `docs/PHASE1_STATUS.md` og `H-CODE-PRINCIPLES.md`. Seneste dokumenterede lokale testbaseline: **107/107** i fase-1-arbejdet; ikke en ny testrunde ved skrivning af denne plan.
- Den eksisterende `MILESTONES.md` registrerer foreløbige, endnu **ikke startede** M10–M13-titler. Denne version re-prioriterer **kun de fremtidige** numre for at bygge et reelt generelt sprog før premium features: **gammel M10 Studio Pro → ny M57**, **gammel M11 1.0 → ny M59**, **gammel M12 WASM/native → nye M30/M31**, **gammel M13 Teams/Cloud → ny M56**.
- **CSE-1 = ny M10**, **CSE-2 = M11** og **CSE-3 = M12–M13**. **M14–M16** udvider udtrykskraften med selectors, kompakt bloksyntaks og brugerdefinerede operationer. **CSE-4 = måling og udviklerværktøjer i M17–M19 samt den fulde 20-opgave-verifikation i M58**.
- GitHub: `Henneberg01/H-code`. Fase-1-hardening eksisterer på draft PR **#3** og er **ikke merged** ved dette plandokument. Compact Syntax-design ligger på `docs/compact-syntax-70pct-design`. Ingen merge, ændring af synlighed, tag eller deploy er godkendt her.
- `MILESTONES.md` forbliver historisk kortoversigt, indtil denne re-baselining er reviewet; **dette dokument er foreslået kanonisk plan** med fulde accepttests.

## Hvordan vi arbejder

1. **En milepæl = et afgrænset, testbart produktresultat**, ikke blot oprettede filer eller et UI-mockup.
2. For **nye sprogfunktioner** skal JavaScript-reference og Rust-parser/typechecker/emitter opføre sig ens på positive/negative fixtures, og tidligere `.hc`-kode skal stadig virke.
3. Hver milepæl får et design, TDD-implementeringsplan, målbare accepttests, sikkerheds-/performancekontrol og separat review/draft PR. Ingen automatisk merge, paid CI, branch-force, publicering eller release.
4. Der bruges ærlige måledata med verificerbar provenance: versionsnumre, maskine, scripts, rå resultater, fejlede cases og udækkede platforme. Mål er ikke facit.
5. Rigtige produktbehov styrer bibliotekerne, men H-Code selv skal fortsat være **generelt**: ingen compiler-hardcodet checkout, spilmotor, Stripe eller chatbot.
6. **Sikkerhed:** H-Code-genereret JavaScript arver i dag Node-rettigheder; M8 er **ikke sandboxing**. Ubetroet kode må først udføres efter særskilt verificeret isolation (M37).

## Fuld milepælsliste (60 af 60)

**Statusforklaring:** M0–M9 = tidligere prototype-/betaresultat; M10–M59 = planlagt. Gaten er den mindst krævede verificerbare accept, ikke et løfte om at underliggende arbejde er udført.

### Fase A — Eksisterende H-Code-fundament (M0–M9)

| Milestone | Konkrete leverance | Objektiv accepttest / definition of done | Afhænger af |
|---|---|---|---|
| **M0** ✓ prototype | Projektgrundlag | Projektets navn/arkitektur og dokumenteret modulstruktur findes | – |
| **M1** ✓ prototype | Symbolbaseret referencesprog | Glyphs og ASCII-aliaser parses/fortolkes med offline tests og låste symbolpakker | M0 |
| **M2** ✓ prototype | Rust-frontend | Lexer, AST og statisk typechecker består eksisterende integrationstests | M1 |
| **M3** ✓ prototype | JavaScript-emitter | `hcodec check/build/run` udfører kendte eksempler med korrekt output | M2 |
| **M4** ✓ prototype | Filer og moduler | Rekursive lokale imports, exports og standardbiblioteksstart fungerer | M3 |
| **M5** ✓ prototype | Tre beregningsprogrammer | Faktura/lager/opsparing fungerer som demos, ikke komplette applikationer | M4 |
| **M6** ✓ prototype | Lokal H-Code Studio | Editor, filer, check/build/run og symbolpalette fungerer; visuel QA udestår | M3 |
| **M7** ✓ prototype | AI-forslag med godkendelse | Forslag/diff/apply/rollback findes; real API-credential test udestår | M6 |
| **M8** ✓ prototype | Runtime- og HTTP-grænser | Fuel/depth og lokale Origin/Host-kontroller består tests; **ingen sandbox** | M7 |
| **M9** ✓ prototype | Licens og kildekodesamling | Apache-2.0, dokumentation og GitHub-kilde merged; ikke officiel tagget release | M8 |


### Fase B — Compact Syntax Engine og ægte tegnkomprimering (M10–M19)

| Milestone | Konkrete leverance | Objektiv accepttest / definition of done | Afhænger af |
|---|---|---|---|
| **M10** | CSE-1: korte funktioner og pipeline `▷` / `|>` | Begge frontends: ≥6 glyph/ASCII-par, ≥6 negative cases, korrekt typesystem, CLI og ingen regressionsfejl | M9 + PR #3 |
| **M11** | CSE-2: **TEGN-sekvenser** | `⟦...⟧` typed sekvens, `xs⟦i⟧` bounds-sikker adgang, `⌗xs` længde, `xs ⧺ ys` typed sammensætning; verificeret Rust/JS-glyphparitet | M10 |
| **M12** | CSE-3a: tegn-records og felter | Tegn-drevet oprettelse og felttilgang typesikres; ingen skjult JS | M11 |
| **M13** | CSE-3b: generiske samlingsoperationer | Versioneret generisk operator-binding med åbne, typede `∑`, `⌕`, `⇢` i et SHA-låst bibliotek; tegn er primær syntaks | M11–M12 |
| **M14** | Higher-order funktioner og selectors | Lamdas/funktionsværdier og `?felt`/`.felt` bevares som kontrollerbare typede AST-noder | M13 |
| **M15** | Kort bloksyntaks og delimiter-regler | Valgfrie afslutninger/kompakte blokke kan parses entydigt, formatteres og bagudkompatibelt | M14 |
| **M16** | Egne tegn i almindelig H-Code | Brugere definerer dokumenterede operationer med typede signaturer, eksporterer og versionlåser tegn uden compilerpatch | M13–M15 |
| **M17** | Unicode-værktøjer og læsbarhed | Palette, tastaturindtastning, aliasvisning, søgning, code review og skærmlæsernavne testes | M16 |
| **M18** | Pipelines i compileren | Reproducerbare lowering-/optimeringskontroller viser ingen dobbelt evaluering, skjult effekt eller svækket fejldiagnostik | M10–M17 |
| **M19** | CSE-4: reproducerbar komprimeringsbase | 6 implementerede sammenligningspar og protokol for alle 20 opgaver; tegn, bytes og afhængigheder rapporteres ærligt | M10–M18 |


### Fase C — Universelle sprogfunktioner og runtime (M20–M29)

| Milestone | Konkrete leverance | Objektiv accepttest / definition of done | Afhænger af |
|---|---|---|---|
| **M20** | Generics og traits | Generiske brugerfunktioner, constraints og typeinference består positive/negative tests | M13 |
| **M21** | Collections og avancerede datatyper | `Map`, `Set`, tuple, nested types og sikker mutation med typekontrol | M11 + M20 |
| **M22** | `Option`, `Result`, enums og pattern matching | Udtryk for fravær, fejl og varianter giver udtømmende match-kontrol | M20–M21 |
| **M23** | Ressourcer og hukommelsesmodel | Dokumenteret ownership/GC-valg, livscyklustests, allokations- og fejltilfældekontrol | M20–M22 |
| **M24** | Async, tasks og samtidighed | Async/await eller tilsvarende tegnsyntaks; race-/cancel-/ordering-tests | M23 |
| **M25** | Filer, processer og streams | Platform-I/O er eksplicit, reproducerbart og permission-gated | M24 |
| **M26** | Netværk og HTTP | Typed klient/server sockets/HTTP med timeout, streaming og fejlhåndtering | M24–M25 |
| **M27** | Package manager og registry | Versioner, lockfiles, verificerede pakker, konflikt- og supply-chain-tests | M16 + M22 |
| **M28** | Optimerbar IR og incremental compilation | Typed IR, incremental builds, gyldige source maps og diff-test mod referencebackend | M18 + M27 |
| **M29** | FFI med JS/Rust/C | Typede grænser, ejerskab/ABI, rettighedsmodel og integration med eksisterende biblioteker | M23 + M28 |


### Fase D — Compilerplatforme, værktøjskæde og sikkerhed (M30–M39)

| Milestone | Konkrete leverance | Objektiv accepttest / definition of done | Afhænger af |
|---|---|---|---|
| **M30** | WebAssembly-backend | H-Code-programmer kører i WASM med deterministisk output og dokumenterede host-API'er | M28 |
| **M31** | Native backend | Kørbar Windows/Linux/macOS-artifact og compiler-smoketests uden JS-runtime | M28–M30 |
| **M32** | Debugger og sourcemaps | Breakpoints/stack/variable-sporing peger tilbage på originale Unicode-kildespænd | M28 |
| **M33** | Language Server Protocol | Autocomplete, definitioner, rename og diagnostik i flere editorer med glyphs og aliases | M16 + M32 |
| **M34** | Formatter, linter og docs-generator | Idempotent formatter, symbolbevarende lint og genereret API-dokumentation | M15 + M33 |
| **M35** | Officielt testframework | Unit/integration/property tests, mocks og coverage på begge compiler-backends | M28 |
| **M36** | Build-, distribuerings- og versionsværktøjer | Signering/packaging, reproducible builds og kompatibilitet på målplatformene | M27 + M30–M35 |
| **M37** | Sandbox og capabilities | Ubetroet kode isoleres i separat verificeret sikkerhedsgrænse; ekstern audit obligatorisk | M23–M36 |
| **M38** | Performance og optimering | IR-/runtime optimeres med før/efter benchmarks; correctness, hukommelse og performance følges | M28 + M35 |
| **M39** | Sprogspecifikation og compat-kontrakt | Versioneret grammatik, normativ semanticspec og migreringstest på gamle programmer | M10–M38 |


### Fase E — Hjemmesider, webshops og SaaS (M40–M48)

| Milestone | Konkrete leverance | Objektiv accepttest / definition of done | Afhænger af |
|---|---|---|---|
| **M40** | Browser/DOM og styling | UI-kode i H-Code påvirker browser-DOM/CSS med verificeret HTML-eventadfærd | M30 + M39 |
| **M41** | Reactive komponenter | Komponenter, state, events, forms og responsiv rendering har automatiske browser-tests | M40 |
| **M42** | Routing, SSR, SEO og PWA | Dynamiske sider, serverrendering og tilgængelige ruter/indexering bestået | M41 |
| **M43** | Backend/API-framework | Routed HTTP, middleware, validering, jobs, observability og load-tests | M26 + M39 |
| **M44** | PostgreSQL, SQL og migrations | Typed databaseadgang, transaktioner/migrations og isolation i integrationstests | M43 |
| **M45** | Login og adgangsstyring | Sessions, roller, multi-factor integration, CSRF og auth-testpakke | M43–M44 |
| **M46** | Real-time og workers | WebSockets, streams, køer, retry/idempotency og concurrency-tests | M24 + M43 |
| **M47** | Komplet webshop i H-Code | Produkter, varianter, kurv, priser, moms, ordre, Stripe testmode, kunde/admin og deploy accepteret | M41–M46 |
| **M48** | Multi-tenant SaaS/marketplace | Abonnementer, lejerskel, roller, isolerede data og belastnings-/sikkerhedstests | M45–M47 |


### Fase F — Spil og øvrige platforme (M49–M55)

| Milestone | Konkrete leverance | Objektiv accepttest / definition of done | Afhænger af |
|---|---|---|---|
| **M49** | 2D-spilframework | Sprites, animationer, game loop, input og browser/native demo uden hardcodede spilregler | M30–M31 + M39 |
| **M50** | 3D-rendering | GPU/WGPU/WebGPU-wrapper, meshes, shaders, lys og kameraer med render-/perf-tests | M49 |
| **M51** | Fysik, lyd og animation | Collision, simulationstidsstep, asset-loading, animation og lydintegration fungerer | M49–M50 |
| **M52** | Rigtig multiplayer | Autoritativ server, state sync, lag, reconnect, lobby og flere spillere over internettet | M26 + M51 |
| **M53** | Spiludgivelse | Komplet spil kan buildes og distribueres i browser og på understøttede desktopmål | M49–M52 |
| **M54** | Desktop, mobil og PWA | Windows/macOS/Linux-apps, Android/iOS via egnede targets/bridges, distributionstests | M31 + M40 |
| **M55** | Hardware og IoT | Typede Bluetooth/USB/sensor-API'er med eksplicit platform- og capabilities-test | M25 + M37 |


### Fase G — Økosystem, kommercialisering og 1.0 (M56–M59)

| Milestone | Konkrete leverance | Objektiv accepttest / definition of done | Afhænger af |
|---|---|---|---|
| **M56** | Teams, H-Code Cloud og drift | Workspace- og adgangsisolation, CI/deploy/hosting, observability og pris-/driftstest | M36 + M48 |
| **M57** | Valgfri AI Studio Pro | Betalte AI-arbejdsgange med review, test, sikker credentials og klar adskillelse fra gratis Core | M33 + M56 |
| **M58** | 20-programmers benchmark og uafhængig review | Alle 20 opgaver gennemføres korrekt, TypeScript-paritet, kilde/bytes/afhængigheder og medianmål ≥70% vurderes uden at skjule tabere | M19 + M47 + M53–M57 |
| **M59** | H-Code 1.0 — universel accept | Stabil spec, cross-platform værktøjer, komplette webshop/spil/SaaS-eksempler, ekstern sikkerheds-/DX-review og versioneret release | M37–M58 |

## De første gennemførlige arbejdsblokke (prioritet og grænser)

| Leverance | Første ændring | Resultat inden næste start |
|---|---|---|
| **M10 / CSE-1** | Korte expression-return funktioner og `▷` / `|>`-pipeline i eksisterende compiler | Seks fælles positive glyph-/aliasprogrammer, mindst seks fejltilfælde, typekontrol, runtimeækvivalens, alle eksisterende tests grønne, draft PR |
| **M11 / CSE-2** | Sign-first `⟦` `⟧` `⌗` `⧺`: typede sekvenser og kontrolleret indeks | Semantiske Rust/JS-paritetstests, grænser og kompatibilitet grønne |
| **M12 / CSE-3a** | Records, felter og statisk validering | Type-/semantiske integrationstests |
| **M13 / CSE-3b** | Rent, åbent samlingsbibliotek med `∑`, `⌕`, `⇢` og versioneret manifest | Generiske kontrakter, signaturer, kollisioner og låste kilder verficeret |
| **M14–M19 / syntaksudbygning og CSE-4** | Lambda/selectors, syntaks, egne tegn, dokumentation og reproducerbar målemotor | Baseline inkl. både gevinster og regressioner, men ingen global 70 %-påstand |
| **Slutbenchmark — M58** | Komplet 20-programmers slutbenchmark | Samtlige 20 opgaver er funktionsækvivalente og understøttede; hvis én ikke er understøttet, tæller målet som ikke opfyldt |

**Hvor vi starter:** Den **første faktisk implementerbare opgave er M10/CSE-1**, beskrevet i `docs/superpowers/specs/2026-10-17-hcode-compact-syntax-design.md` og implementeringsplanen `docs/superpowers/plans/2026-10-17-hcode-cse1-compact-syntax.md`. Resten er fremtidige faser og kræver særskilte design-/acceptbeslutninger.

## Definition af 70 %-målet

```text
Reduktion (%) = 100 × (1 − H-Code kodepunkter / idiomatisk TypeScript kodepunkter)
```

- **Primært:** Medianen over de **20 på forhånd navngivne** opgaver i `docs/BENCHMARKS.md` skal være ≥70 %; alle 20 skal kunne gennemføres korrekt for at kunne erklære resultatet nået. Opgaver, der ikke kan bygges, er **ikke** nul-længde H-Code og må ikke fjernes.
- **Sekundært:** Individuelle reduktioner, gennemsnit/median/spredning, UTF-8-bytes, faktisk brugerdefineret bibliotekskode, outputbinaries, genbrugte pakker, eksekveringstid, udviklingstid og AI-tokenregnskab.
- Begge implementationer skal bestå samme input/output-accepttest; fælles biblioteker må bruges på begge sider. Engangsgenererede filer kan holdes ude af udviklerskrevet kildekode på **begge** sider, men er med i total footprint.
- Brug **ikke** fase 1's 11–19 % glyph-vs-alias-tal som TypeScript-vs-H-Code-sammenligning. De måler noget andet. 
- 70 % kan være realistisk i visse anvendelser, men det er ikke bevist som generel median; ikke alle typer programmer kan eller bør forkortes uden omkostninger i læsbarhed.

## Accept før næste fase

**M10 klar til start, når plan er reviewet:** `docs/superpowers/plans/2026-10-17-hcode-cse1-compact-syntax.md` beskriver præcis grammatik, ændrede filer, regressionstests, Unicode- og typekontrol samt GitHub branch-policy. **Et plandokument er ikke færdig compilerkode.**

**Arkitektonisk disciplin:** ny funktion bør kun introduceres, hvis den virker i rigtig .hc-kilde, både Unicode og ASCII, med egne tests, og uden skjulte FastSell-/webshop-specifikke antagelser. Spec, kode og tests skal holdes synkrone.

## Roadmap-historik

- V1: historisk `MILESTONES.md` med M0–M13, samt tidligere mundtlig M0–M59-projektvision.
- V2 2026-10-17: samlet M0–M59 plan baseret på den godkendte kompakthedsretning; kun **uimplementerede** numre M10+ er prioriteret på ny. Bevar dette mappingspor ved alle senere ændringer.

## Ejergodkendt kurskorrektion 2026-10-18 — TEGN først

M11-planen blev tidligere teksttung med `List<T>`, `len`, `append` som primær demonstration. Dette var i strid med H-Codes formål. Den reviderede, **ikke implementerede** grammatik fremhæver `⟦`, `⟧`, `⌗`, `⧺`; M13 kræver ægte generiske `∑`, `⌕` og `⇢`. Interne typer er stadig tilladt, men kildeeksempler og release-accept skal bruge tegn. Hver milepæl måles på sammenlignelige, låste programpar; datasæt udskiftes aldrig uden nyt versions-ID.

## Tekniske implementeringsresultater (18. oktober 2026) — ikke endelig M13-godkendelse

På `feat/m13-core-collection-signs` er `∑`, `⌕`, `⇢` nu oprettet som **rigtige operatorer** i Rust-lexer, AST, typechecker og JavaScript-codegen samt JS-referencefortolker og Studio. Deres semantik er generel og typed. De bruger nu kernelignende, kontrollerede runtime-primitiver — det er **ikke** en implementering af det planlagte SHA-låste, brugerdefinerbare manifest-v2 bibliotek, som stadig er åbent.

De **samme tre M11-opgaver og identiske, SHA-låste TypeScript-programmer** blev genkørt i JS-referencefortolkeren og en TypeScript-udførelse:

| Samme opgave | M11 H-Code | M13 H-Code | Uændret TypeScript | M13 besparelse vs TypeScript |
|---|---:|---:|---:|---:|
| Sum | 113 | 17 | 100 | +83,00% |
| Map | 159 | 57 | 130 | +56,15% |
| Filter | 185 | 77 | 167 | +53,89% |

Median **+56,15% i Unicode-kodepunkter**, median **+40,12% i UTF-8-bytes**, kun **tre foruddefinerede opgaver**, ikke universel 70%. Alle kilders Git SHA og forventet output findes i `compact/benchmarks/m13/manifest.json`. Reproducerbar kørsel: `npm run m13:measure` på Node 22+.

**M13 release gate fortsat åben:** Cargo/Rust, fuld Node/Studio CI, gamle programmer, opdateret manifest-v2 og publiceret generisk operator-binding. M0–M9 og `main` er urørte. Inkludér ALLE 20 kanoniske programmer, også de dårlige, før universelle effektivitets-påstande.

## 2026-10-18 — M14 sign-first expression work (draft only)

The experimental **M14 λ anonymous unary closure** and **first-class operator sections** are implemented in both Rust sources and the JS reference on `feat/m14-typed-lambda-glyph`. M13 `∑ ⌕ ⇢` is untouched on its upstream draft branch.

The same three M11 task IDs and **the same SHA-locked original TypeScript files** have a new, separately versioned M14 H-Code source variant. Exact program outputs are identical in the JS reference; no TypeScript examples have been shortened, enlarged or swapped.

| Task | M11 H-Code | M13 H-Code | M14 H-Code | TypeScript | New code-point reduction vs TypeScript |
|---|---:|---:|---:|---:|---:|
| Sum | 113 | 17 | 17 | 100 | 83.00% |
| Map | 159 | 57 | 41 | 130 | 68.46% |
| Filter | 185 | 77 | 55 | 167 | 67.07% |

**Median M14 = 68.46% fewer Unicode code points; 55.09% fewer UTF-8 bytes** than these three TypeScript programs. This is still below 70% on map and filter and is **not the canonical 20-case study**.

Run the separately frozen comparisons on Node22+: `npm run m14:measure`. Cargo, full Node/Studio CI, upstream PR integration, future M14 field selectors and generic manifest-v2 remain open. Do not mark M14, M13 or the 70% global hypothesis complete.
