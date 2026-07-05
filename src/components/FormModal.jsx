import React, { useEffect, useState } from 'react';
import Modal from './Modal';

// fields: [{ name, label, type='text', options?: [{value,label}] }]
export default function FormModal({ isOpen, onClose, title, fields, initialData, onSubmit, renderExtra }) {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (isOpen) {
      const defaults = {};
      fields.forEach((f) => {
        let value = initialData?.[f.name] ?? '';
        // DATE columns come back from the API as full ISO datetime strings
        // (e.g. "2026-01-14T18:30:00.000Z"); <input type="date"> needs "YYYY-MM-DD",
        // otherwise the untouched raw value gets resubmitted and MySQL rejects it.
        if (f.type === 'date' && typeof value === 'string' && value.includes('T')) {
          value = value.slice(0, 10);
        }
        defaults[f.name] = value;
      });
      setFormData(defaults);
    }
  }, [isOpen, initialData, fields]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {field.label}
            </label>
            {field.type === 'select' ? (
              <select
                name={field.name}
                value={formData[field.name] ?? ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required={field.required}
              >
                <option value="">Select...</option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea
                name={field.name}
                value={formData[field.name] ?? ''}
                onChange={handleChange}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required={field.required}
              />
            ) : (
              <input
                type={field.type || 'text'}
                name={field.name}
                value={formData[field.name] ?? ''}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required={field.required}
              />
            )}
          </div>
        ))}
        {renderExtra?.(formData)}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
