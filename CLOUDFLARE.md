# Garáž na Cloudflare bez karty

Náhled používá Cloudflare Workers Free, Firebase Spark a stávající Google Tabulku a Disk. Připojení v náhledu se povolí až po dokončení nastavení. Každý účastník má vlastní účet Firebase. Apps Script ověřuje identitu u Firebase a porovnává UID s dvěma povolenými účty ještě před přístupem k datům.

## 1. Firebase

1. Otevři [Firebase Console](https://console.firebase.google.com/) a vytvoř projekt Garáž na tarifu Spark. Pro tuto aplikaci nemusíš zapínat Analytics, Firestore ani Storage.
2. V sekci Authentication otevři Sign-in method a zapni Email/Password. V sekci Users vytvoř účet pro sebe a pro Pavla. Pro svůj účet použij stejný e-mail, kterým jsi připojil Google Kalendář v Garáži. Hesla zadávej přímo ve Firebase nebo použij obnovu hesla z konzole. Přístup k datům se kontroluje podle UID a případný jiný účet data nezíská.
3. Zkopíruj z přehledu účtů obě UID. V nastavení projektu na kartě General si připrav Project ID a Web API Key. Pokud klíč není zobrazený, přidej v Project settings webovou aplikaci a použij její hodnotu `apiKey`.

## 2. Apps Script

1. Pod Google účtem, který vlastní Garáž, vytvoř nový projekt na [script.google.com](https://script.google.com/). Nahraď výchozí obsah souboru Code.gs souborem `apps-script/Code.gs` z této větve.
2. V Project settings zapni zobrazení manifestu `appsscript.json` a vlož obsah ze souboru `apps-script/appsscript.json`. Manifest povoluje propojení s Google Kalendářem. Proxy v kódu povolí pouze zapsaný kalendář typu `@group.calendar.google.com` a jen vlastníkovi.
3. V Project settings přidej do Script properties následující hodnoty.

| Vlastnost | Hodnota |
| --- | --- |
| FIREBASE_PROJECT_ID | Project ID z Firebase |
| FIREBASE_API_KEY | Web API Key z Firebase |
| OWNER_UID | UID tvého účtu Firebase |
| PAVEL_UID | UID Pavlova účtu Firebase |
| SPREADSHEET_ID | Část odkazu na původní Google tabulku mezi `/d/` a dalším lomítkem |
| FOLDER_ID | Část odkazu na složku s fotkami za `/folders/` |

4. Vpravo nahoře vyber Deploy → New deployment → Web app. Zvol Execute as Me a Who has access Anyone. Nastavení umožní Workeru zavolat skript bez vlastního účtu Google. O přístupu k evidenci rozhoduje následná kontrola dvou účtů Firebase v kódu. Potvrď Google souhlas jako vlastník.
5. Pro přenos termínů ověř, že je v Google Cloud projektu tohoto Apps Scriptu zapnuté Google Calendar API. Stávající propojení kalendáře se načítá z listu Kalendar. Pro provoz bez synchronizace stačí kalendář v Garáži a export ICS.
6. Zkopíruj adresu webové aplikace končící `/exec`. Pro dokončení nasazení Worker potřebuje tuto adresu a Web API Key projektu Firebase. UID a ID souborů stačí uložit do Script properties.

## 3. Ověření

Ověř nejdřív přihlášení vlastníka, načtení existujících vozů a fotek, stažení dokumentu a zápis zkušební poznámky. Pak zopakuj z Pavlova účtu. Vyzkoušej opětovné načtení stránky a odhlášení. Pokud používáš synchronizaci kalendáře, ověř ji s jedním testovacím úkolem. Změny v náhledu se zapisují do stejné tabulky, takže se po připojení projeví i ve stávající Garáži.

## Nasazení Workeru

`worker.mjs` bere veřejné soubory z modulu `assets.generated.mjs`. Vygeneruj ho příkazem `python3 build-worker.py`. Do Cloudflare nahraj oba moduly jako ES modules, `worker.mjs` je vstupní soubor. Worker používá proměnné `FIREBASE_API_KEY` a `GARAZ_SCRIPT_URL`. Dokud nejsou nastavené obě, nepropouští požadavky na Google data.
