import React from 'react';
import { useApp } from '../context/AppContext';
import { RecommendationWidget } from './RecommendationWidget.tsx';

export const DashboardView: React.FC<{ onOpenManageMembers?: () => void }> = ({
  onOpenManageMembers,
}) => {
  const {
    netBalances,
    paymentMethods,
    expenses,
    members,
    selectedMonth,
    syncCardSpendWithExpenses,
    setActiveTab,
  } = useApp();

  return (
    <div className="flex flex-col w-full h-full max-h-full overflow-hidden select-none gap-2 font-body">
      {/* Top Banner Bar */}
      <div className="shrink-0 flex items-center justify-between border-2 border-[#264D59] bg-[#FCF9F3] px-3.5 py-1.5 shadow-[3px_3px_0px_#264D59]">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center bg-[#264D59] text-[#F9E07F] px-2 py-0.5 text-xs font-headline font-bold uppercase tracking-wider">
            HOUSEHOLD OVERVIEW
          </span>
          <div className="flex flex-col">
            <h1 className="font-headline font-bold text-sm tracking-tight uppercase leading-none text-[#264D59]">
              SPLITSTACK DASHBOARD &amp; INTELLIGENCE
            </h1>
            <span className="text-[10px] font-headline font-medium text-[#41484b] tracking-wider uppercase mt-0.5">
              {(selectedMonth || 'NO LOGGED EXPENSES').toUpperCase()} CYCLE • {members.length}-PERSON EXPENSE POOL
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenManageMembers}
            className="hidden sm:flex items-center gap-1 bg-[#F0EEE8] hover:bg-[#F9E07F] text-[#264D59] border-2 border-[#264D59] px-2.5 py-1 text-xs font-headline font-bold uppercase tracking-wider shadow-[1.5px_1.5px_0px_#264D59] transition-all"
          >
            <span className="material-symbols-outlined text-sm">group</span>
            <span>Members ({members.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className="flex items-center gap-1.5 bg-[#264D59] text-white hover:bg-[#F9E07F] hover:text-[#264D59] border-2 border-[#264D59] px-3 py-1 text-xs font-headline font-bold uppercase tracking-wider shadow-[2px_2px_0px_#264D59] transition-all"
          >
            <span className="material-symbols-outlined text-sm font-bold">add_circle</span>
            <span>+ Log Expense</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Zero-Scroll Layout */}
      <div className="flex-1 grid grid-cols-12 gap-2.5 min-h-0 overflow-hidden">
        {/* Left Column: Settlement & Household Net Balances (4 cols) */}
        <div className="col-span-12 md:col-span-4 flex flex-col border-2 border-[#264D59] bg-[#FCF9F3] p-2.5 shadow-[3px_3px_0px_#264D59] justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b-2 border-[#264D59] pb-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-[#264D59]">account_balance_wallet</span>
              <span className="font-headline font-bold text-xs uppercase tracking-wider text-[#264D59]">
                Monthly Settlement Ledger
              </span>
            </div>
            <span className="text-[9px] font-headline font-bold uppercase bg-[#F9E07F] text-[#264D59] px-1.5 py-0.5 border border-[#264D59]">
              Net Balances
            </span>
          </div>

          {/* KPI Card */}
          <div className="bg-[#F0EEE8] border-2 border-[#264D59] p-2 flex flex-col gap-1 shrink-0 my-1">
            <span className="text-[9px] font-headline font-bold uppercase text-[#41484b]">Total Pool Spend</span>
            <div className="flex justify-between items-baseline">
              <span className="font-headline font-extrabold text-xl text-[#264D59]">
                ${netBalances.totalMonthSpend.toLocaleString('en-SG', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] font-mono text-[#264D59] bg-[#FCF9F3] px-1.5 py-0.5 border border-[#264D59] font-bold">
                {netBalances.totalActiveTransactions} Txns Logged
              </span>
            </div>
          </div>

          {/* Member Net Owed Cards (Dynamic for all members) */}
          <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto pr-1">
            {members.map((m) => {
              const net = netBalances.memberNets[m.id] || 0;
              const isPositive = net > 0.005;
              const isNegative = net < -0.005;

              return (
                <div
                  key={m.id}
                  className="bg-[#FCF9F3] border-2 border-[#264D59] p-2 flex items-center justify-between shadow-[1.5px_1.5px_0px_#264D59]"
                >
                  <div className="flex flex-col">
                    <span className="font-headline font-bold text-xs uppercase text-[#264D59]">
                      {m.name} {m.role === 'lead' ? '(Lead)' : ''}
                    </span>
                    <span className="text-[9px] font-body text-[#41484b]">
                      {m.phone || 'Household Member'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span
                      className={`font-headline font-bold text-sm ${
                        isPositive ? 'text-[#43978D]' : isNegative ? 'text-[#D46C4E]' : 'text-[#41484b]'
                      }`}
                    >
                      {isPositive ? `+$${net.toFixed(2)}` : isNegative ? `-$${Math.abs(net).toFixed(2)}` : '$0.00'}
                    </span>
                    <span
                      className={`block text-[8px] font-label font-bold uppercase ${
                        isPositive ? 'text-[#43978D]' : isNegative ? 'text-[#D46C4E]' : 'text-[#41484b]'
                      }`}
                    >
                      {isPositive ? 'To Collect' : isNegative ? 'Owed' : 'Settled'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action to settle */}
          <button
            onClick={() => setActiveTab('settle')}
            className="w-full mt-1.5 py-1.5 bg-[#F9E07F] hover:bg-[#F9AD6A] text-[#264D59] border-2 border-[#264D59] font-headline font-bold text-xs uppercase tracking-wider shadow-[2px_2px_0px_#264D59] transition-all flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">checklist</span>
            <span>Open Monthly Settlement Ledger</span>
          </button>
        </div>

        {/* Center Column: Card Caps & Strategy Radar (4 cols) */}
        <div className="col-span-12 md:col-span-4 flex flex-col border-2 border-[#264D59] bg-[#FCF9F3] p-2.5 shadow-[3px_3px_0px_#264D59] justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b-2 border-[#264D59] pb-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-[#264D59]">credit_card</span>
              <span className="font-headline font-bold text-xs uppercase tracking-wider text-[#264D59]">
                User Card Spend Radar
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => syncCardSpendWithExpenses(selectedMonth)}
                className="text-[9px] font-headline font-bold uppercase bg-[#F9E07F] hover:bg-[#F9AD6A] text-[#264D59] border border-[#264D59] px-1.5 py-0.5 shadow-[1px_1px_0px_#264D59] flex items-center gap-0.5 transition-colors"
                title="Match card spend with current expenses log"
              >
                <span className="material-symbols-outlined text-[10px]">sync</span>
                <span>Match Log</span>
              </button>
              <button
                onClick={() => setActiveTab('cards')}
                className="text-[9px] font-headline font-bold uppercase text-[#264D59] hover:underline"
              >
                View Grid &rarr;
              </button>
            </div>
          </div>

          {/* Mini Cards Headroom List (Pulls from user-added methods) */}
          <div className="flex-1 flex flex-col gap-2 overflow-y-auto py-1">
            {paymentMethods
              .filter((c) => c.bonusCap > 0)
              .map((card) => {
                const pct = Math.min(100, (card.currentSpend / card.bonusCap) * 100);
                const isOver = card.currentSpend >= card.bonusCap;
                const remaining = Math.max(0, card.bonusCap - card.currentSpend);

                return (
                  <div key={card.id} className="bg-[#F0EEE8] border border-[#264D59] p-2 flex flex-col gap-1">
                    <div className="flex justify-between items-baseline">
                      <span className="font-headline font-bold text-xs uppercase text-[#264D59] truncate">
                        {card.name}
                      </span>
                      <span
                        className={`text-[8px] font-label font-bold uppercase px-1 border border-[#264D59] ${
                          isOver ? 'bg-[#D46C4E] text-white' : remaining < 150 ? 'bg-[#F9AD6A] text-[#264D59]' : 'bg-[#43978D] text-white'
                        }`}
                      >
                        {isOver ? 'Capped Out' : `${remaining.toFixed(0)} Left`}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-[#E5E2DC] border border-[#264D59] h-2.5 overflow-hidden flex">
                      <div
                        className={`h-full ${
                          isOver ? 'bg-[#D46C4E]' : remaining < 150 ? 'bg-[#F9AD6A]' : 'bg-[#43978D]'
                        }`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between items-center text-[9px] font-mono text-[#41484b]">
                      <span>
                        ${card.currentSpend.toFixed(2)} / ${card.bonusCap}
                      </span>
                      <span className="font-bold text-[#264D59]">{card.bonusRate}</span>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Routing Advice Box */}
          <div className="mt-1 bg-[#F9AD6A]/20 border-2 border-[#264D59] p-1.5 flex items-start gap-1.5">
            <span className="material-symbols-outlined text-sm text-[#264D59] font-bold shrink-0 mt-0.5">
              tune
            </span>
            <div className="flex flex-col">
              <span className="text-[9px] font-headline font-bold uppercase text-[#264D59] leading-tight">
                CheckMCC &amp; Supabase Engine:
              </span>
              <span className="text-[9px] font-body text-[#264D59]/90 leading-tight">
                Translates merchant query via CheckMCC API, then checks your <strong>{paymentMethods.length} Supabase card rules</strong> for bonus eligibility and $5 block rounding.
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: CheckMCC + Supabase RecommendationWidget (4 cols) */}
        <div className="col-span-12 md:col-span-4 flex flex-col border-2 border-[#264D59] bg-[#FCF9F3] p-2.5 shadow-[3px_3px_0px_#264D59] justify-between overflow-hidden">
          <RecommendationWidget />
        </div>
      </div>

      {/* Bottom Recent Activity Bar */}
      <div className="shrink-0 bg-[#FCF9F3] border-2 border-[#264D59] px-3 py-1.5 shadow-[2px_2px_0px_#264D59] flex items-center justify-between text-[10px] font-label">
        <div className="flex items-center gap-2 truncate">
          <span className="font-headline font-bold uppercase text-[#264D59]">Latest Transaction:</span>
          <span className="truncate text-[#264D59]">
            {expenses[0] ? `${expenses[0].merchant} ($${expenses[0].amount.toFixed(2)}) on ${expenses[0].date}` : 'None logged yet'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('settle')}
            className="hover:underline font-headline font-bold uppercase text-[#264D59]"
          >
            Review All {expenses.length} Entries &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};
