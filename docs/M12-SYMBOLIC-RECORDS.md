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
## Frosset én-opgaves mikrobenchmark

| Kilde | Unicode-kodepunkter |
|---|---:|
| `compact/benchmarks/m12/records.hc` | 79 |
| Idiomatisk `compact/benchmarks/m12/records.ts` | 96 |

Samme output testes med rigtige runtime-kørsler. Det svarer til **17,71 % færre udviklerskrevne Unicode-kodepunkter på denne ene recordopgave**, ikke 70 % og ikke en global M19-status. UTF-8-bytes måles separat, fordi Unicode-tegn er dyrere i bytes. Testen bruger ingen bibliotekspakke; afhængigheder og compile/runtime-størrelse måles endnu ikke.

Filerne er Git-blob-SHA-frosne i `scripts/m12-records-compare.mjs`. Den frosne M14-median **68,46 % på tre andre sum/map/filter-opgaver** forbliver uændret. De præregistrerede **20 universelle workloads er stadig 0 fuldt verificerede, 2 med delvist bevis og 18 uden dækning**.

Kør:

```sh
cargo test --manifest-path compiler/Cargo.toml --test m12_symbolic_records
npm test
npm run m12:measure
npm run benchmark20:status
```

## Hvad M12 **ikke** lover

- Records er i denne første iteration **immutable**; `⊞` udfører nu en typesikker kopi/opdatering. Der er endnu ingen direkte feltmutation, generelt spread, pattern matching, enums/Option/Result eller felt-constraints på generics.
- Feltnavne skal være statiske ASCII-identifikatorer. Ingen arbitrær dictionary/map-indexering.
- Record-generics via SHA-låste eksterne pakker afventer særskilt format-3 JS-signaturparitet; den almindelige AST/Rust-typechecker understøtter allerede strukturerne.
- Der er endnu ingen parsing/serialisering af JSON, persistens, HTTP-endpoints eller UI. Disse kræver **rigtige, sikre sprog- og runtime-funktioner**, ikke en “magisk” en-tegns-erstatning.
- Ingen påstand om opnået 70 % over 20 workloads. Hold afhængige PR'er som drafts til integrationreview.

**Prioritet:** Byg videre på record/field-systemet og derefter generelle data- og I/O-primitiver. Nye tegn skal spare reelt forfattet kildekode og bevare korrekthed, ikke tilføje pynt.
