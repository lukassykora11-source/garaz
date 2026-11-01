# Garáž — první verze, 1. listopadu 2026

Aplikace pro několik aut a malý tým. Funguje na GitHub Pages bez PHP, MySQL, Supabase nebo dalšího serveru. Data jsou v Google Sheets, fotky v soukromé složce Google Disku.

## Co dostáváš

- Přehled aut, práce po termínu, nejbližších termínů a dokončených úkolů.
- Kartu auta s vlastními poznámkami, historií práce, fotkami a součtem skutečných nákladů.
- Úkoly: auto, typ práce, odpovědná osoba, termín, priorita, stav, popis, odhad a skutečné náklady.
- Měsíční kalendář a jednorázový export otevřených úkolů do ICS.
- Poznámky a odkazy na stránky, díly a YouTube.
- Nahrání fotek k autu nebo konkrétnímu úkolu; originály se nezmenšují.
- Světlý a tmavý vzhled, rozložení pro mobil.
- Přihlášení Google, sdílení podle oprávnění tabulky a složky.
- Ukázku, která neposílá žádné záznamy do Googlu.

Všichni přizvaní uživatelé vidí celou garáž. Odpovědná osoba je textový údaj, nikoli samostatné přístupové oprávnění. Automatické e-mailové ani push připomínky tato verze neposílá. Kalendář není průběžně propojený s Google Kalendářem; ICS je jednorázový export. Termíny jsou celodenní.

## 1. Nejdřív vyzkoušej ukázku

Rozbal ZIP a otevři `garaz.html` v běžném prohlížeči. Je to samostatná verze se všemi styly a aplikačním kódem uvnitř. Obsahuje ukázková auta a vymyšlené úkoly. Nejde o potvrzení skutečného stavu tvých oprav.

Změny v ukázce zůstávají jen v daném prohlížeči; fotky jsou v jeho místní databázi. Vymazání dat prohlížeče je odstraní. Pro skutečný společný provoz použij Google podle dalších kroků. Ukázka se do nové společné tabulky nekopíruje.

## 2. Vystav aplikaci na GitHub Pages

1. Vytvoř repozitář, například `garaz`.
2. Do jeho kořene nahraj `index.html`, `style.css`, `core.js`, `google.js`, `app.js`, `config.js`, `icon.svg` a `.nojekyll`. Není potřeba build ani instalace balíčků.
3. V repozitáři otevři **Settings → Pages**.
4. Vyber **Deploy from a branch**, větev `main` a složku `/ (root)`.
5. Počkej na dokončení publikování. Adresa typicky bude `https://TVUJ-UCET.github.io/garaz/`.

Samotná stránka GitHub Pages bývá veřejná, i když je repozitář soukromý. Soukromí dat zajišťují oprávnění Googlu. Do repozitáře nenahrávej svoje exporty, zálohy záznamů nebo fotky.

Soubor `garaz.html` je alternativní samostatné balení stejné verze. Pro běžný provoz a úpravy konfigurace používej `index.html` s dalšími soubory. Nenahrazuj jím index při každé změně, jde o dvě oddělená balení.

## 3. Vytvoř Google Cloud projekt

1. Otevři [Google Cloud Console](https://console.cloud.google.com/).
2. Vytvoř nový projekt, třeba **Moje garáž**.
3. V přehledu projektu si zkopíruj **Project number**. Je to číselná hodnota, nikoli textové Project ID.
4. V **APIs & Services → Library** zapni **Google Drive API**, **Google Sheets API** a **Google Picker API**.

## 4. Připrav přihlášení Google

V **Google Auth platform** nastav název aplikace a kontaktní e-mail. Pro různé osobní Google účty zvol publikum **External**. Pro začátek ji můžeš nechat v režimu **Testing** a do **Test users** přidat sebe i každého dalšího účastníka. Testovací režim Google omezuje; není to náhrada trvalého produkčního nastavení pro veřejnou aplikaci.

V **Data Access** přidej pouze tyto rozsahy:

```text
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
```

Nepotřebuješ přístup k celému Disku ani ke všem tabulkám. `drive.file` umožňuje pracovat s jednotlivými soubory vytvořenými nebo vybranými pro aplikaci.

V **Clients → Create client** zvol **Web application**. Do **Authorized JavaScript origins** přidej svůj origin, například:

```text
https://TVUJ-UCET.github.io
```

Bez `/garaz/` a bez koncového lomítka. Pro vlastní doménu vlož její origin. Přesměrovací URI pro tento prohlížečový tok nepotřebuješ. Zkopíruj **Client ID**, které končí `.apps.googleusercontent.com`. Client secret aplikace nepoužívá a do žádného souboru se nevkládá.

## 5. Vytvoř klíč pro výběr souborů

V **APIs & Services → Credentials → Create credentials → API key** vytvoř klíč. Omez jej:

- **Application restrictions → Websites**: tvoje adresa `https://TVUJ-UCET.github.io/*` a také `https://docs.google.com/*`. Druhou adresu potřebuje Google Picker, který běží v rámci Googlu.
- **API restrictions**: Google Picker API a Google Drive API.

Tento prohlížečový API klíč je veřejný; bezpečnost mu dávají uvedená omezení. Přístup k soukromým souborům se řídí přihlášením a jejich sdílením, samotný klíč jej nedává.

## 6. Doplň konfiguraci

V repozitáři uprav `config.js`:

```js
window.GARAZ_CONFIG = {
  clientId: 'TVUJ_CLIENT_ID.apps.googleusercontent.com',
  apiKey: 'TVUJ_API_KEY',
  projectNumber: '123456789012',
  spreadsheetId: '',
  folderId: ''
};
```

Změnu ulož na GitHub, počkej na nové publikování a stránku obnov. Stejné tři hodnoty můžeš pro první test vyplnit také v **Nastavení a přístup** přímo v aplikaci; tak se ale uloží jen do konkrétního prohlížeče. Pro všechny účastníky patří do `config.js`.

## 7. Založ společná data

1. V aplikaci otevři **Nastavení a přístup → Přihlásit přes Google**.
2. Přihlas se účtem, který bude vlastníkem evidence. Povol požadovaná oprávnění.
3. U společné tabulky klikni na **Vytvořit novou**. Vznikne `Garáž — evidence aut` s listem `Udalosti`. Tabulka bude prázdná.
4. U fotek zvol **Vytvořit novou**, nebo přes **Vybrat složku** vyber svou existující složku. Doporučuji samostatnou složku jen pro auta, aby se se spolupracovníky nesdílely i jiné osobní fotky.
5. Z nastavení zkopíruj ID tabulky a složky do `spreadsheetId` a `folderId` v `config.js`. Publikuj změnu.
6. Přidej vlastní auta a skutečné úkoly.

Pouhé napsání ID existujícího souboru neuděluje aplikaci oprávnění. Soubor musí být pro daného uživatele vytvořený aplikací nebo zvolený přes Google Picker. Po změně přihlášení nebo na dalším zařízení může být potřeba výběr zopakovat.

## 8. Pozvi svoje lidi

V aplikaci otevři odkaz na tabulku a v Google Sheets klikni na **Sdílet**. Totéž udělej se složkou fotek na Disku.

1. Obecný přístup nech **Omezený přístup**.
2. Přidej konkrétní Google e-maily.
3. **Editor** může pracovat se záznamy; pro nahrání fotek potřebuje možnost přidávat soubory i do složky.
4. **Čtenář** si může prohlížet záznamy. V aplikaci jsou úpravy vypnuté a Google zápis zároveň nepovolí.
5. V testovacím režimu OAuth musí být e-mail také mezi **Test users** v Google Cloud projektu.
6. Pošli lidem adresu aplikace. Po přihlášení a případné chybě 403/404 vyberou stejnou společnou tabulku a složku přes tlačítka **Vybrat…**. Nemají vytvářet každý svou tabulku.

Odebrání člověka proveď v oprávněních **tabulky i složky**, případně zkontroluj přímé sdílení jednotlivých fotek. Již stažené kopie a exporty tím neodstraníš. Google Workspace může podle firemních pravidel omezovat externí sdílení nebo OAuth aplikace.

## Jak se data ukládají

Každé uložení přidá do listu `Udalosti` nový řádek s verzí příslušného záznamu. Před zápisem aplikace načte aktuální data. Při souběžné úpravě stejné věci zachová obě verze a zobrazí upozornění; otevři záznam, porovnej varianty a ulož společnou podobu. Nejde o automatické sloučení textů.

List `Udalosti`, jeho záhlaví a obsah neupravuj ručně. Je to zdrojová evidence ve formátu historie změn, nikoli běžný seznam úkolů pro ruční doplňování. Oprávnění Editor znamená, že člověk technicky může měnit i tuto tabulku; samostatná role administrátora nad ostatními editory zde není.

Změny kolegů načteš tlačítkem **Obnovit**. Aplikace neudržuje živé připojení. Po obnovení celé stránky je potřeba znovu kliknout na Google přihlášení; krátkodobý přístupový token se neukládá do souborů ani místního úložiště.

Fotky se ukládají jako soubory, tabulka obsahuje jejich ID a vazbu na auto/úkol. Výběr složky neposkytuje přístup ke všem starým fotkám uvnitř; první verze eviduje fotky nově nahrané aplikací. Pokud náhled sdílené fotky není dostupný přes omezené API oprávnění, otevři ji odkazem přímo na Disku. Staré fotky lze z počítače znovu nahrát nebo vložit jejich odkaz do poznámky.

Záznam odstraněného úkolu/poznámky zůstává v historii. Odstranění úkolu nemaže fotky. Archivované auto ponechá historii i existující úkoly. Export JSON obsahuje záznamy a ID fotek, nikoli obrázky. Automatický import zálohy zatím není součástí aplikace.

## Když něco nefunguje

| Problém | Co ověřit |
|---|---|
| `origin_mismatch` | Origin v OAuth klientovi musí být přesně stejný jako otevřený web: protokol a doména, bez cesty. |
| Google nepovolí přihlášení | Testovací e-mail, firemní pravidla, správný účet a povolené přihlašovací okno. Použij běžný Chrome, Edge nebo Safari. |
| API developer key is invalid | Omezení API key, zapnutý Picker API a `https://docs.google.com/*` v povolených webech. |
| 403 / 404 | Zapnutá API, správný účet, sdílení souboru a jeho výběr přes Google Picker. |
| Chyba struktury tabulky | Vyber tabulku vytvořenou aplikací; list se musí jmenovat `Udalosti` a záhlaví zůstat původní. |
| Fotka nejde nahrát | Oprávnění složky, volné místo na Disku, JPG/PNG/WebP a nejvýše 12 MB na soubor. |
| Kolega nevidí novou práci | Používá stejnou tabulku? Klikl na Obnovit? |
| Nová hodnota z config.js se neprojevila | Dřívější nastavení uložené v prohlížeči má přednost; vyber správnou tabulku/složku v Nastavení nebo aktualizuj hodnoty formulářem. |

Živé připojení nemůžeš správně zkoušet pouhým otevřením `file://` souboru. Pro Google použij nasazený HTTPS web.

## Ověření této verze

Prošla kontrola syntaxe všech skriptů; testy logiky termínů, přestupného roku, kalendáře, bezpečných odkazů, ICS exportu, historie a souběžných úprav. V simulovaném prostředí prošlo přidání auta, přidání a dokončení úkolu a navigace. Rozhraní Google bylo ověřeno s náhradními odpověďmi včetně zamítnutí zápisu čtenáři a chyb 403.

Živé přihlášení, Picker, skutečný zápis do Sheets, nahrání fotek a sdílení mezi dvěma účty vyžadují tvůj Google projekt a zbývají ověřit po nastavení. Vizuální a mobilní kontrola ve skutečném prohlížeči nebyla v tomto prostředí dostupná.

Po nasazení nejdřív přidej jedno testovací auto a úkol, přihlas druhý pozvaný účet, ověř čtení i úpravu, nahraj fotku a zkontroluj její soukromé sdílení. Teprve potom začni vkládat ostrou evidenci.

## Použité oficiální podklady

- [Google: token model pro webové aplikace](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Google: výběr souborů a nastavení API klíče](https://developers.google.com/workspace/drive/picker/guides/web-picker)
- [Google: oprávnění Sheets včetně drive.file](https://developers.google.com/workspace/sheets/api/scopes)
- [Google: oprávnění a sdílení souborů](https://developers.google.com/workspace/drive/api/guides/manage-sharing)
- [GitHub: publikování pomocí Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
