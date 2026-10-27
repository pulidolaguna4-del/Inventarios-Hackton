import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Inbox, Filter } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  searchPlaceholder?: string;
  onSearchChange?: (term: string) => void;
  categories?: string[];
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
  statuses?: { value: string; label: string }[];
  selectedStatus?: string;
  onStatusChange?: (status: string) => void;
  pageSize?: number;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  searchPlaceholder = 'Buscar...',
  onSearchChange,
  categories,
  selectedCategory,
  onCategoryChange,
  statuses,
  selectedStatus,
  onStatusChange,
  pageSize = 10,
  isLoading = false,
  emptyMessage = 'No se encontraron registros.',
}: DataTableProps<T>) {
  const [paginaElegida, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    if (onSearchChange) onSearchChange(term);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(data.length / pageSize) || 1;
  // Si un filtro externo reduce los datos, no quedarse en una página que ya no existe.
  const currentPage = Math.min(paginaElegida, totalPages);
  const paginatedData = data.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Control Filters Bar */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
        {/* Search Bar (solo si la página maneja la búsqueda) */}
        {onSearchChange ? (
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearch}
              placeholder={searchPlaceholder}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-400"
            />
          </div>
        ) : (
          <div className="flex-1 text-xs font-medium text-slate-500">{data.length} registros</div>
        )}

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {categories && onCategoryChange && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedCategory || 'ALL'}
                onChange={(e) => {
                  onCategoryChange(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent font-medium focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">Todas las Categorías</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}

          {statuses && onStatusChange && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600">
              <select
                value={selectedStatus || 'ALL'}
                onChange={(e) => {
                  onStatusChange(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-transparent font-medium focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">Todos los Estados</option>
                {statuses.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/60 text-slate-600 text-xs font-bold uppercase tracking-wider">
              {columns.map((col) => (
                <th key={col.key} className={`py-3.5 px-4 ${col.className || ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-slate-400">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-2"></div>
                  <p className="text-xs font-medium">Cargando datos...</p>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-slate-400">
                  <Inbox className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              paginatedData.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  className="hover:bg-indigo-50/30 transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`py-3.5 px-4 ${col.className || ''}`}>
                      {col.render
                        ? col.render(item)
                        : (item as Record<string, unknown>)[col.key] as React.ReactNode}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!isLoading && data.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Mostrando <span className="font-semibold text-slate-700">{(currentPage - 1) * pageSize + 1}</span> a{' '}
            <span className="font-semibold text-slate-700">
              {Math.min(currentPage * pageSize, data.length)}
            </span>{' '}
            de <span className="font-semibold text-slate-700">{data.length}</span> registros
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 font-semibold text-slate-700">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
