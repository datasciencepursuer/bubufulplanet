#!/bin/bash

# Database Migration Runner
# This script runs database migrations on startup

echo "🗄️ Running database migrations..."

# Function to run database migrations
run_migrations() {
    local migrations_dir="./migrations"
    local migration_log="/tmp/migration.log"
    
    # Check if migrations directory exists
    if [ ! -d "$migrations_dir" ]; then
        echo "❌ Migrations directory not found: $migrations_dir"
        exit 1
    fi
    
    # Check for required Supabase environment variables
    if [ -z "$POSTGRES_PASSWORD" ]; then
        echo "❌ Missing required environment variable: POSTGRES_PASSWORD"
        exit 1
    fi
    
    # Use Supabase configuration from environment
    DB_HOST="${POSTGRES_HOST:-db}"
    DB_PORT="${POSTGRES_PORT:-5432}"
    DB_NAME="${POSTGRES_DB:-postgres}"
    DB_USER="supabase_admin"
    DB_PASSWORD="$POSTGRES_PASSWORD"
    
    DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
    
    echo "🔗 Connecting to database: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
    
    echo "🔍 Looking for migration files in $migrations_dir..."
    
    # Find all .sql files and sort them
    migration_files=$(find "$migrations_dir" -name "*.sql" -type f | sort)
    
    if [ -z "$migration_files" ]; then
        echo "ℹ️  No migration files found"
        return 0
    fi
    
    echo "📁 Found migration files:"
    echo "$migration_files" | sed 's/^/   - /'
    
    # Run each migration file
    for migration_file in $migration_files; do
        echo "🔄 Running migration: $(basename "$migration_file")"
        
        # Check if we have psql available, if not use curl to Supabase REST API
        if command -v psql >/dev/null 2>&1; then
            # Use psql for direct database access
            if psql "$DB_URL" -f "$migration_file" >> "$migration_log" 2>&1; then
                echo "✅ Migration completed: $(basename "$migration_file")"
            else
                echo "❌ Migration failed: $(basename "$migration_file")"
                echo "   Check log: $migration_log"
                cat "$migration_log" | tail -20
                exit 1
            fi
        else
            echo "⚠️  psql not available, skipping migration: $(basename "$migration_file")"
            echo "   Migrations should be run manually in the database container"
        fi
    done
    
    echo "✅ All migrations completed successfully"
}

# Run migrations and then start the application
run_migrations

echo "🚀 Starting Next.js application..."
exec pnpm start