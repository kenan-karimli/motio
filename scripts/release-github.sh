#!/usr/bin/env bash
# Publishes the signed release APK as a GitHub release; installed apps find it and offer "Update".
# Run after `RELEASE=1 MOTIO_API=https://motio-api.onrender.com npm run apk`.
set -euo pipefail
cd "$(dirname "$0")/.."
code=$(grep -oP 'versionCode \K\d+' android/app/build.gradle)
name=$(grep -oP 'versionName "\K[^"]+' android/app/build.gradle)
src="dist/motio-$name.apk"
[ -f "$src" ] || { echo "Missing $src: build the release APK first" >&2; exit 1; }
# The app compares the number in this file name with its own versionCode. motio.apk is the same file under a
# fixed name, so https://github.com/kenan-karimli/motio/releases/latest/download/motio.apk always serves the newest.
cp "$src" "dist/motio-$code.apk"
cp "$src" "dist/motio.apk"
# What's new: release-notes/<version>.md (shown on the website and in the app's What's new sheet).
notes="release-notes/$name.md"
[ -f "$notes" ] || { echo "Write $notes first (one '- ' line per change)" >&2; exit 1; }
gh release create "v$name" "dist/motio-$code.apk" "dist/motio.apk" --repo kenan-karimli/motio --title "Motio $name" --notes-file "$notes" --latest
