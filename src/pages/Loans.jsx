import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';
import DataTable from '../components/DataTable';
import FormModal from '../components/FormModal';
import PageHeader from '../components/PageHeader';
import { useToast } from '../components/ToastProvider';

const loanFields = [
  { name: 'MemberId', label: 'Member ID', required: true },
  { name: 'Amount', label: 'Loan Amount', type: 'number', required: true },
  { name: 'InterestRate', label: 'Interest Rate (%)', type: 'number', required: true },
  { name: 'RequestDate', label: 'Request Date', type: 'date' },
  { name: 'OutstandingAmount', label: 'Outstanding Amount', type: 'number' }
];

const emiFields = [
  { name: 'LoanId', label: 'Loan ID', required: true },
  { name: 'EMIAmount', label: 'EMI Amount', type: 'number', required: true },
  { name: 'DueDate', label: 'Due Date', type: 'date', required: true },
  { name: 'Status', label: 'Status' }
];

export default function Loans() {
  const showToast = useToast();
  const [tab, setTab] = useState('loans');
  const [loans, setLoans] = useState([]);
  const [emis, setEmis] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [emiModalOpen, setEmiModalOpen] = useState(false);

  const loadAll = () => {
    apiClient.get('/loans').then((res) => setLoans(res.data)).catch(() => setLoans([]));
    apiClient.get('/loan-emis').then((res) => setEmis(res.data)).catch(() => setEmis([]));
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSubmit = async (data) => {
    try {
      await apiClient.post('/loans', data);
      setModalOpen(false);
      loadAll();
    } catch (err) {
      showToast('Error creating loan: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleEmiSubmit = async (data) => {
    try {
      await apiClient.post('/loan-emis', data);
      setEmiModalOpen(false);
      loadAll();
    } catch (err) {
      showToast('Error creating EMI: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleApprove = async (row, status) => {
    try {
      await apiClient.post(`/loans/${row.LoanId}/approve`, { ApprovalStatus: status, ApprovedBy: 1 });
      loadAll();
    } catch (err) {
      showToast('Error updating loan: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const loanColumns = [
    { key: 'LoanId', label: 'ID' },
    { key: 'CustomerName', label: 'Customer' },
    { key: 'Amount', label: 'Amount' },
    { key: 'InterestRate', label: 'Interest %' },
    { key: 'ApprovalStatus', label: 'Approval Status' },
    { key: 'OutstandingAmount', label: 'Outstanding' },
    {
      key: 'actions2',
      label: 'Approve/Reject',
      render: (row) => (
        <div className="flex gap-1">
          <button
            onClick={() => handleApprove(row, 'Approved')}
            className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
          >
            Approve
          </button>
          <button
            onClick={() => handleApprove(row, 'Rejected')}
            className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            Reject
          </button>
        </div>
      )
    }
  ];

  const emiColumns = [
    { key: 'EMIId', label: 'ID' },
    { key: 'LoanId', label: 'Loan ID' },
    { key: 'EMIAmount', label: 'EMI Amount' },
    { key: 'DueDate', label: 'Due Date' },
    { key: 'PaidDate', label: 'Paid Date' },
    { key: 'Status', label: 'Status' }
  ];

  return (
    <div>
      <PageHeader
        title="Loan Against Chit"
        actionLabel={tab === 'loans' ? 'New Loan Request' : 'Add EMI'}
        onAction={() => {
          if (tab === 'loans') setModalOpen(true);
          else setEmiModalOpen(true);
        }}
      />
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('loans')}
          className={`px-4 py-2 text-sm font-medium rounded-md ${tab === 'loans' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
        >
          Loans
        </button>
        <button
          onClick={() => setTab('emis')}
          className={`px-4 py-2 text-sm font-medium rounded-md ${tab === 'emis' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
        >
          EMI Schedule
        </button>
      </div>

      {tab === 'loans' ? (
        <DataTable columns={loanColumns} rows={loans} keyField="LoanId" />
      ) : (
        <DataTable columns={emiColumns} rows={emis} keyField="EMIId" />
      )}

      <FormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Loan Request"
        fields={loanFields}
        initialData={null}
        onSubmit={handleSubmit}
      />
      <FormModal
        isOpen={emiModalOpen}
        onClose={() => setEmiModalOpen(false)}
        title="Add EMI"
        fields={emiFields}
        initialData={null}
        onSubmit={handleEmiSubmit}
      />
    </div>
  );
}
