#!/bin/bash
# Génère un debug keystore stable pour les builds CI Android.
# À exécuter UNE SEULE FOIS. Copie la valeur affichée dans le secret GitHub ANDROID_DEBUG_KEYSTORE_B64.

KEYSTORE_PATH="$HOME/.android/debug.keystore"
mkdir -p "$HOME/.android"

if [ -f "$KEYSTORE_PATH" ]; then
  echo "✅ debug.keystore déjà présent à $KEYSTORE_PATH"
else
  keytool -genkeypair -v \
    -keystore "$KEYSTORE_PATH" \
    -alias androiddebugkey \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass android -keypass android \
    -dname "CN=Android Debug,O=Android,C=US"
  echo "✅ debug.keystore généré."
fi

echo ""
echo "━━━ Copie cette valeur dans le secret GitHub ANDROID_DEBUG_KEYSTORE_B64 ━━━"
echo ""
base64 -i "$KEYSTORE_PATH"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "→ GitHub repo → Settings → Secrets and variables → Actions → New secret"
echo "   Name  : ANDROID_DEBUG_KEYSTORE_B64"
echo "   Value : (la valeur ci-dessus)"
echo ""
echo "Ensuite désinstalle l'app une dernière fois sur ton téléphone, puis relance un build CI."
