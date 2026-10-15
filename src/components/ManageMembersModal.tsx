import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { HouseholdMember } from '../types';

interface ManageMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManageMembersModal: React.FC<ManageMembersModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { members, addMember, updateMember, deleteMember, setLeadMember, showToast } = useApp();

  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // New member form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<'lead' | 'member'>('member');

  if (!isOpen) return null;

  const handleStartEdit = (m: HouseholdMember) => {
    setEditingMemberId(m.id);
    setEditName(m.name);
    setEditPhone(m.phone || '');
  };

  const handleSaveEdit = (id: string) => {
    if (!editName.trim()) {
      showToast('Name cannot be empty', 'error');
      return;
    }
    updateMember(id, { name: editName, phone: editPhone });
    setEditingMemberId(null);
  };

  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      showToast('Please enter member name', 'error');
      return;
    }
    addMember(newName, newRole, newPhone);
    setNewName('');
    setNewPhone('');
    setShowAddForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#264D59]/60 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="bg-[#FCF9F3] border-4 border-[#264D59] shadow-[6px_6px_0px_#264D59] w-full max-w-lg p-4 flex flex-col gap-3 font-body max-h-[85vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b-2 border-[#264D59] pb-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-[#264D59] font-bold">group</span>
            <span className="font-headline font-bold text-sm uppercase tracking-wide text-[#264D59]">
              Manage Household Members ({members.length})
            </span>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-[#D46C4E] hover:text-white px-2 py-0.5 border border-[#264D59] font-bold text-xs text-[#264D59]"
          >
            ✕
          </button>
        </div>

        {/* Member Roster List */}
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pr-1">
          {members.map((member) => {
            const isEditing = editingMemberId === member.id;
            const isLead = member.role === 'lead';

            return (
              <div
                key={member.id}
                className="bg-white border-2 border-[#264D59] p-2.5 flex flex-col gap-2 shadow-[2px_2px_0px_#264D59]"
              >
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-headline font-bold uppercase text-[#41484b]">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full bg-[#FCF9F3] border border-[#264D59] p-1 text-xs font-bold text-[#264D59]"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-headline font-bold uppercase text-[#41484b]">
                          Phone (Optional)
                        </label>
                        <input
                          type="text"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="w-full bg-[#FCF9F3] border border-[#264D59] p-1 text-xs font-mono text-[#264D59]"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => setEditingMemberId(null)}
                        className="px-2 py-1 text-[10px] font-headline font-bold uppercase border border-[#264D59] bg-[#F0EEE8]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(member.id)}
                        className="px-3 py-1 text-[10px] font-headline font-bold uppercase border border-[#264D59] bg-[#264D59] text-white"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#264D59] text-[#F9E07F] font-headline font-bold text-xs flex items-center justify-center shrink-0 border border-[#264D59]">
                        {member.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-headline font-bold text-xs uppercase text-[#264D59] truncate">
                            {member.name}
                          </span>
                          {isLead ? (
                            <span className="bg-[#F9E07F] text-[#264D59] text-[9px] font-label font-bold px-1.5 py-0.2 border border-[#264D59] uppercase">
                              Lead Payer
                            </span>
                          ) : (
                            <span className="bg-[#F0EEE8] text-[#41484b] text-[9px] font-label font-bold px-1 py-0.2 border border-[#264D59]/30 uppercase">
                              Member
                            </span>
                          )}
                        </div>
                        {member.phone && (
                          <span className="text-[10px] font-mono text-[#41484b] truncate">
                            {member.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!isLead && (
                        <button
                          onClick={() => setLeadMember(member.id)}
                          className="px-2 py-1 bg-[#F0EEE8] hover:bg-[#F9E07F] text-[#264D59] border border-[#264D59] text-[10px] font-headline font-bold uppercase"
                          title="Make Lead Payer"
                        >
                          Make Lead
                        </button>
                      )}
                      <button
                        onClick={() => handleStartEdit(member)}
                        className="p-1 hover:bg-[#264D59] hover:text-white border border-[#264D59] text-[#264D59]"
                        title="Edit Member"
                      >
                        <span className="material-symbols-outlined text-xs">edit</span>
                      </button>
                      {members.length > 1 && !isLead && (
                        <button
                          onClick={() => deleteMember(member.id)}
                          className="p-1 hover:bg-[#D46C4E] hover:text-white border border-[#264D59] text-[#264D59]"
                          title="Delete Member"
                        >
                          <span className="material-symbols-outlined text-xs">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add New Member Section */}
          {showAddForm ? (
            <form
              onSubmit={handleCreateMember}
              className="bg-[#F9E07F]/30 border-2 border-[#264D59] p-3 flex flex-col gap-2 shadow-[2px_2px_0px_#264D59] mt-1"
            >
              <span className="font-headline font-bold text-xs uppercase text-[#264D59]">
                Add New Household Member
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-headline font-bold uppercase text-[#41484b]">
                    Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. David Wong"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-white border-2 border-[#264D59] p-1 font-headline font-bold text-xs text-[#264D59] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-headline font-bold uppercase text-[#41484b]">
                    Phone (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="+65 9111 2233"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-white border-2 border-[#264D59] p-1 font-mono text-xs text-[#264D59] focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-2.5 py-1 bg-[#F0EEE8] border border-[#264D59] text-[10px] font-headline font-bold uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1 bg-[#264D59] text-white hover:bg-[#43978D] border-2 border-[#264D59] font-headline font-bold text-xs uppercase shadow-[1.5px_1.5px_0px_#264D59]"
                >
                  Confirm &amp; Add
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-2 bg-white hover:bg-[#F9E07F]/40 border-2 border-dashed border-[#264D59] font-headline font-bold text-xs uppercase text-[#264D59] flex items-center justify-center gap-1.5 mt-1 transition-colors"
            >
              <span className="material-symbols-outlined text-sm font-bold">person_add</span>
              <span>+ Add Household Member</span>
            </button>
          )}
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 flex items-center justify-between border-t-2 border-[#264D59] pt-2">
          <span className="text-[9px] font-label text-[#41484b]">
            All splits and ledgers dynamically synchronize across members.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#264D59] text-white hover:bg-[#F9E07F] hover:text-[#264D59] border-2 border-[#264D59] shadow-[2px_2px_0px_#264D59] font-headline font-bold text-xs uppercase transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
