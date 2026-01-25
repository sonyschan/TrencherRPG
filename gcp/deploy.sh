#!/bin/bash

# TrencherRPG GCP Deployment Script
# Usage: ./deploy.sh

set -e  # Exit on error

echo "TrencherRPG GCP Deployment Script"
echo "=================================="
echo ""

# Check if logged in to GCP
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
    echo "Please login to GCP first: gcloud auth login"
    exit 1
fi

# Get project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo "Please set GCP project: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "Project ID: $PROJECT_ID"
echo ""

# Set variables
REGION="asia-southeast1"
SERVICE_NAME="trencherrpg"
BUCKET_NAME_DEFAULT="trencherrpg-data-$PROJECT_ID"

# Get script directory and backend directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/../backend" && pwd)"

echo "Deploying from: $BACKEND_DIR"
echo ""

# Ask for bucket name
read -p "Enter Cloud Storage Bucket name (default: $BUCKET_NAME_DEFAULT): " BUCKET_NAME_INPUT
BUCKET_NAME=${BUCKET_NAME_INPUT:-$BUCKET_NAME_DEFAULT}

echo ""
echo "Deployment Configuration:"
echo "  - Project: $PROJECT_ID"
echo "  - Region: $REGION"
echo "  - Service: $SERVICE_NAME"
echo "  - Bucket: $BUCKET_NAME"
echo ""

read -p "Confirm deployment? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo "Starting deployment..."
echo ""

# 1. Enable required APIs
echo "1. Enabling GCP APIs..."
gcloud services enable run.googleapis.com \
    cloudbuild.googleapis.com \
    storage-api.googleapis.com \
    --quiet

echo "APIs enabled"
echo ""

# 2. Check/create bucket
echo "2. Checking Cloud Storage Bucket..."
if gsutil ls gs://$BUCKET_NAME 2>/dev/null; then
    echo "Bucket exists: gs://$BUCKET_NAME"
else
    echo "Creating new bucket..."
    gsutil mb -l $REGION gs://$BUCKET_NAME
    echo "Bucket created: gs://$BUCKET_NAME"
fi
echo ""

# 3. Deploy to Cloud Run from backend directory
echo "3. Deploying to Cloud Run..."
cd "$BACKEND_DIR"

gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --update-env-vars "GCS_BUCKET_NAME=$BUCKET_NAME" \
  --quiet

echo "Cloud Run service deployed"
echo ""

# 4. Get service URL
echo "4. Getting service URL..."
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')
echo "Service URL: $SERVICE_URL"
echo ""

# 5. Test health check
echo "5. Testing health check..."
sleep 3  # Wait for service to start
if curl -s "$SERVICE_URL/api/health" | grep -q "ok"; then
    echo "Health check passed"
else
    echo "Health check failed, please check logs"
fi
echo ""

# Done
echo "=================================="
echo "Deployment complete!"
echo ""
echo "Quick commands:"
echo "  View logs:"
echo "    gcloud run services logs tail $SERVICE_NAME --region $REGION"
echo ""
echo "  Test API:"
echo "    curl $SERVICE_URL/api/health"
echo ""
echo "  Update code:"
echo "    cd $BACKEND_DIR && gcloud run deploy $SERVICE_NAME --source . --region $REGION"
echo ""
echo "Cloud Console:"
echo "  Cloud Run: https://console.cloud.google.com/run?project=$PROJECT_ID"
echo "  Storage: https://console.cloud.google.com/storage/browser/$BUCKET_NAME"
echo ""
echo "IMPORTANT: Configure environment variables in Cloud Run console:"
echo "  - HELIUS_API_KEY"
echo "  - PRIVY_APP_ID"
echo "  - PRIVY_APP_SECRET"
echo "  - IDLE_TOKEN_ADDRESS"
echo ""
echo "UPDATE vercel.json with the Cloud Run URL:"
echo "  $SERVICE_URL"
echo ""
