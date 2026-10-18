# H-Code: målegrundlag må ALDRIG blandes

**Tegn er sproget.** 70 % færre Unicode-kodepunkter i udviklerens egen kildekode er forskningsmålet; tegn skal repræsentere reel, generel typed logik. Tekstaliaser er kun tilgængelighed.

| Måling | Hvad sammenlignes? | Resultat | Kan den sammenlignes direkte med de andre? |
|---|---|---|---|
| Phase-1 | 4 forskellige H-Code-tegnprogrammer mod deres ASCII-H-Code-version | 11,39–18,92 % færre kodepunkter, afhængigt af program | **NEJ**, ikke sammenligning mod TypeScript |
| Tidligere 2 små programmer | H-Code mod TypeScript med en ældre JS-reference | 26,73 % / 30,71 % tidligere rapporteret | **NEJ**: oprindelige versionsfastlåste kildefiler mangler verificering |
| Første 2 M10 | TYPET funktion og kædede funktioner, H-Code mod TypeScript | **31,25 % / 47,86 %** | JA, med de to identiske kildepar; de ligger uændret i det udvidede datasæt |
| 8 M10 programmer | De to ovenstående **plus 6 andre** programopgaver | Median **2,27 %** færre kodepunkter, median **-5,85 %** UTF-8-bytes | **NEJ**, anden population end 2-programmers test |

Det var en fejl at fremlægge 8-programmers medianen som om de *samme to* programmer blev dårligere. De to M10 programmer har stadig 31,25 % og 47,86 % i samme kildekode. En ny median med flere opgaver er **ikke** en før/efter compilerregression.

Maskinlæsbart frosset 8-programmers input: `compact/results/frozen-baseline-m10-eight.json` med eksakte SHA-1 Git blob-ID'er for alle **16 filer**. `scripts/test/compact-frozen-benchmark.test.mjs` stopper ved ændringer i et frosset par; nye opgaver kræver *nyt datasæt-ID* i et andet manifest.

### Obligatorisk fremgangsmåde

1. Frys tests, præcise filindhold, SHA og funktionelt forventet output, inden en compilerændring evalueres.
2. Mål samme opgaves implementering før/efter og angiv revisionerne. Udskift ikke tests undervejs; hvis kilde ændres grundet nyt tegnsprog, gem både original og ny revision.
3. Sammenlign altid med idiomatisk TypeScript på samme opgave og output; tæl Unicode-kodepunkter, UTF-8-bytes, AI-tokens, biblioteker og runtime separat.
4. Bevar både succeser og tab. 8-task-medianen er et foreløbigt observeret resultat; Rust/CI og det kanoniske 20-task benchmark er **ikke** gennemført.
