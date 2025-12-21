/**
 * GeminiService - Interface to Google Gemini API
 * Handles FAQ generation with configurable parameters
 */

class GeminiService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
        this.model = 'gemini-1.5-flash';
        this.defaultParams = {
            temperature: 0.7,
            maxTokens: 1024,
            topP: 0.9
        };
    }

    /**
     * Generate FAQ response using Gemini API
     */
    async generateFAQ(prompt, params = {}) {
        // Merge with defaults
        const config = { ...this.defaultParams, ...params };

        // Build the FAQ-optimized prompt
        const systemPrompt = `You are an expert FAQ generator. Create clear, concise, and helpful FAQ entries.
For the given question, generate a response in JSON format with:
- title: A clear, specific FAQ title
- answer: A comprehensive but concise answer (2-4 paragraphs)
- category: The topic category
- keywords: Array of relevant keywords

Keep answers accurate, helpful, and easy to understand.`;

        const fullPrompt = `${systemPrompt}\n\nQuestion: ${prompt}\n\nGenerate the FAQ entry:`;

        try {
            // Call Gemini API
            const response = await this._callAPI(fullPrompt, config);

            // Parse and validate response
            const faqData = this._parseResponse(response);

            return {
                success: true,
                data: faqData,
                metadata: {
                    model: this.model,
                    params: config,
                    tokensUsed: response.usageMetadata || {}
                }
            };
        } catch (error) {
            console.error('[GEMINI] Generation failed:', error.message);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Make API call to Gemini
     */
    async _callAPI(prompt, config) {
        if (!this.apiKey) {
            // Mock response for development/testing
            console.warn('[GEMINI] No API key - using mock response');
            return this._mockResponse(prompt, config);
        }

        const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: config.temperature,
                maxOutputTokens: config.maxTokens,
                topP: config.topP
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('No response generated from Gemini');
        }

        return {
            text: data.candidates[0].content.parts[0].text,
            usageMetadata: data.usageMetadata
        };
    }

    /**
     * Parse Gemini response into structured FAQ data
     */
    _parseResponse(response) {
        try {
            // Try to extract JSON from response
            const text = response.text;

            // Look for JSON block in markdown code fence or raw JSON
            const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                            text.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const jsonStr = jsonMatch[1] || jsonMatch[0];
                const parsed = JSON.parse(jsonStr);

                // Validate required fields
                if (!parsed.title || !parsed.answer) {
                    throw new Error('Missing required fields: title and answer');
                }

                return {
                    title: parsed.title,
                    answer: parsed.answer,
                    category: parsed.category || 'General',
                    keywords: parsed.keywords || [],
                    rawResponse: text
                };
            }

            // Fallback: treat as plain text answer
            return {
                title: 'FAQ Response',
                answer: text,
                category: 'General',
                keywords: [],
                rawResponse: text
            };
        } catch (error) {
            console.error('[GEMINI] Parse error:', error.message);
            throw new Error(`Failed to parse FAQ response: ${error.message}`);
        }
    }

    /**
     * Mock response for testing without API key
     */
    _mockResponse(prompt, config) {
        const mockAnswers = {
            title: 'Understanding the Topic',
            answer: `This is a comprehensive answer generated with temperature ${config.temperature}.

The response addresses the question thoroughly while maintaining clarity and accuracy. The content is structured to provide immediate value to the reader.

Additional context and details are provided here to ensure complete understanding of the topic.`,
            category: 'General',
            keywords: ['faq', 'information', 'help']
        };

        return {
            text: JSON.stringify(mockAnswers),
            usageMetadata: {
                promptTokens: 100,
                candidatesTokens: 150,
                totalTokens: 250
            }
        };
    }

    /**
     * Validate API configuration
     */
    isConfigured() {
        return !!this.apiKey;
    }
}

module.exports = GeminiService;
