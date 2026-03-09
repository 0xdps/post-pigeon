import { useState } from 'react';

export function DateTimePicker({ onSelect, onClose }) {
  const [dateTime, setDateTime] = useState('');
  const [error, setError] = useState('');

  function handleSelect() {
    if (!dateTime) {
      setError('Please select a date and time');
      return;
    }

    const selectedTime = new Date(dateTime).getTime();
    const now = Date.now();

    if (selectedTime <= now) {
      setError('Please select a future time');
      return;
    }

    onSelect(selectedTime);
  }

  // Get min datetime (now + 1 minute)
  const now = new Date();
  now.setMinutes(now.getMinutes() + 1);
  const minDateTime = now.toISOString().slice(0, 16);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-lg p-6 max-w-sm w-full mx-4 border border-zinc-800">
        <h2 className="text-xl font-bold mb-4 text-zinc-100">Schedule Post</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            When should this post be published?
          </label>
          <input
            type="datetime-local"
            value={dateTime}
            onChange={(e) => {
              setDateTime(e.target.value);
              setError('');
            }}
            min={minDateTime}
            className="w-full px-3 py-2 border border-zinc-700 bg-zinc-800 text-zinc-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 text-red-400 rounded text-sm border border-red-500/20">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-300 bg-zinc-800 rounded hover:bg-zinc-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
