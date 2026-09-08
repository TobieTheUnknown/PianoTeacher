#!/usr/bin/env python3
"""Keep the web, desktop and native Android release versions aligned."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SEMVER = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$")


def replace_once(path: Path, pattern: str, replacement: str) -> None:
    original = path.read_text()
    updated, count = re.subn(pattern, replacement, original, count=1, flags=re.MULTILINE)
    if count != 1:
        raise RuntimeError(f"Version introuvable dans {path.relative_to(ROOT)}")
    path.write_text(updated)


def main() -> int:
    if len(sys.argv) != 2 or not SEMVER.fullmatch(sys.argv[1]):
        print("Usage: scripts/set-version.py <major.minor.patch[-prerelease]>", file=sys.stderr)
        return 2

    version = sys.argv[1]
    for relative in ("web/package.json", "web/package-lock.json"):
        path = ROOT / relative
        data = json.loads(path.read_text())
        data["version"] = version
        if relative.endswith("package-lock.json"):
            data["packages"][""]["version"] = version
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")

    tauri_config = ROOT / "web/src-tauri/tauri.conf.json"
    data = json.loads(tauri_config.read_text())
    data["version"] = version
    tauri_config.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")

    replace_once(ROOT / "web/src-tauri/Cargo.toml", r'^version = "[^"]+"$', f'version = "{version}"')
    replace_once(
        ROOT / "web/src-tauri/Cargo.lock",
        r'(\[\[package\]\]\nname = "app"\nversion = ")[^"]+("\n)',
        rf'\g<1>{version}\2',
    )
    replace_once(
        ROOT / "android/app/build.gradle.kts",
        r'^\s*versionName = "[^"]+"$',
        f'        versionName = "{version}"',
    )

    print(f"Versions web, desktop et Android alignées sur {version}.")
    print("Vérifiez le diff, puis créez le commit et le tag séparément.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
