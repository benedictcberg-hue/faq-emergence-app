# 🚀 Vercel Deployment Guide

Complete guide for deploying FAQ Emergence App to Vercel.

## 📋 Prerequisites

- GitHub/GitLab/Bitbucket account
- [Vercel account](https://vercel.com/signup) (free tier available)
- Neon PostgreSQL database (from [neon.tech](https://neon.tech))
- Google Gemini API key (from [makersuite.google.com](https://makersuite.google.com/app/apikey))

---

## 🎯 Quick Deploy (5 Minutes)

### Option 1: Deploy via GitHub (Recommended)

**1. Push to GitHub:**
```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

**2. Import to Vercel:**
1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"**
3. Select your GitHub repository
4. Vercel will auto-detect the configuration
5. Click **"Deploy"**

**3. Configure Environment Variables:**

After deployment, go to **Settings → Environment Variables** and add:

```
DATABASE_URL = postgresql://neondb_owner:npg_WmCSHEio25Fv@ep-damp-tree-ahudrsca-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

GEMINI_API_KEY = AIzaSyDRgGF1IBwlmjEq49C4ucRTIH0PdE0dyPc

NODE_ENV = production
```

**4. Redeploy:**
- Go to **Deployments** tab
- Click **"Redeploy"** on the latest deployment
- ✅ Done! Your app is live

---

### Option 2: Deploy via Vercel CLI

**1. Install Vercel CLI:**
```bash
npm install -g vercel
```

**2. Login:**
```bash
vercel login
```

**3. Deploy:**
```bash
vercel
```

Follow the prompts:
- **Set up and deploy?** Yes
- **Which scope?** Select your account
- **Link to existing project?** No
- **Project name?** faq-emergence-app
- **Directory?** `./` (press Enter)
- **Override settings?** No

**4. Set Environment Variables:**
```bash
vercel env add DATABASE_URL
# Paste your Neon connection string

vercel env add GEMINI_API_KEY
# Paste your Gemini API key

vercel env add NODE_ENV
# Enter: production
```

**5. Deploy to Production:**
```bash
vercel --prod
```

---

## 🔧 Configuration Details

### vercel.json

The project includes a `vercel.json` configuration file:

```json
{
  "version": 2,
  "name": "faq-emergence-app",
  "builds": [
    {
      "src": "index.html",
      "use": "@vercel/static"
    },
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ],
  "regions": ["iad1"]
}
```

### API Routes

Vercel serverless functions are located in `/api` directory:

- `/api/generate_faq.js` - Main FAQ generation endpoint

**Endpoint URL:** `https://your-app.vercel.app/api/generate_faq`

---

## 📊 Post-Deployment

### 1. Initialize Database

After first deployment, initialize your database:

```bash
# Using your local machine (with DATABASE_URL in .env)
npm run db:init
```

Or connect directly to Neon and run the SQL from `db/schema.sql`.

### 2. Test the Deployment

Visit your deployed app:
```
https://your-app.vercel.app
```

Try generating a FAQ to verify everything works!

### 3. Monitor Performance

Vercel Dashboard shows:
- ✅ Function execution logs
- ✅ Performance metrics
- ✅ Error tracking
- ✅ Bandwidth usage

**View Logs:**
1. Go to your project dashboard
2. Click **"Deployments"**
3. Select a deployment
4. Click **"Functions"** → Select function → View logs

---

## 🎛️ Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string | `postgresql://user:pass@host/db` |
| `GEMINI_API_KEY` | Google Gemini API key | `AIza...` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |

---

## 🔄 Updating the App

### Automatic Deployments

Vercel automatically deploys on every `git push`:

```bash
git add .
git commit -m "Update features"
git push origin main
# Vercel auto-deploys in ~30 seconds
```

### Manual Deployments

```bash
vercel --prod
```

---

## 🐛 Troubleshooting

### Function Timeouts

**Error:** `FUNCTION_INVOCATION_TIMEOUT`

**Solution:** Vercel free tier has 10s timeout. Upgrade to Pro for 60s.

Or optimize in `lib/quality.js`:
```javascript
// Reduce attempts
this.maxAttempts = 2; // Instead of 3
```

### Database Connection Errors

**Error:** `Database service unavailable`

**Solutions:**
1. Verify `DATABASE_URL` is set correctly in Vercel dashboard
2. Check Neon database is active
3. Ensure connection string includes `?sslmode=require`

### CORS Errors

The API already includes CORS headers. If you still get errors:

1. Check browser console for the actual error
2. Verify the API endpoint URL matches your Vercel domain

### Build Errors

**Error:** `Cannot find module '../lib/database'`

**Solution:** Ensure all files are committed:
```bash
git status
git add lib/
git commit -m "Add lib files"
git push
```

---

## 📈 Performance Optimization

### 1. Enable Edge Runtime (Optional)

For faster global response times, add to `api/generate_faq.js`:

```javascript
export const config = {
  runtime: 'edge'
};
```

Note: Edge runtime has some limitations with Node.js modules.

### 2. Connection Pooling

Already implemented in `lib/database.js` using `pg.Pool`.

### 3. Caching

Add response caching for repeated queries:

```javascript
// In vercel.json, add caching headers
{
  "headers": [
    {
      "source": "/api/generate_faq",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "s-maxage=60, stale-while-revalidate"
        }
      ]
    }
  ]
}
```

---

## 🌍 Custom Domain

### Add Custom Domain

1. Go to **Settings → Domains**
2. Click **"Add"**
3. Enter your domain (e.g., `faq.yourdomain.com`)
4. Follow DNS setup instructions
5. Wait for SSL certificate (automatic, ~1 minute)

---

## 💰 Pricing

### Free Tier Includes:
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/month
- ✅ 100 serverless function executions/day
- ✅ 10s function timeout
- ✅ HTTPS & SSL

### Pro Tier ($20/month):
- ✅ 1TB bandwidth
- ✅ Unlimited function executions
- ✅ 60s function timeout
- ✅ Analytics
- ✅ Priority support

---

## 🔗 Useful Links

- [Vercel Dashboard](https://vercel.com/dashboard)
- [Vercel Documentation](https://vercel.com/docs)
- [Serverless Functions](https://vercel.com/docs/functions)
- [Environment Variables](https://vercel.com/docs/environment-variables)

---

## ✅ Deployment Checklist

- [ ] Code pushed to GitHub/GitLab
- [ ] Vercel account created
- [ ] Project imported to Vercel
- [ ] Environment variables configured
- [ ] Database initialized
- [ ] Test deployment working
- [ ] Custom domain added (optional)
- [ ] Monitoring set up

---

**Your app is now live on Vercel! 🎉**

Visit your deployment URL and start generating FAQs with adaptive learning!
