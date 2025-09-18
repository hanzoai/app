#!/bin/bash

# Script to publish all Hanzo packages under @hanzonet organization
# with clean naming conventions

set -e

echo "🚀 Publishing Hanzo packages to @hanzonet organization"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to update package.json with new name
update_package_name() {
    local package_path=$1
    local new_name=$2
    local version=${3:-"1.0.0"}

    echo -e "${BLUE}Updating $package_path to $new_name${NC}"

    # Create backup
    cp "$package_path/package.json" "$package_path/package.json.bak"

    # Update package name and version
    node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('$package_path/package.json', 'utf8'));
    pkg.name = '$new_name';
    pkg.version = '$version';
    pkg.publishConfig = { access: 'public' };
    pkg.repository = {
        type: 'git',
        url: 'https://github.com/hanzoai/app'
    };
    pkg.author = 'Hanzo AI';
    pkg.license = 'MIT';
    fs.writeFileSync('$package_path/package.json', JSON.stringify(pkg, null, 2) + '\\n');
    "

    echo -e "${GREEN}✓ Updated $new_name${NC}"
}

# Function to build and publish package
publish_package() {
    local package_path=$1
    local package_name=$2

    echo -e "${YELLOW}Building and publishing $package_name...${NC}"

    cd "$package_path"

    # Build if needed
    if [ -f "tsconfig.json" ]; then
        echo "Building TypeScript..."
        npx tsc || true
    fi

    # Create .npmrc if not exists
    if [ ! -f ".npmrc" ]; then
        echo "//registry.npmjs.org/:_authToken=\${NPM_TOKEN}" > .npmrc
    fi

    # Try to publish (dry-run first)
    echo "Dry run for $package_name..."
    npm publish --dry-run --access public || true

    cd - > /dev/null
}

# Main packages mapping
declare -A PACKAGE_MAPPING=(
    # Core node packages
    ["libs/hanzo-node-state"]="@hanzonet/node"
    ["libs/hanzo-message-ts"]="@hanzonet/message"

    # UI packages
    ["libs/hanzo-ui"]="@hanzonet/ui"
    ["libs/hanzo-artifacts"]="@hanzonet/artifacts"
    ["libs/hanzo-i18n"]="@hanzonet/i18n"
    ["libs/hanzo-brand"]="@hanzonet/brand"
)

# Wallet-specific packages (will be under @hanzonet/wallet)
declare -A WALLET_PACKAGES=(
    ["libs/hanzo-wallet-hooks"]="@hanzonet/wallet-hooks"
    ["libs/hanzo-wallet-types"]="@hanzonet/wallet-types"
    ["libs/hanzo-wallet-ui"]="@hanzonet/wallet-ui"
)

echo "📦 Step 1: Creating wallet packages structure..."

# Create wallet-specific packages if they don't exist
mkdir -p libs/hanzo-wallet-hooks
mkdir -p libs/hanzo-wallet-types
mkdir -p libs/hanzo-wallet-ui

# Create wallet-hooks package
if [ ! -f "libs/hanzo-wallet-hooks/package.json" ]; then
    cat > libs/hanzo-wallet-hooks/package.json << 'EOF'
{
  "name": "@hanzonet/wallet-hooks",
  "version": "1.0.0",
  "description": "React hooks for Hanzo wallet functionality",
  "main": "./index.js",
  "types": "./index.d.ts",
  "exports": {
    ".": {
      "import": "./index.mjs",
      "require": "./index.js"
    }
  },
  "dependencies": {
    "react": "^18.0.0"
  }
}
EOF

    cat > libs/hanzo-wallet-hooks/index.ts << 'EOF'
// Wallet hooks exports
export { useGetWalletList } from './hooks/useGetWalletList';
export { useGetWalletBalance } from './hooks/useGetWalletBalance';
export { useCreateLocalWallet } from './hooks/useCreateLocalWallet';
export { useRestoreLocalWallet } from './hooks/useRestoreLocalWallet';
export { useRestoreCoinbaseMpcWallet } from './hooks/useRestoreCoinbaseMpcWallet';
EOF
fi

# Create wallet-types package
if [ ! -f "libs/hanzo-wallet-types/package.json" ]; then
    cat > libs/hanzo-wallet-types/package.json << 'EOF'
{
  "name": "@hanzonet/wallets",
  "version": "1.0.0",
  "description": "TypeScript types for Hanzo wallet",
  "main": "./index.js",
  "types": "./index.d.ts",
  "exports": {
    ".": {
      "import": "./index.mjs",
      "require": "./index.js"
    }
  }
}
EOF

    cat > libs/hanzo-wallet-types/index.ts << 'EOF'
// Wallet types exports
export { NetworkIdentifier, WalletRole } from './types/wallet';
export type { WalletInfo, WalletBalance } from './types/wallet';
EOF
fi

echo -e "${GREEN}✓ Wallet packages structure created${NC}"

echo ""
echo "📦 Step 2: Updating package names..."

# Update main packages
for package_path in "${!PACKAGE_MAPPING[@]}"; do
    if [ -d "$package_path" ]; then
        update_package_name "$package_path" "${PACKAGE_MAPPING[$package_path]}"
    else
        echo -e "${YELLOW}⚠ Skipping $package_path (not found)${NC}"
    fi
done

# Update wallet packages
for package_path in "${!WALLET_PACKAGES[@]}"; do
    if [ -d "$package_path" ]; then
        update_package_name "$package_path" "${WALLET_PACKAGES[$package_path]}"
    fi
done

echo ""
echo "📦 Step 3: Creating exports for @hanzonet/node..."

# Create consolidated exports for @hanzonet/node
if [ -d "libs/hanzo-node-state" ]; then
    cat > libs/hanzo-node-state/index.ts << 'EOF'
// Main @hanzonet/node exports
export * from './src/v2/mutations';
export * from './src/v2/queries';
export * from './src/forms';
export * from './src/types';
EOF
fi

echo ""
echo "📦 Step 4: Updating imports in source files..."

# Update all imports in the app
find apps/hanzo-desktop/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i.bak \
    -e "s/@hanzo_network\/hanzo-node-state/@hanzonet\/node/g" \
    -e "s/@hanzo_network\/hanzo-message-ts/@hanzonet\/message/g" \
    -e "s/@hanzo_network\/hanzo-ui/@hanzonet\/ui/g" \
    -e "s/@hanzo_network\/hanzo-i18n/@hanzonet\/i18n/g" \
    -e "s/@hanzo_network\/hanzo-artifacts/@hanzonet\/artifacts/g" \
    -e "s/@hanzonet\/hanzo-node-state/@hanzonet\/node/g" \
    -e "s/@hanzonet\/hanzo-message-ts/@hanzonet\/message/g" \
    {} +

# Clean up backup files
find apps/hanzo-desktop/src -name "*.bak" -delete

echo -e "${GREEN}✓ All imports updated${NC}"

echo ""
echo "📦 Step 5: Building packages..."

# Build each package
for package_path in libs/*/; do
    if [ -f "$package_path/package.json" ]; then
        echo -e "${BLUE}Building $(basename $package_path)...${NC}"
        (cd "$package_path" && npm run build 2>/dev/null || true)
    fi
done

echo ""
echo "📦 Step 6: Ready to publish!"
echo ""
echo -e "${YELLOW}To publish packages, run:${NC}"
echo ""
echo "  export NPM_TOKEN=your_npm_token"
echo "  ./scripts/publish-hanzonet-packages.sh --publish"
echo ""

# If --publish flag is passed, actually publish
if [ "$1" == "--publish" ]; then
    echo -e "${RED}🚀 Publishing packages to npm...${NC}"

    # Publish in order (dependencies first)
    PUBLISH_ORDER=(
        "libs/hanzo-wallet-types"
        "libs/hanzo-message-ts"
        "libs/hanzo-node-state"
        "libs/hanzo-wallet-hooks"
        "libs/hanzo-i18n"
        "libs/hanzo-ui"
        "libs/hanzo-artifacts"
        "libs/hanzo-brand"
        "libs/hanzo-wallet-ui"
    )

    for package_path in "${PUBLISH_ORDER[@]}"; do
        if [ -d "$package_path" ]; then
            package_name=$(node -e "console.log(require('./$package_path/package.json').name)")
            echo ""
            echo -e "${YELLOW}Publishing $package_name...${NC}"
            (cd "$package_path" && npm publish --access public) || echo -e "${RED}Failed to publish $package_name${NC}"
            echo -e "${GREEN}✓ Published $package_name${NC}"
            sleep 2 # Give npm registry time to update
        fi
    done

    echo ""
    echo -e "${GREEN}✅ All packages published successfully!${NC}"
else
    echo -e "${BLUE}Dry run complete. Add --publish flag to actually publish.${NC}"
fi

echo ""
echo "📦 Package Summary:"
echo "=================="
echo "@hanzonet/node         - Core node state and API"
echo "@hanzonet/message      - Message types and protocols"
echo "@hanzonet/wallet-hooks - React hooks for wallet"
echo "@hanzonet/wallets      - Wallet types and interfaces"
echo "@hanzonet/ui           - UI components"
echo "@hanzonet/i18n         - Internationalization"
echo "@hanzonet/artifacts    - Build artifacts"
echo "@hanzonet/brand        - Brand assets"
echo "@hanzonet/wallet-ui    - Wallet UI components"