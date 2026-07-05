import React from 'react';
import { NavLink } from 'react-router-dom';
import logo from '../assets/logo.svg';
import {
  LayoutDashboard,
  Users,
  Layers,
  UserPlus,
  Wallet,
  Calculator,
  FileBarChart,
  Bell
} from 'lucide-react';

// Auctions and Loans are hidden from navigation per request — their routes/pages are
// still registered in App.jsx, just not linked from the sidebar.
const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/chit-groups', label: 'Chit Groups', icon: Layers },
  { to: '/members', label: 'Member Enrollment', icon: UserPlus },
  { to: '/installments', label: 'Installment Collection', icon: Wallet },
  { to: '/accounting', label: 'Accounting', icon: Calculator },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/notifications', label: 'Notifications', icon: Bell },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen sticky top-0 flex flex-col">
      <div className="px-5 py-4 border-b border-gray-200">
        <img src={logo} alt="Madhavi Chit Fund" className="w-full h-auto" />
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-sm font-medium mx-2 rounded-md mb-1 transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
