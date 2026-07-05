import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, IndianRupee } from 'lucide-react';
import apiClient from '../api/client';
import FormModal from '../components/FormModal';
import PageHeader from '../components/PageHeader';
import { baseCustomerFields } from './Customers';
import { liftFields, findChitLiftConflict } from './Members';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmProvider';

const paymentFields = [
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
  { name: 'PaymentDate', label: 'Payment Date & Time', type: 'datetime-local' }
];

// MySQL DATETIME columns come back as ISO strings; datetime-local inputs need "YYYY-MM-DDTHH:mm".
function toDateTimeLocal(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

// Every group's monthly due date lands on this fixed day of the month regardless of
// what day StartDate falls on — a chit fund collects on one fixed day every month
// (e.g. "the 10th"), not on the enrollment day drifted forward.
const INSTALLMENT_DUE_DAY = 10;

function addMonths(dateStr, n) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  // Built from year/month + a fixed day directly — using setMonth() on the original
  // day-of-month would drift when the target month is shorter (e.g. Jan 30 + 1 month
  // overflows into March because February has no 30th).
  return new Date(d.getFullYear(), d.getMonth() + n, INSTALLMENT_DUE_DAY);
}

// Net amount a member receives when lifting the chit in a given month, following the
// scheme's standard payout table: 95% of the chit value in month 1, rising by 1% of the
// chit value each subsequent month.
function computeChitLiftPayout(chitAmount, liftedMonth, sharePercent = 100) {
  if (!chitAmount || !liftedMonth) return null;
  const fullPayout = chitAmount * 0.95 + (liftedMonth - 1) * chitAmount * 0.01;
  return fullPayout * (sharePercent / 100);
}

const STATUS_STYLES = {
  Done: 'bg-green-100 text-green-700',
  Due: 'bg-red-100 text-red-700',
  Pending: 'bg-gray-100 text-gray-600'
};

// Builds one row per month of the group's duration (chit_groups.Months), merging in
// whatever installment/payment records already exist so unrecorded months still show up.
function buildMonthRows(member, group, installments, payments) {
  const totalMonths = group?.Months || 0;
  const installmentByMonth = {};
  installments
    .filter((i) => i.MemberId === member.MemberId)
    .forEach((i) => {
      installmentByMonth[i.MonthNumber] = i;
    });
  const paymentByInstallmentId = {};
  const paymentByMonth = {};
  payments
    .filter((p) => p.MemberId === member.MemberId)
    .forEach((p) => {
      if (p.InstallmentId) paymentByInstallmentId[p.InstallmentId] = p;
      if (p.MonthNumber) paymentByMonth[p.MonthNumber] = p;
    });

  // Once a member's chit is lifted (auction won), the group's post-lift installment
  // rate applies to any month after the lift that doesn't already have a recorded amount.
  const liftedMonth = member.ChitLifted === 'Yes' && member.LiftedMonth ? Number(member.LiftedMonth) : null;
  // Members sharing one ticket (e.g. two customers splitting a chit 50/50) each owe
  // their share of the group's installment, not the full ticket amount.
  const shareRatio = (member.SharePercent != null ? Number(member.SharePercent) : 100) / 100;

  const monthData = [];
  for (let month = 1; month <= totalMonths; month++) {
    const inst = installmentByMonth[month] || null;
    const payment = (inst && paymentByInstallmentId[inst.InstallmentId]) || paymentByMonth[month] || null;
    const dueDate = inst?.DueDate || (group?.StartDate ? addMonths(group.StartDate, month - 1) : null);
    const usesPostLiftRate = liftedMonth && month > liftedMonth && group?.PostLiftInstallment != null;
    const computedAmount = group ? Number(usesPostLiftRate ? group.PostLiftInstallment : group.Installment) * shareRatio : 0;
    // A real installment row's Amount is the actual billed amount for that month —
    // trust it over the generic formula. The formula assumes a member's own rate only
    // changes when *their* chit lifts, but in practice a group-wide rate change (e.g.
    // a different member's auction) or manually-entered historical data can make a
    // given month's real amount differ from that. Only unbilled future months (no
    // installment row yet) fall back to the computed estimate.
    const dueAmount = inst?.Amount != null ? Number(inst.Amount) : computedAmount;
    const paidAmount = payment ? parseFloat(payment.Amount || 0) : 0;

    let status = 'Pending';
    if (payment) status = 'Done';
    else if (dueDate && new Date(dueDate) <= new Date()) status = 'Due';

    monthData.push({ month, inst, payment, dueDate, dueAmount, paidAmount, status });
  }

  // Pending isn't matched strictly month-by-month — an overpayment in one month (e.g.
  // ₹3,000 paid against a ₹2,500 due) rolls forward as a credit and clears an earlier
  // month's shortfall automatically, instead of leaving that shortfall stuck forever
  // while the overpaid month shows no pending. Pool everything collected so far and
  // allocate it across months in order.
  let pool = monthData.reduce((sum, m) => sum + m.paidAmount, 0);
  return monthData.map(({ month, inst, payment, dueDate, dueAmount, status }) => {
    const allocated = Math.min(pool, dueAmount);
    pool -= allocated;
    const pendingAmount = dueAmount - allocated;

    return {
      MemberId: member.MemberId,
      MonthNumber: month,
      InstallmentId: inst?.InstallmentId || null,
      DueDate: dueDate,
      Amount: dueAmount,
      PendingAmount: pendingAmount,
      Status: status,
      payment
    };
  });
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();
  const confirmAction = useConfirm();
  const [customer, setCustomer] = useState(null);
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [payingMonth, setPayingMonth] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [liftingMember, setLiftingMember] = useState(null);

  const loadCustomer = () => {
    apiClient.get(`/customers/${id}`).then((res) => setCustomer(res.data)).catch(() => setCustomer(null));
  };
  const loadMembers = () => {
    apiClient.get('/members').then((res) => setMembers(res.data)).catch(() => setMembers([]));
  };
  const loadGroups = () => {
    apiClient.get('/chit-groups').then((res) => setGroups(res.data)).catch(() => setGroups([]));
  };
  const loadInstallments = () => {
    apiClient
      .get('/installments', { params: { customerId: id } })
      .then((res) => setInstallments(res.data))
      .catch(() => setInstallments([]));
  };
  const loadPayments = () => {
    apiClient
      .get('/payments', { params: { customerId: id } })
      .then((res) => setPayments(res.data))
      .catch(() => setPayments([]));
  };

  useEffect(() => {
    loadCustomer();
    loadMembers();
    loadGroups();
    loadInstallments();
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const refreshHistory = () => {
    loadInstallments();
    loadPayments();
  };

  const handleCustomerSubmit = async (data) => {
    try {
      await apiClient.put(`/customers/${id}`, data);
      setEditCustomerOpen(false);
      loadCustomer();
    } catch (err) {
      showToast('Error saving customer: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  // Adding a payment for a month with no installment row yet creates the installment first.
  const handlePaySubmit = async (data) => {
    const payload = { ...data };
    if (payload.PaymentDate) payload.PaymentDate = payload.PaymentDate.replace('T', ' ') + ':00';
    try {
      let installmentId = payingMonth.InstallmentId;
      if (!installmentId) {
        const res = await apiClient.post('/installments', {
          MemberId: payingMonth.MemberId,
          MonthNumber: payingMonth.MonthNumber,
          // The installment's Amount is what's actually owed for the month (the group's
          // rate), not what's being paid right now — those can differ on a partial payment.
          Amount: payingMonth.Amount,
          DueDate: payingMonth.DueDate ? new Date(payingMonth.DueDate).toISOString().slice(0, 10) : null,
          Status: 'Pending'
        });
        installmentId = res.data.InstallmentId;
      }
      await apiClient.post('/payments', {
        MemberId: payingMonth.MemberId,
        InstallmentId: installmentId,
        ...payload
      });
      setPayingMonth(null);
      refreshHistory();
    } catch (err) {
      showToast('Error recording payment: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleEditSubmit = async (data) => {
    const payload = { ...data };
    if (payload.PaymentDate) payload.PaymentDate = payload.PaymentDate.replace('T', ' ') + ':00';
    try {
      await apiClient.put(`/payments/${editingPayment.payment.PaymentId}`, payload);
      setEditingPayment(null);
      refreshHistory();
    } catch (err) {
      showToast('Error saving payment: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleLiftSubmit = async (data) => {
    if (data.ChitLifted === 'Yes' && data.LiftedMonth) {
      const conflict = findChitLiftConflict(members, liftingMember.GroupId, data.LiftedMonth, liftingMember.MemberId);
      if (conflict) {
        showToast(
          `Month ${data.LiftedMonth} was already lifted by ${conflict.CustomerName || 'Member #' + conflict.MemberId} in this chit group. Only one member can lift the chit per month.`,
          'error'
        );
        return;
      }
    }
    try {
      await apiClient.put(`/members/${liftingMember.MemberId}`, data);
      setLiftingMember(null);
      loadMembers();
    } catch (err) {
      showToast('Error saving chit lift status: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleDelete = async (row) => {
    if (!(await confirmAction(`Delete the payment recorded for month ${row.MonthNumber}?`))) return;
    try {
      await apiClient.delete(`/payments/${row.payment.PaymentId}`);
      if (row.InstallmentId) {
        await apiClient.put(`/installments/${row.InstallmentId}`, { Status: 'Pending', PaidDate: null });
      }
      refreshHistory();
    } catch (err) {
      showToast('Error deleting payment: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  if (!customer) {
    return (
      <div>
        <button
          onClick={() => navigate('/customers')}
          className="flex items-center gap-1 text-sm text-indigo-600 hover:underline mb-4"
        >
          <ArrowLeft size={16} /> Back to Customers
        </button>
        <p className="text-gray-500">Loading customer...</p>
      </div>
    );
  }

  const customerMembers = members.filter((m) => m.CustomerId === Number(id));

  return (
    <div>
      <button
        onClick={() => navigate('/customers')}
        className="flex items-center gap-1 text-sm text-indigo-600 hover:underline mb-4"
      >
        <ArrowLeft size={16} /> Back to Customers
      </button>

      <PageHeader
        title={`Customer: ${customer.Name}`}
        actionLabel="Edit Customer"
        onAction={() => setEditCustomerOpen(true)}
      />

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
        <div><span className="text-gray-500">Mobile:</span> {customer.Mobile || '—'}</div>
        <div><span className="text-gray-500">Email:</span> {customer.Email || '—'}</div>
        <div><span className="text-gray-500">Aadhaar:</span> {customer.Aadhaar || '—'}</div>
        <div><span className="text-gray-500">PAN:</span> {customer.PAN || '—'}</div>
        <div><span className="text-gray-500">DOB:</span> {customer.DOB ? new Date(customer.DOB).toLocaleDateString() : '—'}</div>
        <div><span className="text-gray-500">KYC Status:</span> {customer.KYCStatus || '—'}</div>
        <div><span className="text-gray-500">Nominee:</span> {customer.NomineeName || '—'} ({customer.NomineeRelation || '—'})</div>
        <div><span className="text-gray-500">Bank:</span> {customer.BankName || '—'}</div>
        <div><span className="text-gray-500">Account No:</span> {customer.AccountNumber || '—'}</div>
        <div><span className="text-gray-500">IFSC:</span> {customer.IFSC || '—'}</div>
        <div className="sm:col-span-2 lg:col-span-3"><span className="text-gray-500">Address:</span> {customer.Address || '—'}</div>
      </div>

      <h3 className="text-base font-semibold text-gray-800 mb-3">Payment History</h3>

      {customerMembers.length === 0 && (
        <p className="text-sm text-gray-400 mb-6">Not enrolled in any chit group yet.</p>
      )}

      {customerMembers.map((member) => {
        const group = groups.find((g) => g.GroupId === member.GroupId);
        const rows = buildMonthRows(member, group, installments, payments);
        const doneRows = rows.filter((r) => r.Status === 'Done');
        // "Pending" here means already due (or short-paid), not months that simply haven't come up yet.
        const pendingRows = rows.filter((r) => (r.Status === 'Due' || r.Status === 'Done') && r.PendingAmount > 0);
        const totalPaid = doneRows.reduce((sum, r) => sum + (r.payment ? parseFloat(r.payment.Amount || 0) : 0), 0);
        const totalPending = pendingRows.reduce((sum, r) => sum + r.PendingAmount, 0);

        return (
          <div key={member.MemberId} className="mb-8">
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <h4 className="text-sm font-semibold text-gray-800">
                {group?.GroupName || `Group #${member.GroupId}`}
                <span className="text-gray-400 font-normal"> · Ticket #{member.TicketNumber}</span>
                {member.SharePercent != null && Number(member.SharePercent) !== 100 && (
                  <span className="text-gray-400 font-normal"> · {member.SharePercent}% share</span>
                )}
              </h4>
              <span className="text-sm text-gray-600 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1 text-green-700">
                  <IndianRupee size={14} />
                  {doneRows.length} / {rows.length} paid · ₹{totalPaid.toFixed(2)} collected
                </span>
                <span className="flex items-center gap-1 text-red-700">
                  <IndianRupee size={14} />
                  {pendingRows.length} pending · ₹{totalPending.toFixed(2)} due
                </span>
              </span>
            </div>
            <div className="mb-2 flex items-center gap-2 flex-wrap">
              {member.ChitLifted === 'Yes' ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                  Chit Lifted — Month {member.LiftedMonth ?? '—'}
                  {group?.PostLiftInstallment != null && ` (installment ₹${(Number(group.PostLiftInstallment) * (Number(member.SharePercent ?? 100) / 100)).toLocaleString('en-IN')} from month ${Number(member.LiftedMonth) + 1})`}
                  {member.SharePercent != null && Number(member.SharePercent) !== 100 && ` [${member.SharePercent}% share]`}
                  {(() => {
                    const payout = computeChitLiftPayout(Number(group?.ChitAmount), Number(member.LiftedMonth), Number(member.SharePercent ?? 100));
                    return payout != null ? ` · Net Payout ₹${payout.toLocaleString('en-IN')}` : '';
                  })()}
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                  Chit not lifted yet
                </span>
              )}
              <button
                onClick={() => setLiftingMember(member)}
                className="text-xs px-2 py-0.5 rounded-full border border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-medium"
              >
                {member.ChitLifted === 'Yes' ? 'Update Chit Lift' : 'Mark Chit Lifted'}
              </button>
            </div>

            <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Month</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Due Date</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Amount</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Paid Amount</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Pending This Month</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Paid On (Date & Time)</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Mode</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-6 text-center text-gray-400">
                        This group has no duration (Months) configured.
                      </td>
                    </tr>
                  )}
                  {rows.map((row) => (
                    <tr key={row.MonthNumber} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{row.MonthNumber}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{formatDate(row.DueDate)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[row.Status]}`}>
                          {row.Status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">₹{row.Amount}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {row.payment ? (
                          <span className="text-green-700 font-medium">₹{parseFloat(row.payment.Amount || 0).toFixed(2)}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {(row.Status === 'Due' || row.Status === 'Done') && row.PendingAmount > 0 ? (
                          <span className="text-red-600 font-medium">₹{row.PendingAmount.toFixed(2)}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{formatDateTime(row.payment?.PaymentDate)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-gray-700">{row.payment?.Mode || '—'}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex gap-2">
                          {row.Status === 'Done' ? (
                            <>
                              <button
                                onClick={() => setEditingPayment(row)}
                                className="p-1.5 rounded text-indigo-600 hover:bg-indigo-50"
                                title="Edit Payment"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(row)}
                                className="p-1.5 rounded text-red-600 hover:bg-red-50"
                                title="Delete Payment"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setPayingMonth(row)}
                              className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                            >
                              Add Payment
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <FormModal
        isOpen={editCustomerOpen}
        onClose={() => setEditCustomerOpen(false)}
        title="Edit Customer"
        fields={baseCustomerFields}
        initialData={customer}
        onSubmit={handleCustomerSubmit}
      />

      <FormModal
        isOpen={!!payingMonth}
        onClose={() => setPayingMonth(null)}
        title={payingMonth ? `Record Payment — Month ${payingMonth.MonthNumber}` : 'Record Payment'}
        fields={paymentFields}
        initialData={
          payingMonth ? { Amount: payingMonth.Amount, PaymentDate: toDateTimeLocal() } : null
        }
        onSubmit={handlePaySubmit}
      />

      <FormModal
        isOpen={!!editingPayment}
        onClose={() => setEditingPayment(null)}
        title="Edit Payment"
        fields={paymentFields}
        initialData={
          editingPayment
            ? { ...editingPayment.payment, PaymentDate: toDateTimeLocal(editingPayment.payment.PaymentDate) }
            : null
        }
        onSubmit={handleEditSubmit}
      />

      <FormModal
        isOpen={!!liftingMember}
        onClose={() => setLiftingMember(null)}
        title="Chit Lift Status"
        fields={liftFields}
        initialData={liftingMember}
        onSubmit={handleLiftSubmit}
        renderExtra={(formData) => {
          if (formData.ChitLifted !== 'Yes' || !formData.LiftedMonth) return null;
          const liftGroup = groups.find((g) => g.GroupId === liftingMember?.GroupId);
          const payout = computeChitLiftPayout(
            Number(liftGroup?.ChitAmount),
            Number(formData.LiftedMonth),
            Number(liftingMember?.SharePercent ?? 100)
          );
          if (payout == null) return null;
          return (
            <div className="text-sm bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-amber-800">
              Net Payout for Month {formData.LiftedMonth}: <span className="font-semibold">₹{payout.toLocaleString('en-IN')}</span>
            </div>
          );
        }}
      />
    </div>
  );
}
