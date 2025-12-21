# Quick Setup Guide

Your database credentials have been saved to `.env` file.

## Initialize Database Schema

You have **3 options** to initialize your Neon database:

### Option 1: Using Neon Web Console (Easiest)

1. Go to [Neon Console](https://console.neon.tech)
2. Select your project: `ep-damp-tree-ahudrsca`
3. Click on **SQL Editor**
4. Copy and paste the contents of `db/schema.sql`
5. Click **Run** to execute

### Option 2: Using psql locally (if you have PostgreSQL installed)

```bash
# From your project directory
psql 'postgresql://neondb_owner:npg_WmCSHEio25Fv@ep-damp-tree-ahudrsca-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' -f db/schema.sql
```

Or using npm script:
```bash
npm run db:init
```

### Option 3: Using Node.js script (no psql required)

Create a file `init-db.js`:

```javascript
const { Client } = require('pg');
const fs = require('fs');

async function initDatabase() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('Connected to database');

        const schema = fs.readFileSync('./db/schema.sql', 'utf8');
        await client.query(schema);

        console.log('✅ Database schema initialized successfully!');
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
    }
}

initDatabase();
```

Then run:
```bash
npm install  # Make sure pg is installed
node init-db.js
```

## Verify Database Setup

After initialization, verify it worked:

```sql
-- Check tables were created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';

-- Should show:
-- adaptive_params
-- faq_generations
-- learning_metrics
```

## Next Steps

1. **Get Gemini API Key** (optional for testing):
   - Visit: https://makersuite.google.com/app/apikey
   - Add to `.env` file: `GEMINI_API_KEY=your-key-here`

2. **Test locally**:
   ```bash
   npm install
   npm run dev
   ```
   Visit: http://localhost:8888

3. **Deploy to Netlify**:
   ```bash
   npx netlify login
   npx netlify init

   # Set environment variables
   npx netlify env:set DATABASE_URL "postgresql://neondb_owner:npg_WmCSHEio25Fv@ep-damp-tree-ahudrsca-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
   npx netlify env:set GEMINI_API_KEY "your-key-if-you-have-one"

   # Deploy
   npm run deploy
   ```

## Troubleshooting

**Can't connect to database?**
- Make sure you're using the connection string with `channel_binding=require`
- Check that your IP is allowed (Neon allows all IPs by default)
- Verify the database project is active in Neon console

**Need to reset database?**
```bash
npm run db:reset  # WARNING: Deletes all data!
```

**Test without Gemini API?**
- Just omit `GEMINI_API_KEY` from `.env`
- The app will run in mock mode for testing
