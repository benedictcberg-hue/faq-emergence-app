// ====================================================================
// --- I. KONSTANTEN UND ABHÄNGIGKEITEN ---
// ====================================================================
const { Client } = require('pg'); 

const LLM_API_KEY = process.env.GEMINI_API_KEY; 
const DB_URL = process.env.NETLIFY_DATABASE_URL; 

const QUALITY_THRESHOLD = 0.8; 
const MAX_ADAPTIVE_ATTEMPTS = 3; 

// ====================================================================
// --- II. SSSInterface (L: Lernen & Persistenz via Neon DB) ---
// ====================================================================
class SSSInterface {
    // ... [Der vollständige Code der Klasse SSSInterface]
    constructor(dbUrl) {
        this.dbUrl = dbUrl;
    }

    async _getClient() {
        if (!this.dbUrl) {
            throw new Error("Datenbank-URL (NETLIFY_DATABASE_URL) fehlt.");
        }
        const client = new Client({ connectionString: this.dbUrl });
        await client.connect();
        return client;
    }

    // L: Lernen und Speichern der erfolgreichen Sequenz (ASYNCHRON)
    async learnAndStoreSequence(pqsCode, sequence) {
        const client = await this._getClient();
        try {
            const currentRecord = await client.query('SELECT weight_ws FROM sss_cache WHERE pqs_code = $1', [pqsCode]);
            const currentWeight = currentRecord.rows[0]?.weight_ws || 0;
            
            const sequenceLength = sequence.length;
            const newWeight = parseFloat((currentWeight + (1.0 / sequenceLength)).toFixed(2)); 

            const query = `
                INSERT INTO sss_cache (pqs_code, sequence_json, weight_ws, updated_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (pqs_code) DO UPDATE
                SET sequence_json = EXCLUDED.sequence_json, weight_ws = EXCLUDED.weight_ws, updated_at = NOW()
            `;
            await client.query(query, [pqsCode, JSON.stringify(sequence), newWeight]);
        } finally {
            await client.end();
        }
    }

    // A: Abrufen für den Warmstart (ASYNCHRON)
    async getBestSequence(pqsCode) {
        const client = await this._getClient();
        try {
            const result = await client.query('SELECT sequence_json FROM sss_cache WHERE pqs_code = $1', [pqsCode]);
            if (result.rows.length > 0) {
                return JSON.parse(result.rows[0].sequence_json);
            }
            return null;
        } finally {
            await client.end();
        }
    }

    // A: Abrufen des adaptivsten Parameters für Dim5 (ASYNCHRON)
    async getHighestWeightedParam(pqsCode) {
        const sequence = await this.getBestSequence(pqsCode); 
        return (sequence && sequence.length > 0) ? sequence[sequence.length - 1] : null;
    }
}

// ====================================================================
// --- III. LLMInterface (O, S, F: Orchestrierung, Sensorik, Feedback) ---
// ====================================================================
class LLMInterface {
    // ... [Der vollständige Code der Klasse LLMInterface]
    constructor(apiKey) {
        this.API_KEY = apiKey;
        this.DEFAULT_PARAMS = { temp: 0.5, top_k: 40, desc: 'Initial Default' };
        this.QUALITY_WEIGHTS = { schema: 0.5, facts: 0.3, coherence: 0.2 }; 
    }

    async generate(prompt, params) {
        const rawOutput = await this._callLlmService(prompt, params); 
        const schemaCompliance = (rawOutput.temp < 0.4) ? 1.0 : (Math.random() > 0.1 ? 1.0 : 0.0);

        if (schemaCompliance < 0.5) { 
            const pqsSignal = this._createPqsSignal('FAILURE', 'E501', true); 
            return { faqOutput: {}, pqsSignal };
        }
        
        const factScore = 0.8 + Math.random() * 0.2; 
        const coherenceScore = 0.7 + Math.random() * 0.3; 
        const fScore = (this.QUALITY_WEIGHTS.schema * schemaCompliance) + 
                       (this.QUALITY_WEIGHTS.facts * factScore) +
                       (this.QUALITY_WEIGHTS.coherence * coherenceScore);
        
        const pqsCode = (fScore < 0.7) ? 'E302' : 'P200';
        
        const status = (pqsCode === 'P200') ? 'OK' : 'FAILURE';
        const pqsSignal = this._createPqsSignal(status, pqsCode, false);
        
        rawOutput.f_score = parseFloat(fScore.toFixed(2)); 
        return { faqOutput: rawOutput, pqsSignal };
    }

    _createPqsSignal(status, code, isDim5) {
        return { status, code, is_dim5: isDim5, timestamp: new Date().toISOString() };
    }
    
    async _callLlmService(prompt, params) {
        if (!this.API_KEY) {
             console.warn("WARNUNG: GEMINI_API_KEY fehlt. Simuliere LLM-Output.");
        }
        
        console.log(`[O] Generiere Output (Prompt: ${prompt.substring(0, 15)}...) mit Params: ${params.desc}`);
        return { 
            faq_title: "Generierter FAQ Titel (Simuliert)",
            faq_answer: `Generierte Antwort mit Temperatur ${params.temp}. Dieses Ergebnis wurde von der LLM-Simulation bereitgestellt.`,
            temp: params.temp 
        };
    }
}


// ====================================================================
// --- IV. AdaptiveEngine (Das Gehirn: S-A-F-L-O-Logik) ---
// ====================================================================
class AdaptiveEngine {
    // ... [Der vollständige Code der Klasse AdaptiveEngine]
    constructor(sssInterface, llmInterface, qualityThreshold) {
        this.sss = sssInterface;             
        this.llm = llmInterface;             
        this.QUALITY_THRESHOLD = qualityThreshold; 
        this.MAX_ATTEMPTS = MAX_ADAPTIVE_ATTEMPTS; 
    }

    async generate_faq_autonomously(prompt, defaultParams) {
        const pqsLog = []; 
        let { faqOutput, pqsSignal } = await this.llm.generate(prompt, defaultParams);
        pqsLog.push({ attempt: 0, params: defaultParams, pqs: pqsSignal.code });
        
        if (pqsSignal.status === 'OK') {
            return { faq_output: faqOutput, pqs_log: pqsLog }; 
        }

        return this._handleFailureMode(prompt, pqsSignal, pqsLog);
    }

    async _handleFailureMode(prompt, pqsSignal, pqsLog) {
        const code = pqsSignal.code;

        if (pqsSignal.is_dim5) {
            console.error(`🚨 KRITISCHER ALARM (DIM5: ${code}). Führe Fallback aus.`);
            const bestParam = await this.sss.getHighestWeightedParam(code) || this.llm.DEFAULT_PARAMS;
            const { faqOutput } = await this.llm.generate(prompt, bestParam);
            pqsLog.push({ attempt: 'DIM5_Fallback', params: bestParam, pqs: 'DIM5' });
            return { faq_output: faqOutput, pqs_log: pqsLog }; 
        }

        const adaptiveSequence = await this.sss.getBestSequence(code) || 
                                 this._generateExpansionSequence(code); 
        
        let successfulSequence = [];
        let finalOutput = null;

        for (let i = 0; i < adaptiveSequence.length && i < this.MAX_ATTEMPTS; i++) {
            const paramsToTest = adaptiveSequence[i];
            
            const { faqOutput: testOutput, pqsSignal: testPqs } = await this.llm.generate(prompt, paramsToTest);
            const fScore = testOutput.f_score; 
            
            pqsLog.push({ attempt: i + 1, params: paramsToTest, f_score: fScore, pqs: testPqs.code });
            
            if (fScore >= this.QUALITY_THRESHOLD) {
                successfulSequence.push(paramsToTest);
                finalOutput = testOutput;

                await this.sss.learnAndStoreSequence(code, successfulSequence); 
                
                console.log(`✅ Qualität erreicht nach ${i + 1} Versuch(en). SSS (Neon) aktualisiert.`);
                return { faq_output: finalOutput, pqs_log: pqsLog };
            }
            
            successfulSequence.push(paramsToTest);
        }

        console.warn(`⚠️ Maximale Versuche ohne Qualitätserfolg für Code ${code}.`);
        return { faq_output: finalOutput || faqOutput, pqs_log: pqsLog };
    }
    
    _generateExpansionSequence(code) {
        return [
            { temp: 0.3, top_k: 20, desc: 'Strict Stabilization' }, 
            { temp: 0.8, top_k: 80, desc: 'Creative Exploration' },
            { temp: 0.5, top_k: 50, desc: 'Balanced Retrial' }
        ];
    }
}

// ====================================================================
// --- V. Netlify Handler (Der API-Endpunkt) ---
// ====================================================================
exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Methode nicht erlaubt' };
    }
    
    if (!DB_URL) {
         return { statusCode: 500, body: 'FEHLER: NETLIFY_DATABASE_URL Umgebungsvariable fehlt. Bitte prüfen Sie die Konfiguration.' };
    }
    
    try {
        const { prompt, default_params } = JSON.parse(event.body);

        const sssInterface = new SSSInterface(DB_URL); 
        const llmInterface = new LLMInterface(LLM_API_KEY);
        const adaptiveEngine = new AdaptiveEngine(sssInterface, llmInterface, QUALITY_THRESHOLD);

        const result = await adaptiveEngine.generate_faq_autonomously(prompt, default_params || llmInterface.DEFAULT_PARAMS);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                faq_output: result.faq_output,
                pqs_log: result.pqs_log 
            }),
        };

    } catch (error) {
        console.error("Netlify Function Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Interner Serverfehler im Emergenz-Framework. Prüfen Sie Neon/Netlify-Logs.', 
                message: error.message 
            }),
        };
    }
};
