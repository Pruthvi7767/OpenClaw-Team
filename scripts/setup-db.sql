-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. System State
CREATE TABLE IF NOT EXISTS system_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    status TEXT DEFAULT 'STOPPED',
    last_started_at TIMESTAMPTZ,
    last_stopped_at TIMESTAMPTZ,
    total_runtime_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- 2. API Credits
CREATE TABLE IF NOT EXISTS api_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service TEXT NOT NULL UNIQUE,
    account_name TEXT NOT NULL,
    daily_used INTEGER DEFAULT 0,
    monthly_used INTEGER DEFAULT 0,
    daily_limit INTEGER NOT NULL,
    monthly_limit INTEGER NOT NULL,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default API limits
INSERT INTO api_credits (service, account_name, daily_limit, monthly_limit) VALUES
('serper', 'account_1', 80, 2500),
('apify_scraper', 'account_1', 5, 150),
('apify_maps', 'account_2', 3, 100),
('gmail', 'primary', 50, 1500),
('openrouter', 'free', 200, 6000),
('nvidia', 'free', 1000, 30000)
ON CONFLICT (service) DO NOTHING;

-- 3. Clients
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE,
    company_name TEXT,
    website TEXT NOT NULL UNIQUE,
    
    status TEXT DEFAULT 'new',
    payment_status TEXT DEFAULT 'pending',
    unique_amount DECIMAL(10,2),
    payment_detected_at TIMESTAMPTZ,
    
    report_sent BOOLEAN DEFAULT false,
    report_sent_at TIMESTAMPTZ,
    preview_sent BOOLEAN DEFAULT false,
    
    last_contact_date DATE,
    total_reports_purchased INTEGER DEFAULT 0,
    
    spam_score INTEGER DEFAULT 0,
    is_blacklisted BOOLEAN DEFAULT false,
    
    lead_score INTEGER DEFAULT 0,
    scraped_data JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Email Campaigns
CREATE TABLE IF NOT EXISTS email_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    email_type TEXT,
    subject TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    reply_content TEXT,
    status TEXT DEFAULT 'sent'
);

-- 5. Employee Logs
CREATE TABLE IF NOT EXISTS employee_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_name TEXT NOT NULL,
    action TEXT NOT NULL,
    details JSONB,
    status TEXT DEFAULT 'success',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. CEO Decisions
CREATE TABLE IF NOT EXISTS ceo_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    decision_type TEXT,
    reason TEXT,
    action_taken TEXT,
    impact JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Daily Reports
CREATE TABLE IF NOT EXISTS daily_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_date DATE DEFAULT CURRENT_DATE UNIQUE,
    leads_generated INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    replies_received INTEGER DEFAULT 0,
    payments_received INTEGER DEFAULT 0,
    revenue DECIMAL(10,2) DEFAULT 0,
    api_costs JSONB,
    employee_performance JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Telegram Conversations
CREATE TABLE IF NOT EXISTS telegram_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id BIGINT NOT NULL,
    message_type TEXT,
    user_message TEXT,
    sora_response TEXT,
    context JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_payment ON clients(payment_status);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_emails_client ON email_campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_emails_sent ON email_campaigns(sent_at);
CREATE INDEX IF NOT EXISTS idx_employee_logs_date ON employee_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_employee_logs_name ON employee_logs(employee_name);
CREATE INDEX IF NOT EXISTS idx_telegram_user ON telegram_conversations(user_id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for clients table
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to reset daily API credits
CREATE OR REPLACE FUNCTION reset_daily_credits()
RETURNS void AS $$
BEGIN
    UPDATE api_credits
    SET daily_used = 0,
        last_reset_date = CURRENT_DATE
    WHERE last_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;
