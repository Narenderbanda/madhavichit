import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';
import DataTable from '../components/DataTable';
import FormModal from '../components/FormModal';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmProvider';

const fields = [
  { name: 'GroupName', label: 'Group Name', required: true },
  { name: 'ChitAmount', label: 'Chit Value', type: 'number', required: true },
  { name: 'Months', label: 'Duration (Months)', type: 'number', required: true },
  { name: 'Installment', label: 'Monthly Installment', type: 'number', required: true },
  { name: 'PostLiftInstallment', label: 'Installment After Chit Lift (Auction)', type: 'number', required: true },
  { name: 'StartDate', label: 'Start Date', type: 'date', required: true },
  { name: 'AuctionRules', label: 'Auction Rules', type: 'textarea' },
  { name: 'BranchId', label: 'Branch ID' },
  {
    name: 'Status',
    label: 'Status',
    type: 'select',
    required: true,
    options: [
      { value: 'Active', label: 'Active' },
      { value: 'Closed', label: 'Closed' },
      { value: 'Upcoming', label: 'Upcoming' }
    ]
  }
];

// EndDate isn't collected from the user anymore — it's derived from StartDate + Months.
function computeEndDate(startDate, months) {
  if (!startDate || !months) return null;
  const d = new Date(startDate);
  if (Number.isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + Number(months));
  return d.toISOString().slice(0, 10);
}

export default function ChitGroups() {
  const showToast = useToast();
  const confirmAction = useConfirm();
  const [groups, setGroups] = useState([]);
  const [members, setMembers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewingGroup, setViewingGroup] = useState(null);

  const loadGroups = () => {
    apiClient.get('/chit-groups').then((res) => setGroups(res.data)).catch(() => setGroups([]));
  };
  const loadMembers = () => {
    apiClient.get('/members').then((res) => setMembers(res.data)).catch(() => setMembers([]));
  };

  useEffect(() => {
    loadGroups();
    loadMembers();
  }, []);

  const handleSubmit = async (data) => {
    const payload = { ...data, EndDate: computeEndDate(data.StartDate, data.Months) };
    try {
      if (editing) {
        await apiClient.put(`/chit-groups/${editing.GroupId}`, payload);
      } else {
        await apiClient.post('/chit-groups', payload);
      }
      setModalOpen(false);
      setEditing(null);
      loadGroups();
    } catch (err) {
      showToast('Error saving chit group: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleDelete = async (row) => {
    if (!(await confirmAction(`Delete chit group ${row.GroupName}?`))) return;
    try {
      await apiClient.delete(`/chit-groups/${row.GroupId}`);
      loadGroups();
    } catch (err) {
      showToast('Error deleting chit group: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const columns = [
    { key: 'GroupId', label: 'ID' },
    { key: 'GroupName', label: 'Group Name' },
    { key: 'ChitAmount', label: 'Chit Value' },
    { key: 'Months', label: 'Months' },
    { key: 'Installment', label: 'Installment' },
    {
      key: 'PostLiftInstallment',
      label: 'Post-Lift Installment',
      render: (row) => (row.PostLiftInstallment != null ? row.PostLiftInstallment : '—')
    },
    { key: 'MemberCount', label: 'Members', render: (row) => row.MemberCount ?? '-' },
    { key: 'Status', label: 'Status' }
  ];

  const membersInViewedGroup = viewingGroup
    ? members.filter((m) => m.GroupId === viewingGroup.GroupId)
    : [];

  return (
    <div>
      <PageHeader
        title="Chit Group Management"
        actionLabel="Add Chit Group"
        onAction={() => {
          setEditing(null);
          setModalOpen(true);
        }}
      />
      <DataTable
        columns={columns}
        rows={groups}
        keyField="GroupId"
        onView={(row) => {
          loadMembers();
          setViewingGroup(row);
        }}
        onEdit={(row) => {
          setEditing(row);
          setModalOpen(true);
        }}
        onDelete={handleDelete}
      />
      <FormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        title={editing ? 'Edit Chit Group' : 'Add Chit Group'}
        fields={fields}
        initialData={editing}
        onSubmit={handleSubmit}
      />

      <Modal
        isOpen={!!viewingGroup}
        onClose={() => setViewingGroup(null)}
        title={viewingGroup ? `${viewingGroup.GroupName} — Members` : 'Members'}
      >
        {viewingGroup && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
              <div><span className="font-medium text-gray-800">Chit Value:</span> {viewingGroup.ChitAmount}</div>
              <div><span className="font-medium text-gray-800">Duration:</span> {viewingGroup.Months} months</div>
              <div>
                <span className="font-medium text-gray-800">End Date:</span>{' '}
                {viewingGroup.EndDate ? new Date(viewingGroup.EndDate).toLocaleDateString() : 'Not set'}
              </div>
              <div><span className="font-medium text-gray-800">Installment:</span> {viewingGroup.Installment}</div>
              <div>
                <span className="font-medium text-gray-800">Post-Lift Installment:</span>{' '}
                {viewingGroup.PostLiftInstallment ?? 'Not set'}
              </div>
              <div><span className="font-medium text-gray-800">Status:</span> {viewingGroup.Status}</div>
            </div>
            <h4 className="text-sm font-semibold text-gray-800">
              Enrolled Customers ({membersInViewedGroup.length})
            </h4>
            {membersInViewedGroup.length === 0 ? (
              <p className="text-sm text-gray-400">No members enrolled in this chit group yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md overflow-hidden">
                {membersInViewedGroup.map((m) => (
                  <li key={m.MemberId} className="px-3 py-2 text-sm flex justify-between items-center">
                    <span>{m.CustomerName || `Customer #${m.CustomerId}`}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {m.Status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
