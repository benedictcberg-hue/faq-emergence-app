// ====================================================================
// --- I. KONSTANTEN UND ABHÄNGIGKEITEN ---
// ====================================================================
// WICHTIG: Die 'pg' Abhängigkeit wird für die Neon-Datenbank benötigt.
const { Client } = require('pg'); 

const LLM_API_KEY = process.env.GEMINI_API_KEY; 
const DB_URL = process.env.DATABASE_URL; // Standardkonvention in vielen Hosts (Vercel verwendet oft DATABASE_URL)

// Emergenz-Architektur 2.0 Parameter
const QUALITY_THRESHOLD = 0.85; 
const MAX_ADAPTIVE_ATTEMPTS = 3; 
const BASE_MODEL = "gemini-2.5-flash-preview-09-2025";
const EMERGENCY_MODEL_FALLBACK = "gemini-3-pro-lite-hypothetical"; 

// ====================================================================
// --- II. SSSInterface (L: Lernen & Persistenz via Neon DB) ---
//         Der EQS-Cache speichert erfolgreich adaptive Parameter
// ====================================================================
class SSSInterface {
    constructor(dbUrl) {
        this.dbUrl = dbUrl;
    }

    async _getClient() {
        if (!this.dbUrl) {
            // Generiere einen benutzerdefinierten Fehler, der spezifisch für die Umgebung ist
            throw new Error("Datenbank-URL (DATABASE_URL) fehlt. Bitte prüfen Sie die Umgebungsvariablen.");
        }
        // Client-Initialisierung mit der Verbindungsschnur
        const client = new Client({ connectionString: this.dbUrl });
        await client.connect(); 
        return client;
    }

    // L: Lernen und Speichern der erfolgreichen Adaption
    async learnAndStoreParam(pqsCode, successfulParam, eqsScore) {
        const client = await this._getClient();
        try {
            // SQL zur Speicherung des besten adaptiven Parameters für einen Fehlercode
            const query = `
                INSERT INTO eqs_cache (pqs_code, adaptive_param_json, eqs_score, updated_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (pqs_code) DO UPDATE
                SET adaptive_param_json = 
                    CASE WHEN EXCLUDED.eqs_score > eqs_cache.eqs_score 
                         THEN EXCLUDED.adaptive_param_json 
                         ELSE eqs_cache.adaptive_param_json END,
                    eqs_score = 
                    CASE WHEN EXCLUDED.eqs_score > eqs_cache.eqs_score 
                         THEN EXCLUDED.eqs_score 
                         ELSE eqs_cache.eqs_score END,
                    updated_at = NOW()
            `;
            await client.query(query, [pqsCode, JSON.stringify(successfulParam), eqsScore]);
            console.log(`[L] Bester adaptiver Parameter für ${pqsCode} (EQS: ${eqsScore}) im EQS-Cache protokolliert.`);
        } finally {
            await client.end();
        }
    }

    // A: Abrufen des adaptivsten Parameters für den Warmstart
    async getBestAdaptiveParam(pqsCode) {
        const client = await this._getClient();
        try {
            const result = await client.query('SELECT adaptive_param_json FROM eqs_cache WHERE pqs_code = $1 ORDER BY eqs_score DESC LIMIT 1', [pqsCode]);
            
            if (result.rows.length > 0) {
                return JSON.parse(result.rows[0].adaptive_param_json);
            }
            return null;
        } finally {
            await client.end();
        }
    }
}

// ====================================================================
// --- III. LLMInterface (O, S, F: Orchestrierung, Sensorik, Feedback) ---
// ====================================================================
class LLMInterface {
    constructor(apiKey) {
        this.API_KEY = apiKey;
        this.DEFAULT_PARAMS = { temp: 0.5, top_k: 40, model: BASE_MODEL, desc: 'Initial Default' };
        // Gewichte für den EQS-Score (Emergent Quality Score)
        this.EQS_WEIGHTS = { 
            flesch_kincaid: 0.4,    // Verständlichkeit
            answer_depth: 0.3,      // Detaillierung (Antwortlänge)
            source_trust: 0.3       // Vertrauenswürdigkeit der Quelle (Grounding)
        }; 
    }

    // O: Orchestrierung des API-Aufrufs und S: Sensorik des Outputs
    async generate(prompt, params) {
        let rawOutput = { faq_title: "Initial Output", faq_answer: "Initial Answer", temp: params.temp, model: params.model, content_length: 0 };
        let pqsSignal = this._createPqsSignal('OK', 'P200', false);
        let groundingMetadata = null;

        try {
            const llmResponse = await this._callLlmService(prompt, params);
            rawOutput = llmResponse.faqOutput;
            groundingMetadata = llmResponse.groundingMetadata;
            
            // 1. Kritikalitätsprüfung (Dim5 - Output Corrupt)
            if (!rawOutput.is_valid_json) { 
                pqsSignal = this._createPqsSignal('FAILURE', 'Dim5_OutputCorrupt', true); 
                console.error(`🚨 Dim5: Output Corrupt erkannt. JSON-LD-Struktur ungültig.`);
                return { faqOutput: rawOutput, pqsSignal };
            }

            // 2. Qualitätsprüfung (EQS)
            const eqsScore = this._calculateEQSScore(rawOutput, groundingMetadata);
            rawOutput.eqs_score = parseFloat(eqsScore.toFixed(3)); 
            
            if (eqsScore < this.QUALITY_THRESHOLD) {
                pqsSignal = this._createPqsSignal('FAILURE', 'E302_LowEQS', false);
            }

        } catch (error) {
            // 3. Kritikalitätsprüfung (Dim5 - System Freeze)
            if (error.httpStatus === 429) { 
                pqsSignal = this._createPqsSignal('FAILURE', 'Dim5_SystemFreeze_429', true);
                console.error(`🚨 Dim5: System Freeze (429) erkannt.`);
            } else {
                pqsSignal = this._createPqsSignal('FAILURE', 'E500_ApiError', false);
            }
            rawOutput.error_message = error.message;
        }
        
        return 