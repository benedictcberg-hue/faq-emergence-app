#!/usr/bin/env node
/**
 * Demo Server - Runs FAQ Emergence App in mock mode
 * No database or API required - perfect for testing the UI/UX
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8888;

// Mock in-memory database
const mockDB = {
    adaptiveParams: [],
    generations: [],
    successCount: 0
};

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
};

// Mock FAQ generator
function generateMockFAQ(prompt, params) {
    const templates = [
        {
            title: "Understanding {topic}",
            answer: "This is a comprehensive answer about {topic}.\n\n{topic} is an important concept that involves multiple aspects. The key points to understand include the fundamental principles, practical applications, and real-world examples.\n\nAdditionally, it's worth noting that {topic} has evolved significantly over time and continues to be relevant in modern contexts."
        },
        {
            title: "{topic} Explained",
            answer: "Let me explain {topic} in detail.\n\n{topic} works by combining several key elements: theoretical foundations, practical implementation, and continuous improvement. Understanding these components helps you grasp the full picture.\n\nMoreover, {topic} plays a crucial role in various applications and scenarios that you encounter daily."
        },
        {
            title: "A Guide to {topic}",
            answer: "Here's a comprehensive guide to understanding {topic}.\n\nFirst, {topic} involves understanding the basic concepts and principles. Second, you need to consider the practical applications and use cases. Finally, real-world examples help solidify your understanding.\n\n{topic} is essential for anyone looking to deepen their knowledge in this area."
        }
    ];

    // Extract topic from prompt
    const topic = prompt.replace(/^(what is|how does|explain|tell me about|what are)\s*/i, '').trim() || 'the topic';

    // Select random template
    const template = templates[Math.floor(Math.random() * templates.length)];

    // Generate FAQ
    const faq = {
        title: template.title.replace(/{topic}/g, topic),
        answer: template.answer.replace(/{topic}/g, topic),
        category: 'General',
        keywords: topic.split(' ').slice(0, 5)
    };

    // Simulate quality based on temperature (lower temp = higher quality)
    const baseQuality = 0.6 + (Math.random() * 0.2);
    const tempBonus = (1 - (params.temperature || 0.7)) * 0.2;
    const qualityScore = Math.min(baseQuality + tempBonus, 0.95);

    // Quality breakdown
    const breakdown = {
        completeness: 0.8 + Math.random() * 0.2,
        length: 0.7 + Math.random() * 0.25,
        structure: 0.75 + Math.random() * 0.2,
        relevance: 0.65 + Math.random() * 0.3
    };

    const level = qualityScore >= 0.85 ? 'excellent' :
                  qualityScore >= 0.70 ? 'good' :
                  qualityScore >= 0.50 ? 'acceptable' : 'poor';

    return {
        faq,
        qualityScore,
        breakdown,
        level,
        passed: qualityScore >= 0.5
    };
}

// Adaptive learning simulation
function adaptiveGeneration(prompt) {
    const attemptLog = [];
    let attempt = 0;

    // Try with learned params if available
    if (mockDB.adaptiveParams.length > 0 && mockDB.successCount > 2) {
        const learnedParams = mockDB.adaptiveParams[0];
        const result = generateMockFAQ(prompt, learnedParams);
        attemptLog.push({
            strategy: 'learned',
            params: learnedParams,
            qualityScore: result.qualityScore,
            qualityLevel: result.level,
            duration: 800 + Math.random() * 400
        });

        if (result.passed) {
            mockDB.successCount++;
            return { success: true, result, attemptLog };
        }
        attempt++;
    }

    // Try default
    const defaultParams = { temperature: 0.7, maxTokens: 1024, topP: 0.9 };
    const defaultResult = generateMockFAQ(prompt, defaultParams);
    attemptLog.push({
        strategy: 'default',
        params: defaultParams,
        qualityScore: defaultResult.qualityScore,
        qualityLevel: defaultResult.level,
        duration: 900 + Math.random() * 500
    });

    if (defaultResult.passed) {
        mockDB.successCount++;
        mockDB.adaptiveParams.unshift(defaultParams);
        return { success: true, result: defaultResult, attemptLog };
    }
    attempt++;

    // Adaptive attempts
    const strategies = [
        { name: 'lower_temp', params: { temperature: 0.4, maxTokens: 1200, topP: 0.8 } },
        { name: 'creative_boost', params: { temperature: 0.8, maxTokens: 1200, topP: 0.92 } }
    ];

    for (const strategy of strategies) {
        if (attempt >= 3) break;

        const result = generateMockFAQ(prompt, strategy.params);
        attemptLog.push({
            strategy: strategy.name,
            params: strategy.params,
            qualityScore: result.qualityScore,
            qualityLevel: result.level,
            duration: 850 + Math.random() * 450
        });

        if (result.passed) {
            mockDB.successCount++;
            mockDB.adaptiveParams.unshift(strategy.params);
            return { success: true, result, attemptLog };
        }
        attempt++;
    }

    // Return best attempt
    return { success: defaultResult.passed, result: defaultResult, attemptLog };
}

// HTTP Server
const server = http.createServer((req, res) => {
    // Handle serverless function
    if (req.url === '/.netlify/functions/generate_faq' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { prompt } = JSON.parse(body);

                if (!prompt || prompt.length < 5) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid prompt' }));
                    return;
                }

                const startTime = Date.now();
                const { success, result, attemptLog } = adaptiveGeneration(prompt);
                const totalDuration = Date.now() - startTime;

                mockDB.generations.push({ prompt, quality: result.qualityScore });

                res.writeHead(200, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });

                res.end(JSON.stringify({
                    success,
                    faq: result.faq,
                    quality: {
                        score: result.qualityScore,
                        level: result.level,
                        breakdown: result.breakdown
                    },
                    metadata: {
                        attempts: attemptLog.length,
                        attemptLog,
                        totalDuration,
                        model: 'gemini-2.0-flash-exp (mock)'
                    },
                    message: success
                        ? '✅ FAQ generated successfully (DEMO MODE - No API/DB required)'
                        : 'FAQ generated but quality threshold not met (DEMO MODE)'
                }));

            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    // Serve static files
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('🧠  FAQ EMERGENCE - DEMO MODE');
    console.log('='.repeat(60));
    console.log(`\n✅ Server running at: http://localhost:${PORT}`);
    console.log('\n📝 Demo Mode Features:');
    console.log('   • Mock AI responses (no Gemini API needed)');
    console.log('   • In-memory adaptive learning');
    console.log('   • Full UI/UX demonstration');
    console.log('   • Quality evaluation system');
    console.log('\n💡 Note: This is a demo without real database or API');
    console.log('   For production: Set DATABASE_URL and GEMINI_API_KEY');
    console.log('\n' + '='.repeat(60));
    console.log(`\n🚀 Open your browser to http://localhost:${PORT}\n`);
    console.log('Press Ctrl+C to stop\n');
});
