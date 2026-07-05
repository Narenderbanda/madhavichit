import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';
import DataTable from '../components/DataTable';
import FormModal from '../components/FormModal';
import PageHeader from '../components/PageHeader';
import { useToast } from '../components/ToastProvider';

const cashBookFields = [
  { name: 'BranchId', label: 'Branch ID', required: true },
  { name: 'TransactionDate', label: 'Transaction Date', type: 'date', required: true },
  { name: 'Description', label: 'Description' },
  { name: 'Debit', label: 'Debit', type: 'number' },
  { name: 'Credit', label: 'Credit', type: 'number' },
  { name: 'Balance', label: 'Balance', type: 'number' }
];

const ledgerFields = [
  { name: 'AccountName', label: 'Account Name', required: true },
  { name: 'TransactionDate', label: 'Transaction Date', type: 'date', required: true },
  { name: 'Debit', label: 'Debit', type: 'number' },
  { name: 'Credit', label: 'Credit', type: 'number' },
  { name: 'Balance', label: 'Balance', type: 'number' }
];

const journalFields = [
  { name: 'TransactionDate', label: 'Transaction Date', type: 'date', required: true },
  { name: 'Description', label: 'Description' },
  { name: 'DebitAccount', label: 'Debit Account', required: true },
  { name: 'CreditAccount', label: 'Credit Account', required: true },
  { name: 'Amount', label: 'Amount', type: 'number', required: true }
];

const expenseFields = [
  { name: 'BranchId', label: 'Branch ID', required: true },
  { name: 'Category', label: 'Category', required: true },
  { name: 'Amount', label: 'Amount', type: 'number', required: true },
  { name: 'Description', label: 'Description', type: 'textarea' },
  { name: 'ExpenseDate', label: 'Expense Date', type: 'date' }
];

const incomeFields = [
  { name: 'BranchId', label: 'Branch ID', required: true },
  { name: 'Source', label: 'Source', required: true },
  { name: 'Amount', label: 'Amount', type: 'number', required: true },
  { name: 'Description', label: 'Description', type: 'textarea' },
  { name: 'IncomeDate', label: 'Income Date', type: 'date' }
];

const TABS = [
  { key: 'cashbook', label: 'Cash Book', endpoint: '/cash-book', fields: cashBookFields, keyField: 'CashBookId' },
  { key: 'ledger', label: 'Ledger', endpoint: '/ledger', fields: ledgerFields, keyField: 'LedgerId' },
  { key: 'journal', label: 'Journal', endpoint: '/journal', fields: journalFields, keyField: 'JournalId' },
  { key: 'expenses', label: 'Expenses', endpoint: '/expenses', fields: expenseFields, keyField: 'ExpenseId' },
  { key: 'income', label: 'Income', endpoint: '/income', fields: incomeFields, keyField: 'IncomeId' },
  { key: 'pl', label: 'Profit & Loss', endpoint: null, fields: null, keyField: null }
];

export default function Accounting() {
  const showToast = useToast();
  const [tab, setTab] = useState('cashbook');
  const [rows, setRows] = useState([]);
  const [pl, setPl] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const current = TABS.find((t) => t.key === tab);

  const loadData = () => {
    if (tab === 'pl') {
      apiClient.get('/reports/profit-report').then((res) => setPl(res.data)).catch(() => setPl(null));
    } else if (current?.endpoint) {
      apiClient.get(current.endpoint).then((res) => setRows(res.data)).catch(() => setRows([]));
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleSubmit = async (data) => {
    try {
      await apiClient.post(current.endpoint, data);
      setModalOpen(false);
      loadData();
    } catch (err) {
      showToast('Error saving record: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const columnsFor = (key) => {
    if (!rows[0]) return [];
    return Object.keys(rows[0]).map((k) => ({ key: k, label: k }));
  };

  return (
    <div>
      <PageHeader
        title="Accounting"
        actionLabel={tab !== 'pl' ? `Add ${current.label}` : undefined}
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

      {tab === 'pl' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <p className="text-sm text-gray-500">Total Income</p>
            <p className="text-xl font-bold text-green-600">₹{pl?.TotalIncome ?? '...'}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <p className="text-sm text-gray-500">Total Expense</p>
            <p className="text-xl font-bold text-red-600">₹{pl?.TotalExpense ?? '...'}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <p className="text-sm text-gray-500">Net Profit</p>
            <p className="text-xl font-bold text-indigo-600">₹{pl?.NetProfit ?? '...'}</p>
          </div>
        </div>
      ) : (
        <DataTable columns={columnsFor(tab)} rows={rows} keyField={current.keyField} />
      )}

      {tab !== 'pl' && (
        <FormModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={`Add ${current.label}`}
          fields={current.fields}
          initialData={null}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
