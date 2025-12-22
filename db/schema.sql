-- FAQ Emergence App - Database Schema for Neon PostgreSQL
-- This schema supports the adaptive learning framework

-- Table: adaptive_params
-- Stores successful parameter combinations for different quality scenarios
CREATE TABLE IF NOT EXISTS adaptive_params (
    id SERIAL PRIMARY KEY,
    scenario_code VARCHAR(50) NOT NULL,
    params JSONB NOT NULL,
    quality_score FLOAT NOT NULL,
    success_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_scenario_params UNIQUE (scenario_code, params)
);

-- Index for faster lookups by scenario
CREATE INDEX IF NOT EXISTS idx_adaptive_params_scenario ON adaptive_params(scenario_code);
CREATE INDEX IF NOT EXISTS idx_adaptive_params_quality ON adaptive_params(quality_score DESC);

-- Table: faq_generations
-- Audit log of all FAQ generation attempts
CREATE TABLE IF NOT EXISTS faq_generations (
    id SERIAL PRIMARY KEY,
    prompt TEXT NOT NULL,
    response JSONB NOT NULL,
    quality_score FLOAT,
    attempts_count INTEGER DEFAULT 1,
    params_used JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_faq_generations_created ON faq_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_faq_generations_quality ON faq_generations(quality_score DESC);

-- Table: learning_metrics
-- Tracks overall system learning performance
CREATE TABLE IF NOT EXISTS learning_metrics (
    id SERIAL PRIMARY KEY,
    metric_date DATE DEFAULT CURRENT_DATE,
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    avg_quality_score FLOAT,
    avg_attempts FLOAT,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_metric_date UNIQUE (metric_date)
);

-- Function to update adaptive params with learning
CREATE OR REPLACE FUNCTION update_adaptive_param(
    p_scenario_code VARCHAR(50),
    p_params JSONB,
    p_quality_score FLOAT
) RETURNS void AS $$
BEGIN
    INSERT INTO adaptive_params (scenario_code, params, quality_score, success_count, updated_at)
    VALUES (p_scenario_code, p_params, p_quality_score, 1, NOW())
    ON CONFLICT (scenario_code, params)
    DO UPDATE SET
        success_count = adaptive_params.success_count + 1,
        quality_score = CASE
            WHEN p_quality_score > adaptive_params.quality_score
            THEN p_quality_score
            ELSE adaptive_params.quality_score
        END,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get best parameters for a scenario
CREATE OR REPLACE FUNCTION get_best_params(p_scenario_code VARCHAR(50))
RETURNS TABLE(params JSONB, quality_score FLOAT) AS $$
BEGIN
    RETURN QUERY
    SELECT ap.params, ap.quality_score
    FROM adaptive_params ap
    WHERE ap.scenario_code = p_scenario_code
    ORDER BY ap.quality_score DESC, ap.success_count DESC, ap.updated_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Initial seed data for common scenarios
INSERT INTO adaptive_params (scenario_code, params, quality_score, success_count)
VALUES
    ('default', '{"temperature": 0.7, "maxTokens": 1024, "topP": 0.9}', 0.75, 0),
    ('technical', '{"temperature": 0.3, "maxTokens": 1500, "topP": 0.8}', 0.70, 0),
    ('creative', '{"temperature": 0.9, "maxTokens": 1024, "topP": 0.95}', 0.70, 0)
ON CONFLICT (scenario_code, params) DO NOTHING;
