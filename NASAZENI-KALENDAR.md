# Google Kalendář — aktualizace Garáže

## Co aktualizace přidává

- Samostatný Google kalendář **Garáž — opravy a termíny**.
- Jednosměrný přenos úkolů z Garáže do Google Kalendáře.
- Volitelný čas úkolu, například 15:00. S časem vznikne hodinová událost, bez času zůstává celodenní.
- Změna názvu, popisu, odpovědné osoby, stavu nebo termínu aktualizuje stejnou událost.
- Dokončený úkol zůstává s označením HOTOVO, šedou barvou a bez připomínky.
- Úkol bez termínu, odstraněný úkol nebo úkol s vypnutým přenosem se z kalendáře odebere. Záznamy v evidenci tím nejsou odstraněny.
- Opakovaná synchronizace nevytváří nové kopie existujících událostí.
- U každého úkolu je přepínač **Zobrazovat v Google Kalendáři, pokud má úkol termín**.
- Nastavení připomínek: den předem, dva dny předem, výchozí nastavení Google kalendáře nebo vypnuto.

## 1. Nahraj aktualizaci na GitHub

1. Rozbal ZIP.
2. Otevři složku **garaz-kalendar**.
3. V repozitáři `lukassykora11-source/garaz` zvol **Add file → Upload files**.
4. Nahraj všechny soubory uvnitř této složky přímo do kořene repozitáře. Potvrď **Commit changes**.
5. Počkej na dokončení GitHub Pages a obnov aplikaci, případně použij v prohlížeči obnovení bez mezipaměti.

**Tvůj `config.js` ponech stávající.** Balíček jej záměrně neobsahuje, aby se neztratily tvoje klíče ani ID tabulky a složky. Obsahuje kompletní aktualizovaný HTML/CSS/JS kód; běží nad tvým již nastaveným config.js.

Nahraj tyto soubory současně: `index.html`, `style.css`, `app.js`, `core.js`, `google.js`, nový `calendar.js`, `icon.svg` a `.nojekyll`. Není potřeba nová tabulka, nový API klíč ani nový OAuth klient. Nepoužívej pro tuto aktualizaci dříve stažený samostatný index.html nebo garaz.html.

## 2. Povol oprávnění v Google projektu

Projekt **Garaz**, ID `garaz-513416`, číslo `621344193106`.

1. [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=garaz-513416) musí být zapnuté. Pokud vidíš Manage, je zapnuté.
2. Otevři [Google Auth Platform → Data Access](https://console.cloud.google.com/auth/scopes?project=garaz-513416).
3. Přes **Add or remove scopes** přidej pouze:

```text
https://www.googleapis.com/auth/calendar.app.created
```

4. Potvrď **Update / Save**. Zachovej dosavadní rozsahy `drive.file`, `userinfo.email` a `userinfo.profile`. Pokud v seznamu ještě nejsou, přidej také tyto již používané rozsahy.
5. Aplikace může pro první ověření zůstat v režimu **Testing**. Tvůj účet musí být mezi **Test users**, což už máš nastavené.

Omezený prohlížečový API klíč pro Google Picker není potřeba rozšiřovat o Calendar API. Kalendář používá přihlášení OAuth a jeho přístupový token. Aplikace nežádá přístup ke všem kalendářům ani k hlavnímu kalendáři.

Pokud Google zobrazí nečekané varování nebo odmítne oprávnění, pošli screenshot bez klíčů. Nepřidávej kvůli tomu plošný přístup ke všem kalendářům.

## 3. Propoj kalendář v aplikaci

1. Otevři [nastavení Garáže](https://lukassykora11-source.github.io/garaz/index.html#settings).
2. Přihlas se stejným Google účtem jako dosud.
3. V nové části **Google Kalendář** klikni na **Povolit Google Kalendář** a potvrď požadovaný přístup.
4. Klikni na **Vytvořit kalendář Garáž**.
5. Aplikace vytvoří samostatný kalendář a uloží propojení do nového listu **Kalendar** v existující společné tabulce.
6. Otevři ho tlačítkem **Otevřít Google Kalendář**.
7. Ulož jeden zkušební úkol s termínem a případně klikni na **Synchronizovat teď**.

List **Udalosti** se strukturou a historií aut zůstává zachovaný. List **Kalendar** nevyplňuj ručně. ID kalendáře nemusíš zapisovat do config.js; je uložené ve společné tabulce.

## 4. Jak synchronizace běží

Přenos spouští účet, který kalendář vytvořil a propojil. Spouští se po uložení úkolu nebo auta, po přihlášení a přibližně každou minutu, když je aplikace viditelná a přihlášení platí. Lze jej spustit ručně.

Když jiný uživatel změní úkol, uloží se do společné evidence. Do Google Kalendáře jej přenese vlastník propojení při své další synchronizaci. Ostatní uživatelé nemusejí kvůli evidenci aut dávat aplikaci přístup ke kalendáři.

**Po zavření Garáže neběží nová synchronizace.** Události již uložené v Googlu zůstávají a Google dále zajišťuje připomínky. Přenos nepřihlášený v pozadí by vyžadoval serverovou část s jiným způsobem správy přihlášení.

V přehledu synchronizace uvidíš počty nových, změněných a odebraných událostí. Chyba kalendáře nezruší uložení úkolu do tabulky. Při chybě se podívej na text v části Google Kalendář a zkus ruční synchronizaci znovu.

## 5. Připomínky a další lidé

V Garáži může vlastník změnit předstih připomínky. K termínu úkolu lze vyplnit volitelný čas. S časem aplikace rezervuje v Google Kalendáři 1 hodinu. Bez času zůstává událost celodenní. Časy se vyhodnocují v pásmu Europe/Prague včetně letního a zimního času. Přesný čas připomínky si zkontroluj na první události v Google Kalendáři; předstih se počítá k začátku události. Při přechodu na zimní čas se u opakující se hodiny použije její první výskyt; neexistující hodina při přechodu na letní čas se odmítne.

Pro upozornění na telefonu musíš mít v Google Kalendáři přidaný stejný účet, zapnuté zobrazení kalendáře a povolená oznámení v telefonu. Nelze zaručit doručení, pokud telefon oznámení blokuje nebo má úsporná omezení.

Kalendář můžeš v jeho nastavení nasdílet konkrétním lidem. Samotné sdílení tabulky ani složky fotek kalendář nesdílí. Připomínky dalších uživatelů se řídí také jejich vlastním nastavením Googlu; aplikace neposílá pozvánky ani e-maily za ně.

## 6. Co se upravuje a co zůstává zachované

Úkoly upravuj v Garáži. Změny událostí přímo v Google Kalendáři se do Garáže nevracejí a synchronizace může jejich spravované údaje obnovit podle evidence. Ručně přidané události bez značky Garáže aplikace nespravuje.

Pokud má úkol v evidenci nevyřešené souběžné verze, přenos daného úkolu se přeskočí. Nastavení kalendáře se při souběžné změně pozastaví, aby se nezvolil chybný kalendář. V takovém případě pošli zobrazenou chybu.

Pozastavení synchronizace ponechá již vytvořené události v Googlu. Znovu ji zapneš v nastavení. Dokončené úkoly zůstávají v kalendáři jako historie.

## 7. Přerušení při vytváření kalendáře

Pokud kalendář vznikne, ale zápis propojení do tabulky selže, aplikace si v prohlížeči zapamatuje jeho ID. Další pokus použije stejný kalendář.

Pokud se přeruší samotná odpověď Googlu a není jisté, zda kalendář vznikl, aplikace další kalendář automaticky nevytvoří. Zkontroluj Google Kalendář. Pokud tam Garáž je, otevři jeho **Nastavení → Integrovat kalendář**, zkopíruj **ID kalendáře** a v Garáži rozbal **Obnovit propojení po přerušeném vytváření**.

Obnova přijme pouze samostatný kalendář vytvořený aplikací pro stejnou společnou tabulku a vyžaduje účet vlastníka. Nezadávej `primary` ani ID osobního kalendáře.

## Ověření před předáním

Prošly automatické kontroly syntaxe a simulované testy vytvoření, opakovaného přenosu, posunu termínu, dokončení, odebrání termínu, vypnutí přenosu, stránkování, souběžných změn, přerušení připojení a zachování cizích událostí. Ověřeno bylo také zachování stávající konfigurace a oddělené ukládání nastavení do tabulky. Prošly testy volitelného času, časového pásma Praha v létě i zimě, přechodu přes půlnoc, přepnutí celodenní/časované události, uchování ID události a ICS exportu s časem.

Živé ověření nového OAuth oprávnění, vytvoření skutečného kalendáře, vzhledu a přenosu události je potřeba dokončit s tvým Google účtem po nahrání aktualizace. Samotné zapnutí Calendar API funkci do dřívější verze aplikace nepřidává.

## Oficiální podklady

- [Vytvoření samostatného kalendáře](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/insert)
- [Vytváření událostí a ID](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert)
- [Úpravy událostí](https://developers.google.com/workspace/calendar/api/v3/reference/events/patch)
- [Připomínky](https://developers.google.com/workspace/calendar/api/concepts/reminders)
