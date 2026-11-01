// Veřejná konfigurace. Sem nikdy nevkládej client secret, heslo ani přístupový token.
window.GARAZ_CONFIG = {
  clientId: '',        // Google OAuth Client ID (Web application)
  apiKey: '',          // API key pro Google Picker, omezený na tvoji doménu
  projectNumber: '',   // Číselné Project number z Google Cloud
  spreadsheetId: '',  // Po vytvoření zkopíruj z Nastavení, pak budou všichni používat stejná data
  folderId: ''         // ID sdílené složky pro fotky
};
