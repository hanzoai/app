#!/usr/bin/env python3
"""
Hanzo Icon Generator
Generates all required icons for Hanzo app in various sizes and formats
"""

import os
import subprocess
from pathlib import Path
import json

# SVG Template for Hanzo Icon - Clean, modern design
HANZO_SVG = """<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="1024" height="1024" rx="256" fill="url(#gradient)"/>
  
  <!-- Hanzo "H" Logo -->
  <g transform="translate(512, 512)">
    <!-- Center H shape with modern, minimalist design -->
    <path d="M -200 -300 L -200 300 L -80 300 L -80 60 L 80 60 L 80 300 L 200 300 L 200 -300 L 80 -300 L 80 -60 L -80 -60 L -80 -300 Z" 
          fill="white" 
          fill-opacity="1"/>
  </g>
  
  <!-- Gradient Definition -->
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#000000;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#1a1a1a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#000000;stop-opacity:1" />
    </linearGradient>
  </defs>
</svg>"""

# Tray icon SVG (simpler, monochrome for system tray)
HANZO_TRAY_SVG = """<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Simple H for tray -->
  <path d="M 40 40 L 40 216 L 80 216 L 80 138 L 176 138 L 176 216 L 216 216 L 216 40 L 176 40 L 176 118 L 80 118 L 80 40 Z" 
        fill="black" 
        fill-opacity="0.9"/>
</svg>"""

# macOS specific icon with rounded corners
HANZO_MACOS_SVG = """<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- macOS style rounded rect background -->
  <rect width="1024" height="1024" rx="234" fill="url(#macGradient)"/>
  
  <!-- Inner shadow for depth -->
  <rect x="2" y="2" width="1020" height="1020" rx="232" fill="none" stroke="url(#innerGradient)" stroke-width="2" opacity="0.3"/>
  
  <!-- Hanzo H -->
  <g transform="translate(512, 512)">
    <path d="M -180 -280 L -180 280 L -70 280 L -70 55 L 70 55 L 70 280 L 180 280 L 180 -280 L 70 -280 L 70 -55 L -70 -55 L -70 -280 Z" 
          fill="white"/>
  </g>
  
  <defs>
    <linearGradient id="macGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a0a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#000000;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="innerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.2" />
      <stop offset="100%" style="stop-color:#ffffff;stop-opacity:0.05" />
    </linearGradient>
  </defs>
</svg>"""

def ensure_dir(path):
    """Ensure directory exists"""
    Path(path).mkdir(parents=True, exist_ok=True)

def save_svg(content, filepath):
    """Save SVG content to file"""
    with open(filepath, 'w') as f:
        f.write(content)
    print(f"✅ Created: {filepath}")

def convert_svg_to_png(svg_path, png_path, size):
    """Convert SVG to PNG using rsvg-convert or Inkscape"""
    try:
        # Try rsvg-convert first (faster)
        subprocess.run([
            'rsvg-convert',
            '-w', str(size),
            '-h', str(size),
            svg_path,
            '-o', png_path
        ], check=True, capture_output=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        try:
            # Fallback to Inkscape
            subprocess.run([
                'inkscape',
                svg_path,
                '--export-type=png',
                f'--export-filename={png_path}',
                f'--export-width={size}',
                f'--export-height={size}'
            ], check=True, capture_output=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            print(f"⚠️  Could not convert {svg_path} to PNG. Please install rsvg-convert or inkscape.")
            return False
    
    print(f"✅ Generated: {png_path} ({size}x{size})")
    return True

def generate_ico(png_files, ico_path):
    """Generate ICO file from multiple PNG sizes"""
    try:
        # Use ImageMagick to create ICO
        subprocess.run([
            'convert',
            *png_files,
            ico_path
        ], check=True, capture_output=True)
        print(f"✅ Generated: {ico_path}")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print(f"⚠️  Could not generate ICO. Please install ImageMagick.")
        return False

def generate_icns(png_files, icns_path):
    """Generate ICNS file for macOS"""
    try:
        # Create iconset directory
        iconset_path = icns_path.replace('.icns', '.iconset')
        ensure_dir(iconset_path)
        
        # Required sizes for macOS iconset
        sizes = {
            16: ['16x16'],
            32: ['16x16@2x', '32x32'],
            64: ['32x32@2x'],
            128: ['128x128'],
            256: ['128x128@2x', '256x256'],
            512: ['256x256@2x', '512x512'],
            1024: ['512x512@2x']
        }
        
        # Copy/convert PNGs to iconset with proper naming
        for size, names in sizes.items():
            png_source = f"/tmp/hanzo_icon_{size}.png"
            if not os.path.exists(png_source):
                # Generate this size if it doesn't exist
                convert_svg_to_png('/tmp/hanzo_macos.svg', png_source, size)
            
            for name in names:
                dest = os.path.join(iconset_path, f'icon_{name}.png')
                subprocess.run(['cp', png_source, dest], check=True)
        
        # Generate ICNS
        subprocess.run([
            'iconutil',
            '-c', 'icns',
            iconset_path,
            '-o', icns_path
        ], check=True, capture_output=True)
        
        # Clean up iconset
        subprocess.run(['rm', '-rf', iconset_path], check=True)
        
        print(f"✅ Generated: {icns_path}")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print(f"⚠️  Could not generate ICNS. Please run on macOS with iconutil available.")
        return False

def main():
    """Generate all icons for Hanzo desktop app"""
    
    # Paths
    desktop_icons = "apps/hanzo-desktop/src-tauri/icons"
    public_dir = "apps/hanzo-desktop/public"
    ui_assets = "libs/hanzo-ui/src/assets"
    
    # Ensure directories exist
    ensure_dir(desktop_icons)
    ensure_dir(public_dir)
    ensure_dir(f"{ui_assets}/icons")
    
    # Save main SVG files
    save_svg(HANZO_SVG, f"{public_dir}/hanzo-icon.svg")
    save_svg(HANZO_SVG, f"{ui_assets}/icons/hanzo.svg")
    save_svg(HANZO_MACOS_SVG, "/tmp/hanzo_macos.svg")
    save_svg(HANZO_TRAY_SVG, "/tmp/hanzo_tray.svg")
    
    print("\n🎨 Generating PNG icons...")
    
    # Generate various PNG sizes for Tauri
    icon_sizes = {
        32: "32x32.png",
        128: "128x128.png",
        256: "128x128@2x.png",  # Retina display
    }
    
    png_files = []
    for size, filename in icon_sizes.items():
        png_path = f"{desktop_icons}/{filename}"
        if convert_svg_to_png(f"{public_dir}/hanzo-icon.svg", png_path, size):
            png_files.append(png_path)
    
    # Windows specific icons
    print("\n🪟 Generating Windows icons...")
    windows_sizes = [
        (30, "Square30x30Logo.png"),
        (44, "Square44x44Logo.png"),
        (71, "Square71x71Logo.png"),
        (89, "Square89x89Logo.png"),
        (107, "Square107x107Logo.png"),
        (142, "Square142x142Logo.png"),
        (150, "Square150x150Logo.png"),
        (284, "Square284x284Logo.png"),
        (310, "Square310x310Logo.png"),
        (50, "StoreLogo.png"),
    ]
    
    for size, filename in windows_sizes:
        convert_svg_to_png(f"{public_dir}/hanzo-icon.svg", f"{desktop_icons}/{filename}", size)
    
    # Generate main icon.png and app-icon.png
    convert_svg_to_png(f"{public_dir}/hanzo-icon.svg", f"{desktop_icons}/icon.png", 512)
    convert_svg_to_png(f"{public_dir}/hanzo-icon.svg", f"{desktop_icons}/app-icon.png", 512)
    
    # Generate tray icon for macOS
    convert_svg_to_png("/tmp/hanzo_tray.svg", f"{desktop_icons}/tray-icon-macos.png", 32)
    
    # Generate ICO for Windows
    print("\n🪟 Generating ICO file...")
    ico_sizes = []
    for size in [16, 32, 48, 64, 128, 256]:
        tmp_png = f"/tmp/hanzo_icon_{size}.png"
        if convert_svg_to_png(f"{public_dir}/hanzo-icon.svg", tmp_png, size):
            ico_sizes.append(tmp_png)
    
    if ico_sizes:
        generate_ico(ico_sizes, f"{desktop_icons}/icon.ico")
    
    # Generate ICNS for macOS
    print("\n🍎 Generating ICNS file...")
    generate_icns(png_files, f"{desktop_icons}/icon.icns")
    
    # Generate favicon
    print("\n🌐 Generating favicon...")
    convert_svg_to_png(f"{public_dir}/hanzo-icon.svg", f"{public_dir}/favicon.png", 32)
    
    # Update Tauri configuration to use the new icons
    print("\n📝 Updating Tauri configuration...")
    tauri_conf_path = "apps/hanzo-desktop/src-tauri/tauri.conf.json"
    
    if os.path.exists(tauri_conf_path):
        with open(tauri_conf_path, 'r') as f:
            config = json.load(f)
        
        # Update icon paths
        config['bundle']['icon'] = [
            "icons/32x32.png",
            "icons/128x128.png",
            "icons/128x128@2x.png",
            "icons/icon.icns",
            "icons/icon.ico"
        ]
        
        with open(tauri_conf_path, 'w') as f:
            json.dump(config, f, indent=2)
        
        print(f"✅ Updated: {tauri_conf_path}")
    
    print("\n✨ Icon generation complete!")
    print("\nGenerated icons:")
    print("  • SVG icons for web and UI components")
    print("  • PNG icons in various sizes (32px to 512px)")
    print("  • Windows ICO file")
    print("  • macOS ICNS file")
    print("  • System tray icons")
    print("  • Windows Store logos")
    
    # Clean up temporary files
    subprocess.run(['rm', '-f'] + [f"/tmp/hanzo_icon_{size}.png" for size in [16, 32, 48, 64, 128, 256, 512, 1024]], check=False)
    subprocess.run(['rm', '-f', '/tmp/hanzo_macos.svg', '/tmp/hanzo_tray.svg'], check=False)

if __name__ == "__main__":
    main()