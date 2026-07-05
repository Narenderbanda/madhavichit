import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';
import DataTable from '../components/DataTable';
import FormModal from '../components/FormModal';
import PageHeader from '../components/PageHeader';
import { useToast } from '../components/ToastProvider';

const memberFields = [
  { name: 'CustomerId', label: 'Customer ID', required: true },
  { name: 'GroupId', label: 'Group ID', required: true },
  { name: 'TicketNumber', label: 'Ticket Number', required: true },
  {
    name: 'SharePercent',
    label: 'Share % (100 for a full ticket; e.g. 50 if two customers split one ticket 50/50 using the same Group ID + Ticket Number)',
    type: 'number'
  },
  { name: 'EnrollDate', label: 'Enroll Date', type: 'date' },
  {
    name: 'Status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'Active', label: 'Active' },
      { value: 'WaitingList', label: 'WaitingList' },
      { value: 'Transferred', label: 'Transferred' },
      { value: 'Exited', label: 'Exited' }
    ]
  }
];

// In a real chit fund, only one ticket can lift (win the auction for) the chit in a
// given month within the same group — this finds whoever already holds that month.
// Co-owners of the same shared ticket (same TicketNumber) are excluded: they're expected
// to carry the same LiftedMonth since a shared ticket lifts as one unit, not a conflict.
export function findChitLiftConflict(members, groupId, month, excludeMemberId) {
  const self = members.find((m) => m.MemberId === excludeMemberId);
  return members.find(
    (m) =>
      m.GroupId === groupId &&
      m.MemberId !== excludeMemberId &&
      !(self && m.TicketNumber != null && m.TicketNumber === self.TicketNumber) &&
      m.ChitLifted === 'Yes' &&
      Number(m.LiftedMonth) === Number(month)
  );
}

export const liftFields = [
  {
    name: 'ChitLifted',
    label: 'Chit Lifted (Auction Won)?',
    type: 'select',
    options: [
      { value: 'No', label: 'No' },
      { value: 'Yes', label: 'Yes' }
    ],
    required: true
  },
  { name: 'LiftedMonth', label: 'Lifted Month (if Yes)', type: 'number' }
];

const waitingFields = [
  { name: 'CustomerId', label: 'Customer ID', required: true },
  { name: 'GroupId', label: 'Group ID', required: true },
  { name: 'RequestDate', label: 'Request Date', type: 'date' },
  { name: 'Status', label: 'Status' }
];

const transferFields = [
  { name: 'MemberId', label: 'Member ID', required: true },
  { name: 'FromCustomerId', label: 'From Customer ID', required: true },
  { name: 'ToCustomerId', label: 'To Customer ID', required: true },
  { name: 'TransferDate', label: 'Transfer Date', type: 'date' },
  { name: 'Reason', label: 'Reason', type: 'textarea' }
];

const exitFields = [
  { name: 'MemberId', label: 'Member ID', required: true },
  { name: 'ExitDate', label: 'Exit Date', type: 'date' },
  { name: 'Reason', label: 'Reason', type: 'textarea' },
  { name: 'RefundAmount', label: 'Refund Amount', type: 'number' }
];

const TABS = [
  { key: 'members', label: 'Add Members' },
  { key: 'waiting', label: 'Waiting List' },
  { key: 'transfer', label: 'Transfer Member' },
  { key: 'exit', label: 'Exit Member' }
];

export default function Members() {
  const showToast = useToast();
  const [tab, setTab] = useState('members');
  const [members, setMembers] = useState([]);
  const [waiting, setWaiting] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [exits, setExits] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [liftingMember, setLiftingMember] = useState(null);

  const loadAll = () => {
    apiClient.get('/members').then((res) => setMembers(res.data)).catch(() => setMembers([]));
    apiClient.get('/waiting-list').then((res) => setWaiting(res.data)).catch(() => setWaiting([]));
    apiClient.get('/member-transfers').then((res) => setTransfers(res.data)).catch(() => setTransfers([]));
    apiClient.get('/member-exits').then((res) => setExits(res.data)).catch(() => setExits([]));
  };

  useEffect(() => {
    loadAll();
  }, []);

  const endpointMap = {
    members: '/members',
    waiting: '/waiting-list',
    transfer: '/member-transfers',
    exit: '/member-exits'
  };

  const handleSubmit = async (data) => {
    try {
      await apiClient.post(endpointMap[tab], data);
      setModalOpen(false);
      loadAll();
    } catch (err) {
      showToast('Error saving record: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleLiftSubmit = async (data) => {
    if (data.ChitLifted === 'Yes' && data.LiftedMonth) {
      const conflict = findChitLiftConflict(members, liftingMember.GroupId, data.LiftedMonth, liftingMember.MemberId);
      if (conflict) {
        showToast(
          `Month ${data.LiftedMonth} was already lifted by ${conflict.CustomerName || 'Member #' + conflict.MemberId} in this chit group. Only one member can lift the chit per month.`,
          'error'
        );
        return;
      }
    }
    try {
      await apiClient.put(`/members/${liftingMember.MemberId}`, data);
      setLiftingMember(null);
      loadAll();
    } catch (err) {
      showToast('Error saving chit lift status: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const memberColumns = [
    { key: 'MemberId', label: 'ID' },
    { key: 'CustomerName', label: 'Customer' },
    { key: 'GroupName', label: 'Group' },
    { key: 'TicketNumber', label: 'Ticket #' },
    { key: 'SharePercent', label: 'Share %', render: (row) => (row.SharePercent != null ? `${row.SharePercent}%` : '100%') },
    { key: 'EnrollDate', label: 'Enroll Date' },
    { key: 'Status', label: 'Status' },
    { key: 'ChitLifted', label: 'Chit Lifted' },
    { key: 'LiftedMonth', label: 'Lifted Month', render: (row) => (row.ChitLifted === 'Yes' ? row.LiftedMonth ?? '—' : '—') }
  ];
  const waitingColumns = [
    { key: 'WaitingId', label: 'ID' },
    { key: 'CustomerId', label: 'Customer ID' },
    { key: 'GroupId', label: 'Group ID' },
    { key: 'RequestDate', label: 'Request Date' },
    { key: 'Status', label: 'Status' }
  ];
  const transferColumns = [
    { key: 'TransferId', label: 'ID' },
    { key: 'MemberId', label: 'Member ID' },
    { key: 'FromCustomerId', label: 'From Customer' },
    { key: 'ToCustomerId', label: 'To Customer' },
    { key: 'TransferDate', label: 'Date' },
    { key: 'Reason', label: 'Reason' }
  ];
  const exitColumns = [
    { key: 'ExitId', label: 'ID' },
    { key: 'MemberId', label: 'Member ID' },
    { key: 'ExitDate', label: 'Exit Date' },
    { key: 'Reason', label: 'Reason' },
    { key: 'RefundAmount', label: 'Refund Amount' }
  ];

  const dataMap = {
    members: { rows: members, columns: memberColumns, key: 'MemberId', fields: memberFields, title: 'Enroll Member' },
    waiting: { rows: waiting, columns: waitingColumns, key: 'WaitingId', fields: waitingFields, title: 'Add to Waiting List' },
    transfer: { rows: transfers, columns: transferColumns, key: 'TransferId', fields: transferFields, title: 'Transfer Member' },
    exit: { rows: exits, columns: exitColumns, key: 'ExitId', fields: exitFields, title: 'Exit Member' }
  };

  const current = dataMap[tab];

  return (
    <div>
      <PageHeader
        title="Member Enrollment"
        actionLabel={current.title}
        onAction={() => setModalOpen(true)}
      />
      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md ${tab === t.key ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <DataTable
        columns={current.columns}
        rows={current.rows}
        keyField={current.key}
        onEdit={tab === 'members' ? (row) => setLiftingMember(row) : undefined}
      />
      <FormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={current.title}
        fields={current.fields}
        initialData={null}
        onSubmit={handleSubmit}
      />
      <FormModal
        isOpen={!!liftingMember}
        onClose={() => setLiftingMember(null)}
        title={liftingMember ? `Chit Lift Status — ${liftingMember.CustomerName || 'Member #' + liftingMember.MemberId}` : 'Chit Lift Status'}
        fields={liftFields}
        initialData={liftingMember}
        onSubmit={handleLiftSubmit}
      />
    </div>
  );
}
