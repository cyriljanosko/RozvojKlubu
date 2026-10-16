# 0002 – Hlavné prihlásenie cez Sportnet (OIDC), e-mail ako doplnok

- Stav: prijaté
- Dátum: 2026-10-15
- Rozhodol: Cyril Janoško
- Mení: pôvodné rozhodnutie z 12. 10. 2026 „vlastné kontá (e-mail)“

## Kontext

Sportnet má vlastný prihlasovací server `auth.sportnet.online` – plnohodnotný OAuth2/OIDC poskytovateľ
(Authorization Code + PKCE, ID tokeny, RS256 JWT, JWKS). Sám podporuje heslo, passkey, magic link,
Google, Facebook, Apple a prihlásenie cez ISSF/futbalnet. Funkcionári klubov už Sportnet účty majú.
(Zdroj: Sportnet dokumentácia, projekt `auth-sportnet-online`.)

## Rozhodnutie

- Hlavný spôsob prihlásenia: **Sportnet OIDC** cez Better Auth `genericOAuth`.
- Doplnok pre ľudí bez Sportnet účtu: **prihlásenie e-mailovým odkazom** odoslaným cez **Ecomail**.
- Google, Apple a ďalšie siete riešime cez Sportnet, nie samostatne (kým nevznikne iná potreba).
- Microsoft Entra ID (tenant SFZ) zostáva v pláne ako ďalší krok.

## Dôsledky

- Pri prihlásení cez Sportnet získame Sportnet ID automaticky (väzba na kluby a osoby pre F2).
- Treba zaregistrovať OAuth klienta v Sportnete (client_id, client_secret, redirect URI).
- Účty z rôznych spôsobov prihlásenia sa prepájajú podľa overeného e-mailu.
- Rola nového účtu je „verejnosť“; rolu a klub prideľuje admin.
