# Postup práce

## Vetvy a pull requesty

- `main` je chránená, priamo sa do nej necommituje.
- Každá úloha má issue a vlastnú vetvu: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- Zmena ide cez pull request, vyžaduje review (@cyriljanosko) a zelené CI. Merge cez **squash**.

## Commity

Conventional Commits v angličtine, napr.:

```
feat(api): add club profile endpoint
fix(auth): handle expired magic link
docs: describe deployment
```

## Jazyk

- Kód, názvy, komentáre a commity: angličtina.
- Texty v aplikácii, README a dokumentácia: slovenčina.

## Kvalita

Pred pull requestom:

```bash
npm run format && npm run lint && npm run typecheck && npm test && npm run build
```

## Bezpečnosť

- Tajomstvá patria do `.env.local` (lokálne) a do Vercel, nikdy do repozitára.
- Osobné údaje spracúvame v nevyhnutnom rozsahu (GDPR), osobitne údaje maloletých.
- Bezpečnostný problém nehlás cez verejné issue, ale priamo správcovi repozitára.
