import React, { useState, useEffect } from 'react';
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
  const [showConfigForm, setShowConfigForm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const creds = getSupabaseCredentials();
      setUrlInput(creds.url);
      setKeyInput(creds.key);
      runDiagnostics();
    }
  }, [isOpen]);

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

  const creds = getSupabaseCredentials();

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

    showToast('Saved Supabase credentials! Testing connection...', 'sync');
    await runDiagnostics();
    await refreshCloudData();
  };

  const handleResetToEnv = async () => {
    clearCustomSupabaseConfig();
    const envCreds = getSupabaseCredentials();
    setUrlInput(envCreds.url);
    setKeyInput(envCreds.key);
    showToast('Reset to environment variables. Testing...', 'restart_alt');
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
    const sqlContent = `-- SplitStack SG: Supabase Schema
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
ALTER PUBLICATION supabase_realtime ADD TABLE public.household_expenses;`;

    try {
      await navigator.clipboard.writeText(sqlContent);
      setCopiedSql(true);
      showToast('Copied full SQL Schema to clipboard!', 'content_copy');
      setTimeout(() => setCopiedSql(false), 3000);
    } catch {
      showToast('Failed to copy to clipboard', 'error');
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
              Cross-Device Database & Cloud Sync
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3 font-body text-xs text-[#264D59]">
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
                  : 'Your expenses are currently saved only to this browser’s local storage. Connect your Supabase project below to sync between mobile and desktop.'}
              </p>
            </div>
          </div>

          {/* Diagnostics Card */}
          <div className="bg-[#F0EEE8] border border-[#264D59] p-3 shadow-[1.5px_1.5px_0px_#264D59] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-headline font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">troubleshoot</span>
                Diagnostic Health Check
              </span>
              <button
                onClick={runDiagnostics}
                disabled={testing}
                className="px-2 py-0.5 bg-[#FCF9F3] hover:bg-[#F9E07F] border border-[#264D59] text-[10px] font-headline font-bold uppercase transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[11px] ${testing ? 'animate-spin' : ''}`}>
                  sync
                </span>
                {testing ? 'Testing...' : 'Test Connection'}
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

            {/* Table Health Check */}
            <div className="bg-[#FCF9F3] p-2.5 border border-[#264D59]/50 space-y-1.5">
              <span className="font-headline font-bold text-[10px] uppercase block text-[#264D59]">
                Database Tables & Realtime Channels:
              </span>
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
                      ? `OK (${diagnostic.rowCounts.members} rows)`
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
                <span className="font-bold block">Diagnostics detected the following issue(s):</span>
                <ul className="list-disc pl-4 space-y-0.5 font-mono text-[9px]">
                  {diagnostic.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Quick Setup Instructions if tables missing */}
          {!tablesReady && (
            <div className="bg-[#F9E07F]/30 border-2 border-[#264D59] p-3 shadow-[2px_2px_0px_#264D59] space-y-2">
              <div className="flex items-center gap-1.5 text-[#264D59] font-headline font-bold text-xs uppercase">
                <span className="material-symbols-outlined text-sm">integration_instructions</span>
                How to initialize Supabase Database (Takes 30 seconds):
              </div>
              <ol className="list-decimal pl-4 space-y-1 text-[11px] leading-tight text-[#264D59]">
                <li>
                  Open your Supabase Project Dashboard and go to the{' '}
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
              </ol>
              <div className="pt-1 flex items-center gap-2">
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
          )}

          {/* Action Buttons: Push & Pull */}
          <div className="bg-[#FCF9F3] border-2 border-[#264D59] p-3 shadow-[2px_2px_0px_#264D59] space-y-2">
            <span className="font-headline font-bold text-xs uppercase tracking-wide block">
              Direct Cloud Synchronization:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handlePushLocalData}
                disabled={syncingPush || !diagnostic?.isConfigured}
                className="w-full py-1.5 px-2.5 bg-[#43978D] hover:bg-[#43978D]/90 text-white border-2 border-[#264D59] shadow-[1.5px_1.5px_0px_#264D59] font-headline font-bold text-xs uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Pushes all ledger entries from this browser into Supabase so other devices receive them"
              >
                <span className={`material-symbols-outlined text-sm ${syncingPush ? 'animate-spin' : ''}`}>
                  cloud_upload
                </span>
                {syncingPush ? 'Pushing...' : `Push Local Data (${expenses.length} Txns) to Cloud`}
              </button>

              <button
                type="button"
                onClick={handlePullCloudData}
                disabled={syncingPull || !diagnostic?.isConfigured}
                className="w-full py-1.5 px-2.5 bg-[#F9E07F] hover:bg-[#F9E07F]/90 text-[#264D59] border-2 border-[#264D59] shadow-[1.5px_1.5px_0px_#264D59] font-headline font-bold text-xs uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Forces a fetch from Supabase to update local state"
              >
                <span className={`material-symbols-outlined text-sm ${syncingPull ? 'animate-spin' : ''}`}>
                  cloud_download
                </span>
                {syncingPull ? 'Pulling...' : 'Pull Latest from Cloud'}
              </button>
            </div>
            <p className="text-[10px] text-[#264D59]/75 italic leading-tight">
              Tip: If you edited expenses on desktop, click <strong>&quot;Push Local Data to Cloud&quot;</strong> once. Then refresh your phone — your phone will instantly load the exact updated ledger!
            </p>
          </div>

          {/* Toggle Credentials Configuration */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowConfigForm(!showConfigForm)}
              className="text-[#264D59] font-headline font-bold text-xs uppercase flex items-center gap-1 hover:underline cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">
                {showConfigForm ? 'expand_less' : 'settings'}
              </span>
              {showConfigForm ? 'Hide Credential Settings' : 'Configure Supabase Credentials (URL & Anon Key)'}
            </button>

            {showConfigForm && (
              <form onSubmit={handleSaveCredentials} className="mt-2 bg-[#F0EEE8] border border-[#264D59] p-3 space-y-2">
                <p className="text-[10px] text-[#264D59]/80 leading-tight">
                  You can paste your Supabase Project credentials here directly. They will be stored in this browser to immediately connect without needing to rebuild or redeploy Vercel.
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

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="submit"
                    className="px-3 py-1 bg-[#264D59] text-white hover:bg-[#F9E07F] hover:text-[#264D59] border border-[#264D59] font-headline font-bold text-xs uppercase transition-colors cursor-pointer"
                  >
                    Save &amp; Connect
                  </button>
                  <button
                    type="button"
                    onClick={handleResetToEnv}
                    className="px-2 py-1 text-[10px] text-[#D46C4E] hover:underline font-headline font-bold uppercase cursor-pointer"
                  >
                    Reset to Env Defaults
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-[#F0EEE8] border-t-2 border-[#264D59] px-4 py-2 flex items-center justify-between shrink-0">
          <div className="text-[10px] text-[#264D59]/75 font-mono">
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
