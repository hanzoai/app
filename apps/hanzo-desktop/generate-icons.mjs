#!/usr/bin/env node

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Master SVG source (white Hanzo logo on transparent, will add background)
const LOGO_SVG = `<svg viewBox="0 0 67 67" xmlns="http://www.w3.org/2000/svg">
  <path d="M22.21 67V44.6369H0V67H22.21Z" fill="#ffffff"/>
  <path d="M0 44.6369L22.21 46.8285V44.6369H0Z" fill="#DDDDDD"/>
  <path d="M66.7038 22.3184H22.2534L0.0878906 44.6367H44.4634L66.7038 22.3184Z" fill="#ffffff"/>
  <path d="M22.21 0H0V22.3184H22.21V0Z" fill="#ffffff"/>
  <path d="M66.7198 0H44.5098V22.3184H66.7198V0Z" fill="#ffffff"/>
  <path d="M66.6753 22.3185L44.5098 20.0822V22.3185H66.6753Z" fill="#DDDDDD"/>
  <path d="M66.7198 67V44.6369H44.5098V67H66.7198Z" fill="#ffffff"/>
</svg>`;

// Tray icon SVG source (black for macOS template images)
const TRAY_LOGO_SVG = `<svg viewBox="0 0 67 67" xmlns="http://www.w3.org/2000/svg">
  <path d="M22.21 67V44.6369H0V67H22.21Z" fill="#000000"/>
  <path d="M0 44.6369L22.21 46.8285V44.6369H0Z" fill="#333333"/>
  <path d="M66.7038 22.3184H22.2534L0.0878906 44.6367H44.4634L66.7038 22.3184Z" fill="#000000"/>
  <path d="M22.21 0H0V22.3184H22.21V0Z" fill="#000000"/>
  <path d="M66.7198 0H44.5098V22.3184H66.7198V0Z" fill="#000000"/>
  <path d="M66.6753 22.3185L44.5098 20.0822V22.3185H66.6753Z" fill="#333333"/>
  <path d="M66.7198 67V44.6369H44.5098V67H66.7198Z" fill="#000000"/>
</svg>`;

// Icon sizes needed for different platforms
const ICON_SIZES = {
  // macOS/iOS icons (will have rounded corners)
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
};

// Tray icon sizes (special handling - no background)
const TRAY_SIZES = {
  'tray-icon-macos.png': 22, // macOS tray icon standard size (menu bar height)
  'tray-icon-macos@2x.png': 44, // macOS tray icon retina (2x menu bar height)
  'tray-icon.png': 32,
};

// Create rounded rectangle mask for macOS icons
function createRoundedRectSVG(size, cornerRadius) {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${size}" height="${size}" rx="${cornerRadius}" ry="${cornerRadius}" fill="white"/>
  </svg>`;
}

async function generateIcons() {
  try {
    console.log('🎨 Generating icons from Hanzo logo SVG');

    // Output directory
    const outputDir = path.resolve(__dirname, 'src-tauri/icons');
    await fs.mkdir(outputDir, { recursive: true });

    // Save master SVG files
    await fs.writeFile(path.join(outputDir, 'hanzo-logo.svg'), LOGO_SVG);
    console.log('✅ Saved master SVG file');

    // Generate main app icons with rounded corners and black background
    for (const [filename, size] of Object.entries(ICON_SIZES)) {
      const outputPath = path.join(outputDir, filename);

      // Calculate padding (about 20% of the icon size for good spacing)
      const padding = Math.round(size * 0.2);
      const logoSize = size - padding * 2;

      // For main app icons, create rounded corner version
      if (filename === 'icon.png' || filename === 'app-icon.png') {
        // Create a rounded rectangle mask
        const cornerRadius = Math.round(size * 0.18); // 18% radius like macOS icons

        // First, resize the logo
        const logoBuffer = await sharp(Buffer.from(LOGO_SVG))
          .resize(logoSize, logoSize, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer();

        // Create black background with logo composited on top
        const iconWithLogo = await sharp({
          create: {
            width: size,
            height: size,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 1 },
          },
        })
          .composite([
            {
              input: logoBuffer,
              top: padding,
              left: padding,
            },
          ])
          .png()
          .toBuffer();

        // Apply rounded corners mask
        const roundedMask = Buffer.from(
          createRoundedRectSVG(size, cornerRadius),
        );

        await sharp(iconWithLogo)
          .composite([
            {
              input: roundedMask,
              blend: 'dest-in',
            },
          ])
          .png()
          .toFile(outputPath);
      } else if (filename.includes('Square')) {
        // Windows Square logos - no rounded corners but with padding
        const winPadding = Math.round(size * 0.15);
        const winLogoSize = size - winPadding * 2;

        const logoBuffer = await sharp(Buffer.from(LOGO_SVG))
          .resize(winLogoSize, winLogoSize, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer();

        await sharp({
          create: {
            width: size,
            height: size,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 1 },
          },
        })
          .composite([
            {
              input: logoBuffer,
              top: winPadding,
              left: winPadding,
            },
          ])
          .png()
          .toFile(outputPath);
      } else {
        // Other icons with padding but smaller corner radius
        const otherPadding = Math.round(size * 0.15);
        const otherLogoSize = size - otherPadding * 2;
        const cornerRadius = Math.round(size * 0.1);

        const logoBuffer = await sharp(Buffer.from(LOGO_SVG))
          .resize(otherLogoSize, otherLogoSize, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png()
          .toBuffer();

        const iconWithLogo = await sharp({
          create: {
            width: size,
            height: size,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 1 },
          },
        })
          .composite([
            {
              input: logoBuffer,
              top: otherPadding,
              left: otherPadding,
            },
          ])
          .png()
          .toBuffer();

        const roundedMask = Buffer.from(
          createRoundedRectSVG(size, cornerRadius),
        );

        await sharp(iconWithLogo)
          .composite([
            {
              input: roundedMask,
              blend: 'dest-in',
            },
          ])
          .png()
          .toFile(outputPath);
      }

      console.log(`✅ Generated ${filename} (${size}x${size})`);
    }

    // Generate tray icons with transparent background (no rounded corners)
    // Using black SVG for proper macOS template image support
    for (const [filename, size] of Object.entries(TRAY_SIZES)) {
      const outputPath = path.join(outputDir, filename);

      await sharp(Buffer.from(TRAY_LOGO_SVG))
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
        })
        .png()
        .toFile(outputPath);

      console.log(
        `✅ Generated ${filename} (${size}x${size}) - Tray icon (template)`,
      );
    }

    // Generate ICO file for Windows (with padding, no rounded corners)
    const icoPath = path.join(outputDir, 'icon.ico');
    const icoSize = 256;
    const icoPadding = Math.round(icoSize * 0.15);
    const icoLogoSize = icoSize - icoPadding * 2;

    const icoLogoBuffer = await sharp(Buffer.from(LOGO_SVG))
      .resize(icoLogoSize, icoLogoSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: icoSize,
        height: icoSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    })
      .composite([
        {
          input: icoLogoBuffer,
          top: icoPadding,
          left: icoPadding,
        },
      ])
      .png()
      .toFile(icoPath);

    console.log('✅ Generated icon.ico');

    // Generate ICNS for macOS (requires additional tooling)
    console.log(
      '⚠️  Note: icon.icns needs to be generated using macOS iconutil',
    );
    console.log('   Run: ./generate-icns.sh');

    // Copy logo SVG to public directory
    const publicDir = path.resolve(__dirname, 'public');
    await fs.mkdir(publicDir, { recursive: true });
    await fs.writeFile(path.join(publicDir, 'hanzo-logo.svg'), LOGO_SVG);
    await fs.writeFile(path.join(publicDir, 'logo.svg'), LOGO_SVG);
    console.log('✅ Copied logo SVGs to public directory');

    // Update Logo component
    await updateLogoComponent();

    console.log('\n🎉 Icon generation complete!');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

async function updateLogoComponent() {
  // Update Logo component to use the master SVG
  const logoComponentPath = path.resolve(__dirname, 'src/components/Logo.tsx');

  try {
    await fs.mkdir(path.dirname(logoComponentPath), { recursive: true });

    const logoComponent = `import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <img 
      src="/hanzo-logo.svg" 
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
    console.log('⚠️  Logo component not updated:', error.message);
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

# Use sips to generate required sizes for iconset
sips -z 16 16 "$ICON_DIR/icon.png" --out "$ICONSET_DIR/icon_16x16.png"
sips -z 32 32 "$ICON_DIR/icon.png" --out "$ICONSET_DIR/icon_16x16@2x.png"
sips -z 32 32 "$ICON_DIR/icon.png" --out "$ICONSET_DIR/icon_32x32.png"
sips -z 64 64 "$ICON_DIR/icon.png" --out "$ICONSET_DIR/icon_32x32@2x.png"
sips -z 128 128 "$ICON_DIR/icon.png" --out "$ICONSET_DIR/icon_128x128.png"
sips -z 256 256 "$ICON_DIR/icon.png" --out "$ICONSET_DIR/icon_128x128@2x.png"
sips -z 256 256 "$ICON_DIR/icon.png" --out "$ICONSET_DIR/icon_256x256.png"
sips -z 512 512 "$ICON_DIR/icon.png" --out "$ICONSET_DIR/icon_256x256@2x.png"
sips -z 512 512 "$ICON_DIR/icon.png" --out "$ICONSET_DIR/icon_512x512.png"
sips -z 1024 1024 "$ICON_DIR/icon.png" --out "$ICONSET_DIR/icon_512x512@2x.png"

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
