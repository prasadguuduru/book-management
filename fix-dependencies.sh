#!/bin/bash

echo "🔧 Fixing dependency resolution issues..."

# Clean existing installations
echo "🧹 Cleaning existing node_modules..."
rm -rf node_modules package-lock.json
rm -rf backend/node_modules backend/package-lock.json  
rm -rf frontend/node_modules frontend/package-lock.json

# Install with legacy peer deps to resolve conflicts
echo "📦 Installing dependencies with legacy peer deps resolution..."
npm install --legacy-peer-deps

echo "✅ Dependencies fixed! You can now run:"
echo "   npm run setup    # Complete setup with LocalStack"
echo "   npm run dev      # Start development servers"