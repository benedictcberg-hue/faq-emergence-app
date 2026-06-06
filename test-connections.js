#!/usr/bin/env node
/**
 * Connection Test Script
 * Verifies database and Gemini API connectivity
 */

require('dotenv').config();
const { Client } = require('pg');

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(color, symbol, message) {
    console.log(`${color}${symbol} ${message}${colors.reset}`);
}

async function testDatabase() {
    log(colors.blue, '🔍', 'Testing database connection...');

    if (!process.env.DATABASE_URL) {
        log(colors.red, '❌', 'DATABASE_URL not found in .env file');
        return false;
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        log(colors.green, '✅', 'Database connection successful');

        // Check if tables exist
        const result = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);

        if (result.rows.length === 0) {
            log(colors.yellow, '⚠️', 'No tables found. Run: npm run db:init');
            return false;
        }

        log(colors.cyan, '📊', `Found ${result.rows.length} tables:`);
        result.rows.forEach(row => {
            console.log(`   ${colors.cyan}•${colors.reset} ${row.table_name}`);
        });

        // Check seed data
        const seedCheck = await client.query('SELECT COUNT(*) as count FROM adaptive_params');
        log(colors.cyan, '📝', `Seed data: ${seedCheck.rows[0].count} parameter sets`);

        await client.end();
        return true;

    } catch (error) {
        log(colors.red, '❌', `Database error: ${error.message}`);
        await client.end().catch(() => {});
        return false;
    }
}

async function testGeminiAPI() {
    log(colors.blue, '🔍', 'Testing Gemini API connection...');

    if (!process.env.GEMINI_API_KEY) {
        log(colors.yellow, '⚠️', 'GEMINI_API_KEY not found (will use mock mode)');
        return true; // Not an error - mock mode is valid
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const requestBody = {
        contents: [{
            parts: [{
                text: 'Say "Hello" in one word'
            }]
        }],
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 10
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.json();
            log(colors.red, '❌', `Gemini API error: ${error.error?.message || response.statusText}`);
            return false;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        log(colors.green, '✅', 'Gemini API connection successful');
        log(colors.cyan, '💬', `Test response: "${text?.trim()}"`);

        return true;

    } catch (error) {
        log(colors.red, '❌', `Gemini API error: ${error.message}`);
        return false;
    }
}

async function runTests() {
    console.log('\n' + colors.cyan + '╔═══════════════════════════════════════╗' + colors.reset);
    console.log(colors.cyan + '║   FAQ Emergence - Connection Test    ║' + colors.reset);
    console.log(colors.cyan + '╚═══════════════════════════════════════╝' + colors.reset + '\n');

    const dbOk = await testDatabase();
    console.log('');
    const apiOk = await testGeminiAPI();

    console.log('\n' + colors.cyan + '───────────────────────────────────────' + colors.reset);
    console.log(colors.cyan + 'Test Summary:' + colors.reset);
    console.log(`  Database: ${dbOk ? colors.green + '✅ Ready' : colors.red + '❌ Failed'}${colors.reset}`);
    console.log(`  Gemini API: ${apiOk ? colors.green + '✅ Ready' : colors.yellow + '⚠️  Will use mock mode'}${colors.reset}`);
    console.log(colors.cyan + '───────────────────────────────────────' + colors.reset + '\n');

    if (dbOk && apiOk) {
        log(colors.green, '🎉', 'All systems ready! Run: npm run dev');
    } else if (dbOk && !process.env.GEMINI_API_KEY) {
        log(colors.yellow, '💡', 'Database ready. App will run in mock mode.');
        log(colors.cyan, '→', 'Run: npm run dev');
    } else if (!dbOk) {
        log(colors.red, '⚠️', 'Database not ready. Run: npm run db:init');
    }

    console.log('');
    process.exit(dbOk ? 0 : 1);
}

// Run tests
runTests();
