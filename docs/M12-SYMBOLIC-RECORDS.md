# H-Code M12 / CSE-3a — records som ægte typer, ikke JS-makroer

**Gren:** `feat/m12-symbolic-records-post-m19`, afhængig af M19 PR #22. Dette er den første fungerende, generelle record-kerne, ikke et løfte om fuld JSON/CRUD/HTTP-understøttelse.

## TEGN FØRST: reel, typesikker syntaks

```hcode
≔ p←⦃name:"Ada",age:42,meta:⦃score:9⦄⦄;
print(p·name);
print(p·age+p·meta·score);
```

Dette skriver `Ada` og `51`. `⦃⦄` erklærer en **recordværdi**, `·felt` læser et felt. Tilgængelige ASCII-aliaser `{name:"Ada"}` og `p.name` sænkes til **samme AST og identiske JavaScript-kompilerede udtryk**. Det er ikke syntaktisk tekstudskiftning eller en skjult appbuilder.

Tilføj en typekontrakt ved behov:

```hcode
ƒ age(p:⦃name:String,age:Number⦄)→Number ↩ p·age;
print(age(⦃age:42,name:"Ada"⦄));
```

Record-typer er statisk infererede, **præcise og strukturelle**: felter kan stå i vilkårlig rækkefølge, men antal, navne og typet indhold skal stemme. Nestede records, sekvenser af records, recordparametre og eksplicitte deklarations- og returtyper er understøttet. Ukendte felter, duplikerede nøgler, forskellige shapes og forkert felt-type giver compilerfejl i Rust, før JavaScript genereres.

Genereret JavaScript opretter **immutable objekter med null-prototype**, kun med eksplicit deklarerede egne felter. Feltlæsning kontrollerer egen nøgle, så `constructor`, `__proto__` og `toString` ikke giver skjult adgang til JS-prototypen. JS-referenceinterpreteren udfører samme egne-felt/kollision/typekontroller.

## ⊞ — ét tegn erstatter objektkopi og feltopdatering

Dette er den faktiske kildekodeforkortelse: `⊞` beskriver **immutable kopi af et record med et eksisterende felt udskiftet**. Ikke en dekorativ stavevariant.

```hcode
≔ q←p⊞age:p·age+1;
```

En TypeScript-konstruktion med tilsvarende kopi og feltudskiftning er eksempelvis `const q={...p,age:p.age+1};`. ASCII-aliaset `<+` parser til præcis samme typede AST. Rust kræver et statisk record, en eksisterende nøgle og en ny værdi med **samme type**; den gamle record ændres ikke. Referenceruntime følger samme form og afviser typeændring.

---
## To fastfrosne record-mikrobenchmarks (IKKE de kanoniske 20)

| Samme konkrete opgave | H-Code tegn | Idiomatisk TypeScript tegn | Besparelse |
|---|---:|---:|---:|
| Typet rekordinferens, nestet feltlæsning | 79 | 96 | **17,71 %** |
| Immutable feltudskiftning med `⊞` | 81 | 114 | **28,95 %** |

Begge opgaver sammenlignes med præcis samme observerbare output og kildeindhold låst til Git-blob-SHA. `npm run m12:measure` udfører H-Code- og TS-kilderne og måler Unicode-kodepunkter og UTF-8-bytes hver for sig. De **28,95 % er alene denne ene opgave**, ikke en ny samlet H-Code-score. Målingen indeholder hele den udviklerskrevne kilde for opgaven; her bruges intet importeret bibliotek. Afhængighedsstørrelse og genereret runtime-kode er endnu ikke opgjort.

De oprindelige tre M14-eksempler måler fortsat **68,46 % færre Unicode-kodepunkter i median**. M19's 20 fastlagte universelle workloads forbliver **0 fuldt verificerede, 2 delvist belagte, 18 uverificerede**. Vi opfinder ikke en global 70 %-score fra mikrocases.

Kør: `cargo test --manifest-path compiler/Cargo.toml --test m12_symbolic_records`, `npm test`, `npm run m12:measure`, `npm run benchmark20:status`.

## Hvad M12 **ikke** lover

- Records er i denne første iteration **immutable**; `⊞` udfører nu en typesikker kopi/opdatering. Der er endnu ingen direkte feltmutation, generelt spread, pattern matching, enums/Option/Result eller felt-constraints på generics.
- Feltnavne skal være statiske ASCII-identifikatorer. Ingen arbitrær dictionary/map-indexering.
- Record-generics via SHA-låste eksterne pakker afventer særskilt format-3 JS-signaturparitet; den almindelige AST/Rust-typechecker understøtter allerede strukturerne.
- Der er endnu ingen parsing/serialisering af JSON, persistens, HTTP-endpoints eller UI. Disse kræver **rigtige, sikre sprog- og runtime-funktioner**, ikke en “magisk” en-tegns-erstatning.
- Ingen påstand om opnået 70 % over 20 workloads. Hold afhængige PR'er som drafts til integrationreview.

**Prioritet:** Byg videre på record/field-systemet og derefter generelle data- og I/O-primitiver. Nye tegn skal spare reelt forfattet kildekode og bevare korrekthed, ikke tilføje pynt.
