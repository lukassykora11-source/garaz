# DC RUST GARAGE — logo a profily aut

## Nahrání na GitHub

Rozbal ZIP a nahraj všechny soubory uvnitř složky garaz-kalendar do kořene svého existujícího repozitáře garaz. Potvrď Commit changes a počkej na dokončení GitHub Pages.

Důležitý je i nový soubor logo.webp; nahraj jej vedle index.html. Celá aktualizace obsahuje vzájemně odpovídající HTML, CSS a JavaScript včetně dosavadního funkčního kalendáře a časů úkolů.

Tvůj config.js ponech stávající. ZIP jej neobsahuje, aby se zachovalo přihlášení, klíč a ID tabulky a složky. Nová oprávnění Googlu nejsou potřeba. Nevytvářej nový kalendář ani novou tabulku.

## Co se změnilo

- Tvoje dodané logo DC RUST GARAGE je v levém menu. Soubor ikony icon.svg zůstává beze změny.
- Úvodní fotografii vybereš přímo v Nové auto nebo Upravit auto. Má vlastní náhled a uloží se společně s autem. Nemusíš nejprve přecházet do galerie.
- Barva auta je volný text, například béžová / hnědá nebo tmavě červená metalíza. Původní barevný odstín karty je zachovaný jako vzhled ilustrace, ne jako skutečná barva vozidla.
- Nové pole Motor, například 5.7 V8, benzín nebo 390ci V8.
- Motor a barva jsou vidět na kartě i v detailu auta.
- Fotky už uložené v galerii můžeš dále zvolit jako úvodní.

## Jak přidat úvodní fotku

1. Moje auta → Přidat auto, případně otevři existující auto a zvol Upravit auto.
2. Vyplň údaje včetně motoru a barvy.
3. V části Úvodní fotografie auta klikni na Nahrát novou úvodní fotku a vyber JPG, PNG nebo WebP do 12 MB.
4. Zkontroluj náhled a klikni na Uložit. U nové fotky během nahrávání počkej na dokončení.

Nový soubor má přednost před výběrem z galerie. Pokud chceš jen vybrat starší fotku, nevybírej nový soubor. Zrušit výběr nové fotky odstraní pouze právě vybraný soubor z formuláře. Volba Použít ilustraci vrátí ilustraci; původní fotku nemaže z Disku ani z galerie.

Jestli se po uložení údajů auta nepodaří uložit fotku, formulář zůstane otevřený a zobrazí důvod. Auto již je v evidenci. Po odstranění problému můžeš zkusit Uložit znovu; aplikace zachovává stejný záznam a už nahranou fotku se snaží použít znovu.

## Zachování dat

Záznamy aut, úkolů, fotek i propojení kalendáře zůstávají v existující tabulce a složce. Pole motor a barva se přidají při uložení auta; u starších vozů jsou prázdná do doplnění. Dosavadní úvodní fotky zůstávají zachované. Úkoly s časem a synchronizace kalendáře jsou součástí této verze.

Pro dřívější první nastavení kalendáře je přiložen NASAZENI-KALENDAR.md; při této aktualizaci už jeho zřizovací kroky neopakuj.

## Ověření

Prošly kontroly syntaxe a testy přímého nahrání fotografie, jejího přiřazení novému autu, ukládání motoru a textové barvy, zachování staré fotky a odstínu karty, odmítnutí příliš velkého souboru i opakovaného uložení po výpadku zápisu metadat bez duplicit auta nebo souboru. Znovu prošlo 23 testů kalendáře a 12 testů jeho ovládání.

Nový formulář a skutečné nahrání z tvého zařízení je po aktualizaci potřeba ověřit na jednom autu. Vizuální kontrola nového rozložení ve skutečném prohlížeči nebyla v tomto prostředí dostupná.


## Sjednocení adres /garaz/ a /garaz/index.html
Kratší adresa nyní automaticky přejde na index.html. Zachová se záložka i parametry odkazu. Nastavení připojení a místní ukázková data na původní adrese index.html zůstávají zachované. Google data se nemění.

Pro tuto samotnou opravu stačí na GitHubu nahradit index.html v kořeni repozitáře garaz. Pokud nemáš předchozí aktualizaci s logem, motorem a profilovou fotkou, nahraj celý obsah složky garaz-kalendar. Soubor config.js na GitHubu ponech svůj.

Po dokončení nasazení otevři https://lukassykora11-source.github.io/garaz/ a obnov stránku přes Ctrl+F5 (na Macu Cmd+Shift+R). Adresa přejde na index.html. Pokud Google vyžádá přihlášení, přihlas se stejným účtem. Ukázková auta nemusíš mazat.


## Zapamatování přihlášení na vlastním zařízení
V Nastavení zapni „Pamatovat přihlášení na tomto zařízení“ a přihlas se přes Google (lze zapnout i během platného přihlášení). Při návratu se platný přístup automaticky obnoví a znovu se načtou data i oprávnění z Googlu.

Volba je standardně vypnutá. Po zapnutí aplikace ukládá krátkodobý přístupový token do místního úložiště prohlížeče; neukládá heslo ani obnovovací token. Token neprodlužuje, ukládá jej nejdéle asi na hodinu od přihlášení, podle platnosti dané Googlem. Po vypršení je potřeba obnovit přístup tlačítkem Google. Odhlášení nebo vypnutí volby uložený přístup odstraní. Na sdíleném zařízení volbu nezapínej. Několikadenní přihlášení vyžaduje serverovou část.

Nahraj index.html, google.js a app.js; můžeš nahrát i všechny ostatní soubory z balíčku. Svůj config.js zachovej. Tato verze načítá config.js a skripty s novým označením, aby prohlížeč nepoužil starou kopii. Součástí zůstává sjednocení adres /garaz/ a /garaz/index.html.

Ověřeno automaticky: obnovení platného přístupu, expirace, odstranění při odhlášení, výchozí vypnutý stav, odmítnutí přístupu jiného OAuth klienta, odmítnutí zneplatněného přístupu, vypnutí volby a poškozený uložený záznam. Regresní kontroly kalendáře a profilových fotek prošly. Skutečný návrat na telefonu ověř po nahrání na GitHub.
