import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import ChitGroups from './pages/ChitGroups';
import Members from './pages/Members';
import Installments from './pages/Installments';
import Auctions from './pages/Auctions';
import Loans from './pages/Loans';
import Accounting from './pages/Accounting';
import Reports from './pages/Reports';
import Notifications from './pages/Notifications';

export default function App() {
  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/chit-groups" element={<ChitGroups />} />
        <Route path="/members" element={<Members />} />
        <Route path="/installments" element={<Installments />} />
        <Route path="/auctions" element={<Auctions />} />
        <Route path="/loans" element={<Loans />} />
        <Route path="/accounting" element={<Accounting />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/notifications" element={<Notifications />} />
      </Routes>
    </MainLayout>
  );
}
