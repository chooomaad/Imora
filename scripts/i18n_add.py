"""Dev helper: add translation keys to fr.json and ar.json at once.
Usage: python scripts/i18n_add.py '{"property.detailsTitle": ["Détails Propriété", "تفاصيل العقار"]}'"""
import json, sys, pathlib
base = pathlib.Path(__file__).resolve().parent.parent / "packages/shared/src/i18n"
entries = json.loads(sys.argv[1])
for idx, lang in enumerate(["fr", "ar"]):
    p = base / f"{lang}.json"
    data = json.loads(p.read_text(encoding="utf-8"))
    for key, values in entries.items():
        node = data
        parts = key.split(".")
        for part in parts[:-1]:
            node = node.setdefault(part, {})
        node[parts[-1]] = values[idx]
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"added {len(entries)} keys")
