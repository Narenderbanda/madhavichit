import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const ConfirmContext = createContext(null);

// Replaces the browser's native confirm() — same "localhost says" ugliness as alert(),
// plus it blocks the whole page. confirmAction(message) returns a Promise<boolean> so
// call sites just `if (!(await confirmAction('...'))) return;` exactly like confirm().
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);

  const confirmAction = useCallback((message) => {
    return new Promise((resolve) => {
      setRequest({ message, resolve });
    });
  }, []);

  const handle = (result) => {
    request?.resolve(result);
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={confirmAction}>
      {children}
      {request && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5">
            <div className="flex items-start gap-3 mb-5">
              <div className="shrink-0 p-2 rounded-full bg-red-50 text-red-600">
                <AlertTriangle size={20} />
              </div>
              <p className="text-sm text-gray-700 pt-1.5 whitespace-pre-line">{request.message}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => handle(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handle(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}
