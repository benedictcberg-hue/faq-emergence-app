/**
 * Vercel Serverless Function - FAQ Generation with Adaptive Learning
 * Implements the S-A-F-L-O framework for intelligent FAQ generation
 */

const DatabaseService = require('../lib/database');
const GeminiService = require('../lib/gemini');
const QualityEvaluator = require('../lib/quality');
const AdaptiveLearner = require('../lib/adaptive');

// Singleton instances (reused across warm invocations)
let dbService = null;
let geminiService = null;
let qualityEvaluator = null;
let adaptiveLearner = null;

/**
 * Initialize services (lazy initialization for performance)
 */
function initializeServices() {
    const databaseUrl = process.env.DATABASE_URL;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    // Validate required environment variables
    if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is required');
    }

    // Initialize services only once (serverless warm start optimization)
    if (!dbService) {
        dbService = new DatabaseService(databaseUrl);
        console.log('[INIT] Database service initialized');
    }

    if (!geminiService) {
        geminiService = new GeminiService(geminiApiKey);
        if (!geminiService.isConfigured()) {
            console.warn('[INIT] GEMINI_API_KEY not set - running in mock mode');
        }
    }

    if (!qualityEvaluator) {
        qualityEvaluator = new QualityEvaluator();
        console.log('[INIT] Quality evaluator initialized');
    }

    if (!adaptiveLearner) {
        adaptiveLearner = new AdaptiveLearner(geminiService, qualityEvaluator, dbService);
        console.log('[INIT] Adaptive learner initialized');
    }

    return { dbService, geminiService, qualityEvaluator, adaptiveLearner };
}

/**
 * Vercel Serverless Function Handler
 */
module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed. Use POST.'
        });
    }

    try {
        // Get request body (already parsed by Vercel)
        const { prompt } = req.body || {};

        // Validate input
        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({
                error: 'Invalid request. "prompt" field is required and must be a string.'
            });
        }

        // Validate prompt length
        if (prompt.length < 5) {
            return res.status(400).json({
                error: 'Prompt is too short. Please provide a meaningful question (at least 5 characters).'
            });
        }

        if (prompt.length > 5000) {
            return res.status(400).json({
                error: 'Prompt is too long. Please keep it under 5000 characters.'
            });
        }

        // Initialize services
        const services = initializeServices();

        // Health check database connection
        const health = await services.dbService.healthCheck();
        if (!health.healthy) {
            console.error('[ERROR] Database health check failed:', health.error);
            return res.status(503).json({
                error: 'Database service unavailable. Please try again later.',
                details: health.error
            });
        }

        // Generate FAQ with adaptive learning
        const startTime = Date.now();
        const result = await services.adaptiveLearner.generateWithLearning(prompt);
        const totalDuration = Date.now() - startTime;

        console.log(`[COMPLETE] Total processing time: ${totalDuration}ms`);

        // Return successful response
        return res.status(200).json({
            success: result.success,
            faq: result.faq,
            quality: result.quality,
            metadata: {
                ...result.metadata,
                totalDuration
            },
            message: result.success
                ? 'FAQ generated successfully with adaptive learning'
                : 'FAQ generated but quality threshold not met'
        });

    } catch (error) {
        console.error('[ERROR] Function execution failed:', error);

        // Determine error type and status code
        let statusCode = 500;
        let errorMessage = 'Internal server error occurred';

        if (error.message.includes('DATABASE_URL')) {
            statusCode = 503;
            errorMessage = 'Database configuration error';
        } else if (error.message.includes('Gemini API')) {
            statusCode = 502;
            errorMessage = 'AI service error';
        }

        return res.status(statusCode).json({
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
};
