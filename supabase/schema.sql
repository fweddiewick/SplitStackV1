-- ==============================================================================
-- SplitStack SG: Supabase Complete Database Schema & Cross-Device Real-Time Sync
--
-- This script is 100% idempotent: safe to run multiple times without any errors.
--
-- HOW TO RUN THIS SCRIPT:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/_/sql
-- 2. Click "New Query", paste this entire script, and click "Run".
-- 3. All tables, columns, indexes, RLS permissions, and Realtime publications
--    will be immediately verified and active.
-- ==============================================================================

-- 1. HOUSEHOLD MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.household_members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure all columns exist even if table was previously created
ALTER TABLE public.household_members ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Member';
ALTER TABLE public.household_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';
ALTER TABLE public.household_members ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.household_members ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.household_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.household_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access for household_members" ON public.household_members;
DROP POLICY IF EXISTS "Allow public write access for household_members" ON public.household_members;
DROP POLICY IF EXISTS "Allow full public access for household_members" ON public.household_members;
CREATE POLICY "Allow full public access for household_members" ON public.household_members FOR ALL USING (true) WITH CHECK (true);


-- 2. PAYMENT METHODS & CARDS TABLE
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id TEXT PRIMARY KEY,
    badge_code TEXT,
    name TEXT NOT NULL,
    bank TEXT,
    member_id TEXT,
    type TEXT NOT NULL DEFAULT 'credit',
    network TEXT NOT NULL DEFAULT 'Visa',
    last4 TEXT,
    status_tag TEXT DEFAULT 'Open Buffer',
    status_tag_bg TEXT DEFAULT '#43978D',
    card_subtitle TEXT,
    billing_cycle_type TEXT DEFAULT 'calendar',
    billing_cycle_desc TEXT,
    statement_start_day INTEGER DEFAULT 1,
    statement_end_day INTEGER DEFAULT 31,
    current_spend NUMERIC(10, 2) DEFAULT 0.00,
    bonus_cap NUMERIC(10, 2) DEFAULT 1000.00,
    min_spend_target NUMERIC(10, 2),
    txn_target_req TEXT,
    max_rebate_desc TEXT,
    base_rate TEXT DEFAULT '0.4 MPD',
    bonus_rate TEXT DEFAULT '4.0 MPD',
    rounding_block INTEGER DEFAULT 1,
    key_exclusions TEXT,
    eligible_modes TEXT,
    overflow_rate TEXT,
    points_expiry TEXT,
    overseas_rate TEXT,
    extra_benefit TEXT,
    footer_advice TEXT,
    footer_icon TEXT DEFAULT 'credit_card',
    footer_type TEXT DEFAULT 'success',
    eligible_categories JSONB DEFAULT '[]'::jsonb,
    is_default_payer BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure all columns exist even if table was created with an older schema
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS badge_code TEXT;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Payment Card';
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS bank TEXT;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS member_id TEXT;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'credit';
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS network TEXT NOT NULL DEFAULT 'Visa';
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS last4 TEXT;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS status_tag TEXT DEFAULT 'Open Buffer';
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS status_tag_bg TEXT DEFAULT '#43978D';
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS card_subtitle TEXT;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS billing_cycle_type TEXT DEFAULT 'calendar';
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS billing_cycle_desc TEXT;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS statement_start_day INTEGER DEFAULT 1;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS statement_end_day INTEGER DEFAULT 31;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS current_spend NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS bonus_cap NUMERIC(10, 2) DEFAULT 1000.00;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS min_spend_target NUMERIC(10, 2);
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS txn_target_req TEXT;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS max_rebate_desc TEXT;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS base_rate TEXT DEFAULT '0.4 MPD';
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS bonus_rate TEXT DEFAULT '4.0 MPD';
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS rounding_block INTEGER DEFAULT 1;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS key_exclusions TEXT;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS eligible_modes TEXT;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS overflow_rate TEXT;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS points_expiry TEXT;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS overseas_rate TEXT;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS extra_benefit TEXT;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS footer_advice TEXT;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS footer_icon TEXT DEFAULT 'credit_card';
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS footer_type TEXT DEFAULT 'success';
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS eligible_categories JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS is_default_payer BOOLEAN DEFAULT false;
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.payment_methods ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access for payment_methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Allow public write access for payment_methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Allow full public access for payment_methods" ON public.payment_methods;
CREATE POLICY "Allow full public access for payment_methods" ON public.payment_methods FOR ALL USING (true) WITH CHECK (true);


-- 3. HOUSEHOLD EXPENSES LEDGER TABLE
CREATE TABLE IF NOT EXISTS public.household_expenses (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    iso_date TEXT NOT NULL,
    merchant TEXT NOT NULL,
    mcc TEXT NOT NULL DEFAULT '5411',
    category TEXT NOT NULL DEFAULT 'General',
    tags JSONB DEFAULT '[]'::jsonb,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payer_id TEXT NOT NULL,
    payment_method_id TEXT NOT NULL,
    split_mode TEXT NOT NULL DEFAULT 'equal',
    split_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    split_member_ids JSONB,
    custom_weights JSONB,
    pair_member_ids JSONB,
    notes TEXT,
    settled BOOLEAN NOT NULL DEFAULT false,
    eligible_blocks_amount NUMERIC(10, 2) DEFAULT 0.00,
    reward_estimated TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure all columns exist even if table was created with an older schema
ALTER TABLE public.household_expenses ADD COLUMN IF NOT EXISTS date TEXT NOT NULL DEFAULT '';
ALTER TABLE public.household_expenses ADD COLUMN IF NOT EXISTS iso_date TEXT NOT NULL DEFAULT '';
ALTER TABLE public.household_expenses ADD COLUMN IF NOT EXISTS merchant TEXT NOT NULL DEFAULT '';
ALTER TABLE public.household_expenses ADD COLUMN IF NOT EXISTS mcc TEXT NOT NULL DEFAULT '5411';
ALTER TABLE public.household_expenses ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General';
ALTER TABLE public.household_expenses ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.household_expenses ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.household_expenses ADD COLUMN IF NOT EXISTS payer_id TEXT NOT NULL DEFAULT '';
ALTER TABLE public.household_expenses ADD COLUMN IF NOT EXISTS payment_method_id TEXT NOT NULL DEFAULT '';
ALTER TABLE public.household_expenses ADD COLUMN IF NOT EXISTS split_mode TEXT NOT NULL DEFAULT 'equal';
ALTER TABLE public.household_expenses ADD COLUMN IF NOT EXISTS split_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.household_expenses ADD COLUMN IF NOT EXISTS split_member_ids JSONB;
ALTER TABLE public.household_expenses ADD COLUMN IF NOT EXISTS custom_weights JSONB;
ALTER TABLE public.household_expenses ADD COLUMN IF NOT EXISTS pair_member_ids JSONB;
ALTER TABLE public.household_expenses ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.household_expenses ADD COLUMN IF NOT EXISTS settled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.household_expenses ADD COLUMN IF NOT EXISTS eligible_blocks_amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.household_expenses ADD COLUMN IF NOT EXISTS reward_estimated TEXT;
ALTER TABLE public.household_expenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.household_expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.household_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access for household_expenses" ON public.household_expenses;
DROP POLICY IF EXISTS "Allow public write access for household_expenses" ON public.household_expenses;
DROP POLICY IF EXISTS "Allow full public access for household_expenses" ON public.household_expenses;
CREATE POLICY "Allow full public access for household_expenses" ON public.household_expenses FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_expenses_iso_date ON public.household_expenses(iso_date);
CREATE INDEX IF NOT EXISTS idx_expenses_payer ON public.household_expenses(payer_id);
CREATE INDEX IF NOT EXISTS idx_expenses_card ON public.household_expenses(payment_method_id);


-- 4. GRANT PERMISSIONS TO ANON AND AUTHENTICATED ROLES
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;


-- 5. ENABLE REALTIME REPLICATION (SAFE & IDEMPOTENT)
ALTER TABLE public.household_members REPLICA IDENTITY FULL;
ALTER TABLE public.payment_methods REPLICA IDENTITY FULL;
ALTER TABLE public.household_expenses REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.household_members;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_methods;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.household_expenses;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- 6. RELOAD POSTGREST SCHEMA CACHE (Ensures immediate visibility without delay)
NOTIFY pgrst, 'reload schema';
