import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';
import StatCard from '../components/StatCard';
import { Users, Layers, Wallet, AlertCircle, Gavel } from 'lucide-react';

const PERIODS = [
  { key: 'daily', label: 'Daily' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' }
];

const COLLECTION_LABEL = {
  daily: "Today's Collection",
  monthly: "This Month's Collection",
  yearly: "This Year's Collection"
};

export default function Dashboard() {
  const [period, setPeriod] = useState('daily');
  const [summary, setSummary] = useState({
    totalCustomers: 0,
    activeChitGroups: 0,
    periodCollection: 0,
    pendingDues: 0,
    upcomingAuctions: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    apiClient
      .get(`/dashboard/summary?period=${period}`)
      .then((res) => setSummary(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h2 className="text-xl font-bold text-gray-800">Dashboard</h2>
        <div className="flex gap-1 bg-gray-100 rounded-md p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === p.key ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <div className="mb-4 p-3 bg-amber-50 text-amber-700 rounded-md text-sm">
          Could not load live data ({error}). Make sure the backend API is running on port 5000.
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total Customers" value={loading ? '...' : summary.totalCustomers} icon={Users} color="indigo" />
        <StatCard label="Active Chit Groups" value={loading ? '...' : summary.activeChitGroups} icon={Layers} color="blue" />
        <StatCard
          label={COLLECTION_LABEL[period]}
          value={loading ? '...' : `₹${summary.periodCollection}`}
          icon={Wallet}
          color="green"
        />
        <StatCard label="Pending Dues" value={loading ? '...' : `₹${summary.pendingDues}`} icon={AlertCircle} color="red" />
        <StatCard label="Upcoming Auctions" value={loading ? '...' : summary.upcomingAuctions} icon={Gavel} color="amber" />
      </div>
    </div>
  );
}
