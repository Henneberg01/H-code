# H-CODE — MASTERPLAN v1.0

**Dato:** 17. oktober 2026  
**Status:** Godkendt retning fra samtalen; tekniske valg, tidsestimater og prisforslag er foreløbige, ikke leverede produkter.  
**Projekt:** Selvstændigt internationalt open source-programmeringssprog med kommercielle AI-tjenester.  
**Arbejdsnavn:** H-Code (kræver navne- og varemærkeundersøgelse).  
**Planens ejer:** Projektstifteren; konkrete udviklingsroller er endnu ikke tildelt.

---

## A. Vision og beslutninger fra projektets første samtale

### Vision

H-Code skal være et nyt, **generelt, symbolbaseret programmeringssprog** og et komplet udviklingsøkosystem, der gør det muligt for mennesker og AI at bygge software med mindre arbejde, høj korrekthed og konkurrencedygtig runtime-ydelse. Det skal kunne udvikles til webapps, backend/API'er, CLI-programmer, mobil- og desktopapps, automation, spil og andre typer software. Det er **ikke** et FastSell-specifikt produkt; FastSell kan eventuelt bruges som testkunde, men må ikke forme sprogets kerne.

### Beslutninger

1. **Nye tegn som programmering:** Idéen bygger på et morse-/SOS-lignende princip: ét tegn kan repræsentere en fuldt defineret operation eller et stort genbrugeligt kodemønster. Tegnet er ikke magi; operationens kontrakt og implementering findes i sproget eller et versioneret bibliotek.
2. **Et rigtigt programmeringssprog:** Variable, værdier, funktioner, kontrolflow, typer, moduler, fejl, datastrukturer og sideeffekter skal kunne udtrykkes uden begrænsning til forudbyggede app-funktioner. Brugere skal kunne definere egne funktioner, symboler og biblioteker.
3. **Universalitet som langsigtet mål:** En bærbar sprogkerne skal være uafhængig af app-platforme. Forskellige backends og biblioteker tilføjes gradvist; alle platforme understøttes ikke ved første release.
4. **Begge indtastningsformer:** Ægte symbolsyntaks skal understøttes i `.hc`-filer, men hvert symbol får også et entydigt, læsbart tekst-alias for almindelige tastaturer, accessibility, Git-værktøjer og AI.
5. **AI-first uden AI-lock-in:** AI kan bygge/ændre kode strukturelt og teste resultater, men en H-Code-app skal kunne kompileres og køres helt uden et AI-abonnement.
6. **Fokus på målbare fordele:** Udviklingstid, korrekthed, AI-forbrug, kompileringshastighed, runtime og hukommelse skal måles særskilt. 'Verdens hurtigste' er en ambition, ikke en opnået egenskab.
7. **Åben kerne:** Sprog, compiler, lokal IDE og kernebiblioteker foreslås udgivet under Apache License 2.0. Gratis brug i både open source- og kommercielle apps; ingen afgift pr. bygget app.
8. **Forretning:** Betalt H-Code AI Studio Pro og senere Teams/Cloud/hosting. Tidlige prisidéer: **199 DKK/md.** for AI Studio Pro og **399 DKK/bruger/md.** for Teams. Priser skal testes, og AI-forbrug skal have klare grænser.
9. **Eksport og ejerskab:** Udvikleren ejer sin app, kan eksportere kode og vælge egen hosting. Forretningen må bygge på reel bekvemmelighed, ikke kunstig lock-in.
10. **Økosystem:** Editor (H-Code Studio), compiler, standardbibliotek, pakkehåndtering, debugger, docs, eksempler, testværktøjer, integrationsbiblioteker og AI-arbejdsgange.

### Ikke besluttet endnu

- Endeligt produktnavn, tilhørende domæner og varemærkestrategi.
- Compilerens implementeringssprog (foreløbig anbefaling: Rust, med TypeScript til IDE/UI).
- Eksakt syntaks, Unicode-tegn, semantiske regler og typesystem.
- Endelig prismodel og hvilke funktioner, der inkluderes i betalte tjenester.
- Juridisk enhed, finansiering og team.

### Ærlig afgrænsning

Symbolbaserede sprog findes allerede (bl.a. APL); den nye værdi skal dokumenteres i kombinationen af moderne generel programmering, kontraktstyrede symboler, læsbarhed, AI-arbejdsflow og udviklerproduktivitet. Det er ikke bevist, at vi kan være hurtigere end alle andre på alle opgavetyper.

---

## B. Produktarkitektur

### B1 — H-Code Core Language

Første gennemarbejdede kerne skal understøtte: primitive typer; variable og scopes; boolesk logik og matematik; arrays/maps/records; funktioner og rekursion; `if`, loops og iteration; moduler og imports; generiske typer (senere, når den simple typechecker er stabil); eksplicit fejlmodel (`Result`/exceptions besluttes); asynkron I/O og concurrency-model (specificeres særskilt); tests og assertions; interoperabilitet med etablerede biblioteker. Definér UTF-8, Unicode-normalisering, talregler, overflow og deterministisk evaluationsorden.

### B2 — Symbolsystemet (projektets særlige idé)

- To overfladeformer: glyphs (f.eks. `⊕`, `▦`, `↦`) og navne (`cart.add`, `ui.grid`, `on`). Begge oversættes til **samme semantiske node** i compileren.
- Et symbol har ID, navn, versionskrav, input-/outputtyper, tilladte sideeffekter, håndtering af fejl, dokumentation og testkontrakter.
- Symboler kan være primitive operatorer, almindelige funktioner eller sammensatte/særligt optimerbare operationer; udvidelser må ikke uforudsigeligt ændre grammatikken.
- Navnerum for bibliotekssymboler forhindrer konflikt mellem to pakker, der vil bruge samme glyph.
- Versionslåste op-definitioner: Et program skal bygge ens med samme kilde, compiler, lockfil og pakker.
- Sikkerhed: Ingen makro eller pakke må få skjulte tilladelser; konkrete I/O- og netværksrettigheder vurderes ved bibliotek/API-grænser.
- Symbolforklaringer i editoren, søgning, keyboardgenveje, copy/paste, almindelige teksterstatninger og skærmlæsernavne.
- Start med ca. 20 veldefinerede tegn, ikke hundredvis af uklare tegn.

**Eksempel på brugerdefineret symbolkontrakt (kun designspecifikation):**

```hcode
symbol ▦ as ui.grid
  version "1.0"
  input  items: List<Product>
  output View
  effects [ui]
  implementation grid_with_loading_and_empty_state(items)
end

view = ▦(products)           // samme betydning som ui.grid(products)
```

Symbolkontrakten beskriver en stor genbrugelig operation, men tilføjer ikke skjulte handlinger. Biblioteket indeholder implementeringen, som kan inspiceres, testes og udskiftes.

**Illustrativt eksempel — endnu ikke gyldig H-Code:**

```hcode
fn sum(a: Number, b: Number) -> Number { return a + b }
let result = sum(10, 20)

use ui
app Counter {
  let clicks = state(0)
  view {
    ui.text(clicks)
    ui.button("+1") ↦ clicks <- clicks + 1
  }
}
```

Det skal være muligt at udvikle egne symbolfunktioner og genbruge dem i tusindvis af projekter. Et symbol på én karakter garanterer ikke færre modeltokens eller bedre kørehastighed.

### B3 — Compiler og toolchain

```text
.hc-kilde (ægte symboler ELLER kanoniske navne)
    -> tokenizer / parser
    -> syntax tree / diagnostik
    -> type- og effektkontrol
    -> typed H-IR (fælles intern repræsentation)
    -> optimeringer + inkrementel cache
    -> JavaScript-backend (først)
    -> senere WebAssembly / LLVM / native, når værdien er valideret
```

Kommandoer (foreslået CLI): `hcode init`, `hcode check`, `hcode run`, `hcode build`, `hcode test`, `hcode fmt`, `hcode add`, `hcode doctor`.

Kernefunktioner: læsbar compilerdiagnostik, source maps fra genereret kode til `.hc`, deterministiske builds, lockfil, fejltests, conformance-suite, versionsmigrering. Brug eksisterende målplatforme og genbrug gennem FFI; skriv ikke browser, styresystem eller egen database fra nul.

### B4 — Standardbibliotek og platformspakker

- **Portable core:** typer, samlinger, datastrukturer, tekst, tal, test, tid, IO-abstraktioner.
- **CLI:** filer, terminal, proceskald inden for klar rettighedsmodel.
- **Web:** UI-komponenter, state, routing og browser-API'er.
- **Backend:** HTTP, API'er, datalagring, auth-integration, jobkøer.
- **Desktop/mobil:** senere via platformbroer; apppakning, permissions og store-builds er særlige projekter.
- **Spil:** almindelig spillo­gik først; rendering/engine-integration senere.

### B5 — H-Code Studio

Lokal editor og CLI forbliver gratis. Første IDE kan være en VS Code-udvidelse/Monaco-baseret editor, før vi bygger en fuld selvstændig desktop-app. Funktioner: syntaksmarkering, glyph-vælger, code completion, format, jump-to-definition, fejlvisning, source-mapped debugging, test runner, symbolsøgning, eksempler og preview. Et nyt programnavn er ikke vigtigere end en fungerende debugger.

### B6 — AI Studio

- AI får sprogspecifikation, dokumenterede operatorer, compilerdiagnostik og testresultater.
- Foretræk AST-/IR-baserede redigeringer, ellers små diff-patches og efterfølgende kompilering/test.
- Plan/ændring/test/resultat skal være gennemsigtigt for brugeren; ingen skjulte eller ubekræftede deploys.
- Ingen hemmelige API-nøgler i modelinput, ingen automatisk udførsel af farlige kommandoer; sandbox og rettighedsgrænser.
- Mål hele opgavens pris: prompts, output, fejlsøgning, retries, modelkald, tests og rettelser.

---

## C. Milepæle (M0–M13)

**Tidsforudsætning:** Projektstart mandag den 19. oktober 2026. Kalenderen er en planlægningsramme for et lille team på omtrent 2–4 erfarne fuldtidsudviklere plus periodisk design/jura, med overlap mellem opgaver. Dette er ikke en leveringsgaranti. Soloudvikling kan tage markant længere. Ingen milestone er gennemført på tidspunktet for planen.

| ID | Milepæl | Vejledende periode | Afhængighed | Release-resultat |
|---|---|---|---|---|
| M0 | Projektgrundlag og benchmarkbaseline | Uge 1–2 / okt.–nov. 2026 | Ingen | Charter, referenceopgaver, risikoregister |
| M1 | Grammatik, semantik og symbolkontrakter | Uge 3–6 / nov. 2026 | M0 | H-Code Spec 0.1 |
| M2 | Parser, typechecker og fejlvisning | Måned 2–4 / dec. 2026–jan. 2027 | M1 | Maskinlæselig AST og automatiske tests |
| M3 | Første runtime og JavaScript-compiler | Måned 3–6 / jan.–mar. 2027 | M2 | `hcode run` og `hcode build` |
| M4 | Generelt sprog + moduler, FFI, stdlib | Måned 5–8 / mar.–jun. 2027 | M2–M3 | Apps kan bygges af brugerdefinerede funktioner |
| M5 | Første rigtige apps og platformbiblioteker | Måned 6–10 / apr.–aug. 2027 | M3–M4 | CLI, API og fuldstack-demo |
| M6 | H-Code Studio lokalt + debugging | Måned 8–11 / jun.–sep. 2027 | M2–M5 | Brugbar IDE og editor-support |
| M7 | AI-native strukturelle ændringer | Måned 10–13 / aug.–nov. 2027 | M4–M6 | AI kan ændre/teste H-Code reproducerbart |
| M8 | Optimering, sikkerhed og benchmarking | Måned 11–15 / sep. 2027–jan. 2028 | M3–M7 | Publicerbare fairness-benchmarks |
| M9 | Offentlig open source-beta og community | Måned 14–17 / dec. 2027–mar. 2028 | M5–M8 | Downloadbar beta og eksterne brugertests |
| M10 | H-Code AI Studio betalingspilot | Måned 16–19 / feb.–maj 2028 | M7–M9 | Reelle betalende pilotkunder og unit economics |
| M11 | Stabil H-Code 1.0 | Måned 18–24 / apr.–okt. 2028 | M8–M10 | Stabil compiler, versioneret SDK og supportpolitik |
| M12 | WebAssembly/native og flere platforme | Efter bevist kerne; 2028+ | M8–M11 | Cross-target konformitet og nye app-platforme |
| M13 | Teams, hosting, vækst og økosystem | Efter betalingsbevis; 2028+ | M10–M11 | Kommercielle udvidelser, partnerships, community |

### M0 — Fundament og baseline

**Formål:** Sikre, at vi løser et reelt problem og kan dokumentere en forbedring.

**Opgaver:**
- [ ] Skriv Product Requirements Document (PRD), målgruppe og 5 ikke-mål.
- [ ] Kortlæg APL, BQN, Uiua, almindelige makro-/DSL-systemer, Rust, TypeScript, Python, AI-appbuildere og relevante compiler-rammer uden at kopiere ophavsretligt materiale.
- [ ] Vælg 20 sammenlignelige benchmarkopgaver: 5 CLI/data, 5 backend/API, 5 UI/CRUD og 5 fejlretning/refaktorering.
- [ ] Beslut testmetode (samme hardware, biblioteksklasser, modelversion, opgavebriefs og testpakker).
- [ ] Lav data- og repository-arkitektur, contributions-principper, ADR-skabelon, CI-forslag og backlog.
- [ ] Undersøg navnekollisioner og varemærker (H-Code er foreløbigt) og vælg ejer af IP.

**Beståkrav:** Dokumenteret projektcharter, 20 testcases med automatiserede accepttests, benchmarkprotokol, teknisk risikoregister og beslutning om compilerens implementeringssprog.  
**Stop/revider hvis:** Fordelen alene synes at være kortere tegn uden væsentlig genbrug, sikkerhed eller produktivitet.

### M1 — Sprogspecifikation og symbolalfabet

**Opgaver:**
- [ ] Specificér EBNF/grammar og de første programmer i H-Code.
- [ ] Definér 20 kandidatsymboler samt tydelige ASCII-/tekstaliaser.
- [ ] Definér typeregler, scope, funktioner, kontrolflow, operatorpræcedens, mutabilitet, datamodeller og fejlhåndtering.
- [ ] Fastlæg semantikken for makro-/superoperationer: input, output, sideeffekter, navnerum og versionering.
- [ ] Definér Unicode-normalisering, look-alike-tegn, glyph-opslag og source-formattering.
- [ ] Skriv 30 eksempler med forventet output og 30 ugyldige programmer med forventede fejl.

**Beståkrav:** Spec 0.1 og referencetestcases, der entydigt beskriver programbetydningen; symbol- og navneformen kan kortlægges til samme operation.  
**Stop/revider hvis:** Symboler gør sproget umuligt at læse eller introducerer uforudsigelig betydning.

### M2 — Parser, typer og diagnostik

**Opgaver:**
- [ ] Implementér lexer, parser, AST og tydelige spans/locations i kildefilen.
- [ ] Implementér typechecker for de valgte primitive typer, funktioner og collections.
- [ ] Tilføj en reference-evaluator til simple testprogrammer, hvis det giver hurtigere validering.
- [ ] Implementér formatter med AST-roundtrip og stabile snapshots.
- [ ] Test Unicode/glyphs, fejlinput, rekursion, scopes og ugyldige typer.
- [ ] Sæt GitHub Actions/CI op med automatisk lint, test og reproducérbar build.

**Beståkrav:** Mindst 150 automatiske parser-/type-/semantiktests; `hcode check` returnerer præcise, nyttige fejl. Forskellige kildeformer normaliseres til samme AST.  
**Stop/revider hvis:** Grammatikken kræver håndteringsregler, der ikke kan testes deterministisk.

### M3 — Første compiler og execution

**Opgaver:**
- [ ] Introducér typed H-IR og en JS-backend.
- [ ] Byg `hcode run`, `hcode build`, `hcode test` og kildefilkortlægning til genereret kode.
- [ ] Definér runtime-standardtyper og deterministisk fejlopsamling.
- [ ] Implementér minimal CLI-distribution til Windows, Linux og macOS efter behov.
- [ ] Test konformitet mod reference-evaluator og against generated code.

**Beståkrav:** `hello.hc`, algoritmer, datastrukturer og et ikke-trivielt CLI-program kompilerer, kører og består tests. Mindst 250 automatiserede konformitets-/integrationstests.  
**Stop/revider hvis:** Vigtig semantik er afhængig af JavaScript-specifikke tilfældigheder uden dokumentation.

### M4 — Generelt sprog, standardbibliotek og interoperabilitet

**Opgaver:**
- [ ] Færdiggør brugerdefinerede funktioner, records, maps, moduler/imports og fejlhåndtering.
- [ ] Design og implementér sikker JS-FFI, så eksisterende pakker kan genbruges.
- [ ] Definér async/await-, task- og concurrency-semantik for første version.
- [ ] Byg standardbibliotek for collections, string, filer (hvor tilladt), HTTP-abstraktioner og tests.
- [ ] Definér API'er for symbolpakker og pakkeversionskompatibilitet.
- [ ] Beslut generics/traits, dependency injection og memory-models via eksplicitte ADR'er.

**Beståkrav:** Eksterne udviklere kan lave egne biblioteker og symboler. CLI/API kan implementeres uden specialkodede demonstrationsregler i compileren.  
**Stop/revider hvis:** Alle nye funktioner kræver hårdkodede undtagelser i compileren i stedet for almindelige biblioteker.

### M5 — Rigtige applikationer

**Opgaver:**
- [ ] Byg en CLI-dataanalyse-app med filer og tests.
- [ ] Byg en REST-API med databaseadapter, logning og auth-integration.
- [ ] Byg en lille fuldstack CRUD-/booking-app med frontend, backend, validering og tests.
- [ ] Dokumentér eksport af den genererede kode og deployment til en almindelig tredjepartsplatform.
- [ ] Få mindst 5 eksterne udviklere til at forsøge at ændre de samme apps.

**Beståkrav:** 3 ægte eksempelapplikationer gennemført og reproducerbare; brugerne kan ændre apps uden hjælp fra compilerforfatteren.  
**Stop/revider hvis:** Apps kun fungerer som låste templates og ikke kan tilpasses generelt.

### M6 — H-Code Studio og udvikleroplevelse

**Opgaver:**
- [ ] Integrér sprogserver (LSP), autocompletion, hover-forklaring og navigation.
- [ ] Implementér symbolpalet, søgning efter operatornavne og tastaturgenveje.
- [ ] Tilføj compilerdiagnostik og source-mapped debugging fra `.hc`.
- [ ] Byg projektoprettelse, formatter, test-runner og webpreview.
- [ ] Accessibility-test med almindeligt tastatur og skærmlæserlabels.

**Beståkrav:** En person uden forkundskab om H-Code kan følge en trin-for-trin-guide og køre/ændre en lille app. UX-test med mindst 10 udviklere og dokumenteret gennemførelsesrate.  
**Stop/revider hvis:** Symbolerne skaber mere input- og fejlfindingsfriktion end de sparer.

### M7 — AI-native udvikling

**Opgaver:**
- [ ] Dokumentér et stabilt værktøjs-API: `parse`, `inspect`, `edit_ast`, `compile`, `test`, `diagnostics`.
- [ ] Integrér AI-assistenten, som arbejder med præcise ændringer frem for hele filomskrivninger.
- [ ] Gør alle ændringer synlige og diffbare; brugeren godkender kritiske handlinger.
- [ ] Håndtér model-fejl, hallucinerede symboler, test-runs og retries.
- [ ] Log tokenforbrug, pris, tid til korrekt løsning og antal fejlretninger.

**Beståkrav:** AI kan bygge eller ændre de 20 benchmarkopgaver gennem samme compiler; alle ændringer består de samme tests som sammenligningsgruppen. Resultatet er reproducerbart og kan granskes.  
**Stop/revider hvis:** AI bruger mere samlet tid/forbrug på at lære symbolsproget end den sparer.

### M8 — Performance, sikkerhed og ekstern benchmark

**Opgaver:**
- [ ] Sammenlign H-Code med idiomatisk TypeScript/JavaScript, Python og relevante Rust-opgaver, altid med rimelige biblioteker.
- [ ] Måling: median tid til beståede tests, fejlrate, p90, AI-tokens pr. løst opgave, LOC, buildtid, runtime, hukommelse.
- [ ] Registrér både bedste og svageste opgavekategorier; publicér rå data og scripts.
- [ ] Profilér compileren og tilfældig overhead i genereret JavaScript; optimér hotspots.
- [ ] Tilføj sårbarhedsscanning, pakke-sikkerhed, reproducérbar builds og trusselsmodel for AI-tilknytninger.

**Foreløbig stretch-målsætning:** Mindst 2× hurtigere **samlet udviklingstid** på mindst én repræsentativ opgavegruppe uden lavere beståelsesrate; 70 % færre LOC på udvalgte apps undersøges som sekundær indikator. Samlet AI-forbrug skal ikke stige i de opgaver, hvor hurtigere AI-udvikling markedsføres. Runtime sammenlignes med relevant target/backend og eget overhead — ikke med urimeligt forskellige økosystemer.  
**Beståkrav:** Gennemsigtige og reproducerbare resultater, ingen kendte kritiske sikkerhedsfejl. Hvis målene ikke nås, skal vi revidere modellen, ikke pynte på tallene.

### M9 — Open source-beta og community

**Opgaver:**
- [ ] Publicér compiler, standardbibliotek, lokal IDE, dokumentation og eksempler med verificeret Apache-2.0-licens.
- [ ] Tilføj LICENSE, NOTICE hvor nødvendigt, SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md og versionspolitik.
- [ ] Udgiv CLI-installationer, eksempelprojekter, quickstart, referencemanual og API-dokumentation.
- [ ] Etablér issue-triage, roadmap, bug bounty-/disclosure-procedure efter økonomi.
- [ ] Gennemfør ekstern pilot med mindst 25 udviklere; registrér installation, opgavefuldførelse og returneringsrate.

**Beståkrav:** En ny udvikler kan hente, installere, bygge, teste og deploye et eksempel uden private services eller intern hjælp.  
**Stop/revider hvis:** Projektet kræver skjult infrastruktur for at være anvendeligt.

### M10 — Betalt AI Studio-pilot

**Opgaver:**
- [ ] Test behov hos 20–30 kvalificerede brugere, inklusive udviklere og små teams.
- [ ] Tilbyd betalt AI Studio Pro med tydelige månedlige forbrugsgrænser; test **199 DKK/md.** som første hypotese.
- [ ] Tilføj abonnementsstyring, forbrugsregistrering, spend limits, betaling, refundering og support.
- [ ] Mål AI- og infrastrukturbaserede omkostninger pr. aktiv kunde, konvertering, retention og supporttid.
- [ ] Test Teams-pris omkring **399 DKK/bruger/md.** kun efter dokumenteret teambehov.

**Beståkrav:** Mindst 5 reelle betalende pilotkunder, dokumenteret nettobruttoavance efter direkte AI-/cloud- og betalingsomkostninger og en pris, der giver mening ved faktisk brug. Ingen ubegrænset AI-forbrug til fast lav pris.  
**Stop/revider hvis:** Markedsført værdi er uklar, betalende kunder udebliver, eller en normal aktiv bruger giver negativ dækningsbidrag.

### M11 — H-Code 1.0

**Opgaver:**
- [ ] Fastfrys og versionér core-specifikationen med dokumenteret kompatibilitetspolitik.
- [ ] Stabiliser pakker, lockfil, source maps, compiler, formatter og diagnostics.
- [ ] Test SDK, installationer og release-pipelines på understøttede platforme.
- [ ] Udbyg tutorials og migreringsguides; sæt offentlig fejlrapportering og release notes i drift.
- [ ] Dokumentér præcist, hvilke app-platforme der er fuldt understøttet og hvilke der stadig er eksperimentelle.

**Beståkrav:** Ingen uafklarede release-blokerende bugs, en realistisk vedligeholdelsesplan, tydelig API-stabilitet og reproducerbar conformance-suite.  
**Stop/revider hvis:** Et 1.0-label ville love mere end projektet reelt kan understøtte.

### M12 — Flere compile targets, mobil, desktop og spil

**Opgaver:**
- [ ] Undersøg, hvor WebAssembly giver konkret værdi; implementér en eksperimentel backend.
- [ ] Vurder LLVM/native for beregningsopgaver og systemintegrationer.
- [ ] Brug platform-bridges til desktop/mobil; implementér permissions, filsystem og platform-pakkeoutput.
- [ ] Understøt spilmotor-/renderingintegration og udvikl en lille spilprototype som bevis.
- [ ] Kør samme semantiktests på flere backends og sammenlign output.

**Beståkrav:** Samme portable program passerer den relevante conformance-suite på alle understøttede backends. Produktets platformkrav dokumenteres ærligt.  
**Startbetingelse:** Først efter at kernelanguage, værktøjer og brugerværdi er bevist.

### M13 — Teams, hosting, vækst og økosystem

**Opgaver:**
- [ ] Tilføj paid Teams, audit trails, rolle-/rettighedsstyring og private organisationer efter efterspørgsel.
- [ ] Introducér valgfri Cloud/hosting, hvis kunder efterspørger det og driftstal kan bære økonomien.
- [ ] Udbyg pakkenetværk med kvalitets- og sikkerhedsmarkører; tredjepartsintegrationer.
- [ ] Månedlige community-releases, udviklerrelationer, undervisningsmaterialer og tekniske cases.
- [ ] Opstil revenue, churn, retention og contribution KPI'er, og prioritér ud fra dokumenteret produktbrug.

**Beståkrav:** En rentabel og vedligeholdelig kommerciel tjeneste oven på en selvstændigt brugbar, åben kerne.  
**Startbetingelse:** Købsintention, konvertering og direkte økonomi skal være påvist i M10.

---

## D. Release-gates og beslutningsregler

| Gate | Tidspunkt | Skal være sandt før investering i næste trin |
|---|---|---|
| G0: Forstå problemet | Efter M0 | 20 tests, konkurrentbaseline, brugerbehov og risici er dokumenteret |
| G1: Sproget er sammenhængende | Efter M2 | Parser/typechecker består tests; symboler har entydig semantik |
| G2: Rigtigt sprog, ikke demo | Efter M4–M5 | Tre typer apps bygges uden specialtilpasning af compileren |
| G3: Bedre udvikleroplevelse | Efter M6–M8 | Minimum én relevant opgavekategori viser dokumenteret produktivitetsfordel; fejlrate forringes ikke |
| G4: Offentlig anvendelighed | Efter M9 | Eksterne udviklere kan installere, bygge og ændre projekter uden hjælp |
| G5: Betalingsvilje | Efter M10 | Betalende piloter og bæredygtige direkte omkostninger |
| G6: Stabilt 1.0-produkt | Efter M11 | Stabil spec, tools, docs, fejlpolitik og kompatibilitet |

**Generel regel:** En milepæl får aldrig status DONE, blot fordi koden findes. Accepttests, dokumentation og reproducerbar demonstration skal være færdige. Hvis en gate fejler, bruges en iteration på at rette årsagen frem for at fortsætte ukritisk.

---

## E. Benchmarkprotokol: hvad betyder 'hurtigere'?

**Udviklingshastighed:** Tid fra samme opgavebrief til alle tests består, inklusive installation, fejlfinding, ændringer og iterationer. Brug 5 CLI, 5 API, 5 UI/CRUD og 5 bugfix/refaktorering-opgaver. Vurder også læretid for nye brugere.

**AI-hastighed og pris:** Samme AI-modelversion, temperatur/opsætning, opgavebeskrivelse, adgang til værktøjer, hardware og forsøgstælling i hver sammenligning. Registrér antal modelkald, samlede tokens inkl. regelspec, forklaringer, retries og tests, latenstid og omkostning pr. *bestået* opgave. Undgå kun at tælle symbolsprogets tegn.

**Compilerhastighed:** Cold build, warm build, inkrementel build, cache hit-rate, peak memory og artefaktstørrelse på flere projektstørrelser.

**Runtimehastighed:** Output-korrekthed først. Benchmark CPU, I/O, hukommelse, startup og web-interaktion. Sammenlign hver backend med sin relevante platform og ligeværdige biblioteker. Kortere kode betyder ikke nødvendigvis hurtigere kode.

**Korrekthed/sikkerhed:** Beståede tests, type-/runtimefejl, fejl introduceret ved bugfix, supply-chain-risici, autorisationsbrud, regressionsfejl, falsk AI-genereret API-usage.

**Stretch targets — skal valideres:** 2× median totaludviklingstid på mindst én bred kategori; eventuelt 5× på gentagende, velunderstøttede operationer; markant færre kildekodelinjer, men LOC er kun sekundært; ingen signifikant dårligere korrekthed; konkurrencedygtig runtime uden urimelige forudsætninger. Ingen garanti for at slå Rust, C, Python, TypeScript osv. i *alle* aspekter.

**Rapport:** Offentliggør scripts, raw metrics, konfiguration og negative resultater. Gentag på ny compilerrelease og efter større biblioteksændringer.

---

## F. Forretning, licenser og IP

### Gratis og open source

Compiler, sprogspecifikation, standardbibliotek, CLI, testværktøjer, kildekodeeksempler og lokal editor foreslås under **Apache License 2.0**. Licensen tillader kommerciel brug; den giver ikke automatisk retten til at bruge projektets varemærke. Der skal udføres korrekt copyright-/licenshåndtering, tredjepartskomponentanalyse og juridisk gennemgang. Brugerens programmer ejer brugeren selv efter de relevante aftaler.

### Betaling for tjenester, ikke for kode-rettigheder

| Produkt | Anbefalet model | Status |
|---|---|---|
| H-Code Core | 0 kr. | Strategisk beslutning |
| Lokal H-Code Studio | 0 kr. | Strategisk beslutning |
| H-Code AI Studio Pro | Pilotprisidé: 199 DKK/md. med usage cap | Skal valideres |
| H-Code Teams | Pilotprisidé: 399 DKK/bruger/md. | Først ved efterspørgsel |
| H-Code Cloud / hosting | Betaling efter ressourcer/plan | Senere, valgfrit |
| Enterprise/onboarding | Kontraktbaseret support/integration | Senere, valgfrit |

Start ikke med licensafgift pr. app, royalty af udviklernes omsætning eller tvungen hosting. Betalingsforbrug skal have loft, advarsler og mulighed for eksplicit ekstra køb. Abonnementstallet er omsætning, ikke overskud; moms, AI-modelforbrug, cloud, support, betalingsgebyrer og løn skal trækkes fra.

### Økonomiske gates

- **Problem / betalingsbehov:** Mindst 20 interviews og 5–10 brugere der aktivt ønsker en konkret forbedring; tal er interne kvalifikationsmål, ikke evidens endnu.
- **Betalt pilot:** mindst fem virksomheder/brugere der faktisk betaler, ikke blot siger at de vil.
- **Unit economics:** rapportér dækningsbidrag pr. kunde og forbrugsprofil; sæt mål for positiv margin før skalering.
- **Risiko:** Gratis symbolcompiler alene giver ingen garanterede SaaS-kunder; vi skal sælge et målbart resultat.

### Navn og ejerskab

H-Code er arbejdsnavn. Der findes lignende navne/registreringer i softwareverdenen. Før officiel branding: undersøg EUIPO/DK/USPTO, domæner, GitHub-namespace, pakke-navne og risiko for forveksling med eksisterende produkter. Beslut hvem der ejer ophavsret, bidrag, licensnøgler, domæner og varemærke. Overvej DCO for eksterne bidrag; gennemgå en eventuel CLA med jurist før den bruges.

---

## G. Hold, ressourcer, risici og prioriteringer

### Minimumsroller

- **Compiler-/sprogarkitekt:** semantik, parser, typesystem, IR, kompatibilitet, performance.
- **Platform-/runtimeudvikler:** JS-target, FFI, biblioteker, testkørsel og integrationsprojekter.
- **Developer Tools-/IDE-udvikler:** LSP, editor, fejlfinding, UX og docs.
- **AI-/produktudvikler:** strukturerede AI-edits, evaluering, forbrug og betalbare cloudfunktioner.
- **Deltid:** sikkerhed, dokumentation, community, forretningsudvikling og juridisk rådgivning.

Samme person kan dække flere roller, men den samlede kalender forlænges. Der er endnu ikke allokeret et team eller budget.

### Budget og kapacitetsforudsætning

Det er ikke realistisk at love et modent universelt sprog på 24 måneder med nul omkostning. Derfor arbejder vi med to scenarier:

- **Lean proof-of-concept:** Stifter/én teknisk udvikler og målrettet AI-hjælp bygger først M0–M3. Kontante omkostninger kan holdes begrænsede, men udviklerens arbejdstid og risikoen for langsom fremdrift er væsentlige. Beslut først om større investering efter G2.
- **Lille fuldtidsteam:** Eksempel med 3 fuldtidsroller i 18 måneder og en antaget fuldt belastet intern omkostning på 75.000 DKK pr. person pr. måned giver **ca. 4,05 mio. DKK** i personaleomkostninger alene. Tallet er et planlægningsscenarie, **ikke** en verificeret markedspris; juridisk rådgivning, cloud, AI-forbrug, sikkerhed og eventuel markedsføring kommer oveni.

Der bør ved hver gate laves en ny plan for løn, runway, gratis AI-kredit, hosting, regressionstest og udgifter til modelkald. Ansæt ikke permanent til M12/M13 før G3–G5 er bestået.

### Risikoregister

| Risiko | Alvorlighed | Modtræk |
|---|---|---|
| Symboler er kortere, men ikke produktivt bedre | Høj | Test symbol- vs. navne- vs. traditionel kode tidligt |
| Brugere kan ikke huske tegn eller taste dem | Høj | Navnealias, symbolvælger, hover og keyboardgenveje |
| For mange indbyggede specialfunktioner | Høj | Lille kerne, bibliotekspakker, klare kontrakter |
| Det bliver kun en DSL til webapps | Høj | Først CLI og API uden UI, generelle sprogfeatures |
| Compiler bliver vedligeholdelsesbyrde | Høj | Genbrug backends, source maps, conformance-tests |
| AI bruger flere tokens på sprogmanualen | Middel/høj | Mål alt forbrug og giv komprimeret dokumenteret spec |
| Dårlige build- eller runtime-resultater | Middel/høj | Instrumentering og kontinuerlige benchmarktests |
| Usikre pakker/makroer/AI-handlinger | Høj | Capability-grænser, lockfile, sandbox og audits |
| Navnekonflikt/varemærkerisiko | Middel/høj | Navneundersøgelse før branding |
| Gratisbrugere køber ikke AI Studio | Høj | Forbrugsbaserede pilots, interview og positiv margin |
| Projektet forsøger at støtte alle platforme for tidligt | Høj | Portable core først, JS target, øvrige som milestones |
| Manglende finansiering eller udviklingskapacitet | Høj | Gate-styret scope, kort MVP, ingen stor cloud før efterspørgsel |

### Prioritetsregler

1. Korrekthed før symbolkosmetik.
2. Almindelige programmører skal kunne skabe nye funktioner uden at ændre compileren.
3. Det er bedre at levere én god backend end seks ufuldstændige.
4. Betalt AI-tjeneste bygges efter teknisk proof og brugerinteresse.
5. Benchmarks har negativ-resultat-pligt: målet er reel forbedring, ikke flotte tal.

---

## H. Første 30 arbejdsdage: konkret sprint-backlog

### Sprint 1 — Dag 1–10

- [ ] Vælg projektleder/ansvarlig og etabler separat repository/org (ikke FastSell-produktion).
- [ ] Commit projektcharter, denne masterplan, beslutningslog, roadmap og LICENSE-beslutningsnotat.
- [ ] Dokumentér 20 benchmarkopgaver og minimum 5 baseline-løsninger i almindelige sprog.
- [ ] Beslut compiler-implementeringssprog, første output-target og kodelayout.
- [ ] Skitser grammatik og tegnregler, inklusive ASCII-aliaser.
- [ ] Kontroller H-Code-arbejdsnavnets anvendelighed foreløbigt.

**Demo:** Samme simple referenceopgave beskrevet både i traditionel kode og i foreslået H-Code, med åbent regnestykke for forskelle.

### Sprint 2 — Dag 11–20

- [ ] Implementér tokenizer med korrekt Unicode-håndtering og kildepositioner.
- [ ] Implementér parser for literals, variabler, udtryk, funktioner, `if` og simple collections.
- [ ] Byg printbar AST og test-fixtures med positive/negative programmer.
- [ ] Beslut canonical formatting og symbolnavne.
- [ ] Start CI og automatiseret testkørsel.

**Demo:** `.hc`-filer kan parses, normaliseres og give konkrete fejlmeddelelser.

### Sprint 3 — Dag 21–30

- [ ] Implementér første variable-scope og typechecker.
- [ ] Tilføj en minimal evaluator eller JS-kodegenerator, alt efter arkitekturbeslutningen.
- [ ] Kør test-programmer: Hello World, beregning, betingelser, en brugerdefineret funktion.
- [ ] Tilføj første symbol, der kalder en versioneret, testet operation.
- [ ] Måling: første compile/run-tid og basisbenchmark mod TypeScript.

**Demo:** Bruger kan oprette `main.hc`, køre filen og se korrekt resultat uden AI. Det er første ægte proof of concept.

---

## I. Projektets status pr. 17. oktober 2026

| Område | Status |
|---|---|
| Idé og retning | Aftalt i samtalen |
| Masterplan | Dokumenteret i denne fil |
| Projekt-/produktnavn | Midlertidigt |
| Sprogspecifikation | Ikke implementeret |
| Compiler, runtime og IDE | Ikke bygget |
| Benchmarkresultater | Ingen målte resultater |
| Open source repository | Ikke oprettet i denne opgave |
| AI Studio og Cloud | Ikke bygget |
| Betalende brugere/indtægter | Ingen H-Code-indtægt dokumenteret |

**Første næste handling:** Start M0 med et separat repository, en sprogspecifikation, benchmarkopgaver og beslutning om compiler-arkitektur. Hold H-Code helt adskilt fra FastSell, indtil en bevidst og afgrænset testintegration eventuelt vælges.

---

## J. Teknik- og licensreferencer (officielle primærkilder)

- Apache-2.0-licensen: https://www.apache.org/licenses/LICENSE-2.0.html
- Apache om anvendelse af licensen: https://apache.org/legal/apply-license.html
- LLVM: 'My First Language Frontend' (lexer, parser, AST, codegen): https://llvm.org/docs/tutorial/MyFirstLanguageFrontend/
- Dyalog APL glyphs (symbolbaseret programmering eksisterer): https://docs.dyalog.com/20.0/language-reference-guide/glyphs/

**Versionsdisciplin:** Fremtidige ændringer i mål, pris, scope eller semantik skrives i ændringslog med dato og beslutningsbegrundelse. Denne v1.0 er projektets første sammenhængende arbejdsgrundlag, ikke en løfte om færdig leverance.
