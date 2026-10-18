# H-Code M12 — native typekontrolleret JSON med ⤓ og ⤒

H-Code er et selvstændigt, Unicode-tegnbaseret programmeringssprog. Dette er **nye kernesprogoperatorer**, ikke generering af TypeScript-skabeloner eller makroer til enkelte opgaver. Ændringen videreudvikler **M12 records** og er stacked som en ny draft oven på PR #23.

## Semantik: tegnene udfører hele operationen

```hcode
≔raw←"{\"name\":\"Ada\",\"age\":42}";
≔p←⤓⦃name:String,age:Number⦄raw;
print(p·name);
print(⤒p);
```

Udskriver:

```text
Ada
{"age":42,"name":"Ada"}
```

- **`⤓<Type> text`**: dekoder JSON-tekst til den præcist erklærede H-Code-type. Rust-compileren kontrollerer, at typen er konkret og JSON-kompatibel, og at input er `String`; den genererede runtime kontrollerer **hver værdi og hvert felt**. Ingen `any`, `as T`, schema-erasure eller type-løs `JSON.parse`.
- **`⤒ value`**: encoder en værdi af en statisk JSON-kompatibel H-Code-type til en `String`, inklusive records og sekvenser. Rust afviser eksempelvis funktioner og `Unit`, før kode genereres.
- ASCII-tilgængelighed: `json_in⦃...⦄text` og `json_out value` producerer samme Rust AST/JS som henholdsvis `⤓` og `⤒`. Studio-paletten kan indsætte begge Unicode-tegn.
- Generatoren emitterer et **typebestemt, lukket valideringsskema fra Rust-checket AST**. Den selvstændige JS-reference implementerer tilsvarende rekursive kontroller; begge sanitiserer records til frosne, null-prototype-objekter. Hver nøgle skal eksistere, have rigtig type, og der må ikke være flere/færre felter end i den erklærede type. Record-felter serialiseres deterministisk i sorteret rækkefølge.

F.eks. håndterer `⤓⟦⦃v:Number⦄⟧s` lister med records, og et dekodet `p` kan opdateres ved `p⊞age:p·age+1`. Intet brugersymbol eller importeret bibliotek må overtage betydningen af `⤓`/`⤒`.

## Konkrete bounds og begrænsninger

- Den aktuelle implementering understøtter `Number` (kun finite), `String`, `Bool`, statisk typede records og rekursive sekvenser.
- **`null` / Option / Result** er endnu ikke understøttet som JSON-skematype. Ugyldige/manglende/ekstra felter afvises; der er ingen tavs undefined/null-coercion.
- JSON-tekst og produceret output er begrænset til **1 MiB UTF-8**, maks. **16.384 sekvenselementer**, **64 recordfelter** og **32 niveauers nesting**. Runtime arbejder under den eksisterende H-Code-fuelbegrænsning. `JSON.parse` bruges som en sikker standardparser i den genererede JS, derefter løbes hele den konkrete type rekursivt igennem.
- Rust/JS giver sikker prototype-adskillelse: `constructor` og `__proto__` er almindelige datafelter, ikke JS-prototype-navigation. Kodens egne records er immutable; `⊞` opretter nye kopier.
- Rå JSON-tekst med duplikerede objektnøgler følger i denne første iteration den underliggende `JSON.parse`-politik (*sidste værdi vinder*), før præcis shape-validering. Der er ikke implementeret streaming parser, valgfri felter, egendefinerede custom codecs, dynamiske maps eller sikre host I/O-kilder endnu.
- Understøttelsen giver endnu ikke filsystem/HTTP/DB. JSON-konvertering er en ren funktion i hukommelsen; virkelige endpoints og lagring kræver egne runtimeprimitiver og sikkerhedsgates.

## Kilde-SHA-frosset microbenchmark — IKKE samlet 70%-påstand

Det **samme konkrete JSON-roundtrip** måles med `compact/benchmarks/m12/json-typed.hc` og `compact/benchmarks/m12/json-typed.ts`: indlæs strengen, **valider `age:Number` og `name:String` eksplicit**, udskriv navnet og den samme stabilt ordnede JSON.

- H-Code: **93 udviklerskrevne Unicode-kodepunkter** inkl. schema og begge operatorer.
- Idiomatisk TypeScript uden ekstern validator: **637 udviklerskrevne Unicode-kodepunkter** inkl. eksplicit `isPerson`-type guard og JSON.parse/JSON.stringify.
- Baseret alene på denne source-frosne opgave er kodepunktsbesparelsen **85,40 %**, forudsat runtime output-paritet. Det er et **mikrocase** og siger intet om medianen over de 20 fastlagte universelle arbejdsopgaver. TypeScript uden runtime-schema-validering er ikke en semantisk ligeværdig sammenligning. Alternative TS-kilder med en ekstern validator skal opgøre alt forfattet kode, import og bibliotek/dependencies særskilt.

`npm run m12:json-measure` måler kodepunkter og UTF-8 bytes **separat**, SHA-kontrollerer begge fixture-kilder, eksekverer begge og sammenligner eksakt stdout. **Genereret JS-runtime-størrelse måles nu særskilt i bytes og med SHA-256, og det kompilerede output eksekveres også**. Compiler tid, eksekveringshastighed og dependency-size er endnu ikke reproducerbare benchmarks, og må ikke fejlagtigt tælle som forfattet kilde.

**Historisk benchmark:** M14's originale tre sum/map/filter-eksempler er fortsat **68,46 % median færre Unicode-kodepunkter**, og M19's efterfølgende PR #25 har **1/20 fuldt compiler-verificeret** (den oprindelige JSON-transformation, ikke denne mikrotest), 2 delvise og 17 uden fuld verifikation. Den samlede median er fortsat ukendt. M12 JSON-casen må ikke lægges ind som en ny “let” 21. opgave, erstatte en af de 20 eller tælles som en global 70%-måling.

## Verifikation

```sh
cargo test --manifest-path compiler/Cargo.toml --test m12_typed_json
npm test
npm run m12:json-measure
npm run benchmark20:status
npm run m14:measure
```

Alle tests skal bestå på GitHub Actions både **Windows og Linux på eksakt PR-head**. Draft-grenen holdes isoleret fra `main`, indtil dens afhængige PR-kæde er reviewed og integreret.
