import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';
import DataTable from '../components/DataTable';
import FormModal from '../components/FormModal';
import PageHeader from '../components/PageHeader';
import { useToast } from '../components/ToastProvider';

const paymentFields = [
  { name: 'MemberId', label: 'Member ID', required: true },
  { name: 'InstallmentId', label: 'Installment ID', required: true },
  { name: 'Amount', label: 'Amount', type: 'number', required: true },
  {
    name: 'Mode',
    label: 'Mode',
    type: 'select',
    options: [
      { value: 'Cash', label: 'Cash' },
      { value: 'Online', label: 'Online' }
    ],
    required: true
  },
  { name: 'TransactionRef', label: 'Transaction Ref' },
  { name: 'PaymentDate', label: 'Payment Date', type: 'date' },
  { name: 'CollectedBy', label: 'Collected By (User ID)' }
];

// simple penalty calc: flat rate 2% of installment amount if overdue
function computePenalty(installment) {
  if (installment.Status !== 'Overdue') return 0;
  return (parseFloat(installment.Amount || 0) * 0.02).toFixed(2);
}

export default function Installments() {
  const showToast = useToast();
  const [installments, setInstallments] = useState([]);
  const [groupFilter, setGroupFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const loadInstallments = () => {
    const params = {};
    if (groupFilter) params.groupId = groupFilter;
    if (monthFilter) params.monthNumber = monthFilter;
    apiClient
      .get('/installments', { params })
      .then((res) => setInstallments(res.data))
      .catch(() => setInstallments([]));
  };

  useEffect(() => {
    loadInstallments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupFilter, monthFilter]);

  const handleSubmit = async (data) => {
    try {
      await apiClient.post('/payments', data);
      setModalOpen(false);
      loadInstallments();
    } catch (err) {
      showToast('Error recording payment: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleGenerateReceipt = async (row) => {
    try {
      const res = await apiClient.post('/receipts', {
        PaymentId: row.PaymentId || row.InstallmentId,
        ReceiptDate: new Date().toISOString().slice(0, 10),
        GeneratedBy: 1
      });
      showToast(`Receipt generated: ${res.data.ReceiptNo}`, 'success');
    } catch (err) {
      showToast('Error generating receipt: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const columns = [
    { key: 'InstallmentId', label: 'ID' },
    { key: 'CustomerName', label: 'Customer' },
    { key: 'GroupName', label: 'Group' },
    { key: 'MonthNumber', label: 'Month' },
    { key: 'Amount', label: 'Amount' },
    { key: 'DueDate', label: 'Due Date' },
    { key: 'Status', label: 'Status' },
    { key: 'Penalty', label: 'Penalty', render: (row) => `₹${computePenalty(row)}` },
    {
      key: 'actions2',
      label: 'Receipt',
      render: (row) => (
        <button
          onClick={() => handleGenerateReceipt(row)}
          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
        >
          Generate Receipt
        </button>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Installment Collection"
        actionLabel="Record Payment"
        onAction={() => setModalOpen(true)}
      />
      <div className="flex gap-3 mb-4">
        <input
          placeholder="Filter by Group ID"
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
        <input
          placeholder="Filter by Month Number"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>
      <DataTable columns={columns} rows={installments} keyField="InstallmentId" />
      <FormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Payment"
        fields={paymentFields}
        initialData={null}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
