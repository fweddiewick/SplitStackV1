-- ==============================================================================
-- SplitStack SG: Supabase Complete Database Schema & Cross-Device Real-Time Sync
--
-- HOW TO RUN THIS SCRIPT:
-- 1. Go to your Supabase Project Dashboard: https://supabase.com/dashboard/project/_/sql
-- 2. Click "New Query", paste this entire SQL script, and click "RUN".
-- 3. In 2 seconds, all 3 tables, permissive RLS policies, indexes, and Realtime publications
--    will be created. Your phone and desktop will immediately sync!
-- ==============================================================================

-- 1. Household Members Table
CREATE TABLE IF NOT EXISTS public.household_members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access for household_members" ON public.household_members;
CREATE POLICY "Allow public read access for household_members" ON public.household_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access for household_members" ON public.household_members;
CREATE POLICY "Allow public write access for household_members" ON public.household_members FOR ALL USING (true) WITH CHECK (true);


-- 2. Payment Methods & Cards Table
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

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access for payment_methods" ON public.payment_methods;
CREATE POLICY "Allow public read access for payment_methods" ON public.payment_methods FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access for payment_methods" ON public.payment_methods;
CREATE POLICY "Allow public write access for payment_methods" ON public.payment_methods FOR ALL USING (true) WITH CHECK (true);


-- 3. Household Expenses Ledger Table
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
    custom_weights JSONB,
    pair_member_ids JSONB,
    notes TEXT,
    settled BOOLEAN NOT NULL DEFAULT false,
    eligible_blocks_amount NUMERIC(10, 2) DEFAULT 0.00,
    reward_estimated TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.household_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access for household_expenses" ON public.household_expenses;
CREATE POLICY "Allow public read access for household_expenses" ON public.household_expenses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access for household_expenses" ON public.household_expenses;
CREATE POLICY "Allow public write access for household_expenses" ON public.household_expenses FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_expenses_iso_date ON public.household_expenses(iso_date);
CREATE INDEX IF NOT EXISTS idx_expenses_payer ON public.household_expenses(payer_id);
CREATE INDEX IF NOT EXISTS idx_expenses_card ON public.household_expenses(payment_method_id);


-- 4. Enable Supabase Realtime for instant phone-to-desktop synchronization
-- Replica identity ensures full rows are transmitted during UPDATE/DELETE
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
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.household_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_methods;
ALTER PUBLICATION supabase_realtime ADD TABLE public.household_expenses;
