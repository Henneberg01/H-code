# H-Code CSE-2 / M11 — TEGN-først, typede sekvenser (revideret design)

**Dato:** 18. oktober 2026. **Status:** Foreslået sprogdesign; ikke implementeret.  
**Ejers styrende beslutning:** H-Code er et *selvstændigt, universelt TEGN-sprog*. Tegn er det primære interface til programmeringslogik; ASCII er alene en tilgængelighedsalias. Den tidligere teksttunge M11-plan er **erstattet**.

## 1. Hvad vi bygger — og hvad vi ikke bygger

Vi udvikler ikke en minimificeret JavaScript/TypeScript-grammatik og markedsfører ikke engelsk `List<T>`, `len` eller `append` som H-Codes nye kerne. Intern typeanalyse må gerne bruge normale typebegreber, men *udvikleren skriver tegn*.

Et tegn må beskrive reel **typesikker, generel semantik**, eksempelvis funktionel komposition `∘`, pipeline `▷` og senere `⌕`, `⇢`, `∑`. Tegn må ikke skjule AI-prompts, webshop-specialtilfælde eller uigennemsigtig genereret kode. Alle operationer skal kunne forklares, testes, profileres og debugges.

Målet er **70% færre Unicode-kodepunkter i udviklerskrevet kildekode** (median af 20 fastlåste, funktionsækvivalente opgaver). Målet er ikke dokumenteret opnået. UTF-8, afhængigheder, AI-tokens og køretid måles hver for sig. Målegrundlaget ændres aldrig lydløst.

## 2. Tegn i første sekvensfase — M11

| Primært tegn | Foreslået funktion | Teknisk kontrakt |
|---|---|---|
| `⟦ … ⟧` | Typed sekvens, eksempel `⟦1,2,3⟧` | Ens elementtyper, også indlejrede sekvenser |
| `xs⟦i⟧` | Kontrolleret elementadgang | Talindeks, runtime-heltal og bounds-check |
| `⌗xs` | Antal elementer | Ren funktion, returtype Number |
| `xs ⧺ ys` | Sammenkæd to sekvenser | Ens elementtype, nyt resultat uden mutation |
| `⟦T⟧` i typeposition | Sekvenstype, eksempel `⟦Number⟧` | Den interne typechecker bruger en struktureret sekvenstype |

**Disse tegn er forslag, ikke eksisterende features.** Verificér Unicode NFC/NFKC-stabilitet, tastatur og tilgængelighed, samt kollisioner mod pakkesymboler *før* lexeren ændres. Udviklere skal også have dokumenterede ASCII-aliaser for hele grammatikken; de er ikke primær undervisnings- eller eksempelstil.

Foreslået fremtidig H-Code:

```hcode
≔ xs ← ⟦1,2,3⟧;
print(⌗xs);          // 3
print(xs⟦0⟧);         // 1
≔ ys ← xs ⧺ ⟦4⟧;    // ny sekvens; xs er uændret
ƒ empty() → ⟦Number⟧ ↩ ⟦⟧;
```

De typebestemte `⟦T⟧` og tomme `⟦⟧` skal have en entydig parsing og eksplicit forventet elementtype. `≔ xs ← ⟦⟧;` uden forventet type afvises.

## 3. Symbolsk datalogik — M12/M13 (IKKE en del af M11)

`⌕` er filter, `⇢` er map, `∑` er reduktion/sum. De er **generelle semantiske operationer**, ikke omskrivninger af sprogets nøgleord.

```hcode
ƒ positive(n) ↩ n>0;
ƒ twice(n) ↩ n*2;
≔ xs ← ⟦-1,2,3⟧;
print(∑(xs ⌕ positive ⇢ twice));  // 10
```

Konceptet kræver at vilkårlige versionlåste, typede pakkesymboler kan bruges som infix-opkald (ikke blot `⌕(xs,p)`), eller en compilerdefineret generisk alternativ syntaks med samme semantik. Hvis det ikke findes, **må ovenstående eksempel ikke beskrives som eksekverbart**. Alle `⌕`/`⇢`-funktioner skal kunne modtage almindelige H-Code-funktioner som argumenter. `∑` skal virke på enhver korrekt typet tal-sekvens. Brugerdefinerede samlinger og brugerdefinerede højereordensfunktioner skal være mulige uden nye specialtegn i kernesproget.

Records og felter er planlagt i M12; en senere ordreberegning skal på samme måde baseres på generelle felter og almindelige funktionsreferencer, ikke en hardcoded `paid`-regel.

## 4. Hårde acceptkrav

- Glyph- og ASCII-grammatik skal have **samme AST, typebetydning og output**; Unicode-sikkerhed fra M0–M10 skal bevares.
- Hver tilføjet operator skal være én velbeskrevet statisk semantik i Rust-compilerens AST/typechecker. Den må ikke kun eksistere som editor-knap eller JS-strengerstatning.
- Homogene sekvenser typesikres, blandede elementtyper afvises; dynamiske indeks checkes for negativt/uden for grænserne/ikke-heltal.
- `⧺` evaluerer begge input én gang fra venstre mod højre, opretter nyt resultat, og har dokumenteret allokeringsgrænse.
- Ingen netværk, IO eller AI som sideeffekt af sekvensoperatorer. JS-backend forbliver **ikke** en sandbox.
- SHA-låste demo-pakker og eksisterende H-Code-programmer skal fortsat virke; en ny kernesymbol må ikke kollidere med gamle tilladte pakkesymboler uden en eksplicit migrationsplan.
- M11 kræver dokumenterede **negative** og **positive** Rust/JS tests på signerede symbolpar. M13 kræver selvstændige tests af `∑`, `⌕`, `⇢` og generiske operationer.
- Fair sammenligning: frys præcis samme programpar før ændring, gentest dem efter ændring og gem kildekode-revision og datasæt-ID; måling på nye opgaver betegnes *nyt datasæt*, aldrig regression fra tidligere tal.

## 5. Afhængigheder og sikkerhedsgate

CSE-M10 (draft PR #5) samt `∘`-komposition (særskilt feature branch) bygger fundamentet. M11 compilerarbejde må først påbegyndes, når Rust/Cargo, JavaScript-reference, legacy tests og de eksakte programmer er verificeret. PR #3 er stadig umerget; review af ancestry kræves. Denne ændring er **kun en designkorrektion, ikke en implementeret kompileregenskab**.
