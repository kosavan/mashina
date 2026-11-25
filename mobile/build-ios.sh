#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(python3 -c 'import tomllib; print(tomllib.load(open("pyproject.toml", "rb"))["project"]["version"])')
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
xcrun --sdk macosx swiftc mobile/ios/ServerAddress.swift mobile/tests/ServerAddressTest.swift \
    -o "$work/address-tests"
"$work/address-tests" mobile/tests/server-address.tsv
cp -R mobile/ios "$work/project"
sips -z 1024 1024 frontend/public/maskable-512.png \
    --out "$work/project/Assets.xcassets/AppIcon.appiconset/AppIcon.png" > /dev/null

xcodebuild -project "$work/project/MASHINA.xcodeproj" -target MASHINA \
    -configuration Release -sdk iphoneos ARCHS=arm64 ONLY_ACTIVE_ARCH=NO \
    CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO \
    MARKETING_VERSION="$version" CURRENT_PROJECT_VERSION="$version" \
    CONFIGURATION_BUILD_DIR="$work/products" build

app="$work/products/MASHINA.app"
test "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app/Info.plist")" = ru.mashina.mobile
test "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app/Info.plist")" = "$version"
test "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleSupportedPlatforms:0' "$app/Info.plist")" = iPhoneOS
test "$(lipo -archs "$app/MASHINA")" = arm64
xcrun vtool -show-build "$app/MASHINA" | grep -E 'platform[[:space:]]+IOS[[:space:]]*$'
if codesign -dv "$app" 2>/dev/null; then
    codesign --remove-signature "$app/MASHINA"
fi
test ! -e "$app/_CodeSignature"
test ! -e "$app/embedded.mobileprovision"
if codesign -dv "$app" 2>/dev/null; then
    echo 'Expected an unsigned iOS app.' >&2
    exit 1
fi

mkdir -p dist/mobile
mkdir "$work/Payload"
mv "$app" "$work/Payload/"
(cd "$work" && zip -q -r "$work/mashina.ipa" Payload)
unzip -tq "$work/mashina.ipa"
mv "$work/mashina.ipa" "dist/mobile/mashina-$version-ios-unsigned.ipa"
