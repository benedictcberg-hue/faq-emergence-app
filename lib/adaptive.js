/**
 * AdaptiveLearner - Orchestrates the S-A-F-L-O adaptive learning framework
 * S: Sense (monitor quality)
 * A: Adapt (adjust parameters)
 * F: Feedback (evaluate results)
 * L: Learn (persist successful strategies)
 * O: Orchestrate (coordinate generation)
 */

class AdaptiveLearner {
    constructor(geminiService, qualityEvaluator, databaseService) {
        this.gemini = geminiService;
        this.quality = qualityEvaluator;
        this.db = databaseService;

        this.maxAttempts = 3;
        this.adaptiveStrategies = this._defineStrategies();
    }

    /**
     * Main entry point: Generate FAQ with adaptive learning
     */
    async generateWithLearning(prompt) {
        const attemptLog = [];
        let currentAttempt = 0;
        let bestResult = null;
        let bestQuality = 0;

        console.log(`[SAFLO] Starting adaptive generation for: "${prompt.substring(0, 50)}..."`);

        // Phase 1: Try with learned parameters first (if available)
        const learnedParams = await this.db.getBestParameters('success');

        if (learnedParams) {
            console.log('[SAFLO] Using learned parameters from previous successes');
            const result = await this._attemptGeneration(prompt, learnedParams, 'learned');

            attemptLog.push(result.log);

            if (result.quality.passed) {
                // Success on first try!
                await this._recordSuccess(prompt, result, 1, attemptLog);
                return this._formatResponse(result, attemptLog, 1);
            }

            if (result.quality.score > bestQuality) {
                bestResult = result;
                bestQuality = result.quality.score;
            }
            currentAttempt++;
        }

        // Phase 2: Try default parameters
        const defaultParams = this.gemini.defaultParams;
        const defaultResult = await this._attemptGeneration(prompt, defaultParams, 'default');

        attemptLog.push(defaultResult.log);
        currentAttempt++;

        if (defaultResult.quality.passed) {
            await this._recordSuccess(prompt, defaultResult, currentAttempt, attemptLog);
            return this._formatResponse(defaultResult, attemptLog, currentAttempt);
        }

        if (defaultResult.quality.score > bestQuality) {
            bestResult = defaultResult;
            bestQuality = defaultResult.quality.score;
        }

        // Phase 3: Adaptive attempts using scenario-specific strategies
        const scenarioCode = this.quality.getScenarioCode(defaultResult.quality);
        console.log(`[SAFLO] Quality issue detected: ${scenarioCode}, trying adaptive strategies`);

        const strategies = this._getStrategiesForScenario(scenarioCode);

        for (const strategy of strategies) {
            if (currentAttempt >= this.maxAttempts) break;

            const adaptiveResult = await this._attemptGeneration(prompt, strategy.params, strategy.name);
            attemptLog.push(adaptiveResult.log);
            currentAttempt++;

            if (adaptiveResult.quality.passed) {
                // Learn from this success
                await this._recordSuccess(prompt, adaptiveResult, currentAttempt, attemptLog);
                await this.db.learnParameters(scenarioCode, strategy.params, adaptiveResult.quality.score);

                return this._formatResponse(adaptiveResult, attemptLog, currentAttempt);
            }

            if (adaptiveResult.quality.score > bestQuality) {
                bestResult = adaptiveResult;
                bestQuality = adaptiveResult.quality.score;
            }
        }

        // All attempts exhausted - return best result
        console.log(`[SAFLO] Max attempts reached. Best quality: ${bestQuality}`);

        await this._recordFailure(prompt, bestResult, currentAttempt, attemptLog);

        return this._formatResponse(bestResult, attemptLog, currentAttempt);
    }

    /**
     * Attempt generation with specific parameters
     */
    async _attemptGeneration(prompt, params, strategyName) {
        console.log(`[ATTEMPT] Strategy: ${strategyName}, Params: ${JSON.stringify(params)}`);

        const startTime = Date.now();
        const geminiResult = await this.gemini.generateFAQ(prompt, params);
        const duration = Date.now() - startTime;

        if (!geminiResult.success) {
            return {
                success: false,
                quality: { score: 0, passed: false, level: 'failed' },
                data: null,
                log: {
                    strategy: strategyName,
                    params,
                    error: geminiResult.error,
                    duration
                }
            };
        }

        const qualityResult = this.quality.evaluateQuality(geminiResult.data, prompt);

        console.log(`[RESULT] Quality: ${qualityResult.score} (${qualityResult.level}), Duration: ${duration}ms`);

        return {
            success: true,
            quality: qualityResult,
            data: geminiResult.data,
            metadata: geminiResult.metadata,
            log: {
                strategy: strategyName,
                params,
                qualityScore: qualityResult.score,
                qualityLevel: qualityResult.level,
                breakdown: qualityResult.breakdown,
                duration
            }
        };
    }

    /**
     * Record successful generation
     */
    async _recordSuccess(prompt, result, attempts, attemptLog) {
        // Log to database
        await this.db.logGeneration(
            prompt,
            result.data,
            result.quality.score,
            attempts,
            result.log.params
        );

        // Update metrics
        await this.db.updateMetrics(true, result.quality.score, attempts);

        // Learn successful parameters
        await this.db.learnParameters('success', result.log.params, result.quality.score);

        console.log(`[SUCCESS] FAQ generated successfully in ${attempts} attempt(s)`);
    }

    /**
     * Record failed generation attempts
     */
    async _recordFailure(prompt, result, attempts, attemptLog) {
        const errorMsg = `Failed to meet quality threshold after ${attempts} attempts`;

        await this.db.logGeneration(
            prompt,
            result?.data || {},
            result?.quality.score || 0,
            attempts,
            result?.log.params || {},
            errorMsg
        );

        await this.db.updateMetrics(false, result?.quality.score || 0, attempts);

        console.log(`[FAILURE] ${errorMsg}`);
    }

    /**
     * Format final response
     */
    _formatResponse(result, attemptLog, totalAttempts) {
        return {
            success: result.success && result.quality.passed,
            faq: result.data,
            quality: {
                score: result.quality.score,
                level: result.quality.level,
                breakdown: result.quality.breakdown
            },
            metadata: {
                attempts: totalAttempts,
                attemptLog,
                model: result.metadata?.model
            }
        };
    }

    /**
     * Define adaptive strategies for different scenarios
     */
    _defineStrategies() {
        return {
            incomplete_response: [
                { name: 'increase_tokens', params: { temperature: 0.7, maxTokens: 1500, topP: 0.9 } },
                { name: 'structured_prompt', params: { temperature: 0.5, maxTokens: 1200, topP: 0.85 } }
            ],
            length_issue: [
                { name: 'adjust_length', params: { temperature: 0.6, maxTokens: 1200, topP: 0.88 } },
                { name: 'balanced_output', params: { temperature: 0.7, maxTokens: 1000, topP: 0.9 } }
            ],
            structure_issue: [
                { name: 'lower_temp', params: { temperature: 0.4, maxTokens: 1024, topP: 0.8 } },
                { name: 'focused_gen', params: { temperature: 0.5, maxTokens: 1100, topP: 0.85 } }
            ],
            relevance_issue: [
                { name: 'precise_mode', params: { temperature: 0.3, maxTokens: 1024, topP: 0.75 } },
                { name: 'conservative', params: { temperature: 0.4, maxTokens: 900, topP: 0.8 } }
            ],
            quality_low: [
                { name: 'creative_boost', params: { temperature: 0.8, maxTokens: 1200, topP: 0.92 } },
                { name: 'balanced', params: { temperature: 0.6, maxTokens: 1100, topP: 0.87 } }
            ]
        };
    }

    /**
     * Get strategies for a specific scenario
     */
    _getStrategiesForScenario(scenarioCode) {
        return this.adaptiveStrategies[scenarioCode] || this.adaptiveStrategies.quality_low;
    }
}

module.exports = AdaptiveLearner;
