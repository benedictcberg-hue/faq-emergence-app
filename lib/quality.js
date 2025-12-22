/**
 * QualityEvaluator - Calculates quality scores for generated FAQ responses
 * Uses multiple metrics to assess response quality
 */

class QualityEvaluator {
    constructor() {
        // Weights for different quality metrics
        this.weights = {
            completeness: 0.35,      // Has all required fields
            length: 0.25,            // Appropriate answer length
            structure: 0.20,         // Well-structured content
            relevance: 0.20          // Keywords and category match
        };

        // Quality thresholds
        this.thresholds = {
            excellent: 0.85,
            good: 0.70,
            acceptable: 0.50,
            poor: 0.30
        };
    }

    /**
     * Calculate overall quality score for FAQ response
     */
    evaluateQuality(faqData, prompt) {
        const scores = {
            completeness: this._evaluateCompleteness(faqData),
            length: this._evaluateLength(faqData),
            structure: this._evaluateStructure(faqData),
            relevance: this._evaluateRelevance(faqData, prompt)
        };

        // Calculate weighted total score
        const totalScore = Object.keys(scores).reduce((sum, metric) => {
            return sum + (scores[metric] * this.weights[metric]);
        }, 0);

        // Determine quality level
        const level = this._getQualityLevel(totalScore);

        return {
            score: parseFloat(totalScore.toFixed(3)),
            level,
            breakdown: scores,
            passed: totalScore >= this.thresholds.acceptable
        };
    }

    /**
     * Evaluate completeness - checks if all required fields are present
     */
    _evaluateCompleteness(faqData) {
        const requiredFields = ['title', 'answer', 'category', 'keywords'];
        let score = 0;

        for (const field of requiredFields) {
            if (faqData[field]) {
                if (field === 'keywords' && Array.isArray(faqData[field]) && faqData[field].length > 0) {
                    score += 0.25;
                } else if (typeof faqData[field] === 'string' && faqData[field].trim().length > 0) {
                    score += 0.25;
                }
            }
        }

        return score;
    }

    /**
     * Evaluate answer length - checks if answer is appropriate length
     */
    _evaluateLength(faqData) {
        const answer = faqData.answer || '';
        const wordCount = answer.split(/\s+/).length;

        // Optimal: 50-300 words
        if (wordCount >= 50 && wordCount <= 300) {
            return 1.0;
        }
        // Acceptable: 30-50 or 300-500 words
        if (wordCount >= 30 && wordCount <= 500) {
            return 0.7;
        }
        // Too short or too long
        if (wordCount < 10) {
            return 0.1;
        }
        return 0.5;
    }

    /**
     * Evaluate structure - checks formatting and organization
     */
    _evaluateStructure(faqData) {
        const answer = faqData.answer || '';
        let score = 0;

        // Check for paragraphs (multiple lines)
        const paragraphs = answer.split('\n\n').filter(p => p.trim().length > 0);
        if (paragraphs.length >= 2) {
            score += 0.4;
        } else if (paragraphs.length === 1) {
            score += 0.2;
        }

        // Check for proper sentences (ends with punctuation)
        const sentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length >= 3) {
            score += 0.3;
        }

        // Check title quality (not too short, not too long)
        const title = faqData.title || '';
        const titleLength = title.split(/\s+/).length;
        if (titleLength >= 3 && titleLength <= 15) {
            score += 0.3;
        }

        return Math.min(score, 1.0);
    }

    /**
     * Evaluate relevance - checks if response matches the prompt
     */
    _evaluateRelevance(faqData, prompt) {
        let score = 0.5; // Base score

        const promptLower = prompt.toLowerCase();
        const answerLower = (faqData.answer || '').toLowerCase();
        const titleLower = (faqData.title || '').toLowerCase();

        // Extract key words from prompt (ignore common words)
        const stopWords = new Set(['what', 'how', 'why', 'when', 'where', 'who', 'is', 'are', 'the', 'a', 'an']);
        const promptWords = promptLower.split(/\s+/)
            .filter(w => w.length > 3 && !stopWords.has(w));

        // Check if prompt keywords appear in answer or title
        let matchCount = 0;
        for (const word of promptWords) {
            if (answerLower.includes(word) || titleLower.includes(word)) {
                matchCount++;
            }
        }

        if (promptWords.length > 0) {
            const matchRatio = matchCount / promptWords.length;
            score = Math.min(0.5 + (matchRatio * 0.5), 1.0);
        }

        return score;
    }

    /**
     * Determine quality level from score
     */
    _getQualityLevel(score) {
        if (score >= this.thresholds.excellent) return 'excellent';
        if (score >= this.thresholds.good) return 'good';
        if (score >= this.thresholds.acceptable) return 'acceptable';
        if (score >= this.thresholds.poor) return 'poor';
        return 'failed';
    }

    /**
     * Determine scenario code based on quality evaluation
     */
    getScenarioCode(qualityResult) {
        if (qualityResult.passed) {
            return 'success';
        }

        // Analyze which metrics failed to determine scenario
        const breakdown = qualityResult.breakdown;

        if (breakdown.completeness < 0.5) {
            return 'incomplete_response';
        }
        if (breakdown.length < 0.5) {
            return 'length_issue';
        }
        if (breakdown.structure < 0.5) {
            return 'structure_issue';
        }
        if (breakdown.relevance < 0.5) {
            return 'relevance_issue';
        }

        return 'quality_low';
    }

    /**
     * Get acceptable quality threshold
     */
    getAcceptableThreshold() {
        return this.thresholds.acceptable;
    }
}

module.exports = QualityEvaluator;
