import { useState, ReactNode } from 'react';
import { BarChart3, Table as TableIcon } from 'lucide-react';

interface ChartWithTableProps {
  title: string;
  description?: string;
  chart: ReactNode;
  tableData: Record<string, any>[];
  columns: { key: string; header: string; format?: (val: any) => string }[];
}

export function ChartWithTable({
  title,
  description,
  chart,
  tableData,
  columns,
}: ChartWithTableProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  return (
    <div className="bg-surface p-5 rounded-xl border-3 border-ink shadow-brutal flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display font-extrabold text-lg text-ink">{title}</h3>
          {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
        </div>

        {/* View Toggle */}
        <div className="inline-flex p-1 bg-surface-2 border-2 border-ink rounded-lg shadow-brutal-sm self-start sm:self-auto">
          <button
            onClick={() => setViewMode('chart')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-colors ${
              viewMode === 'chart'
                ? 'bg-cobalt text-white border-2 border-ink shadow-brutal-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Chart</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-bold transition-colors ${
              viewMode === 'table'
                ? 'bg-cobalt text-white border-2 border-ink shadow-brutal-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Table</span>
          </button>
        </div>
      </div>

      {/* Content View */}
      <div className="flex-1 min-h-[260px] flex items-center justify-center">
        {viewMode === 'chart' ? (
          <div className="w-full h-full min-h-[260px]">{chart}</div>
        ) : (
          <div className="w-full overflow-x-auto border-2 border-ink rounded-lg bg-surface">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-2 border-b-2 border-ink text-ink font-mono uppercase">
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} className="p-2.5 font-bold">
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/15 font-mono">
                {tableData.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="p-4 text-center text-muted">
                      No data available
                    </td>
                  </tr>
                ) : (
                  tableData.map((row, i) => (
                    <tr key={i} className="hover:bg-sand/30">
                      {columns.map((col) => (
                        <td key={col.key} className="p-2.5 text-ink">
                          {col.format ? col.format(row[col.key]) : String(row[col.key] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
