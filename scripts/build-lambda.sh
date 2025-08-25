#!/bin/bash

# Navigate to backend directory
cd ../backend

# Install dependencies
npm install

# Build TypeScript
npm run build

# Create deployment package
cd dist
zip -r hello.zip ./hello/

echo "Lambda package created at dist/hello.zip"
