# 🧠 FAQ Emergence App

An intelligent FAQ generator powered by adaptive learning and AI. Built with the **S-A-F-L-O Framework** for continuous quality improvement.

## 🌟 Features

- **Adaptive Learning**: Automatically learns from successful parameter combinations
- **Quality-Driven**: Multi-metric quality evaluation ensures high-quality responses
- **Self-Improving**: Gets better over time by storing successful strategies
- **Serverless Architecture**: Scalable deployment on Netlify
- **Persistent Learning**: Uses Neon PostgreSQL for knowledge persistence
- **AI-Powered**: Integrates with Google Gemini for natural language generation

## 🏗️ S-A-F-L-O Framework

The app implements a sophisticated adaptive learning framework:

- **S**ense: Monitor quality metrics in real-time
- **A**dapt: Adjust generation parameters based on feedback
- **F**eedback: Evaluate responses across multiple dimensions
- **L**earn: Persist successful strategies to database
- **O**rchestrate: Coordinate the entire generation pipeline

## 📋 Prerequisites

- Node.js 18 or higher
- A [Neon](https://neon.tech) PostgreSQL database (free tier available)
- A [Google Gemini API](https://makersuite.google.com/app/apikey) key (optional for testing)
- [Netlify](https://netlify.com) account for deployment (optional)

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd faq-emergence-app
npm install
```

### 2. Database Setup

**Create a Neon Database:**
1. Go to [neon.tech](https://neon.tech) and create a free account
2. Create a new project
3. Copy your connection string

**Initialize the Schema:**
```bash
export DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
npm run db:init
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:
```env
DATABASE_URL=your-neon-connection-string
GEMINI_API_KEY=your-gemini-api-key  # Optional for testing
```

### 4. Run Locally

```bash
npm run dev
```

Visit `http://localhost:8888` to see the app.

## 🌐 Deployment to Vercel

### Option 1: Deploy via Git (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [Vercel](https://vercel.com/new)
3. Click "Import Git Repository"
4. Select your repository (Vercel auto-detects configuration)
5. Click "Deploy"
6. Configure environment variables in Vercel dashboard:
   - `DATABASE_URL`: Your Neon connection string
   - `GEMINI_API_KEY`: Your Gemini API key
7. Redeploy to apply environment variables

### Option 2: Deploy via CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Set environment variables
vercel env add DATABASE_URL
vercel env add GEMINI_API_KEY

# Deploy to production
vercel --prod
```

📚 **See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment guide**

## 📁 Project Structure

```
faq-emergence-app/
├── lib/                        # Core application logic
│   ├── database.js            # Database service with connection pooling
│   ├── gemini.js              # Gemini API integration
│   ├── quality.js             # Quality evaluation engine
│   └── adaptive.js            # Adaptive learning orchestrator
├── api/                       # Vercel serverless functions
│   └── generate_faq.js        # FAQ generation API endpoint
├── db/
│   └── schema.sql             # Database schema
├── index.html                 # Frontend interface
├── demo-server.js             # Local development server
├── package.json               # Dependencies and scripts
├── vercel.json                # Vercel configuration
├── DEPLOYMENT.md              # Deployment guide
└── .env.example               # Environment template
```

## 🧪 Testing Without API Key

The app includes a **mock mode** for testing without a Gemini API key. Simply omit the `GEMINI_API_KEY` environment variable and the system will generate simulated responses.

## 📊 How It Works

### Quality Evaluation

Each generated FAQ is evaluated across four dimensions:
- **Completeness** (35%): All required fields present
- **Length** (25%): Appropriate answer length
- **Structure** (20%): Well-formatted content
- **Relevance** (20%): Matches the input question

### Adaptive Learning Process

1. **First Attempt**: Uses learned parameters from previous successes
2. **Second Attempt**: Falls back to default parameters
3. **Adaptive Attempts**: Tries scenario-specific strategies if quality is low
4. **Learning**: Stores successful parameter combinations for future use

### Database Schema

Three main tables:
- `adaptive_params`: Stores successful parameter combinations
- `faq_generations`: Audit log of all generations
- `learning_metrics`: Daily performance metrics

## 🔧 Available Scripts

```bash
npm run dev          # Start local development server
npm run deploy       # Deploy to Netlify
npm run db:init      # Initialize database schema
npm run db:reset     # Reset database (WARNING: deletes all data)
```

## 📈 Monitoring & Analytics

The app automatically tracks:
- Quality scores over time
- Number of attempts needed per generation
- Success rate
- Average quality by scenario

Query the database to analyze performance:

```sql
-- View today's metrics
SELECT * FROM learning_metrics ORDER BY metric_date DESC LIMIT 7;

-- Top performing parameter combinations
SELECT scenario_code, params, quality_score, success_count
FROM adaptive_params
ORDER BY quality_score DESC, success_count DESC
LIMIT 10;

-- Recent generations
SELECT prompt, quality_score, attempts_count, created_at
FROM faq_generations
ORDER BY created_at DESC
LIMIT 20;
```

## 🛠️ Troubleshooting

### Database Connection Errors

**Error**: `Database service unavailable`

**Solution**:
- Verify `DATABASE_URL` is set correctly
- Check that your Neon database is active
- Ensure connection string includes `?sslmode=require`

### Function Timeout

**Error**: `Function execution timed out`

**Solution**:
- Upgrade to Netlify Pro for longer timeouts (10 minutes vs 26 seconds)
- Or optimize quality thresholds in `lib/quality.js`

### CORS Errors

If testing locally with a different frontend:
- The serverless function includes CORS headers
- Modify headers in `netlify/functions/generate_faq.js` if needed

## 🤝 Contributing

Contributions are welcome! Areas for improvement:
- Additional quality metrics
- More sophisticated adaptive strategies
- Support for other LLM providers
- Rate limiting and caching
- Analytics dashboard

## 📄 License

MIT License - feel free to use this project for your own applications.

## 🙏 Acknowledgments

- Built with [Google Gemini](https://deepmind.google/technologies/gemini/)
- Powered by [Neon PostgreSQL](https://neon.tech)
- Deployed on [Vercel](https://vercel.com)

---

**Questions or issues?** Open an issue on GitHub or check the logs in Vercel Functions dashboard.
