# M11 / CSE-2 — implementeringsplan, TEGN først

**Status:** Design- og testplan, ingen M11-compilerkode udført.  
**Overordnet:** H-Code er et universelt Unicode-tegnsprog; skriv tegn for semantik, ikke engelske standardbiblioteksnavne som primær syntaks.  
**Afhænger af:** verificeret M10, Rust/Node checks, PR #3 + #5 ancestry og review af `∘`-funktionen.

## Arbejdspakker

### P0 — fastlås grammatik og målinger
- [ ] Verificér valgt tegnsæt: `⟦`, `⟧`, `⌗`, `⧺` for NFC/NFKC, tilgængelighed og pakkekollisioner.
- [ ] Godkend præcis binding/precedence; test at `▷` og `∘` ikke ændrer betydning.
- [ ] Lås H-Code/ASCII fixturepar med SHA og forventet output *før* kildekoden ændres.
- [ ] Bevar historiske benchmark-datasæt separat. Samme datapar skal sammenlignes på samme grundlag.

### P1 — rigtig tegn-lexer og AST
- [ ] Rust og JS accepterer `⟦1,2,3⟧`, tom `⟦⟧`, `xs⟦i⟧` og `xs ⧺ ys`; `⌗xs` giver sekvenslængde.
- [ ] Disse er strukturerede AST-noder med korrekt source-span, ikke søg/erstat, tekstmakro eller AI-kald.
- [ ] Ingen ændringer på `main` og ingen brug af fremtidige tegn som allerede-implementerede.

### P2 — interne typeregler
- [ ] Sekvenstyperne er rekursive og generiske i typesystemet; brugerens notation for typer er `⟦T⟧`.
- [ ] `⟦1,2⟧` er Number-sekvens; `⟦1,"x"⟧` afvises. Utypet `⟦⟧` afvises.
- [ ] `xs⟦i⟧` kræver tal/heltal og bounds; `⌗xs` giver Number.
- [ ] `xs ⧺ ys` bevarer elementtype; forskellig type afvises.
- [ ] Ingen ændring af pakkenes v1-kontrakter ved et uheld.

### P3 — runtime / allokering
- [ ] Rust-genereret JS og referencefortolker implementerer samme observerbare semantik.
- [ ] Indeksfejl er kontrollerede; alle input evalueres én gang i fast rækkefølge.
- [ ] Begræns allokering og undgå JS-host sideeffekter.
- [ ] Sammenhold med mindst 12 positive og 12 negative tegn/ASCII-kørsler.

### P4 — symbolsk samlingslogik, grænse til M13
- [ ] Demonstrér, at H-Code kan *bruge* samlinger i brugerdefinerede algoritmer uden kun tekstbaserede hjælpefunktioner.
- [ ] Bevis at `⧺` er tilstrækkeligt til rent at bygge variable sekvenser.
- [ ] Design generisk, versioneret infix-symbolkald, så `xs ⌕ pred ⇢ trans` senere kan programmeres uden hardcoded domænelogik.
- [ ] `∑`, `⌕`, `⇢` må først markeres implementeret, når M13 selv har typechecker, bindingskontrakter og executable fixtures.

### P5 — QA og milepælsoverdragelse
- [ ] Kør fuld Rust/Node/Studio-test + gamle pakker og CSE-M10 fixturepar.
- [ ] Dokumentér både gode og dårlige komprimeringsmålinger på *identiske* før/efter-programmer.
- [ ] Rapportér Unicode-kodepunkter, UTF-8-bytes, biblioteker, runtime og AI-tokens adskilt.
- [ ] Opret M11 draft PR med SHA, tests, resultater og review. Ingen merge før accept.

**Færdigdefinition:** Udvikleren kan skrive og kompilere ægte symbolske sekvenser med typesikre tegnoperatorer; konformitet er verificeret i begge frontends, også negative tilfælde; eksisterende programmer virker. **70 % forbliver et forskningsmål.**
