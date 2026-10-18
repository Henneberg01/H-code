# M14 — Tegnbaserede λ-funktioner og operatorsektioner

**Branch:** `feat/m14-typed-lambda-glyph` (stables på `feat/m13-core-collection-signs`), 18 oktober 2026. **Status: Implementeret som kildekode og referencefunktionalitet; Rust/Cargo og fuld CI afventer.**

## Formål

H-Code skal udtrykke reel, generel og stærkt typet programmeringslogik med færre tegn. Vi forkorter ikke bare nøgleord; vi opretter funktioner som førsteklasses H-Code-værdier. Denne milepæl tilføjer:

- `λx:expr`: en typet unary funktion med leksikalsk closure/capture; ASCII `lambda x:expr`. Typeinferens bruger almindelig H-Code-typeunifikation.
- `(*2)`, `(/2)`, `(%3)`, `(+2)`: delvist anvendte, rigtige numeric/string-operationer, hvor den fremtidige inputvariabel står til venstre.
- `(>0)`, `(≤3)`, `(≥2)`, `(≡42)`, `(≠42)`: typed, unary predicate-funktioner. `(-2)` er stadig et negativt tal, ikke en operatorsektion.
- Indbyggede `⌕` og `⇢` tager disse funktioner som argumenter uden specialhåndtering af bestemte opgaver.

Operatorsektionen `(*next())` evaluerer `next()` **én gang ved oprettelsen** og låser højre argument i en lexical closure. Rust-emitteren genererer en normal kontrolleret unary JavaScript-funktion, mens typecheckeren afviser inkompatible typer og aritet. JS-referencefortolkeren har den samme synlige semantik.

## Ægte tegnprogrammer

```hcode
≔ ys←⟦10,11⟧⇢(*2);
print(ys⟦0⟧);
print(ys⟦1⟧);
```
Output `20`, `22`. Og:

```hcode
≔ ys←⟦-1,2,3,-2⟧⌕(>0);
print(⌗ys);
print(ys⟦0⟧);
print(ys⟦1⟧);
```
Output `2`, `2`, `3`.

Ingen AI, ingen domænespecifikke forhåndsværdier, ingen JavaScript `map`/`filter`-aliaser. Tegnoperationerne arbejder med alle kompatible H-Code-værdier.

## Kontrolleret 3-opgavers måling

TypeScript-baselines er **identiske Git blobs** med M11 og M13. Hvert nyt H-Code-program leveres i separat `compact/benchmarks/m14/` mappe og er versionslåst med Git SHA i `manifest.json`, sammen med M11- og M13-kilderne.

| Opgave | Original M11 HC | M13 HC | M14 HC | Uændret TS | M14 besparelse mod TS |
|---|---:|---:|---:|---:|---:|
| Sum | 113 | 17 | 17 | 100 | 83,00% |
| Map | 159 | 57 | 41 | 130 | 68,46% |
| Filter | 185 | 77 | 55 | 167 | 67,07% |

Median **68,46% færre Unicode-kodepunkter** og **55,09% færre UTF-8-bytes**. Det er source-only på disse tre opgaver, ikke hele afhængighedstræet, ikke eksekveringstid og ikke de 20 canonical workloads. Eksisterende negative cases forbliver i datasættene.

**Kør i rigtig checkout med Node22+:** `npm run m14:measure`; alle kildefiler verificeres mod SHA og H-Code (M11/M13/M14) samt uændret TypeScript eksekveres. Rust-kompileret paritet testes i `compiler/tests/symbol_lambda.rs` og `compiler/tests/symbol_sections.rs`, men har **ikke** kunnet eksekveres i arbejdsruntime.

## M14-afslutningskriterier (stadig åbne)

- [x] First-class λ og almindelige operatorsektioner: Rust AST, checker, codegen, JS-reference, Studio-symbolpalette.
- [x] JavaScript-reference tests for lexical capture, unary arity, type-fejl, funktionel sammensætning og kompatibilitet.
- [x] Samme tre programmer genmålt mod uændret, SHA-frosset TypeScript.
- [ ] **Rust Cargo-test og faktisk genereret Node JS-paritet på samme Git SHA.**
- [ ] Fuld `npm test`, Studio, compact, manual CI, `release:check`.
- [ ] Record selectors/feltudtryk, generiske pakke-manifester og brugerdefinerede tegn under særskilte faser.
- [ ] Hele 20-programmers kontrol inklusive svage programmer før 70%-målet omtales som nået.

`main` forbliver urørt; alle ændringer er reviewbare i draft PR. Ingen automatisk merge.
