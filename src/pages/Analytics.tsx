import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  LoaderCircle,
  PackageCheck,
  PackageSearch,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';
import { useToast } from '../hooks/useToast';

type AnalysisMode = 'demand' | 'reorder';

type NumericValue = string | number | null | undefined;

type ProductOption = {
  productId: string;
  productName: string;
  quantityAvailable: number;
  quantityReserved?: number;
  productPrice?: string;
  productPriceSale?: string | null;
  unit: string | null;
};

type ProductsResponse = {
  items: ProductOption[];
};

type ProductSummary = {
  productId: string;
  productName: string;
  effectivePrice: string;
  basePrice: string;
  unit: string | null;
  quantityAvailable: number;
  quantityReserved: number;
  avgCost: string;
};

type DemandForecastResponse = {
  product: ProductSummary;
  model: {
    modelType: string;
    status?: string;
    reason?: string;
    evaluation?: {
      mae?: number;
      rmse?: number;
      mape?: number | null;
    };
  };
  historyDays: number;
  horizonDays: number;
  observedDemand: Array<{
    date: string;
    quantity: number;
  }>;
  stats: {
    avg7: number;
    avg30: number;
    avgAll: number;
    weightedAverageDailyDemand: number;
    stdDev30: number;
    totalDemand: number;
    activeSalesDays: number;
  };
  forecast: Array<{
    date: string;
    forecastQuantity: number;
    model?: string;
    weekdayFactor?: number;
  }>;
  summary: {
    currentStock: number;
    reservedStock: number;
    totalForecastDemand: number;
    projectedStockAfterHorizon: number;
    confidence: 'high' | 'medium' | 'low';
  };
};

type ReorderSuggestion = {
  product: ProductSummary;
  avgDailyDemand: number;
  demandStdDev30: number;
  safetyStock: number;
  reorderPoint: number;
  targetStock: number;
  suggestedOrderQty: number;
  daysUntilStockout: number | null;
  daysUntilStockoutValue: number;
  shouldReorder: boolean;
  urgency: 'high' | 'medium' | 'low' | 'none';
  model: {
    modelType: string;
    mae?: number;
    rmse?: number;
    reason?: string;
  };
  reason: string;
};

type ReorderSuggestionsResponse = {
  historyDays: number;
  leadTimeDays: number;
  coverageDays: number;
  items: ReorderSuggestion[];
  summary: {
    totalProductsAnalyzed: number;
    totalSuggestions: number;
    highUrgency: number;
    mediumUrgency: number;
  };
};

const tooltipStyle = {
  border: '1px solid rgba(22, 49, 31, 0.08)',
  borderRadius: '16px',
  boxShadow: '0 18px 45px -24px rgba(12, 34, 25, 0.45)',
  background: 'var(--theme-surface-container)',
  color: 'var(--theme-on-surface)',
};

export default function Analytics() {
  const { language } = useLanguage();
  const isVietnamese = language === 'vi';
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialMode = resolveMode(searchParams.get('module'));
  const [mode, setMode] = useState<AnalysisMode | null>(initialMode);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(
    searchParams.get('productId') ?? '',
  );
  const [historyDays, setHistoryDays] = useState(
    Number(searchParams.get('historyDays') ?? '90'),
  );
  const [horizonDays, setHorizonDays] = useState(30);
  const [leadTimeDays, setLeadTimeDays] = useState(7);
  const [coverageDays, setCoverageDays] = useState(30);
  const [includeAll, setIncludeAll] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const [demandResult, setDemandResult] =
    useState<DemandForecastResponse | null>(null);
  const [demandBatchResults, setDemandBatchResults] = useState<
    DemandForecastResponse[]
  >([]);
  const [reorderResult, setReorderResult] =
    useState<ReorderSuggestionsResponse | null>(null);

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat(isVietnamese ? 'vi-VN' : 'en-US', {
        maximumFractionDigits: 2,
      }),
    [isVietnamese],
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingProducts(true);

    apiClient
      .get<ProductsResponse>('/products?limit=200&includeHidden=false')
      .then((data) => {
        if (cancelled) return;
        setProducts(data.items ?? []);
        if (!selectedProductId && data.items?.[0]) {
          setSelectedProductId(data.items[0].productId);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        showToast({
          tone: 'error',
          title: isVietnamese
            ? 'Không tải được danh sách sản phẩm'
            : 'Unable to load products',
          description: error instanceof Error ? error.message : '',
        });
      })
      .finally(() => {
        if (!cancelled) setLoadingProducts(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isVietnamese, selectedProductId, showToast]);

  function chooseMode(nextMode: AnalysisMode) {
    setMode(nextMode);
    setSearchParams({ module: nextMode });
  }

  function resetMode() {
    setMode(null);
    setSearchParams({});
  }

  async function fetchDemandForecast(productId: string) {
    const query = new URLSearchParams({
      productId,
      historyDays: String(clamp(historyDays, 14, 365)),
      horizonDays: String(clamp(horizonDays, 1, 90)),
    });

    return apiClient.get<DemandForecastResponse>(
      `/intelligence/demand-forecast?${query.toString()}`,
    );
  }

  async function analyzeDemand(productId = selectedProductId) {
    if (!productId) {
      showToast({
        tone: 'info',
        title: isVietnamese ? 'Chọn sản phẩm trước' : 'Select a product first',
      });
      return;
    }

    setAnalyzing(true);
    try {
      const data = await fetchDemandForecast(productId);
      setSelectedProductId(productId);
      setDemandResult(data);
      setSearchParams({
        module: 'demand',
        productId,
        historyDays: String(historyDays),
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: isVietnamese
          ? 'Không phân tích được dự báo nhu cầu'
          : 'Demand forecast failed',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setAnalyzing(false);
    }
  }

  async function analyzeReorder() {
    setAnalyzing(true);
    try {
      const query = new URLSearchParams({
        historyDays: String(clamp(historyDays, 14, 365)),
        leadTimeDays: String(clamp(leadTimeDays, 1, 90)),
        coverageDays: String(clamp(coverageDays, 1, 180)),
        limit: '100',
        includeAll: includeAll ? 'true' : 'false',
      });
      const data = await apiClient.get<ReorderSuggestionsResponse>(
        `/intelligence/reorder-suggestions?${query.toString()}`,
      );
      setReorderResult(data);
      setSearchParams({ module: 'reorder' });
    } catch (error) {
      showToast({
        tone: 'error',
        title: isVietnamese
          ? 'Không phân tích được đề xuất nhập hàng'
          : 'Reorder analysis failed',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setAnalyzing(false);
    }
  }

  const filteredProducts = useMemo(() => {
    const keyword = productSearch.trim().toLowerCase();
    if (!keyword) return products;
    return products.filter((product) => {
      return (
        product.productName.toLowerCase().includes(keyword) ||
        product.productId.toLowerCase().includes(keyword)
      );
    });
  }, [productSearch, products]);

  const demandBatchCandidates = useMemo(
    () =>
      [...filteredProducts]
        .sort(
          (left, right) =>
            toNumber(left.quantityAvailable) - toNumber(right.quantityAvailable),
        )
        .slice(0, 8),
    [filteredProducts],
  );

  async function analyzeDemandBatch() {
    if (!demandBatchCandidates.length) {
      showToast({
        tone: 'info',
        title: isVietnamese ? 'Chưa có sản phẩm để dự báo' : 'No products to forecast',
      });
      return;
    }

    setBatchAnalyzing(true);
    try {
      const settledResults = await Promise.allSettled(
        demandBatchCandidates.map((product) =>
          fetchDemandForecast(product.productId),
        ),
      );
      const successfulResults = settledResults.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : [],
      );
      const failedCount = settledResults.length - successfulResults.length;

      setDemandBatchResults(successfulResults);
      if (successfulResults[0]) {
        setSelectedProductId(successfulResults[0].product.productId);
        setDemandResult(successfulResults[0]);
        setSearchParams({
          module: 'demand',
          productId: successfulResults[0].product.productId,
          historyDays: String(historyDays),
        });
      }

      if (failedCount > 0) {
        showToast({
          tone: 'info',
          title: isVietnamese
            ? `Có ${failedCount} sản phẩm không đủ dữ liệu dự báo`
            : `${failedCount} products could not be forecast`,
        });
      }
    } catch (error) {
      showToast({
        tone: 'error',
        title: isVietnamese
          ? 'Không chạy được dự báo nhanh'
          : 'Quick forecast failed',
        description: error instanceof Error ? error.message : '',
      });
    } finally {
      setBatchAnalyzing(false);
    }
  }

  const selectedProduct = products.find(
    (product) => product.productId === selectedProductId,
  );

  const demandChartData = useMemo(() => {
    const observed = demandResult?.observedDemand.slice(-30).map((point) => ({
      date: formatDate(point.date, language),
      observed: point.quantity,
      forecast: null as number | null,
    })) ?? [];
    const forecast =
      demandResult?.forecast.map((point) => ({
        date: formatDate(point.date, language),
        observed: null as number | null,
        forecast: point.forecastQuantity,
      })) ?? [];
    return [...observed, ...forecast];
  }, [demandResult, language]);

  const reorderChartData = useMemo(
    () =>
      reorderResult?.items.slice(0, 12).map((item) => ({
        name: shortLabel(item.product.productName, 18),
        stock: item.product.quantityAvailable,
        reorderPoint: item.reorderPoint,
        suggested: item.suggestedOrderQty,
      })) ?? [],
    [reorderResult],
  );

  const atRiskItems = reorderResult?.items.filter(
    (item) => item.urgency === 'high' || item.urgency === 'medium',
  );

  return (
    <div className="space-y-8 pb-12">
      <section className="overflow-hidden rounded-[2.25rem] border border-white/70 bg-[linear-gradient(135deg,rgba(27,94,32,0.96),rgba(44,121,80,0.88),rgba(214,165,29,0.76))] p-7 text-white shadow-[0_30px_80px_-42px_rgba(21,66,18,0.72)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-[0.22em]">
              <Sparkles size={14} />
              {isVietnamese ? 'Trung tâm phân tích AI' : 'AI analysis center'}
            </div>
            <h1 className="max-w-4xl text-4xl font-black tracking-tight md:text-5xl">
              {isVietnamese
                ? 'Chọn bài toán phân tích tồn kho'
                : 'Choose an inventory intelligence workflow'}
            </h1>
            <p className="mt-3 max-w-3xl text-sm font-medium text-white/78">
              {isVietnamese
                ? 'Hai module này dùng dữ liệu đơn hàng và tồn kho hiện tại để dự báo nhu cầu hoặc đề xuất nhập hàng. Bấm một lựa chọn, nhập tham số, rồi chạy phân tích.'
                : 'These modules use current order and inventory data to forecast demand or generate reorder suggestions. Choose a workflow, set parameters, then run analysis.'}
            </p>
          </div>

          {mode ? (
            <button
              type="button"
              onClick={resetMode}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-primary shadow-lg"
            >
              <ArrowLeft size={16} />
              {isVietnamese ? 'Chọn phân tích khác' : 'Choose another'}
            </button>
          ) : null}
        </div>
      </section>

      {!mode ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <AnalysisChoiceCard
            title={isVietnamese ? 'Dự báo nhu cầu' : 'Demand forecasting'}
            badge="1.2"
            description={
              isVietnamese
                ? 'Chạy nhanh nhóm sản phẩm ưu tiên hoặc chọn một sản phẩm để xem biểu đồ dự báo chi tiết.'
                : 'Run a quick batch for priority products or select one product for a detailed forecast chart.'
            }
            icon={TrendingUp}
            bullets={
              isVietnamese
                ? ['Dùng lịch sử bán hàng', 'Biểu đồ thực tế và dự báo', 'Cảnh báo tồn kho âm sau horizon']
                : ['Uses sales history', 'Observed vs forecast chart', 'Projected stock warning']
            }
            onClick={() => chooseMode('demand')}
          />
          <AnalysisChoiceCard
            title={isVietnamese ? 'Đề xuất nhập hàng' : 'Reorder suggestion'}
            badge="1.3"
            description={
              isVietnamese
                ? 'Quét toàn bộ kho để tìm sản phẩm có nguy cơ hết hàng, tính điểm đặt hàng lại, tồn an toàn và số lượng nên nhập.'
                : 'Scan inventory for stockout risks, reorder points, safety stock and suggested order quantities.'
            }
            icon={PackageCheck}
            bullets={
              isVietnamese
                ? ['Tính lead time và coverage', 'Ưu tiên high / medium / low', 'Dùng cho quản lý tồn kho và báo cáo kinh doanh']
                : ['Lead time and coverage aware', 'High / medium / low priority', 'Works for inventory and business reporting']
            }
            onClick={() => chooseMode('reorder')}
          />
        </div>
      ) : null}

      {mode === 'demand' ? (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[24rem_1fr]">
          <div className="space-y-5 rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-sm">
            <PanelHeader
              icon={TrendingUp}
              title={isVietnamese ? 'Dự báo nhu cầu' : 'Demand forecasting'}
              subtitle={
                isVietnamese
                  ? 'Chạy nhanh hoặc chọn sản phẩm chi tiết'
                  : 'Run quick batch or choose one product'
              }
            />

            <div className="space-y-4">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-on-surface-variant/70">
                  {isVietnamese ? 'Tìm sản phẩm' : 'Search product'}
                </span>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50"
                  />
                  <input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    className="w-full rounded-2xl border border-on-surface/10 bg-surface py-3 pl-10 pr-4 text-sm outline-none focus:border-primary/30"
                    placeholder={
                      isVietnamese ? 'Nhập tên hoặc mã sản phẩm...' : 'Name or product ID...'
                    }
                  />
                </div>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-on-surface-variant/70">
                  {isVietnamese ? 'Sản phẩm phân tích' : 'Product'}
                </span>
                <select
                  value={selectedProductId}
                  onChange={(event) => setSelectedProductId(event.target.value)}
                  className="w-full rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm font-bold outline-none focus:border-primary/30"
                  disabled={loadingProducts}
                >
                  {filteredProducts.map((product) => (
                    <option key={product.productId} value={product.productId}>
                      {product.productName}
                    </option>
                  ))}
                </select>
              </label>

              {selectedProduct ? (
                <div className="rounded-2xl bg-primary/5 p-4 text-sm">
                  <p className="font-black text-on-surface">
                    {selectedProduct.productName}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-on-surface-variant">
                    {isVietnamese ? 'Tồn khả dụng' : 'Available stock'}:{' '}
                    <strong>{selectedProduct.quantityAvailable}</strong>
                    {selectedProduct.unit ? ` ${selectedProduct.unit}` : ''}
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <NumberInput
                  label={isVietnamese ? 'Lịch sử' : 'History'}
                  suffix={isVietnamese ? 'ngày' : 'days'}
                  value={historyDays}
                  min={14}
                  max={365}
                  onChange={setHistoryDays}
                />
                <NumberInput
                  label={isVietnamese ? 'Dự báo' : 'Horizon'}
                  suffix={isVietnamese ? 'ngày' : 'days'}
                  value={horizonDays}
                  min={1}
                  max={90}
                  onChange={setHorizonDays}
                />
              </div>

              <button
                type="button"
                onClick={() => void analyzeDemand()}
                disabled={analyzing || batchAnalyzing || loadingProducts}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white transition hover:bg-primary-container disabled:opacity-60"
              >
                {analyzing ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <BrainCircuit size={16} />
                )}
                {isVietnamese ? 'Phân tích dự báo' : 'Run forecast'}
              </button>

              <button
                type="button"
                onClick={() => void analyzeDemandBatch()}
                disabled={
                  analyzing ||
                  batchAnalyzing ||
                  loadingProducts ||
                  !demandBatchCandidates.length
                }
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-5 py-3 text-sm font-black text-primary transition hover:bg-primary/15 disabled:opacity-60"
              >
                {batchAnalyzing ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                {isVietnamese
                  ? `Dự báo nhanh ${demandBatchCandidates.length} sản phẩm ưu tiên`
                  : `Quick forecast ${demandBatchCandidates.length} priority products`}
              </button>

              <div className="rounded-2xl bg-primary/5 p-4 text-xs font-semibold leading-relaxed text-on-surface-variant">
                {isVietnamese
                  ? 'Không cần chọn từng sản phẩm nếu chỉ cần danh sách ưu tiên. Nút dự báo nhanh sẽ chạy theo lô cho các sản phẩm tồn thấp nhất trong danh sách đang lọc.'
                  : 'You do not need to select products one by one for a priority scan. Quick forecast runs a batch over the lowest-stock products in the current filtered list.'}
              </div>

              {demandBatchResults.length ? (
                <div className="space-y-2 rounded-2xl border border-on-surface/10 bg-surface p-3">
                  <p className="px-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">
                    {isVietnamese ? 'Kết quả dự báo nhanh' : 'Quick forecast results'}
                  </p>
                  {demandBatchResults.slice(0, 6).map((result) => {
                    const isRisky =
                      result.summary.projectedStockAfterHorizon < 0;

                    return (
                      <button
                        key={result.product.productId}
                        type="button"
                        onClick={() => {
                          setSelectedProductId(result.product.productId);
                          setDemandResult(result);
                          setSearchParams({
                            module: 'demand',
                            productId: result.product.productId,
                            historyDays: String(historyDays),
                          });
                        }}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition hover:-translate-y-0.5 ${
                          isRisky
                            ? 'border-red-100 bg-red-50 text-red-800'
                            : 'border-white/70 bg-white text-on-surface'
                        }`}
                      >
                        <p className="truncate text-sm font-black">
                          {result.product.productName}
                        </p>
                        <p className="mt-1 text-xs font-semibold opacity-75">
                          {isVietnamese ? 'Tồn sau kỳ' : 'Projected stock'}:{' '}
                          {numberFormatter.format(
                            result.summary.projectedStockAfterHorizon,
                          )}{' '}
                          | {isVietnamese ? 'Nhu cầu' : 'Demand'}:{' '}
                          {numberFormatter.format(
                            result.summary.totalForecastDemand,
                          )}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

          <DemandResult
            result={demandResult}
            chartData={demandChartData}
            formatNumber={(value) => numberFormatter.format(toNumber(value))}
            isVietnamese={isVietnamese}
          />
        </section>
      ) : null}

      {mode === 'reorder' ? (
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[24rem_1fr]">
          <div className="space-y-5 rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-sm">
            <PanelHeader
              icon={PackageCheck}
              title={isVietnamese ? 'Đề xuất nhập hàng' : 'Reorder suggestion'}
              subtitle={
                isVietnamese
                  ? 'Tìm sản phẩm có nguy cơ hết hàng'
                  : 'Find products at risk of stockout'
              }
            />

            <div className="rounded-2xl bg-primary/5 p-4 text-xs font-semibold leading-relaxed text-on-surface-variant">
              {isVietnamese
                ? 'Không cần chọn sản phẩm. Phần này quét toàn bộ kho, xếp mức ưu tiên và trả về danh sách sản phẩm nên nhập.'
                : 'No product selection is needed. This workflow scans the whole inventory, ranks urgency and returns products to reorder.'}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                label={isVietnamese ? 'Lịch sử' : 'History'}
                suffix={isVietnamese ? 'ngày' : 'days'}
                value={historyDays}
                min={14}
                max={365}
                onChange={setHistoryDays}
              />
              <NumberInput
                label="Lead time"
                suffix={isVietnamese ? 'ngày' : 'days'}
                value={leadTimeDays}
                min={1}
                max={90}
                onChange={setLeadTimeDays}
              />
              <NumberInput
                label={isVietnamese ? 'Phủ hàng' : 'Coverage'}
                suffix={isVietnamese ? 'ngày' : 'days'}
                value={coverageDays}
                min={1}
                max={180}
                onChange={setCoverageDays}
              />
              <label className="flex items-center gap-2 rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={includeAll}
                  onChange={(event) => setIncludeAll(event.target.checked)}
                  className="h-4 w-4 rounded border-on-surface/20"
                />
                {isVietnamese ? 'Hiện tất cả' : 'All products'}
              </label>
            </div>

            <button
              type="button"
              onClick={() => void analyzeReorder()}
              disabled={analyzing}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white transition hover:bg-primary-container disabled:opacity-60"
            >
              {analyzing ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              {isVietnamese ? 'Phân tích đề xuất nhập' : 'Run reorder analysis'}
            </button>

            <div className="rounded-2xl bg-amber-50 p-4 text-xs font-semibold leading-relaxed text-amber-800">
              {isVietnamese
                ? 'Logic: nhu cầu lead time + tồn an toàn = điểm đặt hàng lại. Nếu tồn hiện tại thấp hơn điểm này, hệ thống đề xuất nhập.'
                : 'Logic: lead-time demand + safety stock = reorder point. If current stock is below this point, the system suggests a reorder.'}
            </div>
          </div>

          <ReorderResult
            result={reorderResult}
            chartData={reorderChartData}
            atRiskItems={atRiskItems ?? []}
            formatNumber={(value) => numberFormatter.format(toNumber(value))}
            isVietnamese={isVietnamese}
          />
        </section>
      ) : null}
    </div>
  );
}

function AnalysisChoiceCard({
  title,
  badge,
  description,
  icon: Icon,
  bullets,
  onClick,
}: {
  title: string;
  badge: string;
  description: string;
  icon: typeof TrendingUp;
  bullets: string[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:scale-110">
          <Icon size={26} />
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
          {badge}
        </span>
      </div>
      <h2 className="mt-6 text-2xl font-black text-on-surface">{title}</h2>
      <p className="mt-3 text-sm font-medium leading-relaxed text-on-surface-variant">
        {description}
      </p>
      <div className="mt-5 space-y-2">
        {bullets.map((bullet) => (
          <div key={bullet} className="flex items-center gap-2 text-sm font-bold text-on-surface">
            <CheckCircle2 size={15} className="text-primary" />
            {bullet}
          </div>
        ))}
      </div>
    </button>
  );
}

function DemandResult({
  result,
  chartData,
  formatNumber,
  isVietnamese,
}: {
  result: DemandForecastResponse | null;
  chartData: Array<{ date: string; observed: number | null; forecast: number | null }>;
  formatNumber: (value: NumericValue) => string;
  isVietnamese: boolean;
}) {
  if (!result) {
    return (
      <EmptyResult
        icon={BarChart3}
        title={isVietnamese ? 'Chưa có kết quả dự báo' : 'No forecast result yet'}
        description={
          isVietnamese
            ? 'Chọn sản phẩm và bấm “Phân tích dự báo” để xem biểu đồ nhu cầu.'
            : 'Choose a product and run the forecast to see demand charts.'
        }
      />
    );
  }

  const projectedNegative = result.summary.projectedStockAfterHorizon < 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric
          label={isVietnamese ? 'Tồn hiện tại' : 'Current stock'}
          value={formatNumber(result.summary.currentStock)}
        />
        <Metric
          label={isVietnamese ? 'Nhu cầu dự báo' : 'Forecast demand'}
          value={formatNumber(result.summary.totalForecastDemand)}
        />
        <Metric
          label={isVietnamese ? 'Tồn sau kỳ' : 'Projected stock'}
          value={formatNumber(result.summary.projectedStockAfterHorizon)}
          tone={projectedNegative ? 'danger' : 'normal'}
        />
        <Metric
          label={isVietnamese ? 'Độ tin cậy' : 'Confidence'}
          value={translateConfidence(result.summary.confidence, isVietnamese)}
        />
      </div>

      {projectedNegative ? (
        <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          {isVietnamese
            ? 'Sản phẩm có nguy cơ thiếu hàng trong kỳ dự báo. Nên chạy thêm “Đề xuất nhập hàng” để tính số lượng nhập.'
            : 'This product may run out during the forecast horizon. Run reorder suggestions to calculate order quantity.'}
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-sm">
        <PanelHeader
          icon={CalendarDays}
          title={result.product.productName}
          subtitle={`${result.historyDays} ${isVietnamese ? 'ngày lịch sử' : 'history days'} | ${result.horizonDays} ${isVietnamese ? 'ngày dự báo' : 'forecast days'}`}
        />
        <div className="mt-5 h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="observedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1b5e20" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#1b5e20" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d6a51d" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#d6a51d" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(96,113,98,0.16)" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#607162' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#607162' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatNumber(value as NumericValue)} />
              <Area type="monotone" dataKey="observed" name={isVietnamese ? 'Thực tế' : 'Observed'} stroke="#1b5e20" strokeWidth={3} fill="url(#observedFill)" connectNulls={false} />
              <Area type="monotone" dataKey="forecast" name={isVietnamese ? 'Dự báo' : 'Forecast'} stroke="#d6a51d" strokeWidth={3} fill="url(#forecastFill)" connectNulls={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-sm">
        <PanelHeader
          icon={BrainCircuit}
          title={isVietnamese ? 'Thông tin mô hình' : 'Model details'}
          subtitle={result.model.modelType}
        />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Metric label="Avg 7" value={formatNumber(result.stats.avg7)} />
          <Metric label="Avg 30" value={formatNumber(result.stats.avg30)} />
          <Metric
            label={isVietnamese ? 'Ngày có bán' : 'Active sales days'}
            value={formatNumber(result.stats.activeSalesDays)}
          />
        </div>
        {result.model.reason ? (
          <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            {result.model.reason}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function ReorderResult({
  result,
  chartData,
  atRiskItems,
  formatNumber,
  isVietnamese,
}: {
  result: ReorderSuggestionsResponse | null;
  chartData: Array<{
    name: string;
    stock: number;
    reorderPoint: number;
    suggested: number;
  }>;
  atRiskItems: ReorderSuggestion[];
  formatNumber: (value: NumericValue) => string;
  isVietnamese: boolean;
}) {
  if (!result) {
    return (
      <EmptyResult
        icon={PackageSearch}
        title={isVietnamese ? 'Chưa có đề xuất nhập hàng' : 'No reorder result yet'}
        description={
          isVietnamese
            ? 'Bấm “Phân tích đề xuất nhập” để quét toàn bộ kho và tìm sản phẩm có nguy cơ hết hàng.'
            : 'Run reorder analysis to scan inventory and find stockout risks.'
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Metric
          label={isVietnamese ? 'Đã phân tích' : 'Analyzed'}
          value={formatNumber(result.summary.totalProductsAnalyzed)}
        />
        <Metric
          label={isVietnamese ? 'Cần nhập' : 'Suggestions'}
          value={formatNumber(result.summary.totalSuggestions)}
        />
        <Metric
          label={isVietnamese ? 'Khẩn cấp cao' : 'High urgency'}
          value={formatNumber(result.summary.highUrgency)}
          tone={result.summary.highUrgency > 0 ? 'danger' : 'normal'}
        />
        <Metric
          label={isVietnamese ? 'Khẩn cấp vừa' : 'Medium urgency'}
          value={formatNumber(result.summary.mediumUrgency)}
        />
      </div>

      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-sm">
        <PanelHeader
          icon={BarChart3}
          title={isVietnamese ? 'Tồn hiện tại vs điểm đặt hàng lại' : 'Current stock vs reorder point'}
          subtitle={`${result.leadTimeDays} ${isVietnamese ? 'ngày lead time' : 'lead-time days'} | ${result.coverageDays} ${isVietnamese ? 'ngày phủ hàng' : 'coverage days'}`}
        />
        <div className="mt-5 h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 35 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(96,113,98,0.16)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} angle={-18} textAnchor="end" tick={{ fontSize: 11, fill: '#607162' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#607162' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatNumber(value as NumericValue)} />
              <Bar dataKey="stock" name={isVietnamese ? 'Tồn hiện tại' : 'Current stock'} fill="#1b5e20" radius={[8, 8, 0, 0]} />
              <Line type="monotone" dataKey="reorderPoint" name={isVietnamese ? 'Điểm đặt hàng' : 'Reorder point'} stroke="#e26d3d" strokeWidth={3} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="suggested" name={isVietnamese ? 'Nên nhập' : 'Suggested qty'} stroke="#d6a51d" strokeWidth={3} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-sm">
        <PanelHeader
          icon={AlertTriangle}
          title={isVietnamese ? 'Sản phẩm có nguy cơ hết hàng' : 'Products at risk of stockout'}
          subtitle={
            isVietnamese
              ? 'Ưu tiên nhập theo urgency'
              : 'Prioritized by urgency'
          }
        />
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-on-surface/5 text-[10px] font-black uppercase tracking-[0.18em] text-on-surface-variant/50">
                <th className="px-4 py-3">{isVietnamese ? 'Sản phẩm' : 'Product'}</th>
                <th className="px-4 py-3">{isVietnamese ? 'Tồn' : 'Stock'}</th>
                <th className="px-4 py-3">{isVietnamese ? 'Điểm đặt' : 'Reorder point'}</th>
                <th className="px-4 py-3">{isVietnamese ? 'Nên nhập' : 'Suggested'}</th>
                <th className="px-4 py-3">{isVietnamese ? 'Còn ngày' : 'Days left'}</th>
                <th className="px-4 py-3">Urgency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface/5">
              {atRiskItems.length ? (
                atRiskItems.map((item) => (
                  <tr key={item.product.productId} className="hover:bg-primary/5">
                    <td className="px-4 py-4">
                      <p className="font-black text-on-surface">{item.product.productName}</p>
                      <p className="mt-1 max-w-xl text-xs font-semibold text-on-surface-variant">
                        {item.reason}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-sm font-black">
                      {formatNumber(item.product.quantityAvailable)}
                    </td>
                    <td className="px-4 py-4 text-sm font-black">
                      {formatNumber(item.reorderPoint)}
                    </td>
                    <td className="px-4 py-4 text-sm font-black text-primary">
                      {formatNumber(item.suggestedOrderQty)}
                    </td>
                    <td className="px-4 py-4 text-sm font-bold">
                      {item.daysUntilStockout === null
                        ? '--'
                        : formatNumber(item.daysUntilStockout)}
                    </td>
                    <td className="px-4 py-4">
                      <UrgencyPill urgency={item.urgency} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-on-surface-variant">
                    {isVietnamese
                      ? 'Không có sản phẩm nguy cơ cao/vừa trong cấu hình hiện tại.'
                      : 'No high/medium risk products in the current configuration.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PanelHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof TrendingUp;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-black text-on-surface">{title}</h2>
        <p className="mt-1 text-xs font-semibold text-on-surface-variant">{subtitle}</p>
      </div>
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon size={20} />
      </div>
    </div>
  );
}

function NumberInput({
  label,
  suffix,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/70">
        {label}
      </span>
      <div className="flex items-center rounded-2xl border border-on-surface/10 bg-surface px-3 py-2">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="min-w-0 flex-1 bg-transparent text-sm font-black outline-none"
        />
        <span className="text-[10px] font-bold uppercase text-on-surface-variant">
          {suffix}
        </span>
      </div>
    </label>
  );
}

function Metric({
  label,
  value,
  tone = 'normal',
}: {
  label: string;
  value: string;
  tone?: 'normal' | 'danger';
}) {
  return (
    <div className={`rounded-2xl border p-4 ${tone === 'danger' ? 'border-red-100 bg-red-50' : 'border-white/70 bg-white/85'}`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-black ${tone === 'danger' ? 'text-red-700' : 'text-primary'}`}>
        {value}
      </p>
    </div>
  );
}

function EmptyResult({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof BarChart3;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[28rem] flex-col items-center justify-center rounded-[2rem] border border-dashed border-primary/20 bg-white/60 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
        <Icon size={28} />
      </div>
      <h2 className="mt-5 text-xl font-black text-on-surface">{title}</h2>
      <p className="mt-2 max-w-md text-sm font-medium text-on-surface-variant">
        {description}
      </p>
    </div>
  );
}

function UrgencyPill({ urgency }: { urgency: ReorderSuggestion['urgency'] }) {
  const styles: Record<ReorderSuggestion['urgency'], string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-sky-100 text-sky-700',
    none: 'bg-slate-100 text-slate-700',
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${styles[urgency]}`}>
      {urgency}
    </span>
  );
}

function resolveMode(value: string | null): AnalysisMode | null {
  return value === 'demand' || value === 'reorder' ? value : null;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function toNumber(value: NumericValue) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string, language: string) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return value;
  return new Date(time).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
  });
}

function shortLabel(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function translateConfidence(value: string, isVietnamese: boolean) {
  const labels: Record<string, string> = isVietnamese
    ? {
        high: 'Cao',
        medium: 'Trung bình',
        low: 'Thấp',
      }
    : {
        high: 'High',
        medium: 'Medium',
        low: 'Low',
      };

  return labels[value] ?? value;
}
