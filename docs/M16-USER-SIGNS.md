# H-Code M16 — brugerdefinerede, typede og SHA-låste tegn

**Status:** Integreret på `feat/m16-typed-user-signs`, stablet på M15 PR #16. Endelig CI og review afgør godkendelse. `main` er uændret.

## Formålet

Et H-Code-tegn skal kunne repræsentere **en rigtig, genbrugelig H-Code-funktion**, ikke et AI-kald, JavaScript-makro eller hardcodet forkortelse. Brugere skal kunne definere tegn uden at ændre Rust-compileren. En pakke skal kunne genbruges på tværs af projekter og versioner.

### Eksempel

`packages/vec.math/lib.hc`:

```hcode
ƒ total(xs:⟦Number⟧)→Number ↩ ∑xs;
ƒ doubleAll(xs:⟦Number⟧)→⟦Number⟧ ↩ xs⇢(*2);
```

`packages/vec.math/manifest.json` deklarerer **format 2** og forbinder `⊚` til `total` og `⊛` til `doubleAll`. Programmet er:

```hcode
use "vec.math@1.0.0" as vec;
print(vec∷⊚(⟦2,3,5⟧));
≔d←vec∷⊛(⟦2,3,5⟧);
print(∑d);
```

Forventet stdout:

```text
10
20
```

Den komplette låsefil er `hcode.m16.lock.json`: `lockVersion:1`, samt eksakte SHA-256 af **både** manifest- og kildekodebytes. Filer læses kun lokalt, under en kanonikaliseret projektrod og inden for 1 MiB-grænsen. Ingen netværksinstallation, eval, implicit import, skjult AI eller privilegerede hjælpefunktioner.

## Backendkontrakt

- V1 er **fortsat kun primitive typer**: `Number`, `String`, `Bool`, `Unit`. Originalt `hcode.lock.json` og bibliotek `demo.math` ændres ikke.
- V2 tillader de samme konkrete primitive typer plus rekursive sekvenser som `⟦Number⟧`, `⟦String⟧`, `⟦⟦Number⟧⟧`. Maksimal type-længde 256 bytes og maks. 16 sekvensniveauer i Rust. `Any`, ubundne `T` og unchecked generics **afvises**.
- Begge loaderimplementationer verifierer manifestens operationelle navne, unikke Unicode-glyffer, NFC/NFKC, de reserverede kerneglyffer, præcise parameter-navne, aritet, annotations- og returtyper samt `effects: []`.
- Rust bruger **den eksisterende H-Code AST/typechecker** til hver importeret kildedeklaration og producerer normal JavaScript-codegen for reelle funktioner. Både offentlige operationer og interne hjælpefunktioner kontrolleres med `allow_print=false`, ingen ambient I/O.
- JS-referencen bruger den eksisterende parser og `prototype/src/package-v2-types.mjs` til en selvstændig statisk renheds- og typeanalyse af alle kildens funktionskroppe, inden kode eksekveres. Typecheckede værdier kontrolleres igen ved package-grænsen, især sekvenstyper.
- `alias∷glyph` og `alias::operation` er eksplicitte. Et ikke-kvalificeret bruger-tegn kan kun bruges, hvis præcis én importeret pakke ejer det; ellers er det en fejl. Importer kan ikke overskrive kerne-tegn.
- Kodegen-runtime begrænser instruction fuel og funktionsdybde; sekvenser har kapacitetsgrænse. Sikker runtime i Node er **ikke et generelt sikkerhedssandbox for ubetroet JS**.

## Verifikationskrav

**Rust:** `cargo test --manifest-path compiler/Cargo.toml --no-fail-fast`, herunder `compiler/tests/m16_packages_v2.rs`. Test bruger real Rust typechecker/backend og kører genereret JS i Node.

**JS:** `npm test`, herunder `prototype/test/m16-packages-v2.test.mjs`. Test source SHA-tampering, deklarationskollisioner, rekursive typer, ugyldig aritet og data, interne sideeffekter, manglende namespace, delte glyffer samt budgetter.

**System:** Studio, phase1, compact, gamle pakker, samme M10/M13/M14/M15-kilder, release checks og Windows CI. De frosne benchmarkkilder er urørte.

Kør selv:

```sh
cargo run --manifest-path compiler/Cargo.toml -- run examples/m16_vec_operations.hc --lock hcode.m16.lock.json
node prototype/bin/hcode.mjs run examples/m16_vec_operations.hc --lock hcode.m16.lock.json
```

## Åbne særskilte faser

Konkrete v2-typer er **ikke generiske typeparametre**. Implementeringen af egentlige v2 typeparametre som `∀T.⟦T⟧→T` og brugerdefinerede højereordens-signaturer skal først designes og testes separat, uden `Any`/typeerasure. Brugerfladens automatiske discovery af installerede symbolske pakker skal bygge på låsefil-verificeret metadata, ikke frit indtastet JS eller ustyrede AST'er. Review og merge af afhængige PR'er kræves før release.

Der er **ikke** udført nogen ny M16 source-size sammenligning her. Pakkens kildekode, `use`-linjen, SHA-låsning, afhængigheder, bytes og antal reelle programmer skal indgå i en senere reproducerbar undersøgelse. Den endelige 20-programmers 70 %-hypotese står stadig åben.
