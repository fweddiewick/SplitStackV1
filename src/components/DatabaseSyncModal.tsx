import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../context/AppContext';
import {
  getSupabaseCredentials,
  saveCustomSupabaseConfig,
  clearCustomSupabaseConfig,
  testSupabaseConnection,
  SupabaseDiagnosticResult,
  pushAllLocalDataToSupabase,
} from '../services/supabase';

interface DatabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DatabaseSyncModal: React.FC<DatabaseSyncModalProps> = ({ isOpen, onClose }) => {
  const {
    isCloudSynced,
    syncStatusDetails,
    refreshCloudData,
    members,
    paymentMethods,
    expenses,
    showToast,
  } = useApp();

  const [urlInput, setUrlInput] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [syncingPush, setSyncingPush] = useState(false);
  const [syncingPull, setSyncingPull] = useState(false);
  const [diagnostic, setDiagnostic] = useState<SupabaseDiagnosticResult | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'status' | 'qr' | 'sql' | 'credentials'>('status');

  const creds = getSupabaseCredentials();

  useEffect(() => {
    if (isOpen) {
      const c = getSupabaseCredentials();
      setUrlInput(c.url);
      setKeyInput(c.key);
      runDiagnostics();
      generateQr(c.url, c.key);
    }
  }, [isOpen]);

  const generateQr = async (url: string, key: string) => {
    if (!url || !key || typeof window === 'undefined') {
      setQrCodeDataUrl('');
      return;
    }
    try {
      const pairingUrl = `${window.location.origin}/?supabase_url=${encodeURIComponent(url)}&supabase_key=${encodeURIComponent(key)}`;
      const dataUrl = await QRCode.toDataURL(pairingUrl, {
        width: 220,
        margin: 2,
        color: {
          dark: '#264D59',
          light: '#FCF9F3',
        },
      });
      setQrCodeDataUrl(dataUrl);
    } catch (e) {
      console.warn('QR code generation failed:', e);
    }
  };

  const runDiagnostics = async () => {
    setTesting(true);
    try {
      const result = await testSupabaseConnection();
      setDiagnostic(result);
      if (!result.isConfigured) {
        setShowConfigForm(true);
      }
    } finally {
      setTesting(false);
    }
  };

  if (!isOpen) return null;

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || !keyInput.trim()) {
      showToast('Please enter both Supabase URL and Anon Key', 'error');
      return;
    }

    const success = saveCustomSupabaseConfig(urlInput, keyInput);
    if (!success) {
      showToast('Invalid Supabase URL or Anon Key format', 'error');
      return;
    }

    showToast('Saved Supabase credentials! Connecting...', 'sync');
    generateQr(urlInput.trim(), keyInput.trim());
    await runDiagnostics();
    await refreshCloudData();
  };

  const handleResetToEnv = async () => {
    clearCustomSupabaseConfig();
    const envCreds = getSupabaseCredentials();
    setUrlInput(envCreds.url);
    setKeyInput(envCreds.key);
    showToast('Reset to environment variables. Testing...', 'restart_alt');
    generateQr(envCreds.url, envCreds.key);
    await runDiagnostics();
    await refreshCloudData();
  };

  const handlePushLocalData = async () => {
    setSyncingPush(true);
    try {
      const res = await pushAllLocalDataToSupabase(members, paymentMethods, expenses);
      if (res.success) {
        showToast(`Synced ${expenses.length} expenses, ${paymentMethods.length} cards to cloud!`, 'cloud_upload');
        await runDiagnostics();
      } else {
        showToast(`Sync failed: ${res.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Push failed: ${err?.message || err}`, 'error');
    } finally {
      setSyncingPush(false);
    }
  };

  const handlePullCloudData = async () => {
    setSyncingPull(true);
    try {
      await refreshCloudData();
      showToast('Pulled latest changes from Supabase!', 'cloud_download');
      await runDiagnostics();
    } finally {
      setSyncingPull(false);
    }
  };

  const copySqlSchema = async () => {
    const sqlContent = `-- ==============================================================================
-- SplitStack SG: Supabase Complete Database Schema & Cross-Device Real-Time Sync
-- (100% Idempotent: safe to run multiple times without any errors)
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
    custom_weights JSONB,
    pair_member_ids JSONB,
    notes TEXT,
    settled BOOLEAN NOT NULL DEFAULT false,
    eligible_blocks_amount NUMERIC(10, 2) DEFAULT 0.00,
    reward_estimated TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

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

-- 4. GRANT PERMISSIONS
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- 5. ENABLE REALTIME
ALTER TABLE public.household_members REPLICA IDENTITY FULL;
ALTER TABLE public.payment_methods REPLICA IDENTITY FULL;
ALTER TABLE public.household_expenses REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.household_members;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_methods;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.household_expenses;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

NOTIFY pgrst, 'reload schema';`;

    try {
      await navigator.clipboard.writeText(sqlContent);
      setCopiedSql(true);
      showToast('Copied 100% idempotent SQL Schema to clipboard!', 'content_copy');
      setTimeout(() => setCopiedSql(false), 3000);
    } catch {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const copyMobileLink = async () => {
    if (!creds.url || !creds.key) {
      showToast('Please configure Supabase credentials first', 'error');
      return;
    }
    const pairingUrl = `${window.location.origin}/?supabase_url=${encodeURIComponent(creds.url)}&supabase_key=${encodeURIComponent(creds.key)}`;
    try {
      await navigator.clipboard.writeText(pairingUrl);
      setCopiedLink(true);
      showToast('Mobile Pairing link copied! Open it on your phone browser', 'link');
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      showToast('Failed to copy link', 'error');
    }
  };

  const tablesReady =
    diagnostic?.tablesExist.members &&
    diagnostic?.tablesExist.methods &&
    diagnostic?.tablesExist.expenses;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-[#264D59]/60 backdrop-blur-xs select-none">
      <div className="bg-[#FCF9F3] border-3 border-[#264D59] shadow-[6px_6px_0px_#264D59] w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#264D59] text-white px-4 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-[#F9E07F]">cloud_sync</span>
            <span className="font-headline font-bold text-sm uppercase tracking-wider text-[#F9E07F]">
              Cross-Device Database &amp; Cloud Sync
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-[#F9E07F] p-0.5 transition-colors cursor-pointer"
            title="Close"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b-2 border-[#264D59] bg-[#F0EEE8] px-2 pt-2 gap-1 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`px-3 py-1.5 font-headline font-bold text-xs uppercase border-t-2 border-x-2 border-[#264D59] transition-all cursor-pointer ${
              activeTab === 'status'
                ? 'bg-[#FCF9F3] text-[#264D59] -mb-[2px] pb-2'
                : 'bg-[#FCF9F3]/50 text-[#264D59]/70 hover:bg-[#FCF9F3]'
            }`}
          >
            Sync Status
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`px-3 py-1.5 font-headline font-bold text-xs uppercase border-t-2 border-x-2 border-[#264D59] transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === 'qr'
                ? 'bg-[#FCF9F3] text-[#264D59] -mb-[2px] pb-2'
                : 'bg-[#FCF9F3]/50 text-[#264D59]/70 hover:bg-[#FCF9F3]'
            }`}
          >
            <span className="material-symbols-outlined text-xs">qr_code_scanner</span>
            Link Phone (QR)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`px-3 py-1.5 font-headline font-bold text-xs uppercase border-t-2 border-x-2 border-[#264D59] transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === 'sql'
                ? 'bg-[#FCF9F3] text-[#264D59] -mb-[2px] pb-2'
                : 'bg-[#FCF9F3]/50 text-[#264D59]/70 hover:bg-[#FCF9F3]'
            }`}
          >
            <span className="material-symbols-outlined text-xs">terminal</span>
            SQL Schema
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('credentials')}
            className={`px-3 py-1.5 font-headline font-bold text-xs uppercase border-t-2 border-x-2 border-[#264D59] transition-all cursor-pointer flex items-center gap-1 ${
              activeTab === 'credentials'
                ? 'bg-[#FCF9F3] text-[#264D59] -mb-[2px] pb-2'
                : 'bg-[#FCF9F3]/50 text-[#264D59]/70 hover:bg-[#FCF9F3]'
            }`}
          >
            <span className="material-symbols-outlined text-xs">key</span>
            Credentials
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 font-body text-xs text-[#264D59]">
          {/* TAB 1: STATUS & DIAGNOSTICS */}
          {activeTab === 'status' && (
            <>
              {/* Status Banner */}
              <div
                className={`p-3 border-2 border-[#264D59] shadow-[2px_2px_0px_#264D59] flex items-start gap-2.5 ${
                  isCloudSynced && tablesReady
                    ? 'bg-[#43978D]/15'
                    : diagnostic?.isConfigured && !tablesReady
                    ? 'bg-[#F9AD6A]/20'
                    : 'bg-[#D46C4E]/15'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-xl shrink-0 ${
                    isCloudSynced && tablesReady
                      ? 'text-[#43978D]'
                      : diagnostic?.isConfigured && !tablesReady
                      ? 'text-[#F9AD6A]'
                      : 'text-[#D46C4E]'
                  }`}
                >
                  {isCloudSynced && tablesReady
                    ? 'check_circle'
                    : diagnostic?.isConfigured && !tablesReady
                    ? 'warning'
                    : 'cloud_off'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-headline font-bold text-xs uppercase tracking-wide">
                      {isCloudSynced && tablesReady
                        ? 'Cloud Sync Active (Desktop & Mobile Linked)'
                        : diagnostic?.isConfigured && !tablesReady
                        ? 'Connected, But Database Tables Missing'
                        : 'Local Storage Mode (Not Synced)'}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-headline font-bold uppercase border border-[#264D59] ${
                        isCloudSynced && tablesReady
                          ? 'bg-[#43978D] text-white'
                          : diagnostic?.isConfigured && !tablesReady
                          ? 'bg-[#F9AD6A] text-[#264D59]'
                          : 'bg-[#D46C4E] text-white'
                      }`}
                    >
                      {isCloudSynced && tablesReady ? 'Online & Linked' : tablesReady ? 'Ready' : 'Setup Required'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#264D59]/90">
                    {isCloudSynced && tablesReady
                      ? 'Changes made on this device instantly synchronize with your phone or any other browser via Supabase Realtime.'
                      : diagnostic?.isConfigured && !tablesReady
                      ? 'Supabase credentials are detected, but the 3 database tables do not exist yet. Run the SQL schema once in your Supabase SQL editor to activate sync!'
                      : 'Your expenses are currently saved only to this browser’s local storage. Connect your Supabase project in the Credentials tab or scan the QR code to link devices.'}
                  </p>
                </div>
              </div>

              {/* Table Health Check */}
              <div className="bg-[#F0EEE8] border border-[#264D59] p-3 shadow-[1.5px_1.5px_0px_#264D59] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-headline font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">troubleshoot</span>
                    Database Tables &amp; Channels
                  </span>
                  <button
                    onClick={runDiagnostics}
                    disabled={testing}
                    className="px-2 py-0.5 bg-[#FCF9F3] hover:bg-[#F9E07F] border border-[#264D59] text-[10px] font-headline font-bold uppercase transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <span className={`material-symbols-outlined text-[11px] ${testing ? 'animate-spin' : ''}`}>
                      sync
                    </span>
                    {testing ? 'Checking...' : 'Run Health Check'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-[#FCF9F3] p-2 border border-[#264D59]/40">
                    <span className="text-[#264D59]/70 block font-medium">Supabase Project URL:</span>
                    <span className="font-mono font-bold truncate block text-[#264D59]" title={creds.url}>
                      {creds.url ? creds.url.replace('https://', '') : 'Not configured'}
                    </span>
                  </div>
                  <div className="bg-[#FCF9F3] p-2 border border-[#264D59]/40">
                    <span className="text-[#264D59]/70 block font-medium">Credential Source:</span>
                    <span className="font-headline font-bold text-[#264D59]">
                      {creds.source === 'env'
                        ? 'Vercel / Vite Environment'
                        : creds.source === 'localStorage'
                        ? 'Browser LocalStorage'
                        : 'None'}
                    </span>
                  </div>
                </div>

                <div className="bg-[#FCF9F3] p-2.5 border border-[#264D59]/50 space-y-1.5">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono">1. public.household_members</span>
                      <span
                        className={`font-bold px-1 py-0.2 border ${
                          diagnostic?.tablesExist.members
                            ? 'text-[#43978D] border-[#43978D] bg-[#43978D]/10'
                            : 'text-[#D46C4E] border-[#D46C4E] bg-[#D46C4E]/10'
                        }`}
                      >
                        {diagnostic?.tablesExist.members
                          ? `OK (${diagnostic.rowCounts.members} members)`
                          : 'MISSING (42P01)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono">2. public.payment_methods</span>
                      <span
                        className={`font-bold px-1 py-0.2 border ${
                          diagnostic?.tablesExist.methods
                            ? 'text-[#43978D] border-[#43978D] bg-[#43978D]/10'
                            : 'text-[#D46C4E] border-[#D46C4E] bg-[#D46C4E]/10'
                        }`}
                      >
                        {diagnostic?.tablesExist.methods
                          ? `OK (${diagnostic.rowCounts.methods} cards)`
                          : 'MISSING (42P01)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono">3. public.household_expenses</span>
                      <span
                        className={`font-bold px-1 py-0.2 border ${
                          diagnostic?.tablesExist.expenses
                            ? 'text-[#43978D] border-[#43978D] bg-[#43978D]/10'
                            : 'text-[#D46C4E] border-[#D46C4E] bg-[#D46C4E]/10'
                        }`}
                      >
                        {diagnostic?.tablesExist.expenses
                          ? `OK (${diagnostic.rowCounts.expenses} txns)`
                          : 'MISSING (42P01)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Errors if any */}
                {diagnostic?.errors && diagnostic.errors.length > 0 && (
                  <div className="bg-[#D46C4E]/10 border border-[#D46C4E] p-2 text-[10px] text-[#D46C4E] space-y-1">
                    <span className="font-bold block">Issues detected:</span>
                    <ul className="list-disc pl-4 space-y-0.5 font-mono text-[9px]">
                      {diagnostic.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Push & Pull Actions */}
              <div className="bg-[#FCF9F3] border-2 border-[#264D59] p-3 shadow-[2px_2px_0px_#264D59] space-y-2">
                <span className="font-headline font-bold text-xs uppercase tracking-wide block">
                  Data Synchronization Actions:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handlePushLocalData}
                    disabled={syncingPush || !diagnostic?.isConfigured}
                    className="w-full py-2 px-2.5 bg-[#43978D] hover:bg-[#43978D]/90 text-white border-2 border-[#264D59] shadow-[1.5px_1.5px_0px_#264D59] font-headline font-bold text-xs uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span className={`material-symbols-outlined text-sm ${syncingPush ? 'animate-spin' : ''}`}>
                      cloud_upload
                    </span>
                    {syncingPush ? 'Pushing...' : `Push Local Ledger (${expenses.length} Txns) to Cloud`}
                  </button>

                  <button
                    type="button"
                    onClick={handlePullCloudData}
                    disabled={syncingPull || !diagnostic?.isConfigured}
                    className="w-full py-2 px-2.5 bg-[#F9E07F] hover:bg-[#F9E07F]/90 text-[#264D59] border-2 border-[#264D59] shadow-[1.5px_1.5px_0px_#264D59] font-headline font-bold text-xs uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span className={`material-symbols-outlined text-sm ${syncingPull ? 'animate-spin' : ''}`}>
                      cloud_download
                    </span>
                    {syncingPull ? 'Pulling...' : 'Pull Latest from Cloud'}
                  </button>
                </div>
                <p className="text-[10px] text-[#264D59]/75 italic leading-tight">
                  Note: Click <strong>&quot;Push Local Ledger to Cloud&quot;</strong> to upload your current desktop ledger. Any device connected to Supabase will receive the updates immediately.
                </p>
              </div>
            </>
          )}

          {/* TAB 2: LINK PHONE (QR CODE) */}
          {activeTab === 'qr' && (
            <div className="space-y-3">
              <div className="bg-[#43978D]/15 border-2 border-[#264D59] p-3 shadow-[2px_2px_0px_#264D59] space-y-2">
                <span className="font-headline font-bold text-xs uppercase tracking-wide flex items-center gap-1.5 text-[#264D59]">
                  <span className="material-symbols-outlined text-base text-[#43978D]">phone_iphone</span>
                  Pair Your Mobile Phone in 3 Seconds
                </span>
                <p className="text-[11px] leading-relaxed text-[#264D59]">
                  No need to type long API keys on your mobile keyboard! Point your phone’s camera at the QR code below to open SplitStack SG with Supabase sync already pre-configured.
                </p>
              </div>

              {qrCodeDataUrl ? (
                <div className="bg-white border-2 border-[#264D59] p-4 shadow-[2px_2px_0px_#264D59] flex flex-col items-center justify-center space-y-3">
                  <img
                    src={qrCodeDataUrl}
                    alt="Scan to pair mobile"
                    className="w-48 h-48 border-2 border-[#264D59] p-2 bg-[#FCF9F3]"
                  />
                  <div className="text-center space-y-1">
                    <span className="font-headline font-bold text-xs uppercase block text-[#264D59]">
                      Scan with Phone Camera
                    </span>
                    <span className="text-[10px] text-[#264D59]/70 block">
                      Instantly links your mobile phone to this exact database
                    </span>
                  </div>
                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={copyMobileLink}
                      className="px-3 py-1.5 bg-[#264D59] text-white hover:bg-[#F9E07F] hover:text-[#264D59] border-2 border-[#264D59] shadow-[1.5px_1.5px_0px_#264D59] font-headline font-bold text-xs uppercase transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {copiedLink ? 'done' : 'link'}
                      </span>
                      {copiedLink ? 'Link Copied!' : 'Copy Mobile Link to Clipboard'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[#D46C4E]/10 border border-[#D46C4E] p-4 text-center space-y-2">
                  <span className="material-symbols-outlined text-3xl text-[#D46C4E]">warning</span>
                  <p className="font-headline font-bold text-xs uppercase text-[#D46C4E]">
                    Supabase Credentials Not Yet Configured
                  </p>
                  <p className="text-[11px] text-[#264D59]">
                    Please enter your Supabase Project URL and Anon API key in the <strong>Credentials</strong> tab first. Once entered, the QR code will generate immediately.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('credentials')}
                    className="px-3 py-1 bg-[#264D59] text-white hover:bg-[#F9E07F] hover:text-[#264D59] font-headline font-bold text-xs uppercase border border-[#264D59]"
                  >
                    Go to Credentials Tab
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SQL SCHEMA */}
          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="bg-[#F9E07F]/30 border-2 border-[#264D59] p-3 shadow-[2px_2px_0px_#264D59] space-y-2">
                <div className="flex items-center gap-1.5 text-[#264D59] font-headline font-bold text-xs uppercase">
                  <span className="material-symbols-outlined text-sm">integration_instructions</span>
                  How to initialize Supabase Database:
                </div>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] leading-tight text-[#264D59]">
                  <li>
                    Open your Supabase Project Dashboard and navigate to the{' '}
                    <a
                      href="https://supabase.com/dashboard/project/_/sql"
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold underline text-[#264D59] hover:text-[#43978D]"
                    >
                      SQL Editor
                    </a>
                    .
                  </li>
                  <li>Click <strong>&quot;New Query&quot;</strong>.</li>
                  <li>
                    Click the button below to copy the complete schema script, paste it into the editor, and click{' '}
                    <strong>&quot;Run&quot;</strong>.
                  </li>
                  <li>
                    The script creates the 3 tables, permissive RLS policies, permissions, and Realtime channels. It is 100% idempotent and safe to run multiple times.
                  </li>
                </ol>
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copySqlSchema}
                    className="px-3 py-1.5 bg-[#264D59] text-white hover:bg-[#F9E07F] hover:text-[#264D59] border-2 border-[#264D59] shadow-[1.5px_1.5px_0px_#264D59] font-headline font-bold text-xs uppercase transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {copiedSql ? 'done' : 'content_copy'}
                    </span>
                    {copiedSql ? 'Copied SQL Schema!' : 'Copy Complete SQL Schema Script'}
                  </button>
                  <a
                    href="https://supabase.com/dashboard/project/_/sql"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-[#FCF9F3] text-[#264D59] hover:bg-[#F0EEE8] border-2 border-[#264D59] shadow-[1.5px_1.5px_0px_#264D59] font-headline font-bold text-xs uppercase transition-all flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                    Open Supabase SQL Editor
                  </a>
                </div>
              </div>

              <div className="bg-[#264D59] text-[#FCF9F3] p-3 border-2 border-[#264D59] rounded-none font-mono text-[10px] overflow-x-auto max-h-56 leading-relaxed">
                <pre>{`-- 1. HOUSEHOLD MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.household_members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

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
    custom_weights JSONB,
    pair_member_ids JSONB,
    notes TEXT,
    settled BOOLEAN NOT NULL DEFAULT false,
    eligible_blocks_amount NUMERIC(10, 2) DEFAULT 0.00,
    reward_estimated TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);`}</pre>
              </div>
            </div>
          )}

          {/* TAB 4: CREDENTIALS */}
          {activeTab === 'credentials' && (
            <div className="space-y-3">
              <form onSubmit={handleSaveCredentials} className="bg-[#F0EEE8] border border-[#264D59] p-3 space-y-2.5">
                <span className="font-headline font-bold text-xs uppercase block text-[#264D59]">
                  Enter Supabase Project Credentials:
                </span>
                <p className="text-[10px] text-[#264D59]/80 leading-tight">
                  You can paste your Supabase Project credentials here directly. They are saved in this browser to immediately connect and sync across your devices.
                </p>
                <div>
                  <label className="block text-[10px] font-headline font-bold uppercase mb-0.5">
                    Supabase Project URL:
                  </label>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://xyzabcdefghijklm.supabase.co"
                    className="w-full px-2 py-1 bg-white border border-[#264D59] text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-headline font-bold uppercase mb-0.5">
                    Supabase Anon Public API Key:
                  </label>
                  <input
                    type="text"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-2 py-1 bg-white border border-[#264D59] text-xs font-mono"
                    required
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-[#264D59] text-white hover:bg-[#F9E07F] hover:text-[#264D59] border border-[#264D59] font-headline font-bold text-xs uppercase transition-colors cursor-pointer"
                  >
                    Save &amp; Connect
                  </button>
                  <button
                    type="button"
                    onClick={handleResetToEnv}
                    className="px-2 py-1 text-[10px] text-[#D46C4E] hover:underline font-headline font-bold uppercase cursor-pointer"
                  >
                    Reset to Environment Defaults
                  </button>
                </div>
              </form>

              <div className="bg-[#FCF9F3] border border-[#264D59]/40 p-2.5 text-[10px] text-[#264D59]/80 space-y-1">
                <span className="font-bold block">Where to find these in Supabase:</span>
                <p>1. Open your project on <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="underline font-bold">supabase.com</a>.</p>
                <p>2. Go to <strong>Project Settings</strong> (gear icon at bottom left) &rarr; <strong>API</strong>.</p>
                <p>3. Copy <strong>Project URL</strong> and <strong>Project API Keys: anon / public</strong>.</p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#F0EEE8] border-t-2 border-[#264D59] px-4 py-2 flex items-center justify-between shrink-0">
          <div className="text-[10px] text-[#264D59]/75 font-mono truncate max-w-xs">
            {syncStatusDetails || (isCloudSynced ? 'Connected to Supabase' : 'Offline Mode')}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1 bg-[#264D59] text-white hover:bg-[#F9E07F] hover:text-[#264D59] border border-[#264D59] font-headline font-bold text-xs uppercase transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
