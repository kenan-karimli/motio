#!/usr/bin/env bash
# Rebuilds the screens, syncs them into the Android project and produces a signed release APK in dist/.
set -euo pipefail
cd "$(dirname "$0")/.."
export JAVA_HOME="${JAVA_HOME:-$HOME/.local/jdk/jdk-21.0.13+9}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$JAVA_HOME/bin:$PATH"
# RELEASE=1 makes a build for other people: it must point at your hosted HTTPS server and has debugging off.
#   RELEASE=1 MOTIO_API=https://api.example.com npm run apk
if [ "${RELEASE:-0}" = 1 ]; then
  case "${MOTIO_API:-}" in https://*) ;; *) echo "RELEASE=1 needs MOTIO_API=https://your-server" >&2; exit 1 ;; esac
  DEBUG=false
else
  DEBUG=true
fi
node -e "const f='capacitor.config.json',c=JSON.parse(require('fs').readFileSync(f));c.android=c.android||{};c.android.webContentsDebuggingEnabled=$DEBUG;require('fs').writeFileSync(f,JSON.stringify(c,null,2))"
node scripts/make-icons.mjs
node scripts/build-www.mjs
npx cap sync android
(cd android && ./gradlew assembleRelease)
mkdir -p dist
VER=$(grep -m1 versionName android/app/build.gradle | sed 's/[^0-9.]//g')
SUFFIX=$([ "${RELEASE:-0}" = 1 ] && echo "" || echo "-test")
cp android/app/build/outputs/apk/release/app-release.apk "dist/motio-$VER$SUFFIX.apk"
echo "Built dist/motio-$VER$SUFFIX.apk (API: ${MOTIO_API:-http://localhost:8787}, debugging: $DEBUG)"
# Google Play takes an app bundle (.aab) rather than an APK.
if [ "${RELEASE:-0}" = 1 ]; then
  (cd android && ./gradlew bundleRelease)
  cp android/app/build/outputs/bundle/release/app-release.aab "dist/motio-$VER.aab"
  echo "Built dist/motio-$VER.aab for Google Play"
fi
