import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';

const REPORT_TABS = [
  { key: 'daily-collection', label: 'Daily Collection', endpoint: '/reports/daily-collection' },
  { key: 'due-report', label: 'Due Report', endpoint: '/reports/due-report' },
  { key: 'customer-ledger', label: 'Customer Ledger', endpoint: null },
  { key: 'auction-report', label: 'Auction Report', endpoint: '/reports/auction-report' },
  { key: 'profit-report', label: 'Profit Report', endpoint: '/reports/profit-report' },
  { key: 'agent-commission-report', label: 'Agent Commission', endpoint: '/reports/agent-commission-report' },
  { key: 'gst-report', label: 'GST Report', endpoint: '/reports/gst-report' }
];

function columnsFromRows(rows) {
  if (!rows || rows.length === 0) return [];
  return Object.keys(rows[0]).map((k) => ({ key: k, label: k }));
}

export default function Reports() {
  const [tab, setTab] = useState('daily-collection');
  const [rows, setRows] = useState([]);
  const [customerId, setCustomerId] = useState('');

  const current = REPORT_TABS.find((t) => t.key === tab);

  const loadData = () => {
    if (tab === 'customer-ledger') {
      if (!customerId) {
        setRows([]);
        return;
      }
      apiClient
        .get(`/reports/customer-ledger/${customerId}`)
        .then((res) => setRows(Array.isArray(res.data) ? res.data : [res.data]))
        .catch(() => setRows([]));
    } else if (current?.endpoint) {
      apiClient
        .get(current.endpoint)
        .then((res) => setRows(Array.isArray(res.data) ? res.data : [res.data]))
        .catch(() => setRows([]));
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div>
      <PageHeader title="Reports" />
      <div className="flex gap-2 mb-4 flex-wrap">
        {REPORT_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs font-medium rounded-md ${tab === t.key ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'customer-ledger' && (
        <div className="flex gap-2 mb-4">
          <input
            placeholder="Enter Customer ID"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <button
            onClick={loadData}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            Search
          </button>
        </div>
      )}

      <DataTable columns={columnsFromRows(rows)} rows={rows} keyField={Object.keys(rows[0] || {})[0] || 'id'} />
    </div>
  );
}
