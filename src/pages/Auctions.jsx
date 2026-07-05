import React, { useEffect, useState } from 'react';
import apiClient from '../api/client';
import DataTable from '../components/DataTable';
import FormModal from '../components/FormModal';
import PageHeader from '../components/PageHeader';
import { useToast } from '../components/ToastProvider';

const auctionFields = [
  { name: 'GroupId', label: 'Group ID', required: true },
  { name: 'MonthNumber', label: 'Month Number', type: 'number', required: true },
  { name: 'AuctionDate', label: 'Auction Date', type: 'date' },
  { name: 'LowestBid', label: 'Lowest Bid', type: 'number' },
  { name: 'Status', label: 'Status' }
];

const bidFields = [
  { name: 'AuctionId', label: 'Auction ID', required: true },
  { name: 'MemberId', label: 'Member ID', required: true },
  { name: 'BidAmount', label: 'Bid Amount', type: 'number', required: true }
];

const winnerFields = [
  { name: 'WinnerMemberId', label: 'Winner Member ID', required: true },
  { name: 'BidAmount', label: 'Winning Bid Amount', type: 'number', required: true },
  { name: 'CommissionRate', label: 'Commission Rate (%)', type: 'number' }
];

export default function Auctions() {
  const showToast = useToast();
  const [tab, setTab] = useState('auctions');
  const [auctions, setAuctions] = useState([]);
  const [bids, setBids] = useState([]);
  const [dividends, setDividends] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [bidModalOpen, setBidModalOpen] = useState(false);
  const [winnerModalOpen, setWinnerModalOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState(null);

  const loadAll = () => {
    apiClient.get('/auctions').then((res) => setAuctions(res.data)).catch(() => setAuctions([]));
    apiClient.get('/auction-bids').then((res) => setBids(res.data)).catch(() => setBids([]));
    apiClient.get('/dividends').then((res) => setDividends(res.data)).catch(() => setDividends([]));
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSubmit = async (data) => {
    try {
      await apiClient.post('/auctions', data);
      setModalOpen(false);
      loadAll();
    } catch (err) {
      showToast('Error creating auction: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleBidSubmit = async (data) => {
    try {
      await apiClient.post('/auction-bids', { ...data, BidTime: new Date().toISOString() });
      setBidModalOpen(false);
      loadAll();
    } catch (err) {
      showToast('Error recording bid: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleWinnerSubmit = async (data) => {
    try {
      await apiClient.post(`/auctions/${selectedAuction.AuctionId}/select-winner`, data);
      setWinnerModalOpen(false);
      setSelectedAuction(null);
      loadAll();
    } catch (err) {
      showToast('Error selecting winner: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const auctionColumns = [
    { key: 'AuctionId', label: 'ID' },
    { key: 'GroupName', label: 'Group' },
    { key: 'MonthNumber', label: 'Month' },
    { key: 'AuctionDate', label: 'Date' },
    { key: 'WinnerMemberId', label: 'Winner Member ID' },
    { key: 'BidAmount', label: 'Bid Amount' },
    { key: 'CommissionAmount', label: 'Commission' },
    { key: 'Status', label: 'Status' },
    {
      key: 'actions2',
      label: 'Select Winner',
      render: (row) => (
        <button
          onClick={() => {
            setSelectedAuction(row);
            setWinnerModalOpen(true);
          }}
          className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200"
        >
          Select Winner
        </button>
      )
    }
  ];

  const bidColumns = [
    { key: 'BidId', label: 'ID' },
    { key: 'AuctionId', label: 'Auction ID' },
    { key: 'MemberId', label: 'Member ID' },
    { key: 'BidAmount', label: 'Bid Amount' },
    { key: 'BidTime', label: 'Bid Time' }
  ];

  const dividendColumns = [
    { key: 'DividendId', label: 'ID' },
    { key: 'AuctionId', label: 'Auction ID' },
    { key: 'MemberId', label: 'Member ID' },
    { key: 'Amount', label: 'Amount' }
  ];

  return (
    <div>
      <PageHeader
        title="Auction Module"
        actionLabel={tab === 'auctions' ? 'Add Auction' : tab === 'bids' ? 'Record Bid' : undefined}
        onAction={() => {
          if (tab === 'auctions') setModalOpen(true);
          if (tab === 'bids') setBidModalOpen(true);
        }}
      />
      <div className="flex gap-2 mb-4">
        {['auctions', 'bids', 'dividends'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-md capitalize ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'auctions' && <DataTable columns={auctionColumns} rows={auctions} keyField="AuctionId" />}
      {tab === 'bids' && <DataTable columns={bidColumns} rows={bids} keyField="BidId" />}
      {tab === 'dividends' && <DataTable columns={dividendColumns} rows={dividends} keyField="DividendId" />}

      <FormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Auction"
        fields={auctionFields}
        initialData={null}
        onSubmit={handleSubmit}
      />
      <FormModal
        isOpen={bidModalOpen}
        onClose={() => setBidModalOpen(false)}
        title="Record Bid"
        fields={bidFields}
        initialData={null}
        onSubmit={handleBidSubmit}
      />
      <FormModal
        isOpen={winnerModalOpen}
        onClose={() => {
          setWinnerModalOpen(false);
          setSelectedAuction(null);
        }}
        title={`Select Winner - Auction #${selectedAuction?.AuctionId ?? ''}`}
        fields={winnerFields}
        initialData={null}
        onSubmit={handleWinnerSubmit}
      />
    </div>
  );
}
