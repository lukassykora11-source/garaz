"""Bundle the public Garáž assets for a two-module Cloudflare Worker upload."""
import base64
import json
from pathlib import Path

root = Path(__file__).resolve().parent
public = root / "public" if (root / "public").is_dir() else root
names = (
    "app.js", "calendar.js", "index.html", "style.css", "core.js",
    "media.js", "privacy.html", "logo.webp", "icon.svg", "session.js",
)
assets = {name: base64.b64encode((public / name).read_bytes()).decode("ascii") for name in names}
(root / "assets.generated.mjs").write_text("export default " + json.dumps(assets) + ";\n")
