#!/usr/bin/env python3
"""Regenerate navigation indexes without loading implementation bodies into context."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
web = root / 'web/src'
files = sorted(p for p in web.rglob('*') if p.suffix in {'.js', '.jsx', '.css'})
imports = {}
for path in files:
    targets = []
    for match in re.finditer(r'''(?:from\s*|import\s*\(?\s*)['"]([^'"]+)['"]''', path.read_text()):
        ref = match.group(1)
        if not ref.startswith('.'):
            continue
        base = path.parent / ref
        options = [base, *(Path(str(base) + ext) for ext in ('.js', '.jsx', '.css')), base / 'index.js', base / 'index.jsx']
        target = next((p.resolve() for p in options if p.is_file()), None)
        if target and target not in targets:
            targets.append(target)
    imports[path] = targets
reachable = set()
pending = [web / 'main.jsx']
while pending:
    path = pending.pop()
    if path in reachable:
        continue
    reachable.add(path)
    pending.extend(imports.get(path, []))
lines = ['# Index des sources web', '',
         'Généré par `python3 scripts/update-source-index.py`. Imports locaux littéraux seulement ; absence de chemin ne prouve pas que le code peut être supprimé.', '']
for path in files:
    source = path.read_text()
    symbols = re.findall(r'^(?:export\s+)?(?:async\s+)?(?:function|class)\s+(\w+)', source, re.M)
    dependencies = ', '.join(str(p.relative_to(web)) for p in imports[path]) or 'aucune'
    symbol_list = ', '.join(symbols) or 'aucun'
    lines += [f'## {path.relative_to(root)}', '',
              f'{len(source.splitlines())} lignes ; ' + ('accessible depuis main.jsx' if path in reachable else 'sans chemin depuis main.jsx'),
              'Dépendances locales : ' + dependencies,
              'Symboles : ' + symbol_list, '']
(root / 'docs/audit/source-index.md').write_text('\n'.join(lines))
lines = ['# Index Android natif', '', 'Généré par `python3 scripts/update-source-index.py`. Les symboles indiquent les points de lecture ; cet inventaire ne constitue pas une validation.', '']
for path in sorted((root / 'android/app/src/main').rglob('*')):
    if path.suffix not in {'.kt', '.cpp', '.h'}:
        continue
    source = path.read_text()
    symbols = re.findall(r'^\s*(?:(?:private|internal|public|data|sealed|abstract|open|suspend|override|inline)\s+)*(?:class|object|interface|fun)\s+([\w.]+)', source, re.M)
    lines += [f'## {path.relative_to(root)}', '', f'{len(source.splitlines())} lignes.', 'Symboles : ' + (', '.join(symbols) or 'aucun'), '']
(root / 'docs/audit/android-index.md').write_text('\n'.join(lines))
