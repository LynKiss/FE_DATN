import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Barcode, Camera, CheckCircle2, Image, LoaderCircle, Minus, PackagePlus, Plus, ScanLine, X } from 'lucide-react';
import { apiClient } from '../lib/api';
import { useLanguage } from '../i18n/language-context';
import { useToast } from '../hooks/useToast';

type Product = {
  productId: string;
  productName: string;
  productPrice: string;
  productPriceSale: string | null;
  quantityAvailable: number;
  unit: string | null;
  primaryImageUrl?: string | null;
};

type ProductResponse = {
  items: Product[];
};

type ScanItem = {
  productId: string;
  productName: string;
  quantity: number;
};

function playBeep() {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 880;
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.15);
  } catch {
    // AudioContext may not be available in all environments
  }
}

export default function ProductInventoryImport() {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const isVietnamese = language === 'vi';
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Scanner mode state
  const [scanMode, setScanMode] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scanItems, setScanItems] = useState<ScanItem[]>([]);
  const [scanConfirm, setScanConfirm] = useState<string | null>(null);
  const [bulkImporting, setBulkImporting] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Camera scanning state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraScanning, setCameraScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        const data = await apiClient.get<ProductResponse>(
          '/products?includeHidden=true&page=1&limit=100',
        );
        if (!cancelled) {
          setProducts(data.items);
        }
      } catch (error) {
        if (!cancelled) {
          showToast({
            tone: 'error',
            title: isVietnamese ? 'Tải sản phẩm thất bại' : 'Unable to load products',
            description: error instanceof Error ? error.message : 'Unexpected error',
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, [isVietnamese, showToast]);

  // Re-focus barcode input after each scan
  useEffect(() => {
    if (scanMode && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [scanMode, scanItems]);

  const filteredProducts = useMemo(
    () =>
      products.filter((product) =>
        product.productName.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [products, search],
  );
  const selectedProduct =
    products.find((product) => product.productId === selectedProductId) ?? null;

  const processBarcodeScan = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;

      const matched = products.find(
        (p) =>
          p.productId === trimmed ||
          p.productId.startsWith(trimmed) ||
          trimmed.startsWith(p.productId),
      );

      if (!matched) {
        showToast({
          tone: 'error',
          title: isVietnamese ? 'Không tìm thấy sản phẩm' : 'Product not found',
          description: trimmed,
        });
        return;
      }

      playBeep();
      setScanConfirm(matched.productName);
      setTimeout(() => setScanConfirm(null), 1800);

      setScanItems((prev) => {
        const existing = prev.find((item) => item.productId === matched.productId);
        if (existing) {
          return prev.map((item) =>
            item.productId === matched.productId
              ? { ...item, quantity: item.quantity + 1 }
              : item,
          );
        }
        return [
          ...prev,
          { productId: matched.productId, productName: matched.productName, quantity: 1 },
        ];
      });
    },
    [products, isVietnamese, showToast],
  );

  const stopCamera = () => {
    if (scanLoopRef.current !== null) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setCameraScanning(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    if (!('BarcodeDetector' in window)) {
      setCameraError(isVietnamese
        ? 'Trình duyệt không hỗ trợ quét mã vạch. Hãy thử dùng ảnh hoặc nhập thủ công.'
        : 'Your browser does not support BarcodeDetector. Use image scan or type manually.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setCameraScanning(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'data_matrix'] });
      const scan = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          scanLoopRef.current = requestAnimationFrame(scan);
          return;
        }
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const barcodes: Array<{ rawValue: string }> = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            stopCamera();
            processBarcodeScan(code);
            return;
          }
        } catch {}
        scanLoopRef.current = requestAnimationFrame(scan);
      };
      scanLoopRef.current = requestAnimationFrame(scan);
    } catch (err) {
      setCameraError(isVietnamese ? 'Không thể mở camera. Kiểm tra quyền truy cập.' : 'Cannot open camera. Check browser permissions.');
      stopCamera();
    }
  };

  const handleImageScan = async (file: File) => {
    if (!file) return;
    if (!('BarcodeDetector' in window)) {
      // Fallback: create object URL and show prompt
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Trình duyệt không hỗ trợ' : 'Browser not supported',
        description: isVietnamese ? 'Hãy nhập mã vạch thủ công.' : 'Please enter barcode manually.',
      });
      return;
    }
    try {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.src = url;
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error('load'));
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'data_matrix'] });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const barcodes: Array<{ rawValue: string }> = await detector.detect(img);
      URL.revokeObjectURL(url);
      if (barcodes.length > 0) {
        processBarcodeScan(barcodes[0].rawValue);
      } else {
        showToast({
          tone: 'error',
          title: isVietnamese ? 'Không tìm thấy mã vạch trong ảnh' : 'No barcode found in image',
          description: isVietnamese ? 'Hãy thử ảnh rõ hơn hoặc nhập thủ công.' : 'Try a clearer image or enter manually.',
        });
      }
    } catch {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Lỗi đọc ảnh' : 'Image read error',
        description: isVietnamese ? 'Không thể xử lý ảnh này.' : 'Could not process this image.',
      });
    }
  };

  // Cleanup camera on unmount or scanMode off
  useEffect(() => {
    if (!scanMode) stopCamera();
    return () => { stopCamera(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanMode]);

  async function handleImport() {
    if (!selectedProductId || Number(quantity) < 1) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Thiếu dữ liệu nhập kho' : 'Missing import data',
        description: isVietnamese
          ? 'Cần chọn sản phẩm và số lượng lớn hơn 0.'
          : 'Select a product and enter a quantity above 0.',
      });
      return;
    }

    setSaving(true);
    try {
      await apiClient.post('/inventory/transactions/import', {
        productId: selectedProductId,
        quantity: Number(quantity),
        note: note.trim() || undefined,
      });

      showToast({
        tone: 'success',
        title: isVietnamese ? 'Đã cập nhật tồn kho' : 'Inventory updated',
        description: selectedProduct?.productName ?? selectedProductId,
      });
      setQuantity('1');
      setNote('');
    } catch (error) {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Nhập kho thất bại' : 'Import failed',
        description: error instanceof Error ? error.message : 'Unexpected error',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkImport() {
    if (scanItems.length === 0) return;

    setBulkImporting(true);
    let successCount = 0;
    let failCount = 0;

    for (const item of scanItems) {
      try {
        await apiClient.post('/inventory/transactions/import', {
          productId: item.productId,
          quantity: item.quantity,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    setBulkImporting(false);

    if (failCount === 0) {
      showToast({
        tone: 'success',
        title: isVietnamese ? 'Nhập kho hoàn thành' : 'Bulk import done',
        description: isVietnamese
          ? `Đã nhập ${successCount} sản phẩm`
          : `${successCount} products imported`,
      });
      setScanItems([]);
    } else {
      showToast({
        tone: 'error',
        title: isVietnamese ? 'Một số sản phẩm thất bại' : 'Some imports failed',
        description: isVietnamese
          ? `${successCount} thành công, ${failCount} thất bại`
          : `${successCount} succeeded, ${failCount} failed`,
      });
    }
  }

  const totalScanQty = scanItems.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-[2.7rem] font-black tracking-tight text-primary">
            {isVietnamese ? 'Nhập Kho Sản Phẩm' : 'Import Product Inventory'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-on-surface-variant">
            {isVietnamese
              ? 'Page này tập trung cho thao tác nhập kho nhanh. Có thể tìm sản phẩm, chọn số lượng và ghi chú cho giao dịch.'
              : 'Use this page for quick inventory imports. Search products, set the quantity, and keep a note for the transaction.'}
          </p>
        </div>

        {/* Scanner mode toggle */}
        <button
          type="button"
          onClick={() => {
            setScanMode((m) => !m);
            setScanInput('');
          }}
          className={`inline-flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-black transition ${
            scanMode
              ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20'
              : 'border-on-surface/10 bg-white text-on-surface hover:border-primary/30 hover:text-primary'
          }`}
        >
          <ScanLine size={18} />
          {isVietnamese ? 'Chế độ máy quét' : 'Scanner Mode'}
        </button>
      </div>

      {/* Scanner mode UI */}
      {scanMode && (
        <div className="space-y-4">
          {/* Input method selector */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-2 rounded-xl border-2 border-primary bg-white px-5 py-3 flex-1 min-w-0 shadow-lg shadow-primary/10">
              <Barcode size={22} className="shrink-0 text-primary" />
              <input
                ref={barcodeInputRef}
                type="text"
                autoFocus={scanMode && !cameraActive}
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    processBarcodeScan(scanInput);
                    setScanInput('');
                  }
                }}
                onBlur={(e) => {
                  if (e.target.value.trim()) {
                    processBarcodeScan(e.target.value);
                    setScanInput('');
                  }
                }}
                placeholder={
                  isVietnamese
                    ? 'Quét mã vạch hoặc nhập mã sản phẩm...'
                    : 'Scan barcode or enter product code...'
                }
                className="flex-1 bg-transparent text-base font-semibold outline-none placeholder:font-normal placeholder:text-on-surface-variant/40 min-w-0"
              />
            </div>
            {/* Camera button */}
            <button
              type="button"
              onClick={() => { if (cameraActive) { stopCamera(); } else { void startCamera(); } }}
              className={`inline-flex items-center gap-2 rounded-xl border-2 px-5 py-3 text-sm font-black transition ${cameraActive ? 'border-red-500 bg-red-500 text-white' : 'border-on-surface/10 bg-white text-on-surface hover:border-primary/40 hover:text-primary'}`}
              title={isVietnamese ? 'Quét bằng camera' : 'Scan with camera'}
            >
              <Camera size={18} />
              {cameraActive ? (isVietnamese ? 'Dừng' : 'Stop') : (isVietnamese ? 'Camera' : 'Camera')}
            </button>
            {/* Image upload */}
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-on-surface/10 bg-white px-5 py-3 text-sm font-black text-on-surface transition hover:border-primary/40 hover:text-primary"
              title={isVietnamese ? 'Quét từ ảnh' : 'Scan from image'}
            >
              <Image size={18} />
              {isVietnamese ? 'Ảnh' : 'Image'}
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImageScan(f); e.target.value = ''; }}
            />
          </div>

          {/* Camera error */}
          {cameraError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {cameraError}
            </div>
          )}

          {/* Live camera view */}
          {cameraActive && (
            <div className="relative overflow-hidden rounded-xl border-2 border-primary bg-black shadow-sm shadow-primary/10">
              <video ref={videoRef} playsInline muted className="w-full max-h-72 object-contain" />
              <canvas ref={canvasRef} className="hidden" />
              {cameraScanning && (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-black/50 py-3 text-sm font-bold text-white">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {isVietnamese ? 'Đang quét...' : 'Scanning...'}
                </div>
              )}
              {/* Targeting overlay */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-40 w-64 rounded-xl border-2 border-dashed border-white/60 shadow-inner" />
              </div>
            </div>
          )}

          {/* Confirmation flash */}
          {scanConfirm && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg">
              <CheckCircle2 size={15} />
              {scanConfirm}
            </div>
          )}

          {/* Scanned items list */}
          {scanItems.length > 0 && (
            <section className="rounded-xl border border-on-surface/8 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="font-black text-on-surface">
                    {isVietnamese ? 'Danh sách đã quét' : 'Scanned items'}
                  </p>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    {isVietnamese
                      ? `${scanItems.length} sản phẩm — tổng ${totalScanQty} đơn vị`
                      : `${scanItems.length} products — ${totalScanQty} units total`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setScanItems([])}
                  className="rounded-xl p-2 text-on-surface-variant transition hover:bg-red-50 hover:text-red-500"
                  title={isVietnamese ? 'Xóa tất cả' : 'Clear all'}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-2">
                {scanItems.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-surface px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-on-surface">{item.productName}</p>
                      <p className="text-xs text-on-surface-variant">{item.productId}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setScanItems((prev) =>
                            item.quantity <= 1
                              ? prev.filter((i) => i.productId !== item.productId)
                              : prev.map((i) =>
                                  i.productId === item.productId
                                    ? { ...i, quantity: i.quantity - 1 }
                                    : i,
                                ),
                          )
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-on-surface/10 bg-white text-on-surface-variant transition hover:bg-red-50 hover:text-red-500"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-8 text-center text-sm font-black text-on-surface">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setScanItems((prev) =>
                            prev.map((i) =>
                              i.productId === item.productId
                                ? { ...i, quantity: i.quantity + 1 }
                                : i,
                            ),
                          )
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-on-surface/10 bg-white text-on-surface-variant transition hover:bg-primary/10 hover:text-primary"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void handleBulkImport()}
                disabled={bulkImporting || scanItems.length === 0}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-black text-white shadow-sm shadow-primary/20 disabled:opacity-60"
              >
                {bulkImporting ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : (
                  <PackagePlus size={18} />
                )}
                {isVietnamese
                  ? `Nhập kho tất cả (${totalScanQty} đơn vị)`
                  : `Import all (${totalScanQty} units)`}
              </button>
            </section>
          )}
        </div>
      )}

      {/* Normal mode */}
      {!scanMode && (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-xl border border-on-surface-variant/5 bg-white p-6 shadow-sm">
            <div className="grid gap-5">
              <label className="grid gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-on-surface-variant/50">
                  {isVietnamese ? 'Tìm sản phẩm' : 'Search product'}
                </span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={
                    isVietnamese ? 'Nhập tên sản phẩm...' : 'Type a product name...'
                  }
                  className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-on-surface-variant/50">
                  {isVietnamese ? 'Danh sách sản phẩm' : 'Product list'}
                </span>
                <select
                  value={selectedProductId}
                  onChange={(event) => setSelectedProductId(event.target.value)}
                  className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
                >
                  <option value="">
                    {isVietnamese ? 'Chọn sản phẩm' : 'Select a product'}
                  </option>
                  {filteredProducts.map((product) => (
                    <option key={product.productId} value={product.productId}>
                      {product.productName}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.24em] text-on-surface-variant/50">
                    {isVietnamese ? 'Số lượng nhập' : 'Import quantity'}
                  </span>
                  <input
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    type="number"
                    min="1"
                    className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
                  />
                </label>

                <div className="rounded-xl border border-on-surface/10 bg-surface px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-on-surface-variant/50">
                    {isVietnamese ? 'Chế độ thao tác' : 'Operation mode'}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-on-surface">
                    {isVietnamese ? 'Nhập kho thủ công / máy quét' : 'Manual / scanner intake'}
                  </p>
                </div>
              </div>

              <label className="grid gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-on-surface-variant/50">
                  {isVietnamese ? 'Ghi chú giao dịch' : 'Transaction note'}
                </span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={4}
                  className="rounded-2xl border border-on-surface/10 bg-surface px-4 py-3 text-sm outline-none"
                />
              </label>

              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={saving || loading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-black text-white shadow-sm shadow-primary/20 disabled:opacity-60"
              >
                {saving ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : (
                  <PackagePlus size={18} />
                )}
                <span>
                  {isVietnamese
                    ? 'Cập nhật số lượng tồn kho'
                    : 'Update inventory quantity'}
                </span>
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-on-surface-variant/5 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ScanLine size={22} />
              </div>
              <div>
                <p className="font-black text-on-surface">
                  {isVietnamese ? 'Preview sản phẩm' : 'Product preview'}
                </p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {isVietnamese
                    ? 'Thông tin sản phẩm được chọn cho phiên nhập kho.'
                    : 'The currently selected product for this inventory session.'}
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-on-surface/10 bg-surface p-5">
              {loading ? (
                <div className="py-12 text-center text-sm text-on-surface-variant">
                  {isVietnamese
                    ? 'Đang tải danh sách sản phẩm...'
                    : 'Loading products...'}
                </div>
              ) : selectedProduct ? (
                <div className="grid gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white">
                      {selectedProduct.primaryImageUrl ? (
                        <img
                          src={selectedProduct.primaryImageUrl}
                          alt={selectedProduct.productName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Barcode size={24} className="text-on-surface-variant/40" />
                      )}
                    </div>
                    <div>
                      <p className="text-lg font-black text-on-surface">
                        {selectedProduct.productName}
                      </p>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        {selectedProduct.productId}
                      </p>
                    </div>
                  </div>

                  <dl className="grid gap-3 md:grid-cols-2">
                    <InfoCard
                      label={isVietnamese ? 'Tồn hiện tại' : 'Current stock'}
                      value={`${selectedProduct.quantityAvailable}`}
                    />
                    <InfoCard
                      label={isVietnamese ? 'Đơn vị' : 'Unit'}
                      value={selectedProduct.unit || '-'}
                    />
                    <InfoCard
                      label={isVietnamese ? 'Giá bán' : 'Price'}
                      value={selectedProduct.productPrice}
                    />
                    <InfoCard
                      label={isVietnamese ? 'Giá giảm' : 'Sale price'}
                      value={selectedProduct.productPriceSale || '-'}
                    />
                  </dl>
                </div>
              ) : (
                <div className="py-12 text-center text-sm text-on-surface-variant">
                  {isVietnamese
                    ? 'Chọn một sản phẩm để xem thông tin.'
                    : 'Select a product to preview its data.'}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-on-surface/10 bg-white px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-on-surface-variant/50">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold text-on-surface">{value}</p>
    </div>
  );
}
