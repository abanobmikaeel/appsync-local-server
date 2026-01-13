#!/bin/bash
# Setup script for DynamoDB Local testing

DYNAMODB_LOCAL_DIR=~/dynamodb-local
ENDPOINT="http://localhost:8001"

echo "=== Creating Users table in DynamoDB Local ==="

# Create the Users table
aws dynamodb create-table \
  --endpoint-url $ENDPOINT \
  --table-name Users \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --no-cli-pager 2>/dev/null || echo "Table may already exist"

echo ""
echo "=== Seeding test data ==="

# Seed some test users
aws dynamodb put-item \
  --endpoint-url $ENDPOINT \
  --table-name Users \
  --item '{
    "id": {"S": "user-1"},
    "name": {"S": "Alice Johnson"},
    "email": {"S": "alice@example.com"},
    "createdAt": {"S": "2024-01-01T00:00:00Z"}
  }' \
  --no-cli-pager

aws dynamodb put-item \
  --endpoint-url $ENDPOINT \
  --table-name Users \
  --item '{
    "id": {"S": "user-2"},
    "name": {"S": "Bob Smith"},
    "email": {"S": "bob@example.com"},
    "createdAt": {"S": "2024-01-02T00:00:00Z"}
  }' \
  --no-cli-pager

aws dynamodb put-item \
  --endpoint-url $ENDPOINT \
  --table-name Users \
  --item '{
    "id": {"S": "user-3"},
    "name": {"S": "Charlie Brown"},
    "email": {"S": "charlie@example.com"},
    "createdAt": {"S": "2024-01-03T00:00:00Z"}
  }' \
  --no-cli-pager

echo ""
echo "=== Verifying data (scan table) ==="
aws dynamodb scan \
  --endpoint-url $ENDPOINT \
  --table-name Users \
  --no-cli-pager

echo ""
echo "=== Setup complete! ==="
echo "DynamoDB Local is ready with 3 test users."
