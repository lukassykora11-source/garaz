# DC RUST GARAGE — aktuální kompletní aktualizace

## Nahrání na GitHub
1. Rozbal ZIP a otevři složku garaz-kalendar.
2. Nahraj veškerý její obsah přímo do kořene repozitáře garaz. Soubor media.js je nový a musí se nahrát také.
3. Svůj config.js ponech beze změny. Balíček jej neobsahuje.
4. Po dokončení GitHub Pages obnov stránku (Ctrl+F5, na Macu Cmd+Shift+R).
5. Otevři https://lukassykora11-source.github.io/garaz/ . Adresa automaticky přejde na index.html se zachováním záložky a parametrů. Nastavení z původní adresy index.html zůstává zachované.

## Nově: menší fotografie a přílohy
- Fotky JPEG, PNG a WebP se při nahrání automaticky zpracují v prohlížeči: delší strana nejvýše 1920 px, bez zvětšování, výstup JPEG v kvalitě 80 %. Průhlednost se nahradí bílou.
- Pokud by převod malého snímku bez zmenšení vytvořil větší soubor, zůstane původní snímek. Originál ve Fotkách v telefonu se nikdy nemění.
- Zpracování platí i pro úvodní fotku vybranou ve formuláři auta. Dříve uložené fotky se nepřevádějí zpětně.
- V sekci Fotky a soubory lze nahrát PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, ODT, ODS, TXT, CSV a RTF. Dokumenty se uloží beze změny na stejný Google Disk. Otevřou se odkazem na Disk; v ukázce se dají stáhnout z prohlížeče.
- Limit je 25 MB na vstupní soubor a nejvýše 8 souborů ve výběru. HEIC nejdříve převeď do JPG.
- Přílohu přiřaď k autu, případně i ke konkrétnímu úkolu. U uloženého úkolu je tlačítko Fotky a dokumenty k úkolu.
- Dokument se nemůže nastavit jako úvodní fotka. Ve smíšeném výběru aplikace použije první fotografii, pokud je zapnutá odpovídající volba.

## Odkazy na weby a YouTube
Otevři Poznámky a odkazy, přidej záznam, zvol Odkaz / video, vyplň nadpis a celou adresu https://... . Můžeš zvolit konkrétní auto nebo společné poznámky. Stejnou sekci najdeš přímo v detailu auta.

## Úvodní fotka, barva a motor
V Moje auta zvol Přidat auto nebo Upravit auto. Můžeš napsat barvu vlastními slovy, doplnit motor a vybrat úvodní fotografii s náhledem. Údaje se zobrazí na kartách a v detailu. Původní ikona je zachovaná, logo DC RUST GARAGE je v menu.

## Zapamatování přihlášení
V Nastavení zapni Pamatovat přihlášení na tomto zařízení. Volba je standardně vypnutá. Zapnutá ukládá krátkodobý přístupový token do prohlížeče do původní platnosti, nejdéle asi hodinu od přihlášení. Heslo ani obnovovací token neukládá. Používej jen na vlastním zařízení. Odhlášení nebo vypnutí volby uložený přístup odstraní. Po vypršení přístup obnovíš tlačítkem Google. Několikadenní přihlášení vyžaduje serverovou část.

## Zachování dat
Používá se stejná tabulka, složka a propojený kalendář. Nic se nemusí zakládat znovu, ukázková data se do Googlu nekopírují. Sdílení Google souborů ponech Omezené, pouze pro konkrétní e-maily.

## Ověření
Prošly testy přepočtu rozměrů a JPEG kvality, zachování poměru stran a původních souborů, přenosu dokumentů beze změny, limitů, přiřazení smíšeného výběru k autu i úkolu, zákazu dokumentu jako úvodní fotky a ukládání odkazu na YouTube. Regresní testy kalendáře a profilových fotek prošly. Zmenšování bylo ověřené pomocí simulovaného obrazového rozhraní; skutečný převod fotky a její orientaci z konkrétního telefonu ověř po nasazení.


## Google Cloud — přepnutí do ostrého provozu
Nahraj také privacy.html a aktualizovaný index.html. Zásady ochrany údajů jsou veřejná informační stránka bez přihlášení. Před zveřejněním zkontroluj, že odpovídají tvému používání aplikace a že kontaktní e-mail je správný.
Po dokončení nasazení otevři https://lukassykora11-source.github.io/garaz/privacy.html a ověř, že se zobrazí zásady, nikoli chyba 404.
V Google Auth Platform → Branding vyplň:
- Application home page: https://lukassykora11-source.github.io/garaz/
- Application privacy policy link: https://lukassykora11-source.github.io/garaz/privacy.html
- Authorized domain: lukassykora11-source.github.io
- Název Garaz a vlastní podpůrný i kontaktní e-mail.
Terms of service link není podle zobrazeného hlášení podmínkou přepnutí a může zůstat prázdný. Logo v Google přihlašování je volitelné a může vyvolat potřebu ověření značky.
Ulož Branding a vrať se do Audience → Publish app. Přepnutí ani případné ověření není automaticky dokončené nahráním těchto souborů.


## Jednoduchá přihlašovací obrazovka
Před přihlášením se zobrazuje pouze představení aplikace, tlačítko Přihlásit přes Google, volba zapamatování a odkaz na ochranu údajů. Ukázková auta ani nastavení společné tabulky, složky a kalendáře se před přihlášením nezobrazují. Stará místní ukázková data se nemažou ani nepřenášejí do Googlu.
Po přihlášení se načte společná garáž. V Nastavení je účet, tabulka, přílohy a kalendář. Technické hodnoty připojení jsou v zavřené rozbalovací sekci Pokročilé nastavení připojení. Přístup k této sekci nenahrazuje Google oprávnění k datům.
Pokud instalace nemá vůbec nastavený Client ID, přihlašovací stránka nabídne rozbalovací nastavení pro dokončení instalace. Jinak se technický formulář před přihlášením nevykresluje.
Pro tuto úpravu se mění app.js, style.css a index.html. Můžeš nahrát celý obsah ZIP; svůj config.js ponech.
Ověřeno: vstup bez přihlášení i přes odkaz na jinou záložku, skrytí technických údajů, návrat po odhlášení, obnova platné relace i neúspěšná obnova a náhradní nastavení chybějící instalace. Regresní testy kalendáře a příloh prošly. Rozložení na skutečném telefonu ověř po nasazení.
