#!/usr/bin/env node
/**
 * Database Initialization Script
 * Run this to initialize your Neon database schema
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config();

async function initDatabase() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        console.error('❌ ERROR: DATABASE_URL not found in environment variables');
        console.log('   Make sure .env file exists with DATABASE_URL set');
        process.exit(1);
    }

    console.log('🔌 Connecting to Neon database...');
    console.log(`   Host: ${connectionString.match(/@([^/]+)/)?.[1] || 'unknown'}`);

    const client = new Client({
        connectionString,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        console.log('✅ Connected successfully!\n');

        // Read schema file
        const schemaPath = path.join(__dirname, 'db', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('📝 Executing schema SQL...');

        // Execute schema
        await client.query(schema);

        console.log('✅ Schema created successfully!\n');

        // Verify tables were created
        console.log('🔍 Verifying tables...');
        const result = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);

        console.log('   Tables created:');
        result.rows.forEach(row => {
            console.log(`   ✓ ${row.table_name}`);
        });

        // Check seed data
        const seedCheck = await client.query('SELECT COUNT(*) as count FROM adaptive_params');
        console.log(`\n   Seed data: ${seedCheck.rows[0].count} default parameter sets`);

        console.log('\n🎉 Database initialization complete!');
        console.log('\nNext steps:');
        console.log('  1. Get Gemini API key (optional): https://makersuite.google.com/app/apikey');
        console.log('  2. Add to .env: GEMINI_API_KEY=your-key');
        console.log('  3. Run: npm run dev');
        console.log('  4. Visit: http://localhost:8888');

    } catch (error) {
        console.error('\n❌ Error initializing database:');
        console.error('   ', error.message);

        if (error.message.includes('already exists')) {
            console.log('\n💡 Tables already exist. To reset database, run: npm run db:reset');
        } else if (error.message.includes('permission denied')) {
            console.log('\n💡 Check that your database user has CREATE permissions');
        } else if (error.message.includes('could not translate host')) {
            console.log('\n💡 Check your internet connection and DATABASE_URL');
        }

        process.exit(1);
    } finally {
        await client.end();
        console.log('\n🔌 Database connection closed');
    }
}

// Run initialization
initDatabase();
