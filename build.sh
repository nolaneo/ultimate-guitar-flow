#!/bin/bash

# Build script for Ultimate Guitar Flow Firefox extension
# Creates a ZIP file for Firefox Add-ons submission

set -e

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Extract version from manifest.json
VERSION=$(grep -o '"version": "[^"]*"' manifest.json | cut -d'"' -f4)

if [ -z "$VERSION" ]; then
  echo "Error: Could not extract version from manifest.json"
  exit 1
fi

# Create releases directory if it doesn't exist
mkdir -p releases

# Define output filename
OUTPUT="releases/ultimate-guitar-flow-${VERSION}.zip"

# Remove existing zip if it exists
rm -f "$OUTPUT"

# Create the zip file with only the necessary files
# Use PowerShell on Windows, zip command on Unix
if command -v zip &> /dev/null; then
  zip -j "$OUTPUT" manifest.json content.js styles.css
else
  powershell -Command "Compress-Archive -Path manifest.json,content.js,styles.css -DestinationPath '$OUTPUT' -Force"
fi

echo "Created $OUTPUT"
