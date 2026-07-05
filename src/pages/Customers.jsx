import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import apiClient from '../api/client';
import DataTable from '../components/DataTable';
import FormModal from '../components/FormModal';
import PageHeader from '../components/PageHeader';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmProvider';

export const baseCustomerFields = [
  { name: 'Name', label: 'Name', required: true },
  { name: 'Mobile', label: 'Mobile', required: true },
  { name: 'Email', label: 'Email', type: 'email' },
  { name: 'Aadhaar', label: 'Aadhaar Number' },
  { name: 'PAN', label: 'PAN Number' },
  { name: 'DOB', label: 'Date of Birth', type: 'date' },
  { name: 'Address', label: 'Address', type: 'textarea' },
  { name: 'NomineeName', label: 'Nominee Name' },
  { name: 'NomineeRelation', label: 'Nominee Relation' },
  { name: 'BankName', label: 'Bank Name' },
  { name: 'AccountNumber', label: 'Account Number' },
  { name: 'IFSC', label: 'IFSC Code' },
  {
    name: 'KYCStatus',
    label: 'KYC Status',
    type: 'select',
    options: [
      { value: 'Pending', label: 'Pending' },
      { value: 'Verified', label: 'Verified' },
      { value: 'Rejected', label: 'Rejected' }
    ]
  },
  { name: 'AgentId', label: 'Agent ID' },
  { name: 'BranchId', label: 'Branch ID' }
];

// "GroupId", "TicketNumber" and "SharePercent" are not columns on customers — they're
// UI-only fields. When GroupId is set, we enroll the customer into that chit group
// (creates a members row) right after the customer is saved, whether it's a new
// customer or an edit.
const groupField = (groups) => ({
  name: 'GroupId',
  label: 'Enroll in Chit Group (optional)',
  type: 'select',
  options: groups.map((g) => ({ value: g.GroupId, label: g.GroupName }))
});

const ticketNumberField = { name: 'TicketNumber', label: 'Ticket Number', type: 'number' };

// Two customers can share one ticket by enrolling both with the same Group ID + Ticket
// Number and SharePercent adding up to 100 (e.g. 50/50) — see Members.jsx for the
// server-side validation that enforces the 100% total.
const sharePercentField = {
  name: 'SharePercent',
  label: 'Share % (100 for a full ticket; e.g. 50 if two customers split one ticket 50/50 using the same Group ID + Ticket Number)',
  type: 'number'
};

export default function Customers() {
  const navigate = useNavigate();
  const showToast = useToast();
  const confirmAction = useConfirm();
  const [tab, setTab] = useState('customers');
  const [customers, setCustomers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [members, setMembers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [groupFilter, setGroupFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadCustomers = () => {
    apiClient.get('/customers').then((res) => setCustomers(res.data)).catch(() => setCustomers([]));
  };
  const loadDocuments = () => {
    apiClient.get('/customer-documents').then((res) => setDocuments(res.data)).catch(() => setDocuments([]));
  };
  const loadGroups = () => {
    return apiClient.get('/chit-groups').then((res) => setGroups(res.data)).catch(() => setGroups([]));
  };
  const loadMembers = () => {
    return apiClient.get('/members').then((res) => setMembers(res.data)).catch(() => setMembers([]));
  };

  useEffect(() => {
    loadCustomers();
    loadDocuments();
    loadGroups();
    loadMembers();
  }, []);

  // A customer can have multiple enrollments; pre-fill the dropdown/ticket/share fields
  // with their most recent active one so editing shows where they already stand.
  const currentMemberFor = (customerId) => {
    const active = members
      .filter((m) => m.CustomerId === customerId && m.Status !== 'Exited')
      .sort((a, b) => b.MemberId - a.MemberId);
    return active[0] || null;
  };

  // Shown as the 4th field, whether adding or editing, so it's decided right
  // after the core identity fields. Memoized so its identity only changes when
  // its inputs actually change — otherwise FormModal's effect (keyed on `fields`)
  // would reset in-progress edits on every unrelated re-render of this page.
  // Only Active groups are enrollable (Closed ones are done, Upcoming ones haven't
  // opened) — except the group a customer being edited is already enrolled in, which
  // stays selectable even if it since moved to Closed, so editing doesn't blank it out.
  const customerFields = useMemo(() => {
    const editingMember = editing ? currentMemberFor(editing.CustomerId) : null;
    const enrollableGroups = groups.filter(
      (g) => g.Status === 'Active' || (editingMember && g.GroupId === editingMember.GroupId)
    );
    return [
      ...baseCustomerFields.slice(0, 3),
      groupField(enrollableGroups),
      ticketNumberField,
      sharePercentField,
      ...baseCustomerFields.slice(3)
    ];
  }, [groups, editing, members]);

  // Customer dropdown for the Add Document form, showing names instead of raw IDs.
  const docFields = [
    {
      name: 'CustomerId',
      label: 'Customer',
      type: 'select',
      required: true,
      options: customers.map((c) => ({ value: c.CustomerId, label: `${c.Name} (ID ${c.CustomerId})` }))
    },
    { name: 'DocType', label: 'Document Type', required: true },
    { name: 'FilePath', label: 'File Path / URL', required: true }
  ];

  const handleSubmit = async (data) => {
    const { GroupId, TicketNumber, SharePercent, ...customerData } = data;
    try {
      let customerId;
      if (editing) {
        await apiClient.put(`/customers/${editing.CustomerId}`, customerData);
        customerId = editing.CustomerId;
      } else {
        const res = await apiClient.post('/customers', customerData);
        customerId = res.data.CustomerId;
      }
      // The dropdown is pre-filled with the customer's current group when editing,
      // so "already enrolled" is the expected default state, not a mistake — just
      // skip creating a duplicate. But Ticket Number / Share % are also pre-filled
      // from that same enrollment, so if the user changed either, push the update
      // instead of silently discarding it.
      const existingMember = members.find(
        (m) => m.CustomerId === customerId && m.GroupId === Number(GroupId) && m.Status !== 'Exited'
      );
      if (GroupId && !existingMember) {
        try {
          await apiClient.post('/members', {
            CustomerId: customerId,
            GroupId,
            TicketNumber,
            SharePercent,
            EnrollDate: new Date().toISOString().slice(0, 10),
            Status: 'Active'
          });
          loadMembers();
        } catch (enrollErr) {
          showToast(
            `Customer was ${editing ? 'updated' : 'created'}, but enrolling into the chit group failed: ` +
              (enrollErr.response?.data?.error || enrollErr.message),
            'error'
          );
        }
      } else if (existingMember) {
        const ticketChanged = String(TicketNumber ?? '') !== String(existingMember.TicketNumber ?? '');
        const shareChanged = Number(SharePercent || 100) !== Number(existingMember.SharePercent ?? 100);
        if (ticketChanged || shareChanged) {
          try {
            await apiClient.put(`/members/${existingMember.MemberId}`, { TicketNumber, SharePercent });
            loadMembers();
          } catch (updateErr) {
            showToast(
              'Customer was updated, but updating the ticket/share failed: ' +
                (updateErr.response?.data?.error || updateErr.message),
              'error'
            );
          }
        }
      }
      setModalOpen(false);
      setEditing(null);
      loadCustomers();
    } catch (err) {
      showToast('Error saving customer: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleDocSubmit = async (data) => {
    try {
      await apiClient.post('/customer-documents', data);
      setDocModalOpen(false);
      loadDocuments();
    } catch (err) {
      showToast('Error saving document: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleDelete = async (row) => {
    const confirmed = await confirmAction(
      `Delete customer ${row.Name}?\n\nThis will also permanently delete all of their chit group enrollments, payments, and installments. This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await apiClient.delete(`/customers/${row.CustomerId}`);
      loadCustomers();
      loadMembers();
      showToast(`${row.Name} and all related records were deleted.`, 'success');
    } catch (err) {
      showToast('Error deleting customer: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  // Only customers with an active enrollment in the chosen group; '' means no filter.
  const groupFilteredCustomers = groupFilter
    ? customers.filter((c) =>
        members.some((m) => m.CustomerId === c.CustomerId && m.GroupId === Number(groupFilter) && m.Status !== 'Exited')
      )
    : customers;

  // Matches against name, mobile, email, or ID so front-desk staff can search by whatever
  // detail the customer gives them.
  const query = searchQuery.trim().toLowerCase();
  const filteredCustomers = query
    ? groupFilteredCustomers.filter((c) =>
        [c.Name, c.Mobile, c.Email, String(c.CustomerId)].some((field) => field && field.toLowerCase().includes(query))
      )
    : groupFilteredCustomers;

  const customerColumns = [
    { key: 'CustomerId', label: 'ID' },
    { key: 'Name', label: 'Name' },
    { key: 'Mobile', label: 'Mobile' },
    { key: 'Email', label: 'Email' },
    { key: 'Aadhaar', label: 'Aadhaar' },
    { key: 'PAN', label: 'PAN' },
    { key: 'KYCStatus', label: 'KYC Status' }
  ];

  const docColumns = [
    { key: 'DocumentId', label: 'ID' },
    {
      key: 'CustomerId',
      label: 'Customer',
      render: (row) => {
        const c = customers.find((cust) => cust.CustomerId === row.CustomerId);
        return c ? `${c.Name} (ID ${row.CustomerId})` : row.CustomerId;
      }
    },
    { key: 'DocType', label: 'Doc Type' },
    { key: 'FilePath', label: 'File Path' },
    { key: 'UploadedAt', label: 'Uploaded At' }
  ];

  return (
    <div>
      <PageHeader
        title="Customer Management"
        actionLabel={tab === 'customers' ? 'Add Customer' : 'Add Document'}
        onAction={async () => {
          if (tab === 'customers') {
            await Promise.all([loadGroups(), loadMembers()]);
            setEditing(null);
            setModalOpen(true);
          } else {
            setDocModalOpen(true);
          }
        }}
      />

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('customers')}
          className={`px-4 py-2 text-sm font-medium rounded-md ${tab === 'customers' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
        >
          Customers
        </button>
        <button
          onClick={() => setTab('documents')}
          className={`px-4 py-2 text-sm font-medium rounded-md ${tab === 'documents' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
        >
          Documents
        </button>
      </div>

      {tab === 'customers' && (
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, mobile, email, or ID..."
              className="border border-gray-300 rounded-md pl-8 pr-3 py-1.5 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <label className="text-sm font-medium text-gray-700">Chit Group:</label>
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Groups</option>
            {groups.map((g) => (
              <option key={g.GroupId} value={g.GroupId}>
                {g.GroupName}
              </option>
            ))}
          </select>
        </div>
      )}

      {tab === 'customers' ? (
        <DataTable
          columns={customerColumns}
          rows={filteredCustomers}
          keyField="CustomerId"
          onView={(row) => navigate(`/customers/${row.CustomerId}`)}
          onEdit={async (row) => {
            // Wait for fresh group/member data before opening — otherwise the modal can
            // prefill from a stale `members` snapshot and show an existing enrollment's
            // Group/Ticket/Share as blank (e.g. right after enrolling via another page).
            await Promise.all([loadGroups(), loadMembers()]);
            setEditing(row);
            setModalOpen(true);
          }}
          onDelete={handleDelete}
        />
      ) : (
        <DataTable columns={docColumns} rows={documents} keyField="DocumentId" />
      )}

      <FormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        title={editing ? 'Edit Customer' : 'Add Customer'}
        fields={customerFields}
        initialData={
          editing
            ? (() => {
                const m = currentMemberFor(editing.CustomerId);
                return {
                  ...editing,
                  GroupId: m?.GroupId ?? '',
                  TicketNumber: m?.TicketNumber ?? '',
                  SharePercent: m?.SharePercent ?? ''
                };
              })()
            : null
        }
        onSubmit={handleSubmit}
      />

      <FormModal
        isOpen={docModalOpen}
        onClose={() => setDocModalOpen(false)}
        title="Add Document"
        fields={docFields}
        initialData={null}
        onSubmit={handleDocSubmit}
      />
    </div>
  );
}
