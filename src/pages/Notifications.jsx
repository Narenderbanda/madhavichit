import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';
import DataTable from '../components/DataTable';
import FormModal from '../components/FormModal';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { useToast } from '../components/ToastProvider';
import { MessageSquare, MessageCircle, Mail, Bell, Send, CheckCircle2, XCircle, Clock } from 'lucide-react';

const TYPE_STYLES = {
  SMS: { icon: MessageSquare, className: 'bg-blue-50 text-blue-700' },
  WhatsApp: { icon: MessageCircle, className: 'bg-green-50 text-green-700' },
  Email: { icon: Mail, className: 'bg-purple-50 text-purple-700' },
  Push: { icon: Bell, className: 'bg-amber-50 text-amber-700' }
};

const STATUS_STYLES = {
  Sent: { icon: CheckCircle2, className: 'bg-green-50 text-green-700' },
  Failed: { icon: XCircle, className: 'bg-red-50 text-red-700' },
  Pending: { icon: Clock, className: 'bg-gray-100 text-gray-600' }
};

function TypeBadge({ type }) {
  const style = TYPE_STYLES[type] || { icon: Bell, className: 'bg-gray-100 text-gray-600' };
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.className}`}>
      <Icon size={13} />
      {type}
    </span>
  );
}

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.Pending;
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.className}`}>
      <Icon size={13} />
      {status}
    </span>
  );
}

function formatSentAt(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export default function Notifications() {
  const showToast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [members, setMembers] = useState([]);
  const [groupFilter, setGroupFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const loadData = () => {
    apiClient.get('/notifications').then((res) => setNotifications(res.data)).catch(() => setNotifications([]));
  };
  const loadCustomers = () => {
    apiClient.get('/customers').then((res) => setCustomers(res.data)).catch(() => setCustomers([]));
  };
  const loadGroups = () => {
    apiClient.get('/chit-groups').then((res) => setGroups(res.data)).catch(() => setGroups([]));
  };
  const loadMembers = () => {
    apiClient.get('/members').then((res) => setMembers(res.data)).catch(() => setMembers([]));
  };

  useEffect(() => {
    loadData();
    loadCustomers();
    loadGroups();
    loadMembers();
  }, []);

  const sentCount = notifications.filter((n) => n.Status === 'Sent').length;
  const failedCount = notifications.filter((n) => n.Status === 'Failed').length;
  const pendingCount = notifications.filter((n) => n.Status === 'Pending').length;

  // Narrow the recipient dropdown to members of the chosen chit group; with no group
  // picked, every customer is a valid recipient.
  const customerOptions = (groupFilter
    ? customers.filter((c) => members.some((m) => m.CustomerId === c.CustomerId && m.GroupId === Number(groupFilter)))
    : customers
  ).map((c) => ({ value: c.CustomerId, label: `${c.Name} (ID ${c.CustomerId})` }));

  const fields = [
    {
      name: 'GroupId',
      label: 'Chit Group (filters recipient list)',
      type: 'select',
      options: groups.map((g) => ({ value: g.GroupId, label: g.GroupName }))
    },
    {
      name: 'CustomerId',
      label: 'Customer (recipient) — leave blank to send to every member of the Chit Group above',
      type: 'select',
      options: customerOptions
    },
    { name: 'UserId', label: 'User ID (recipient, if internal)', type: 'number' },
    {
      name: 'Type',
      label: 'Type',
      type: 'select',
      required: true,
      options: [
        { value: 'SMS', label: 'SMS' },
        { value: 'WhatsApp', label: 'WhatsApp' },
        { value: 'Email', label: 'Email' },
        { value: 'Push', label: 'Push' }
      ]
    },
    { name: 'Message', label: 'Message', type: 'textarea', required: true }
  ];

  const handleSubmit = async (data) => {
    // GroupId is a UI-only filter/target — the notifications table has no such column.
    const { GroupId, CustomerId, ...notificationData } = data;

    // A group picked with no specific customer means "send to every member of that group".
    if (!CustomerId && GroupId) {
      const recipients = customers.filter((c) =>
        members.some((m) => m.CustomerId === c.CustomerId && m.GroupId === Number(GroupId))
      );
      if (recipients.length === 0) {
        showToast('This chit group has no enrolled customers to notify.', 'error');
        return;
      }
      try {
        const results = await Promise.all(
          recipients.map((c) => apiClient.post('/notifications', { ...notificationData, CustomerId: c.CustomerId }))
        );
        setModalOpen(false);
        loadData();
        const failed = results.filter((r) => r.data.Status === 'Failed');
        if (failed.length > 0) {
          showToast(
            `Sent to ${results.length - failed.length}/${results.length} member(s). ${failed.length} failed:\n` +
              failed.map((r) => `- ${r.data.error}`).join('\n'),
            'error'
          );
        } else {
          showToast(`Notification sent to all ${recipients.length} member(s) of the selected chit group.`, 'success');
        }
      } catch (err) {
        showToast('Error sending notification: ' + (err.response?.data?.error || err.message), 'error');
      }
      return;
    }

    try {
      const res = await apiClient.post('/notifications', { ...notificationData, CustomerId });
      setModalOpen(false);
      loadData();
      if (res.data.Status === 'Failed') {
        showToast('Notification saved, but sending failed: ' + res.data.error, 'error');
      } else {
        showToast('Notification sent.', 'success');
      }
    } catch (err) {
      showToast('Error sending notification: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const columns = [
    { key: 'NotificationId', label: 'ID' },
    { key: 'Type', label: 'Type', render: (row) => <TypeBadge type={row.Type} /> },
    {
      key: 'CustomerId',
      label: 'Customer',
      render: (row) => {
        const c = customers.find((cust) => cust.CustomerId === row.CustomerId);
        return c ? `${c.Name} (ID ${row.CustomerId})` : row.CustomerId ?? '—';
      }
    },
    { key: 'UserId', label: 'User ID', render: (row) => row.UserId ?? '—' },
    {
      key: 'Message',
      label: 'Message',
      render: (row) => (
        <span className="block max-w-xs truncate" title={row.Message}>
          {row.Message}
        </span>
      )
    },
    { key: 'Status', label: 'Status', render: (row) => <StatusBadge status={row.Status} /> },
    { key: 'SentAt', label: 'Sent At', render: (row) => formatSentAt(row.SentAt) }
  ];

  return (
    <div>
      <PageHeader title="Notifications" actionLabel="Send Notification" onAction={() => setModalOpen(true)} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Total Notifications" value={notifications.length} icon={Send} color="indigo" />
        <StatCard label="Sent" value={sentCount} icon={CheckCircle2} color="green" />
        <StatCard label="Failed" value={failedCount} icon={XCircle} color="red" />
        <StatCard label="Pending" value={pendingCount} icon={Clock} color="amber" />
      </div>

      <div className="flex gap-3 mb-4">
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Chit Groups</option>
          {groups.map((g) => (
            <option key={g.GroupId} value={g.GroupId}>
              {g.GroupName}
            </option>
          ))}
        </select>
      </div>
      <DataTable columns={columns} rows={notifications} keyField="NotificationId" />
      <FormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Send Notification"
        fields={fields}
        initialData={groupFilter ? { GroupId: groupFilter } : null}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
