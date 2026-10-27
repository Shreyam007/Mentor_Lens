import { useState, useMemo, ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T | ((row: T) => string | number);
  pageSize?: number;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  pageSize = 10,
  emptyMessage = 'No items found',
  onRowClick,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const handleSort = (key: string) => {
    if (sortField === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(key);
      setSortAsc(true);
    }
  };

  const sortedData = useMemo(() => {
    if (!sortField) return data;
    return [...data].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA === valB) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      const comp = valA > valB ? 1 : -1;
      return sortAsc ? comp : -comp;
    });
  }, [data, sortField, sortAsc]);

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getKey = (row: T, idx: number): string | number => {
    if (typeof keyField === 'function') return keyField(row);
    return row[keyField] ?? idx;
  };

  return (
    <div className="bg-surface border-3 border-ink rounded-xl shadow-brutal overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="bg-surface-2 border-b-2 border-ink text-ink font-mono text-xs uppercase tracking-wider sticky top-0 z-10">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`p-3 font-bold select-none ${col.sortable ? 'cursor-pointer hover:bg-surface' : ''} ${col.className || ''}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.header}</span>
                    {col.sortable && <ChevronsUpDown className="w-3.5 h-3.5 text-muted" />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-ink/15">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-muted font-medium">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => (
                <tr
                  key={getKey(row, idx)}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`hover:bg-sand/30 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`p-3 align-middle text-ink ${col.className || ''}`}>
                      {col.render ? col.render(row) : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="p-3 bg-surface-2 border-t-2 border-ink flex items-center justify-between text-xs font-mono">
          <span className="text-muted">
            Page {currentPage} of {totalPages} ({sortedData.length} total)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn-brutal px-2.5 py-1 bg-surface border-2 border-ink rounded disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn-brutal px-2.5 py-1 bg-surface border-2 border-ink rounded disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
