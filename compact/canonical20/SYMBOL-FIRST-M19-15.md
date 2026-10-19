# M19.15 — genopret H-Code som tegnbaseret programmeringssprog

**Autoritativ regel:** [H-CODE-PRINCIPLES.md](../../H-CODE-PRINCIPLES.md) gælder for hver eneste fremtidig ændring. H-Code er ikke TypeScript med pynt.

## Virkelige tegnoperationer, ikke lange funktionskopier

- `↧` er en NY generisk typesikker operation, `⟦T⟧ × (T→Number) → ⟦T⟧`: stabilt faldende nøglesortering, én evaluering af nøglen pr. element, ingen mutation og deterministiske ties. Det er ikke en sales- eller dashboard-makro.
- `⎙` skriver gennem H-Codes kontrollerede outputeffekt. Det tidligere ASCII-ord `print` er kun et kompatibilitetsalias.
- `⧉`, `⇢`, `⌕`, `∑` og `↧` arbejder på brugerens egne typede data; de erstatter en lang manuel sorteringsfunktion i database-dashboardet.
- ASCII-aliaserne `@v` og `print` er stadig tilgængelige, men ikke primær developer-syntaks.

Eksempel på kildekode for vilkårlige records:

```hcode
≔ xs←⟦⦃n:"first",v:2⦄,⦃n:"second",v:5⦄⟧
⎙(⤒(xs↧λr:r·v))
```

## Ret hele projektets retning, men ødelæg ikke benchmarks

- `node scripts/hcode-symbol-first-audit.mjs` gennemgår **alle** repository-filer med `.hc` og indfører et CI-gate mod engelske kontrolord/ASCII-skrift i de nye aktive M19.15-programmer. SQL og HTML i strenge er data og ignoreres korrekt af auditen.
- Tidligere sign/ASCII-paritetsfiksturer, SHA-låste benchmarks, gamle opgaveprogrammer og importerede signerede pakker **bevares uændret**. Ellers ville kildefaste målinger og bagudkompatibilitet være falske.
- Før-versus-efter for det SAMME H-Code B2b-program er målt fra de rigtige UTF-8-filer: **1.220 → 826 Unicode-kodepunkter (32,30 % kortere)** og **1.406 → 922 bytes (34,42 % kortere)**. Den oprindelige fil er SHA-låst i `candidates/15-db-dashboard-b2b-before-symbol-sort.hc`. Det er ikke et H-Code-versus-TypeScript-tal.
- Den oprindelige 20-opgavers registrering og dens TypeScript-baselines ændres ikke. 70 %-målet er endnu IKKE dokumenteret på 20/20.

## Åben teknisk gæld skal ikke skjules

`⧈` har stadig en **lang, almindelig SQL-streng** i sine argumenter. SQL er ikke TypeScript, men dette er ikke optimal tegnbaseret programmering. Et generelt, typesikkert relationelt tegn-API skal erstatte gentagen SQL-tekst, hvis det faktisk reducerer fair målt kildestørrelse. Vi må ikke introducere særlige `orders`/`sales`-makroer eller slække på SQL-parametre, permissions og SQLite-sikkerhed for at pynte på tallene.

Indtil det er løst, må vi IKKE erklære hele H-Code-projektet, databasedashboardet eller 70 %-målet færdigt. Den nye `↧`/`⎙`-funktion er kandidatarbejde, som kræver Rust- og JavaScript-paritet, negativtests, Windows/Ubuntu CI, CodeQL og fuld regression før merge.
