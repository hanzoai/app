#!/usr/bin/env node

const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

// Icon sizes needed for different platforms
const ICON_SIZES = {
  // macOS/iOS icons
  'icon.png': 1024,
  'app-icon.png': 1024,
  '32x32.png': 32,
  '128x128.png': 128,
  '128x128@2x.png': 256,

  // Windows icons
  'Square30x30Logo.png': 30,
  'Square44x44Logo.png': 44,
  'Square71x71Logo.png': 71,
  'Square89x89Logo.png': 89,
  'Square107x107Logo.png': 107,
  'Square142x142Logo.png': 142,
  'Square150x150Logo.png': 150,
  'Square284x284Logo.png': 284,
  'Square310x310Logo.png': 310,
  'StoreLogo.png': 50,

  // Tray icons
  'tray-icon-macos.png': 22,
  'tray-icon.png': 32,
};

async function generateIcons() {
  try {
    // Read brand config
    const brandConfig = JSON.parse(
      await fs.readFile('brand.config.json', 'utf8'),
    );
    const { logo } = brandConfig.brand;

    // Read the master SVG
    const svgPath = path.resolve(logo.svg);
    const svgContent = await fs.readFile(svgPath, 'utf8');

    console.log('🎨 Generating icons from:', svgPath);

    // Output directory
    const outputDir = path.resolve('src-tauri/icons');
    await fs.mkdir(outputDir, { recursive: true });

    // Generate each PNG icon
    for (const [filename, size] of Object.entries(ICON_SIZES)) {
      const outputPath = path.join(outputDir, filename);

      await sharp(Buffer.from(svgContent))
        .resize(size, size, {
          fit: 'contain',
          background: logo.backgroundColor,
        })
        .png()
        .toFile(outputPath);

      console.log(`✅ Generated ${filename} (${size}x${size})`);
    }

    // Generate ICO file for Windows
    const icoPath = path.join(outputDir, 'icon.ico');
    await sharp(Buffer.from(svgContent))
      .resize(256, 256, {
        fit: 'contain',
        background: logo.backgroundColor,
      })
      .toFile(icoPath);
    console.log('✅ Generated icon.ico');

    // Generate ICNS for macOS (requires additional tooling)
    console.log(
      '⚠️  Note: icon.icns needs to be generated using macOS iconutil',
    );
    console.log('   Run: npm run generate-icns');

    // Copy master SVG to public directory
    const publicDir = path.resolve('public');
    await fs.mkdir(publicDir, { recursive: true });
    await fs.copyFile(svgPath, path.join(publicDir, 'logo.svg'));
    console.log('✅ Copied logo.svg to public directory');

    // Update all SVG references in the app
    await updateSvgReferences();

    console.log('\n🎉 Icon generation complete!');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

async function updateSvgReferences() {
  // Update Logo component to use the master SVG
  const logoComponentPath = path.resolve('src/components/Logo.tsx');

  try {
    const logoComponent = `import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <img 
      src="/logo.svg" 
      alt="Hanzo AI" 
      className={className}
    />
  );
};

export default Logo;
`;

    await fs.writeFile(logoComponentPath, logoComponent);
    console.log('✅ Updated Logo component');
  } catch (error) {
    console.log('⚠️  Logo component not updated (may not exist yet)');
  }
}

// Script to generate ICNS (macOS specific)
async function generateIcnsScript() {
  const script = `#!/bin/bash

# Generate ICNS file for macOS
# Requires iconutil (comes with Xcode)

ICON_DIR="src-tauri/icons"
ICONSET_DIR="$ICON_DIR/icon.iconset"

# Create iconset directory
mkdir -p "$ICONSET_DIR"

# Generate required sizes for iconset
npx sharp-cli -i "$ICON_DIR/hanzo-logo.svg" -o "$ICONSET_DIR/icon_16x16.png" resize 16
npx sharp-cli -i "$ICON_DIR/hanzo-logo.svg" -o "$ICONSET_DIR/icon_16x16@2x.png" resize 32
npx sharp-cli -i "$ICON_DIR/hanzo-logo.svg" -o "$ICONSET_DIR/icon_32x32.png" resize 32
npx sharp-cli -i "$ICON_DIR/hanzo-logo.svg" -o "$ICONSET_DIR/icon_32x32@2x.png" resize 64
npx sharp-cli -i "$ICON_DIR/hanzo-logo.svg" -o "$ICONSET_DIR/icon_128x128.png" resize 128
npx sharp-cli -i "$ICON_DIR/hanzo-logo.svg" -o "$ICONSET_DIR/icon_128x128@2x.png" resize 256
npx sharp-cli -i "$ICON_DIR/hanzo-logo.svg" -o "$ICONSET_DIR/icon_256x256.png" resize 256
npx sharp-cli -i "$ICON_DIR/hanzo-logo.svg" -o "$ICONSET_DIR/icon_256x256@2x.png" resize 512
npx sharp-cli -i "$ICON_DIR/hanzo-logo.svg" -o "$ICONSET_DIR/icon_512x512.png" resize 512
npx sharp-cli -i "$ICON_DIR/hanzo-logo.svg" -o "$ICONSET_DIR/icon_512x512@2x.png" resize 1024

# Convert to ICNS
iconutil -c icns "$ICONSET_DIR" -o "$ICON_DIR/icon.icns"

# Clean up
rm -rf "$ICONSET_DIR"

echo "✅ Generated icon.icns"
`;

  await fs.writeFile('generate-icns.sh', script);
  await fs.chmod('generate-icns.sh', 0o755);
  console.log('✅ Created generate-icns.sh script');
}

// Run the generation
generateIcons().then(() => generateIcnsScript());
