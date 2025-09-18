#!/bin/bash

# Script to update all imports to use correct organization names
# @hanzo for general packages
# @hanzonet for blockchain/wallet packages

set -e

echo "📦 Updating imports to use @hanzo and @hanzonet organizations"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Step 1: Updating general packages to @hanzo...${NC}"

# Update general packages to @hanzo
find apps/hanzo-desktop/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i.bak \
    -e "s/@hanzo_network\/hanzo-i18n/@hanzo\/i18n/g" \
    -e "s/@hanzo_network\/hanzo-ui/@hanzo\/ui/g" \
    -e "s/@hanzo_network\/hanzo-artifacts/@hanzo\/artifacts/g" \
    -e "s/@hanzo_network\/hanzo-brand/@hanzo\/brand/g" \
    -e "s/@hanzo_network\/hanzo-node-state/@hanzo\/node/g" \
    -e "s/@hanzo_network\/hanzo-message-ts/@hanzo\/message/g" \
    {} +

echo -e "${GREEN}✓ General packages updated to @hanzo${NC}"

echo -e "${BLUE}Step 2: Updating wallet/blockchain packages to @hanzonet...${NC}"

# Update wallet-specific imports to @hanzonet
find apps/hanzo-desktop/src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i.bak \
    -e "s/@hanzo\/.*wallet.*/@hanzonet\/wallet/g" \
    -e "s/from '@hanzonet\/hanzo-node-state\/v2\/queries\/getWalletList/from '@hanzonet\/wallet-hooks/g" \
    -e "s/from '@hanzonet\/hanzo-node-state\/v2\/queries\/getWalletBalance/from '@hanzonet\/wallet-hooks/g" \
    -e "s/from '@hanzonet\/hanzo-node-state\/v2\/mutations\/createLocalWallet/from '@hanzonet\/wallet-hooks/g" \
    -e "s/from '@hanzonet\/hanzo-node-state\/v2\/mutations\/restoreLocalWallet/from '@hanzonet\/wallet-hooks/g" \
    -e "s/from '@hanzonet\/hanzo-message-ts\/api\/wallets/from '@hanzonet\/wallets/g" \
    {} +

echo -e "${GREEN}✓ Wallet packages updated to @hanzonet${NC}"

echo -e "${BLUE}Step 3: Cleaning up backup files...${NC}"

# Clean up backup files
find apps/hanzo-desktop/src -name "*.bak" -delete

echo -e "${GREEN}✓ Backup files cleaned${NC}"

echo ""
echo -e "${GREEN}✅ Import update complete!${NC}"
echo ""
echo "Summary of changes:"
echo "=================="
echo "@hanzo/node         - Core node state and API"
echo "@hanzo/message      - Message types and protocols"
echo "@hanzo/ui           - UI components"
echo "@hanzo/i18n         - Internationalization"
echo "@hanzo/artifacts    - Build artifacts"
echo "@hanzo/brand        - Brand assets"
echo ""
echo "@hanzonet/wallet-hooks - Wallet React hooks"
echo "@hanzonet/wallets      - Wallet types and interfaces"