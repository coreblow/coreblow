#!/usr/bin/env bash
# ==============================================================================
# CoreBlow macOS Standalone App & DMG Packaging Pipeline
# Sovereign Autonomous Agent-OS v2.1.1 GA
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MACOS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${MACOS_DIR}/../.." && pwd)"
DIST_DIR="${MACOS_DIR}/dist"
APP_NAME="CoreBlow"
BUNDLE_ID="ai.coreblow.studio"
VERSION="2.1.1"
DMG_NAME="CoreBlow-${VERSION}-arm64.dmg"
DMG_PATH="${DIST_DIR}/${DMG_NAME}"
APP_BUNDLE="${DIST_DIR}/${APP_NAME}.app"
BUILD_APP_BUNDLE="${MACOS_DIR}/.build/${APP_NAME}.app"
ENTITLEMENTS="${MACOS_DIR}/CoreBlow.entitlements"

echo "==> [1/6] Building CoreBlow product in release mode via Swift Package Manager..."
cd "${MACOS_DIR}"
swift build -c release --product CoreBlow

BUILD_DIR="${MACOS_DIR}/.build/arm64-apple-macosx/release"
BINARY="${BUILD_DIR}/CoreBlow"

if [ ! -f "${BINARY}" ]; then
  echo "Error: Compiled binary not found at ${BINARY}" >&2
  exit 1
fi

echo "==> [2/6] Generating Retina Icon.icns from sovereign brand assets..."
ICONSET_DIR="$(mktemp -d)/CoreBlow.iconset"
mkdir -p "${ICONSET_DIR}"

SOURCE_ICON="${REPO_ROOT}/../coreblow.com/frontend/public/dev/mascot-clean.png"
if [ ! -f "${SOURCE_ICON}" ]; then
  SOURCE_ICON="${REPO_ROOT}/../coreblow.com/public/dev/mascot-clean.png"
fi

if [ -f "${SOURCE_ICON}" ]; then
  sips -z 16 16     "${SOURCE_ICON}" --out "${ICONSET_DIR}/icon_16x16.png" >/dev/null
  sips -z 32 32     "${SOURCE_ICON}" --out "${ICONSET_DIR}/icon_16x16@2x.png" >/dev/null
  sips -z 32 32     "${SOURCE_ICON}" --out "${ICONSET_DIR}/icon_32x32.png" >/dev/null
  sips -z 64 64     "${SOURCE_ICON}" --out "${ICONSET_DIR}/icon_32x32@2x.png" >/dev/null
  sips -z 128 128   "${SOURCE_ICON}" --out "${ICONSET_DIR}/icon_128x128.png" >/dev/null
  sips -z 256 256   "${SOURCE_ICON}" --out "${ICONSET_DIR}/icon_128x128@2x.png" >/dev/null
  sips -z 256 256   "${SOURCE_ICON}" --out "${ICONSET_DIR}/icon_256x256.png" >/dev/null
  sips -z 512 512   "${SOURCE_ICON}" --out "${ICONSET_DIR}/icon_256x256@2x.png" >/dev/null
  sips -z 512 512   "${SOURCE_ICON}" --out "${ICONSET_DIR}/icon_512x512.png" >/dev/null
  sips -z 1024 1024 "${SOURCE_ICON}" --out "${ICONSET_DIR}/icon_512x512@2x.png" >/dev/null
  mkdir -p "${MACOS_DIR}/Resources"
  iconutil -c icns "${ICONSET_DIR}" -o "${MACOS_DIR}/Resources/Icon.icns"
  rm -rf "${ICONSET_DIR}"
  echo "Retina Icon.icns generated successfully at ${MACOS_DIR}/Resources/Icon.icns"
else
  echo "Warning: Source icon not found, skipping icon generation"
fi

echo "==> [3/6] Assembling standalone CoreBlow.app bundle..."
rm -rf "${APP_BUNDLE}"
mkdir -p "${APP_BUNDLE}/Contents/MacOS"
mkdir -p "${APP_BUNDLE}/Contents/Resources"
mkdir -p "${APP_BUNDLE}/Contents/Frameworks"

# Install executable
cp "${BINARY}" "${APP_BUNDLE}/Contents/MacOS/${APP_NAME}"
chmod +x "${APP_BUNDLE}/Contents/MacOS/${APP_NAME}"

# Ensure rpath points to Frameworks for Sparkle and runtime dylibs
if ! otool -l "${APP_BUNDLE}/Contents/MacOS/${APP_NAME}" | grep -q "@executable_path/../Frameworks"; then
  install_name_tool -add_rpath "@executable_path/../Frameworks" "${APP_BUNDLE}/Contents/MacOS/${APP_NAME}"
fi

# Install Frameworks
if [ -d "${BUILD_DIR}/Sparkle.framework" ]; then
  cp -R "${BUILD_DIR}/Sparkle.framework" "${APP_BUNDLE}/Contents/Frameworks/"
fi

# Install Resource Bundles
for bundle in "${BUILD_DIR}"/*.bundle; do
  if [ -d "${bundle}" ]; then
    cp -R "${bundle}" "${APP_BUNDLE}/Contents/Resources/"
  fi
done

# Install App Icon
if [ -f "${MACOS_DIR}/Resources/Icon.icns" ]; then
  cp "${MACOS_DIR}/Resources/Icon.icns" "${APP_BUNDLE}/Contents/Resources/Icon.icns"
  cp "${MACOS_DIR}/Resources/Icon.icns" "${APP_BUNDLE}/Contents/Resources/CoreBlow.icns"
fi

# Write PkgInfo
printf "APPL????" > "${APP_BUNDLE}/Contents/PkgInfo"

# Write Info.plist
cat << 'EOF' > "${APP_BUNDLE}/Contents/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleDisplayName</key>
    <string>CoreBlow</string>
    <key>CFBundleExecutable</key>
    <string>CoreBlow</string>
    <key>CFBundleIconFile</key>
    <string>Icon</string>
    <key>CFBundleIconName</key>
    <string>Icon</string>
    <key>CFBundleIdentifier</key>
    <string>ai.coreblow.studio</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>CoreBlow</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>2.1.1</string>
    <key>CFBundleVersion</key>
    <string>211</string>
    <key>LSMinimumSystemVersion</key>
    <string>15.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSMicrophoneUsageDescription</key>
    <string>CoreBlow requires microphone access for voice wake and push-to-talk audio streaming with Cory.</string>
    <key>NSSpeechRecognitionUsageDescription</key>
    <string>CoreBlow requires speech recognition to transcribe your voice instructions locally.</string>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
</dict>
</plist>
EOF

# Sync to .build/CoreBlow.app
mkdir -p "${BUILD_APP_BUNDLE}"
rsync -a --delete "${APP_BUNDLE}/" "${BUILD_APP_BUNDLE}/"

SIGNING_IDENTITY="${APPLE_DEVELOPER_CERTIFICATE:-}"
if [ -n "${SIGNING_IDENTITY}" ]; then
  echo "==> [4/6] Code signing bundle with Apple Developer Certificate (${SIGNING_IDENTITY})..."
  if [ -d "${APP_BUNDLE}/Contents/Frameworks/Sparkle.framework" ]; then
    codesign --force --options runtime --timestamp --sign "${SIGNING_IDENTITY}" "${APP_BUNDLE}/Contents/Frameworks/Sparkle.framework"
    codesign --force --options runtime --timestamp --sign "${SIGNING_IDENTITY}" "${BUILD_APP_BUNDLE}/Contents/Frameworks/Sparkle.framework"
  fi
  codesign --force --deep --options runtime --timestamp --entitlements "${ENTITLEMENTS}" --sign "${SIGNING_IDENTITY}" "${APP_BUNDLE}"
  codesign --force --deep --options runtime --timestamp --entitlements "${ENTITLEMENTS}" --sign "${SIGNING_IDENTITY}" "${BUILD_APP_BUNDLE}"
else
  echo "==> [4/6] Code signing bundle (ad-hoc with entitlements)..."
  if [ -d "${APP_BUNDLE}/Contents/Frameworks/Sparkle.framework" ]; then
    codesign --force --sign - --timestamp=none "${APP_BUNDLE}/Contents/Frameworks/Sparkle.framework"
    codesign --force --sign - --timestamp=none "${BUILD_APP_BUNDLE}/Contents/Frameworks/Sparkle.framework"
  fi
  codesign --force --deep --entitlements "${ENTITLEMENTS}" --sign - "${APP_BUNDLE}"
  codesign --force --deep --entitlements "${ENTITLEMENTS}" --sign - "${BUILD_APP_BUNDLE}"
fi

# Verify code signature
codesign -v --deep "${APP_BUNDLE}"
echo "Code signature verified for ${APP_BUNDLE}"

echo "==> [5/6] Registering with LaunchServices to prevent -600 errors..."
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "${APP_BUNDLE}"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "${BUILD_APP_BUNDLE}"

echo "==> [6/6] Packaging CoreBlow-${VERSION}-arm64.dmg with /Applications symlink..."
DMG_STAGING="$(mktemp -d)/dmg_staging"
mkdir -p "${DMG_STAGING}"
cp -R "${APP_BUNDLE}" "${DMG_STAGING}/${APP_NAME}.app"
ln -s /Applications "${DMG_STAGING}/Applications"

rm -f "${DMG_PATH}"
hdiutil create -volname "${APP_NAME}" -srcfolder "${DMG_STAGING}" -ov -format UDZO "${DMG_PATH}"
rm -rf "${DMG_STAGING}"

if [ -n "${APPLE_NOTARY_KEY:-}" ] || [ -n "${APPLE_ID:-}" ]; then
  echo "==> Submitting DMG for Apple Notarization..."
  if [ -n "${APPLE_NOTARY_KEY:-}" ]; then
    xcrun notarytool submit "${DMG_PATH}" --key "${APPLE_NOTARY_KEY}" --key-id "${APPLE_NOTARY_KEY_ID:-}" --issuer "${APPLE_NOTARY_ISSUER:-}" --wait || true
  elif [ -n "${APPLE_ID:-}" ]; then
    xcrun notarytool submit "${DMG_PATH}" --apple-id "${APPLE_ID}" --password "${APPLE_APP_SPECIFIC_PASSWORD:-}" --team-id "${APPLE_TEAM_ID:-}" --wait || true
  fi
  xcrun stapler staple "${DMG_PATH}" || true
fi

SHA256_SUM=$(shasum -a 256 "${DMG_PATH}" | awk '{print $1}')
echo "${SHA256_SUM}  ${DMG_NAME}" > "${DIST_DIR}/${DMG_NAME}.sha256"

echo ""
echo "=============================================================================="
echo "CoreBlow v2.1.1 macOS Packaging Complete!"
echo "  - Application: ${APP_BUNDLE}"
echo "  - Disk Image:  ${DMG_PATH}"
echo "  - SHA-256:     ${SHA256_SUM}"
echo "=============================================================================="
