# Garáž — kompletní složka pro GitHub

Toto je aktuální verze včetně přidávání aut a úvodní fotografie každého auta.

## Co nahrát na GitHub

Rozbal ZIP, otevři složku `garaz` a nahraj její obsah do kořene svého repozitáře. Pokud tam máš předchozí samostatný index.html, nahraď ho tímto index.html a přidej ostatní soubory současně.

- index.html — hlavní stránka; v tomto balíčku používá soubory níže.
- style.css — vzhled a mobilní rozložení.
- app.js — ovládání aplikace, auta, úkoly, poznámky a fotografie.
- core.js — kalendář, termíny, historie změn a export ICS.
- google.js — přihlášení a ukládání do Google Sheets a Disku.
- config.js — veřejná konfigurace tvého Google projektu.
- icon.svg — ikona aplikace.
- .nojekyll — soubor pro GitHub Pages.
- NASAZENI.md — podrobný návod.
- garaz.html — alternativní samostatná verze; pro provoz složkové verze ji nepotřebuješ, otevírej index.html.

V GitHub Settings → Pages nastav větev main a složku / (root). Hlavní index.html má být přímo v tomto kořeni, ne v další podsložce garaz.

## Úvodní fotka auta

Přidej auto, otevři jeho detail a zvol + Fotky. Při nahrávání můžeš zaškrtnout použití první fotografie jako úvodní. U již uložené fotky v galerii zvol Použít jako úvodní. V Upravit auto můžeš vybrat jinou fotku nebo se vrátit k ilustraci.

## Před ostrým používáním

Google zatím není nakonfigurovaný. Doplň config.js podle NASAZENI.md, přihlas se, vytvoř nebo vyber společnou tabulku a složku a ověř uložení jednoho auta a fotky. Dokud svítí Ukázkový režim, data se ukládají pouze do prohlížeče. Ukázková data se do nové tabulky nepřenášejí.

Přímé propojení s Google Kalendářem v tomto balíčku zatím není; k dispozici je kalendář aplikace a jednorázový export ICS.
