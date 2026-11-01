# Aktualizace Garáže — Google Kalendář

Nahraj obsah složky garaz-kalendar do kořene svého existujícího repozitáře garaz a potvrď Commit changes.

Vlastní config.js ponech beze změny. V ZIPu záměrně není; neztratí se tak API klíč ani ID existující tabulky a složky.

Nový soubor calendar.js musí být nahraný současně s index.html, google.js a app.js. Celé HTML/CSS/JS z této aktualizace patří k sobě. Není potřeba vytvářet nový repozitář ani novou evidenci aut.

Dále otevři NASAZENI-KALENDAR.md. V Google Cloud povol rozsah calendar.app.created a v aplikaci zvol Nastavení → Google Kalendář → Povolit Google Kalendář → Vytvořit kalendář Garáž.

Přenos probíhá jednosměrně z aplikace do samostatného Google kalendáře. Dokončené úkoly zůstávají jako historie bez připomínky. Synchronizuje účet vlastníka propojení při používání aplikace. Nový přenos při zavřené aplikaci neběží; již nastavené připomínky dále zajišťuje Google.

Data a fotografie v Googlu se touto aktualizací nepřepisují. Nové nastavení se uloží do samostatného listu Kalendar v existující tabulce.

Pokud se během povolování objeví nečekaná chyba nebo varování Googlu, pošli screenshot bez klíčů a přístup nerozšiřuj na všechny kalendáře.
