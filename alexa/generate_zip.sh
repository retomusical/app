#!/bin/bash

# Script to generate the Alexa Skill Lambda deployment zip with versioning
# This script should be run from the 'alexa' directory or the project root.

# Stop on error
set -e

# Determine the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

LAMBDA_DIR="lambda"
BASE_ZIP_NAME="skill_deployment"

echo "🚀 Starting Alexa Skill zip generation with versioning..."

# 1. Check if lambda directory exists
if [ ! -d "$LAMBDA_DIR" ]; then
    echo "❌ Error: Directory $LAMBDA_DIR not found in $SCRIPT_DIR"
    exit 1
fi

# 2. Find the current version and increment it
# Look for files like skill_deployment_v*.zip
# If only skill_deployment.zip exists, it's v0.
# If none exist, start with v1.
LAST_ZIP=$(ls ${BASE_ZIP_NAME}_v*.zip 2>/dev/null | sort -V | tail -n 1 || true)

if [ -z "$LAST_ZIP" ]; then
    if [ -f "${BASE_ZIP_NAME}.zip" ]; then
        VERSION=1
        OLD_ZIP="${BASE_ZIP_NAME}.zip"
    else
        VERSION=1
        OLD_ZIP=""
    fi
else
    # Extract version number using regex
    LAST_VERSION=$(echo "$LAST_ZIP" | sed -E "s/${BASE_ZIP_NAME}_v([0-9]+)\.zip/\1/")
    VERSION=$((LAST_VERSION + 1))
    OLD_ZIP="$LAST_ZIP"
fi

NEW_ZIP="${BASE_ZIP_NAME}_v${VERSION}.zip"

# 3. Create the new zip file
echo "🤐 Creating $NEW_ZIP..."
# Go back to the script directory to zip the lambda folder itself but EXCLUDE node_modules
cd "$SCRIPT_DIR"
zip -q -r "$NEW_ZIP" "$LAMBDA_DIR" -x "$LAMBDA_DIR/node_modules/*"

# 4. Cleanup OLD version if specified
if [ -n "$OLD_ZIP" ] && [ -f "$OLD_ZIP" ]; then
    echo "🗑️ Removing previous version: $OLD_ZIP"
    rm "$OLD_ZIP"
fi

echo "✅ Success! New zip file created at $SCRIPT_DIR/$NEW_ZIP"
echo "You can now upload this file to the Alexa Developer Console."
