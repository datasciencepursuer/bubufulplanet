#!/bin/sh

# Exit on any error
set -e

echo "Starting deployment process..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

echo "Running Prisma migrations..."
pnpm run db:migrate

echo "Generating Prisma client..."
pnpm run db:generate

echo "Starting Next.js application..."
exec pnpm start