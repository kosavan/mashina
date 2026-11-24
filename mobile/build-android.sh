#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

mode=${1:-preview}
case "$mode" in preview|release) ;; *) echo 'Expected preview or release.' >&2; exit 2 ;; esac
sdk=${ANDROID_SDK_ROOT:-${ANDROID_HOME:?Set ANDROID_HOME or ANDROID_SDK_ROOT}}
tools="$sdk/build-tools/35.0.1"
platform="$sdk/platforms/android-35/android.jar"
version=$(python3 -c 'import tomllib; print(tomllib.load(open("pyproject.toml", "rb"))["project"]["version"])')
build_number=$(python3 - "$version" <<'PY'
import re
import sys

version = sys.argv[1]
if not re.fullmatch(r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)", version):
    sys.exit("Expected a stable project version")
major, minor, patch = map(int, version.split("."))
code = major * 1_000_000 + minor * 1_000 + patch
if minor >= 1000 or patch >= 1000 or not 0 < code <= 2_100_000_000:
    sys.exit("Project version does not fit in Android versionCode")
print(code)
PY
)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

if [[ "$mode" == release ]]; then
    : "${MASHINA_ANDROID_KEYSTORE:?Set the release keystore path}"
    : "${MASHINA_ANDROID_STORE_PASSWORD:?Set the release keystore password}"
    : "${MASHINA_ANDROID_KEY_ALIAS:?Set the release key alias}"
    : "${MASHINA_ANDROID_KEY_PASSWORD:?Set the release key password}"
    package=ru.mashina.mobile
    filename="mashina-$version-android.apk"
else
    package=ru.mashina.mobile.preview
    filename="mashina-$version-android-preview.apk"
    MASHINA_ANDROID_KEYSTORE="$work/preview.p12"
    export MASHINA_ANDROID_STORE_PASSWORD=android MASHINA_ANDROID_KEY_PASSWORD=android
    MASHINA_ANDROID_KEY_ALIAS=androiddebugkey
    keytool -genkeypair -keystore "$MASHINA_ANDROID_KEYSTORE" -storetype PKCS12 \
        -storepass:env MASHINA_ANDROID_STORE_PASSWORD -alias "$MASHINA_ANDROID_KEY_ALIAS" \
        -dname 'CN=MASHINA Android Preview' -keyalg RSA -keysize 2048 -validity 3650
fi

mkdir -p "$work/res/drawable" "$work/classes" "$work/dex" dist/mobile
cp -R mobile/android/res/. "$work/res/"
cp frontend/public/icon-192.png "$work/res/drawable/app_icon.png"
"$tools/aapt2" compile --dir "$work/res" -o "$work/res.zip"
"$tools/aapt2" link -I "$platform" --manifest mobile/android/AndroidManifest.xml \
    --rename-manifest-package "$package" --min-sdk-version 26 --target-sdk-version 35 \
    --version-code "$build_number" --version-name "$version" --java "$work" \
    -o "$work/base.apk" "$work/res.zip"
javac --release 11 -encoding UTF-8 -classpath "$platform" -d "$work/classes" \
    mobile/android/src/MainActivity.java "$work/ru/mashina/mobile/R.java"
jar --create --file "$work/classes.jar" -C "$work/classes" .
"$tools/d8" --lib "$platform" --release --min-api 26 --output "$work/dex" "$work/classes.jar"
(cd "$work/dex" && zip -q "$work/base.apk" classes.dex)
"$tools/zipalign" -f -P 16 4 "$work/base.apk" "$work/aligned.apk"
"$tools/apksigner" sign --ks "$MASHINA_ANDROID_KEYSTORE" --ks-key-alias "$MASHINA_ANDROID_KEY_ALIAS" \
    --ks-pass env:MASHINA_ANDROID_STORE_PASSWORD --key-pass env:MASHINA_ANDROID_KEY_PASSWORD \
    --v4-signing-enabled false --out "$work/signed.apk" "$work/aligned.apk"
"$tools/apksigner" verify --verbose --print-certs "$work/signed.apk"
"$tools/aapt2" dump badging "$work/signed.apk" | tee "$work/badging"
grep -Fq "package: name='$package' versionCode='$build_number' versionName='$version'" "$work/badging"
grep -Fq "launchable-activity: name='ru.mashina.mobile.MainActivity'" "$work/badging"
mv "$work/signed.apk" "dist/mobile/$filename"
