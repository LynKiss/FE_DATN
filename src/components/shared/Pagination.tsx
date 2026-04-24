type PaginationProps = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  isVietnamese: boolean;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  pageSizeOptions?: number[];
};

function buildPageItems(page: number, totalPages: number) {
  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);

  for (let current = page - 1; current <= page + 1; current += 1) {
    if (current > 1 && current < totalPages) {
      pages.add(current);
    }
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const items: Array<number | 'ellipsis'> = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    const previous = sorted[index - 1];

    if (previous && current - previous > 1) {
      items.push('ellipsis');
    }

    items.push(current);
  }

  return items;
}

export default function Pagination({
  page,
  limit,
  total,
  totalPages,
  isVietnamese,
  onPageChange,
  onLimitChange,
  pageSizeOptions = [10, 12, 24, 48],
}: PaginationProps) {
  if (total === 0) {
    return null;
  }

  const safeTotalPages = Math.max(totalPages, 1);
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const pageItems = buildPageItems(page, safeTotalPages);

  return (
    <div className="mt-6 flex flex-col gap-4 rounded-[1.5rem] border border-on-surface-variant/8 bg-surface px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm font-medium text-on-surface-variant">
        {isVietnamese
          ? `Hiển thị ${from}-${to} trên ${total} bản ghi`
          : `Showing ${from}-${to} of ${total} records`}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-sm font-medium text-on-surface-variant">
          <span>{isVietnamese ? 'Mỗi trang' : 'Per page'}</span>
          <select
            value={limit}
            onChange={(event) => onLimitChange(Number(event.target.value))}
            className="rounded-xl border border-on-surface/10 bg-white px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary/30"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded-xl border border-on-surface/10 bg-white px-4 py-2 text-sm font-bold text-on-surface transition hover:border-primary/20 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isVietnamese ? 'Trước' : 'Prev'}
          </button>

          <div className="flex items-center gap-1">
            {pageItems.map((item, index) =>
              item === 'ellipsis' ? (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-sm font-bold text-on-surface-variant/50"
                >
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPageChange(item)}
                  className={`min-w-10 rounded-xl px-3 py-2 text-sm font-bold transition ${item === page
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'border border-on-surface/10 bg-white text-on-surface hover:border-primary/20 hover:text-primary'
                    }`}
                >
                  {item}
                </button>
              ),
            )}
          </div>

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= safeTotalPages}
            className="rounded-xl border border-on-surface/10 bg-white px-4 py-2 text-sm font-bold text-on-surface transition hover:border-primary/20 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isVietnamese ? 'Sau' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
