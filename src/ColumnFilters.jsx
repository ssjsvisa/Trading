import React from 'react';

export default function ColumnFilters({ filters, setFilters, columns }) {
  // columns: [{ key: 'symbol', label: 'Symbol' }, ...]
  // filters: { symbol: '', name: '', ... }
  // setFilters: function to update filters
  return (
    <tr>
      {columns.map(col => (
        <th key={col.key}>
          <input
            type="text"
            value={filters[col.key] || ''}
            onChange={e => setFilters(f => ({ ...f, [col.key]: e.target.value }))}
            placeholder={`Filter ${col.label}`}
            style={{ width: '90%', fontSize: '12px', padding: '2px 4px', borderRadius: 4, border: '1px solid #1976d2' }}
          />
        </th>
      ))}
    </tr>
  );
}
