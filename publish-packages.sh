#!/bin/bash

# Publish all @hanzo-app packages to npm
# Usage: ./publish-packages.sh <OTP>

OTP=$1

if [ -z "$OTP" ]; then
    echo "Usage: ./publish-packages.sh <OTP>"
    echo "Please provide your npm OTP code from your authenticator"
    exit 1
fi

echo "Publishing @hanzo-app packages with OTP: $OTP"
echo "========================================="

PACKAGES=(
    "hanzo-artifacts"
    "hanzo-brand"
    "hanzo-i18n"
    "hanzo-message-ts"
    "hanzo-node-state"
    "hanzo-ui"
)

PACKAGE_NAMES=(
    "@hanzo-app/artifacts"
    "@hanzo-app/brand"
    "@hanzo-app/i18n"
    "@hanzo-app/message-ts"
    "@hanzo-app/node-state"
    "@hanzo-app/ui"
)

i=0
for pkg in "${PACKAGES[@]}"; do
    echo ""
    echo "Publishing ${PACKAGE_NAMES[$i]}..."
    echo "------------------------"
    cd "libs/$pkg"
    npm publish --access public --otp="$OTP"
    if [ $? -eq 0 ]; then
        echo "✅ Successfully published ${PACKAGE_NAMES[$i]}"
    else
        echo "❌ Failed to publish ${PACKAGE_NAMES[$i]}"
    fi
    cd ../..
    ((i++))
done

echo ""
echo "========================================="
echo "Publishing complete!"
echo ""
echo "Published packages:"
i=0
for pkg in "${PACKAGES[@]}"; do
    VERSION=$(grep '"version"' "libs/$pkg/package.json" | cut -d'"' -f4)
    echo "  ${PACKAGE_NAMES[$i]}@$VERSION"
    ((i++))
done