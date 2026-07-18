#!/bin/bash

echo "======================================"
echo "🚀 LexIO Automated Deployment Script "
echo "======================================"
echo ""

# Ensure we are in a git repository
if [ ! -d .git ]; then
    echo "❌ Error: Not a git repository. Please initialize git first."
    exit 1
fi

# 1. Stage all changes
echo "[1/3] Staging all modified files..."
git add .

# 2. Prompt for a description
echo ""
echo "[2/3] What did you change? (Type a brief description and press Enter):"
read -r USER_MSG

# Format the commit message
if [ -z "$USER_MSG" ]; then
    # Fallback if they just hit enter without typing anything
    COMMIT_MSG="chore: update continuous deployment"
else
    # Professional semantic versioning prefix
    COMMIT_MSG="feat: $USER_MSG"
fi

# Commit the changes
git commit -m "$COMMIT_MSG"

# 3. Push to GitHub
echo ""
echo "[3/3] Pushing updates to GitHub..."
git push origin main

echo ""
echo "✅ Update successfully pushed to GitHub!"
echo "🌐 Vercel and Render will now automatically intercept this push and begin their deployments."
