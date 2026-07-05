import React from 'react';
import { Pencil, Trash2, Eye } from 'lucide-react';

// columns: [{ key, label, render? }]
// rows: array of objects
export default function DataTable({ columns, rows, onView, onEdit, onDelete, keyField = 'id' }) {
  return (
    <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
      <table className="min-w-full text-sm text-left">
        <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 font-semibold whitespace-nowrap">
                {col.label}
              </th>
            ))}
            {(onView || onEdit || onDelete) && (
              <th className="px-4 py-3 font-semibold whitespace-nowrap">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + 1}
                className="px-4 py-6 text-center text-gray-400"
              >
                No records found
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row[keyField]} className="hover:bg-gray-50">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-2.5 whitespace-nowrap text-gray-700">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
              {(onView || onEdit || onDelete) && (
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <div className="flex gap-2">
                    {onView && (
                      <button
                        onClick={() => onView(row)}
                        className="p-1.5 rounded text-gray-600 hover:bg-gray-100"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                    )}
                    {onEdit && (
                      <button
                        onClick={() => onEdit(row)}
                        className="p-1.5 rounded text-indigo-600 hover:bg-indigo-50"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(row)}
                        className="p-1.5 rounded text-red-600 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
