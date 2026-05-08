import { useEffect, useState, useCallback } from 'react';
import { ClipboardCheck, ChevronLeft, ChevronRight, RefreshCw, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { apiClient } from '../../../lib/api';

interface AuditLogItem {
  logId: string;
  changedBy: string | null;
  entityType: string;
  entityId: string;
  action: string;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  ipAddress: string | null;
  notes: string | null;
  changedAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE:      'bg-blue-100 text-blue-700',
  UPDATE:      'bg-yellow-100 text-yellow-700',
  CONFIRM:     'bg-green-100 text-green-700',
  APPROVE:     'bg-green-100 text-green-700',
  CANCEL:      'bg-red-100 text-red-700',
  APPLY_PRICE: 'bg-purple-100 text-purple-700',
  DELETE:      'bg-red-100 text-red-700',
};

const ENTITY_TYPES = ['PO', 'GR', 'SR', 'ADJ', 'TR', 'PRICE', 'ORDER', 'USER'];
const ACTIONS = ['CREATE', 'UPDATE', 'CONFIRM', 'APPROVE', 'CANCEL', 'APPLY_PRICE', 'DELETE'];

export default function AuditLogsPage() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [filterEntityType, setFilterEntityType] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const limit = 30;
  const totalPages = Math.ceil(total / limit);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) });
      if (filterEntityType) params.set('entityType', filterEntityType);
      if (filterAction) params.set('action', filterAction);
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo + 'T23:59:59');
      const data = await apiClient.get<{ items: AuditLogItem[]; meta: { total: number } }>(
        `/audit-logs?${params.toString()}`,
      );
      setItems(data.items ?? []);
      setTotal(data.meta?.total ?? 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filterEntityType, filterAction, filterFrom, filterTo]);

  useEffect(() => {
    setPage(1);
    void load(1);
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold text-on-surface">Nhật Ký Thao Tác (Audit Log)</h1>
        <span className="ml-auto text-sm text-on-surface-variant">{total} bản ghi</span>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-outline-variant bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-on-surface-variant">Loại đối tượng</label>
            <select className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary" value={filterEntityType} onChange={(e) => setFilterEntityType(e.target.value)}>
              <option value="">Tất cả</option>
              {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-on-surface-variant">Hành động</label>
            <select className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary" value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
              <option value="">Tất cả</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-on-surface-variant">Từ ngày</label>
            <input type="date" className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-on-surface-variant">Đến ngày</label>
            <input type="date" className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
          </div>
          <button onClick={() => { setFilterEntityType(''); setFilterAction(''); setFilterFrom(''); setFilterTo(''); }} className="rounded-lg border border-outline-variant px-3 py-1.5 text-sm hover:bg-surface-variant">Xóa lọc</button>
          <button onClick={() => void load(page)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary/90">
            <RefreshCw className="h-3.5 w-3.5" /> Làm mới
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-outline-variant bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-variant text-on-surface-variant">
              <tr>
                <th className="px-4 py-3 text-left font-medium w-8"></th>
                <th className="px-4 py-3 text-left font-medium">Thời gian</th>
                <th className="px-4 py-3 text-left font-medium">Người dùng</th>
                <th className="px-4 py-3 text-left font-medium">Loại</th>
                <th className="px-4 py-3 text-left font-medium">Mã chứng từ</th>
                <th className="px-4 py-3 text-left font-medium">Hành động</th>
                <th className="px-4 py-3 text-left font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr><td colSpan={7} className="py-10 text-center text-on-surface-variant">Đang tải...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-on-surface-variant">Không có nhật ký</td></tr>
              ) : items.map((item) => {
                const actionColor = ACTION_COLORS[item.action] ?? 'bg-gray-100 text-gray-600';
                const hasDetails = item.beforeData || item.afterData;
                const expanded = expandedId === item.logId;
                return [
                  <tr key={item.logId} className="hover:bg-surface-variant/40">
                    <td className="px-4 py-2.5 text-center">
                      {hasDetails && (
                        <button onClick={() => setExpandedId(expanded ? null : item.logId)} className="text-on-surface-variant">
                          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-on-surface-variant whitespace-nowrap">
                      {new Date(item.changedAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-2.5 text-on-surface">
                      {item.changedBy ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded bg-surface-variant px-1.5 py-0.5 text-xs font-mono text-on-surface-variant">
                        {item.entityType}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-primary">
                      {item.entityId}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${actionColor}`}>
                        {item.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-on-surface-variant">{item.ipAddress ?? '—'}</td>
                  </tr>,
                  expanded && hasDetails && (
                    <tr key={`${item.logId}-detail`} className="bg-surface-variant/30">
                      <td colSpan={7} className="px-8 py-3">
                        <div className="grid grid-cols-2 gap-4">
                          {item.beforeData && (
                            <div>
                              <p className="text-xs font-medium text-on-surface-variant mb-1">Trước:</p>
                              <pre className="text-xs bg-surface rounded-lg p-2 overflow-auto max-h-40 text-on-surface-variant">
                                {JSON.stringify(item.beforeData, null, 2)}
                              </pre>
                            </div>
                          )}
                          {item.afterData && (
                            <div>
                              <p className="text-xs font-medium text-on-surface-variant mb-1">Sau:</p>
                              <pre className="text-xs bg-surface rounded-lg p-2 overflow-auto max-h-40 text-on-surface-variant">
                                {JSON.stringify(item.afterData, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-outline-variant px-4 py-3">
            <span className="text-sm text-on-surface-variant">Trang {page}/{totalPages} — {total} bản ghi</span>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); void load(p); }} className="rounded p-1.5 hover:bg-surface-variant disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
              <button disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); void load(p); }} className="rounded p-1.5 hover:bg-surface-variant disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
