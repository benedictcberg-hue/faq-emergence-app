/**
 * DatabaseService - Manages database connections and queries with connection pooling
 * Uses pg.Pool for efficient connection management in serverless environment
 */

const { Pool } = require('pg');

class DatabaseService {
    constructor(connectionString) {
        if (!connectionString) {
            throw new Error('Database connection string is required');
        }

        // Create connection pool with optimized settings for serverless
        this.pool = new Pool({
            connectionString,
            max: 10, // Maximum connections in pool
            idleTimeoutMillis: 30000, // Close idle connections after 30s
            connectionTimeoutMillis: 10000, // 10s timeout for new connections
            allowExitOnIdle: true // Allow process to exit when idle
        });

        // Handle pool errors
        this.pool.on('error', (err) => {
            console.error('Unexpected database pool error:', err);
        });
    }

    /**
     * Store successful parameters for adaptive learning
     */
    async learnParameters(scenarioCode, params, qualityScore) {
        const query = 'SELECT update_adaptive_param($1, $2, $3)';
        try {
            await this.pool.query(query, [scenarioCode, JSON.stringify(params), qualityScore]);
            console.log(`[LEARN] Stored params for scenario: ${scenarioCode}, quality: ${qualityScore}`);
            return true;
        } catch (error) {
            console.error('[LEARN] Failed to store parameters:', error.message);
            throw error;
        }
    }

    /**
     * Retrieve best known parameters for a scenario
     */
    async getBestParameters(scenarioCode) {
        const query = 'SELECT * FROM get_best_params($1)';
        try {
            const result = await this.pool.query(query, [scenarioCode]);

            if (result.rows.length > 0) {
                console.log(`[RETRIEVE] Found best params for ${scenarioCode}`);
                return result.rows[0].params;
            }

            console.log(`[RETRIEVE] No params found for ${scenarioCode}, using default`);
            return null;
        } catch (error) {
            console.error('[RETRIEVE] Failed to get parameters:', error.message);
            return null; // Return null to fall back to defaults
        }
    }

    /**
     * Log FAQ generation attempt for analytics
     */
    async logGeneration(prompt, response, qualityScore, attemptsCount, paramsUsed, errorMessage = null) {
        const query = `
            INSERT INTO faq_generations (prompt, response, quality_score, attempts_count, params_used, error_message)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `;

        try {
            const result = await this.pool.query(query, [
                prompt,
                JSON.stringify(response),
                qualityScore,
                attemptsCount,
                JSON.stringify(paramsUsed),
                errorMessage
            ]);

            return result.rows[0].id;
        } catch (error) {
            console.error('[LOG] Failed to log generation:', error.message);
            // Don't throw - logging failures shouldn't break the app
            return null;
        }
    }

    /**
     * Update daily metrics for monitoring
     */
    async updateMetrics(successful, qualityScore, attempts) {
        const query = `
            INSERT INTO learning_metrics (metric_date, total_requests, successful_requests, avg_quality_score, avg_attempts)
            VALUES (CURRENT_DATE, 1, $1, $2, $3)
            ON CONFLICT (metric_date)
            DO UPDATE SET
                total_requests = learning_metrics.total_requests + 1,
                successful_requests = learning_metrics.successful_requests + $1,
                avg_quality_score = (learning_metrics.avg_quality_score * learning_metrics.total_requests + $2) / (learning_metrics.total_requests + 1),
                avg_attempts = (learning_metrics.avg_attempts * learning_metrics.total_requests + $3) / (learning_metrics.total_requests + 1)
        `;

        try {
            await this.pool.query(query, [successful ? 1 : 0, qualityScore, attempts]);
        } catch (error) {
            console.error('[METRICS] Failed to update metrics:', error.message);
        }
    }

    /**
     * Health check - verifies database connection
     */
    async healthCheck() {
        try {
            const result = await this.pool.query('SELECT NOW()');
            return { healthy: true, timestamp: result.rows[0].now };
        } catch (error) {
            return { healthy: false, error: error.message };
        }
    }

    /**
     * Graceful shutdown - close all connections
     */
    async close() {
        try {
            await this.pool.end();
            console.log('[DB] Connection pool closed');
        } catch (error) {
            console.error('[DB] Error closing pool:', error.message);
        }
    }
}

module.exports = DatabaseService;
