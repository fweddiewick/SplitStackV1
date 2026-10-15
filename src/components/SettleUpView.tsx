import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MemberId } from '../types';
import { isExpenseInMonth } from '../utils/dateUtils';

export const SettleUpView: React.FC = () => {
  const {
    netBalances,
    expenses,
    members,
    paymentMethods,
    deleteExpense,
    clearExpensesByMonth,
    markAllSettled,
    markDebtSettled,
    selectedMonth,
    showToast,
  } = useApp();

  const [filterPayer, setFilterPayer] = useState<'all' | MemberId>('all');
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  // Month-filtered expenses strictly matching the active cycle
  const monthExpenses = selectedMonth
    ? expenses.filter((e) => isExpenseInMonth(e, selectedMonth))
    : expenses;

  const monthTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

  const filteredExpenses = monthExpenses.filter((e) => {
    if (filterPayer === 'all') return true;
    return e.payerId === filterPayer;
  });

  const handleShareWhatsApp = () => {
    const lines = [
      `SplitStack SG ${selectedMonth} Household Settle-Up:`,
      ...netBalances.debts.map((d) => `• ${d.fromName} owes ${d.toName}: SGD $${d.amount.toFixed(2)}`),
      `\nPlease transfer respective amounts to settle this month's ledger.`,
    ];
    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/?text=${text}`, '_blank');
    showToast('Generated WhatsApp settlement summary!');
  };

  return (
    <div className="flex flex-col w-full h-full max-h-full overflow-hidden select-none font-body justify-between gap-2.5">
      {/* Top Banner Bar */}
      <div className="shrink-0 flex items-center justify-between border-2 border-[#264D59] bg-[#FCF9F3] px-3.5 py-1.5 shadow-[3px_3px_0px_#264D59]">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center bg-[#264D59] text-[#F9E07F] px-2 py-0.5 text-xs font-headline font-bold uppercase tracking-wider">
            NET LEDGER
          </span>
          <div className="flex flex-col">
            <h1 className="font-headline font-bold text-sm tracking-tight uppercase leading-none text-[#264D59]">
              MONTHLY SETTLE-UP &amp; HOUSEHOLD BALANCES
            </h1>
            <span className="text-[10px] font-headline font-medium text-[#41484b] tracking-wider uppercase mt-0.5">
              BILATERAL DEBT RESOLUTION • {(selectedMonth || 'ALL').toUpperCase()} CYCLE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsClearModalOpen(true)}
            className="flex items-center gap-1.5 bg-[#D46C4E] hover:bg-[#b85437] text-white border-2 border-[#264D59] px-2.5 py-1 text-xs font-headline font-bold uppercase tracking-wider shadow-[2px_2px_0px_#264D59] transition-all"
            title={`Clear all logged transactions for ${selectedMonth}`}
          >
            <span className="material-symbols-outlined text-sm font-bold">delete_sweep</span>
            <span>Clear Month</span>
          </button>
          <button
            onClick={handleShareWhatsApp}
            className="flex items-center gap-1.5 bg-[#43978D] hover:bg-[#264D59] text-white border-2 border-[#264D59] px-2.5 py-1 text-xs font-headline font-bold uppercase tracking-wider shadow-[2px_2px_0px_#264D59] transition-all"
            title="Export WhatsApp Summary"
          >
            <span className="material-symbols-outlined text-sm font-bold">share</span>
            <span>WhatsApp Summary</span>
          </button>
          <button
            onClick={markAllSettled}
            className="flex items-center gap-1.5 bg-[#F9E07F] hover:bg-[#F9AD6A] text-[#264D59] border-2 border-[#264D59] px-2.5 py-1 text-xs font-headline font-bold uppercase tracking-wider shadow-[2px_2px_0px_#264D59] transition-all"
          >
            <span className="material-symbols-outlined text-sm font-bold">task_alt</span>
            <span>Mark All Settled</span>
          </button>
        </div>
      </div>

      {/* Directed Debts Summary Strip */}
      <div className="shrink-0 grid grid-cols-1 md:grid-cols-3 gap-2">
        {netBalances.debts.length > 0 ? (
          netBalances.debts.map((debt, idx) => (
            <div
              key={idx}
              className="bg-[#FCF9F3] border-2 border-[#264D59] p-2 flex items-center justify-between shadow-[2px_2px_0px_#264D59]"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-[#D46C4E] text-white flex items-center justify-center font-headline font-bold text-xs border border-[#264D59]">
                  {debt.fromName.charAt(0)}
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-headline font-bold uppercase text-[#264D59] leading-tight">
                    {debt.fromName} owes {debt.toName}
                  </span>
                  <span className="text-[9px] font-body text-[#41484b]">
                    Status: Pending Settlement
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-headline font-extrabold text-sm text-[#264D59]">
                  ${debt.amount.toFixed(2)}
                </span>
                <button
                  onClick={() => markDebtSettled(debt.from, debt.to)}
                  className="px-2 py-1 bg-[#264D59] hover:bg-[#43978D] text-white border border-[#264D59] text-[10px] font-headline font-bold uppercase flex items-center gap-1 transition-colors"
                  title="Mark this specific bilateral balance as settled"
                >
                  <span className="material-symbols-outlined text-xs">check</span>
                  <span>Settle</span>
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-3 bg-[#43978D]/20 border-2 border-[#264D59] p-2 text-center text-xs font-headline font-bold uppercase text-[#264D59]">
            ✓ All accounts settled! Net debt is $0.00.
          </div>
        )}
      </div>

      {/* Main Expense Ledger Table Container */}
      <div className="flex-1 min-h-0 bg-[#FCF9F3] border-2 border-[#264D59] p-2.5 shadow-[3px_3px_0px_#264D59] flex flex-col justify-between overflow-hidden">
        {/* Table Filters & Counter */}
        <div className="shrink-0 flex items-center justify-between pb-2 mb-1 border-b-2 border-[#264D59]">
          <div className="flex items-center gap-2">
            <span className="font-headline font-bold uppercase text-xs text-[#264D59]">
              Itemized Household Transactions
            </span>
            <span className="bg-[#264D59] text-white text-[9px] font-label font-bold px-1.5 py-0.2">
              {filteredExpenses.length} Records
            </span>
            <button
              onClick={() => setIsClearModalOpen(true)}
              disabled={monthExpenses.length === 0}
              className="hidden sm:flex items-center gap-1 bg-[#D46C4E]/10 hover:bg-[#D46C4E] text-[#D46C4E] hover:text-white disabled:opacity-40 border border-[#D46C4E] px-2 py-0.5 text-[10px] font-headline font-bold uppercase tracking-wider transition-all"
              title={`Clear all expenses for ${selectedMonth}`}
            >
              <span className="material-symbols-outlined text-xs">delete_sweep</span>
              <span>Clear {selectedMonth}</span>
            </button>
          </div>

          <div className="flex items-center gap-1 text-[10px] font-label">
            <span className="text-[#41484b] font-bold">Filter By Payer:</span>
            <button
              onClick={() => setFilterPayer('all')}
              className={`px-2 py-0.5 font-headline font-bold uppercase border border-[#264D59] transition-all ${
                filterPayer === 'all'
                  ? 'bg-[#264D59] text-white'
                  : 'bg-[#F0EEE8] text-[#264D59] hover:bg-[#F9E07F]'
              }`}
            >
              All
            </button>
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => setFilterPayer(m.id)}
                className={`px-2 py-0.5 font-headline font-bold uppercase border border-[#264D59] transition-all ${
                  filterPayer === m.id
                    ? 'bg-[#264D59] text-white'
                    : 'bg-[#F0EEE8] text-[#264D59] hover:bg-[#F9E07F]'
                }`}
              >
                {m.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Table Area */}
        <div className="flex-1 min-h-0 overflow-y-auto border border-[#264D59]/30">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#F0EEE8] border-b-2 border-[#264D59] sticky top-0 z-10 text-[9px] font-headline font-bold uppercase text-[#264D59]">
              <tr>
                <th className="p-2 border-r border-[#264D59]/30">Date</th>
                <th className="p-2 border-r border-[#264D59]/30">Merchant / MCC</th>
                <th className="p-2 border-r border-[#264D59]/30">Paid By</th>
                <th className="p-2 border-r border-[#264D59]/30">Card / Method</th>
                <th className="p-2 border-r border-[#264D59]/30 text-right">Total SGD</th>
                <th className="p-2 border-r border-[#264D59]/30 text-center">Split Breakdown</th>
                <th className="p-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#264D59]/20 font-body text-[11px]">
              {filteredExpenses.map((exp) => {
                const card = paymentMethods.find((c) => c.id === exp.paymentMethodId);
                const payer = members.find((m) => m.id === exp.payerId);

                return (
                  <tr
                    key={exp.id}
                    className={`hover:bg-[#F9E07F]/20 transition-colors ${
                      exp.settled ? 'opacity-60 bg-[#F0EEE8]/40' : 'bg-white'
                    }`}
                  >
                    <td className="p-2 font-mono text-[10px] text-[#41484b] whitespace-nowrap border-r border-[#264D59]/20">
                      {exp.date}
                    </td>
                    <td className="p-2 border-r border-[#264D59]/20">
                      <div className="font-headline font-bold text-xs uppercase text-[#264D59]">
                        {exp.merchant}
                      </div>
                      <div className="text-[9px] font-mono text-[#43978D]">
                        MCC {exp.mcc} • {exp.category}
                      </div>
                    </td>
                    <td className="p-2 border-r border-[#264D59]/20 whitespace-nowrap">
                      <span className="font-headline font-bold uppercase text-[#264D59]">
                        {payer?.name.split(' ')[0] || exp.payerId}
                      </span>
                    </td>
                    <td className="p-2 border-r border-[#264D59]/20 whitespace-nowrap">
                      <span className="text-[10px] font-label font-bold text-[#264D59] bg-[#F0EEE8] px-1 py-0.5 border border-[#264D59]/40">
                        {card ? card.name : exp.paymentMethodId}
                      </span>
                    </td>
                    <td className="p-2 font-headline font-bold text-xs text-right text-[#264D59] whitespace-nowrap border-r border-[#264D59]/20">
                      ${exp.amount.toFixed(2)}
                    </td>
                    <td className="p-2 border-r border-[#264D59]/20">
                      <div className="flex flex-wrap items-center justify-center gap-1 font-mono text-[9px]">
                        {Object.entries(exp.splitBreakdown).map(([mId, amt]) => {
                          const mName = members.find((x) => x.id === mId)?.name.charAt(0) || mId.charAt(0).toUpperCase();
                          return (
                            <span key={mId} className="bg-[#F0EEE8] px-1 border border-[#264D59]/30">
                              {mName}: ${amt.toFixed(2)}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-2 text-center whitespace-nowrap">
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete expense "${exp.merchant}" ($${exp.amount.toFixed(2)})?\n\nThis will remove the transaction and restore ${card?.name || 'card'} spend limits.`
                            )
                          ) {
                            deleteExpense(exp.id);
                          }
                        }}
                        className="px-2 py-0.5 hover:bg-[#D46C4E] hover:text-white text-[#264D59] border border-[#264D59]/40 hover:border-[#264D59] transition-all text-[10px] font-headline font-bold uppercase flex items-center gap-0.5 mx-auto"
                        title={`Remove ${exp.merchant} ($${exp.amount.toFixed(2)})`}
                      >
                        <span className="material-symbols-outlined text-xs">delete</span>
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Ledger Summary Strip */}
        <div className="shrink-0 mt-2 bg-[#F0EEE8] border border-[#264D59] p-1.5 flex items-center justify-between text-[10px] font-label">
          <div className="flex items-center gap-2">
            <span className="font-headline font-bold uppercase text-[#264D59]">Ledger Total:</span>
            <span className="font-headline font-extrabold text-xs text-[#264D59]">
              ${netBalances.totalMonthSpend.toFixed(2)} SGD
            </span>
          </div>
          <div className="flex items-center gap-3 text-[#41484b]">
            <span className="text-[#43978D] font-bold">Household Settlement Status: Up to date</span>
          </div>
        </div>
      </div>

      {/* Clear Month Confirmation Neo-Brutalist Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#264D59]/60 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-[#FCF9F3] border-4 border-[#264D59] shadow-[6px_6px_0px_#264D59] w-full max-w-md p-4 flex flex-col gap-3 font-body">
            <div className="flex items-center justify-between border-b-2 border-[#264D59] pb-2">
              <div className="flex items-center gap-2 text-[#D46C4E]">
                <span className="material-symbols-outlined text-xl font-bold">delete_sweep</span>
                <span className="font-headline font-bold text-sm uppercase tracking-wide text-[#264D59]">
                  Clear All Expenses for {selectedMonth}
                </span>
              </div>
              <button
                onClick={() => setIsClearModalOpen(false)}
                className="hover:bg-[#D46C4E] hover:text-white px-2 py-0.5 border border-[#264D59] font-bold text-xs text-[#264D59]"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-[#D46C4E]/10 border-2 border-[#D46C4E] text-[#264D59] flex flex-col gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-[#D46C4E] font-headline font-bold uppercase text-xs">
                <span className="material-symbols-outlined text-base">warning</span>
                <span>Confirm Month Reset</span>
              </div>
              <p className="leading-tight">
                You are about to clear <strong>{monthExpenses.length} transaction(s)</strong> totaling{' '}
                <strong>${monthTotal.toFixed(2)} SGD</strong> for <strong>{selectedMonth}</strong>.
              </p>
              <div className="bg-white/90 p-2 border border-[#264D59]/40 text-[10px] space-y-1">
                <div className="text-[#41484b] font-label font-bold uppercase">What will happen:</div>
                <div className="text-[#264D59]">&bull; All itemized logged transactions for {selectedMonth} will be deleted.</div>
                <div className="text-[#264D59]">&bull; Card monthly spend &amp; bonus headroom will be automatically refunded.</div>
                <div className="text-[#264D59]">&bull; Household net settlement ledger will update to $0.00.</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t-2 border-[#264D59]">
              <button
                type="button"
                onClick={() => setIsClearModalOpen(false)}
                className="px-3 py-1.5 bg-[#F0EEE8] hover:bg-white text-[#264D59] border-2 border-[#264D59] font-headline font-bold text-xs uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  clearExpensesByMonth(selectedMonth);
                  setIsClearModalOpen(false);
                }}
                disabled={monthExpenses.length === 0}
                className="px-4 py-1.5 bg-[#D46C4E] hover:bg-[#b85437] disabled:opacity-50 text-white border-2 border-[#264D59] shadow-[2px_2px_0px_#264D59] font-headline font-bold text-xs uppercase flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-sm font-bold">delete_forever</span>
                <span>Yes, Clear {monthExpenses.length} Expenses</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
