import React from 'react';

export default function PageHeader({ title, actionLabel, onAction }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-xl font-bold text-gray-800">{title}</h2>
      {actionLabel && (
        <button
          onClick={onAction}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
