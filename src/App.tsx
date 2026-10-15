import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Toast } from './components/Toast';
import { DashboardView } from './components/DashboardView';
import { LogExpenseView } from './components/LogExpenseView';
import { SettleUpView } from './components/SettleUpView';
import { CardStrategyView } from './components/CardStrategyView';
import { PaymentMethodsView } from './components/PaymentMethodsView';
import { ConfigureCardModal } from './components/ConfigureCardModal';
import { ManageMembersModal } from './components/ManageMembersModal';

const MainAppContent: React.FC = () => {
  const { activeTab } = useApp();

  // Modals state
  const [configureCardModal, setConfigureCardModal] = useState<{ isOpen: boolean; cardId?: string }>({
    isOpen: false,
    cardId: undefined,
  });

  const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);

  const handleOpenConfigureCard = (cardId?: string) => {
    setConfigureCardModal({ isOpen: true, cardId });
  };

  const handleOpenManageMembers = () => {
    setIsManageMembersOpen(true);
  };

  return (
    <div className="bg-warm-mesh font-body text-[#1c1c18] h-screen max-h-screen overflow-hidden flex flex-col antialiased select-none">
      {/* Top Fixed Header Shell */}
      <Header onOpenManageMembers={handleOpenManageMembers} />

      {/* Main Viewport: Strict Non-Scrolling Flex Container */}
      <main className="flex-1 flex flex-col h-[calc(100vh-56px-28px)] max-h-[calc(100vh-56px-28px)] overflow-hidden p-2 md:p-3 gap-2.5">
        {activeTab === 'dashboard' && (
          <DashboardView onOpenManageMembers={handleOpenManageMembers} />
        )}
        {activeTab === 'log' && <LogExpenseView />}
        {activeTab === 'settle' && <SettleUpView />}
        {activeTab === 'cards' && (
          <CardStrategyView onOpenConfigureCard={handleOpenConfigureCard} />
        )}
        {activeTab === 'methods' && (
          <PaymentMethodsView
            onOpenAddModal={() => handleOpenConfigureCard()}
            onOpenManageMembers={handleOpenManageMembers}
          />
        )}
      </main>

      {/* Compact Fixed Status Bar Footer */}
      <Footer />

      {/* Toast Feedback */}
      <Toast />

      {/* Card Config Modal */}
      <ConfigureCardModal
        isOpen={configureCardModal.isOpen}
        onClose={() => setConfigureCardModal({ ...configureCardModal, isOpen: false })}
        cardId={configureCardModal.cardId}
      />

      {/* Household Members Modal */}
      <ManageMembersModal
        isOpen={isManageMembersOpen}
        onClose={() => setIsManageMembersOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
