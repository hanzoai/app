#!/usr/bin/env node

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Master SVG source - the official hanzo blocky logo
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

// Icon configuration for desktop apps
const ICON_CONFIGS = {
  tauri: {
    // Tauri icon sizes
    'icon.png': { size: 1024, padding: 0.2, roundedCorners: true, cornerRadius: 0.18 },
    'app-icon.png': { size: 1024, padding: 0.2, roundedCorners: true, cornerRadius: 0.18 },
    '32x32.png': { size: 32, padding: 0.15, roundedCorners: true, cornerRadius: 0.1 },
    '128x128.png': { size: 128, padding: 0.15, roundedCorners: true, cornerRadius: 0.1 },
    '128x128@2x.png': { size: 256, padding: 0.15, roundedCorners: true, cornerRadius: 0.1 },
    
    // Windows icons
    'Square30x30Logo.png': { size: 30, padding: 0.15, roundedCorners: false },
    'Square44x44Logo.png': { size: 44, padding: 0.15, roundedCorners: false },
    'Square71x71Logo.png': { size: 71, padding: 0.15, roundedCorners: false },
    'Square89x89Logo.png': { size: 89, padding: 0.15, roundedCorners: false },
    'Square107x107Logo.png': { size: 107, padding: 0.15, roundedCorners: false },
    'Square142x142Logo.png': { size: 142, padding: 0.15, roundedCorners: false },
    'Square150x150Logo.png': { size: 150, padding: 0.15, roundedCorners: false },
    'Square284x284Logo.png': { size: 284, padding: 0.15, roundedCorners: false },
    'Square310x310Logo.png': { size: 310, padding: 0.15, roundedCorners: false },
    'StoreLogo.png': { size: 50, padding: 0.15, roundedCorners: false },
    
    // Tray icons (transparent background)
    'tray-icon-macos.png': { size: 22, padding: 0, roundedCorners: false, tray: true },
    'tray-icon-macos@2x.png': { size: 44, padding: 0, roundedCorners: false, tray: true },
  },
  electron: {
    // Electron icon sizes
    'icon.png': { size: 1024, padding: 0.2, roundedCorners: true, cornerRadius: 0.18 },
    'icon@2x.png': { size: 2048, padding: 0.2, roundedCorners: true, cornerRadius: 0.18 },
    'icon-16.png': { size: 16, padding: 0.1, roundedCorners: false },
    'icon-32.png': { size: 32, padding: 0.1, roundedCorners: false },
    'icon-64.png': { size: 64, padding: 0.15, roundedCorners: true, cornerRadius: 0.1 },
    'icon-128.png': { size: 128, padding: 0.15, roundedCorners: true, cornerRadius: 0.1 },
    'icon-256.png': { size: 256, padding: 0.15, roundedCorners: true, cornerRadius: 0.1 },
    'icon-512.png': { size: 512, padding: 0.15, roundedCorners: true, cornerRadius: 0.1 },
  }
};

// Create rounded rectangle mask for macOS-style icons
function createRoundedRectSVG(size, cornerRadius) {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${size}" height="${size}" rx="${cornerRadius}" ry="${cornerRadius}" fill="white"/>
  </svg>`;
}

async function generateIcon(outputPath, config, logoSvg = LOGO_SVG) {
  const { size, padding, roundedCorners, cornerRadius, tray } = config;
  
  // Use tray logo for tray icons
  const svgSource = tray ? TRAY_LOGO_SVG : logoSvg;
  
  // Calculate dimensions
  const paddingPx = Math.round(size * padding);
  const logoSize = size - paddingPx * 2;
  
  // Generate logo buffer
  const logoBuffer = await sharp(Buffer.from(svgSource))
    .resize(logoSize, logoSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  
  if (tray) {
    // Tray icons need transparent background
    await sharp(Buffer.from(svgSource))
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(outputPath);
  } else {
    // Regular icons with black background
    const iconWithBackground = await sharp({
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
          top: paddingPx,
          left: paddingPx,
        },
      ])
      .png()
      .toBuffer();
    
    if (roundedCorners && cornerRadius) {
      // Apply rounded corners
      const radius = Math.round(size * cornerRadius);
      const roundedMask = Buffer.from(createRoundedRectSVG(size, radius));
      
      await sharp(iconWithBackground)
        .composite([
          {
            input: roundedMask,
            blend: 'dest-in',
          },
        ])
        .png()
        .toFile(outputPath);
    } else {
      await sharp(iconWithBackground)
        .png()
        .toFile(outputPath);
    }
  }
}

export async function generateDesktopIcons(platform = 'tauri', outputDir, customLogoSvg) {
  const configs = ICON_CONFIGS[platform];
  if (!configs) {
    throw new Error(`Unknown platform: ${platform}. Supported: ${Object.keys(ICON_CONFIGS).join(', ')}`);
  }
  
  const logoSvg = customLogoSvg || LOGO_SVG;
  
  console.log(`🎨 Generating ${platform} icons for hanzo desktop...`);
  
  // Create output directory
  await fs.mkdir(outputDir, { recursive: true });
  
  // Save master SVG
  await fs.writeFile(path.join(outputDir, 'hanzo-logo.svg'), logoSvg);
  console.log('✅ Saved master hanzo logo SVG');
  
  // Generate all icons
  for (const [filename, config] of Object.entries(configs)) {
    const outputPath = path.join(outputDir, filename);
    await generateIcon(outputPath, config, logoSvg);
    console.log(`✅ Generated ${filename} (${config.size}x${config.size})`);
  }
  
  // Generate ICO file for Windows
  if (platform === 'tauri') {
    const icoPath = path.join(outputDir, 'icon.ico');
    const icoConfig = { size: 256, padding: 0.15, roundedCorners: false };
    await generateIcon(icoPath, icoConfig, logoSvg);
    console.log('✅ Generated icon.ico');
  }
  
  // Create ICNS generation script for macOS
  if (platform === 'tauri') {
    const icnsScript = `#!/bin/bash

# Generate ICNS file for macOS
# Requires iconutil (comes with Xcode)

ICON_DIR="${outputDir}"
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
    
    const scriptPath = path.join(outputDir, 'generate-icns.sh');
    await fs.writeFile(scriptPath, icnsScript);
    await fs.chmod(scriptPath, 0o755);
    console.log('✅ Created generate-icns.sh script');
  }
  
  console.log('\n🎉 hanzo icon generation complete!');
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const platform = args[0] || 'tauri';
  const outputDir = args[1] || path.resolve(process.cwd(), 'icons');
  
  generateDesktopIcons(platform, outputDir)
    .catch(error => {
      console.error('❌ Error generating icons:', error);
      process.exit(1);
    });
}