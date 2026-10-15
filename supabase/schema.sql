-- ==============================================================================
-- SplitStack SG: Supabase Database Schema
-- Table: card_rules
-- Stores credit card rules, earning rates, spend caps, and eligible MCC arrays
-- ==============================================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.card_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_name VARCHAR(100) NOT NULL,
    bank VARCHAR(60) NOT NULL,
    owner VARCHAR(60) NOT NULL DEFAULT 'Ryan Tan',
    base_earn_rate VARCHAR(50) NOT NULL DEFAULT '0.4 MPD',
    bonus_earn_rate VARCHAR(50) NOT NULL DEFAULT '4.0 MPD',
    monthly_cap NUMERIC(10, 2) NOT NULL DEFAULT 1000.00,
    rounding_rule VARCHAR(20) NOT NULL DEFAULT '5_sgd_block' CHECK (rounding_rule IN ('5_sgd_block', '1_sgd_block', 'exact')),
    eligible_mccs JSONB NOT NULL DEFAULT '[]'::jsonb,
    key_exclusions TEXT[] DEFAULT ARRAY['tax', 'hospital', 'insurance', 'utilities'],
    billing_cycle_type VARCHAR(20) NOT NULL DEFAULT 'calendar' CHECK (billing_cycle_type IN ('calendar', 'statement')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Indexes for fast query lookup
CREATE INDEX IF NOT EXISTS idx_card_rules_owner ON public.card_rules(owner);
CREATE INDEX IF NOT EXISTS idx_card_rules_mccs ON public.card_rules USING gin(eligible_mccs);

-- 3. Row Level Security (RLS) policies
ALTER TABLE public.card_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access for household members" 
    ON public.card_rules FOR SELECT 
    USING (true);

CREATE POLICY "Allow authenticated household write access" 
    ON public.card_rules FOR ALL 
    USING (true);

-- 4. Initial Seed Data matching Singapore card market rules
INSERT INTO public.card_rules (card_name, bank, owner, base_earn_rate, bonus_earn_rate, monthly_cap, rounding_rule, eligible_mccs, key_exclusions)
VALUES 
    (
        'UOB One Card',
        'UOB',
        'Ryan Tan',
        '0.05% Cashback',
        '5.0% Cashback (Tier 2)',
        2000.00,
        '5_sgd_block',
        '["5411", "4900", "4814", "5814"]'::jsonb,
        ARRAY['tax', 'hospital', 'insurance']
    ),
    (
        'Citi Rewards + Amaze',
        'Citibank + Instarem',
        'Ryan Tan',
        '0.4 MPD',
        '4.0 MPD (10X Points)',
        1000.00,
        '1_sgd_block',
        '["5311", "5651", "5691", "5814", "5941", "5942", "5944"]'::jsonb,
        ARRAY['airlines', 'utilities', 'travel']
    ),
    (
        'HSBC Revolution',
        'HSBC',
        'Sarah Chen',
        '0.4 MPD',
        '4.0 MPD (10X Points)',
        1000.00,
        '1_sgd_block',
        '["5411", "5812", "5814", "5813", "5912"]'::jsonb,
        ARRAY['tax', 'school_fees']
    ),
    (
        'DBS Woman''s World',
        'DBS Bank',
        'Ken Lim',
        '0.4 MPD',
        '4.0 MPD (10X DBS Points)',
        1500.00,
        '5_sgd_block',
        '["5311", "5411", "5651", "5712", "5814", "5815", "4511"]'::jsonb,
        ARRAY['crypto', 'gambling']
    ),
    (
        'DBS Altitude Visa',
        'DBS Bank',
        'Ryan Tan',
        '1.3 MPD',
        '2.2 MPD (Overseas FCY)',
        0.00,
        '5_sgd_block',
        '[]'::jsonb,
        ARRAY[]::text[]
    )
ON CONFLICT (id) DO NOTHING;
