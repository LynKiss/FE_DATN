import { ShieldCheck, Info, Globe, Key, Trash, History, Activity } from 'lucide-react';
import { useLanguage } from '../i18n/language-context';

export default function Security() {
  const { language } = useLanguage();
  const isVietnamese = language === 'vi';

  return (
    <div className="space-y-12 pb-20">
      <div className="max-w-4xl">
        <h1 className="font-headline mb-4 text-4xl font-black leading-none tracking-tight text-primary">
          {isVietnamese ? 'Bảo mật và giao thức' : 'Security and Protocol'}
        </h1>
        <p className="max-w-2xl text-lg font-medium leading-relaxed text-on-surface-variant">
          {isVietnamese
            ? 'Quản lý lớp phòng vệ hệ thống, cấu hình mật mã và khả năng hiển thị dữ liệu công khai cho mạng lưới vận hành.'
            : 'Manage system defenses, cryptographic configurations, and public visibility for the operational network.'}
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">
          <section className="relative overflow-hidden rounded-xl border border-on-surface-variant/5 bg-white p-10 shadow-sm">
            <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-bl-full bg-primary/5" />
            <div className="mb-10 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/5 bg-primary/10 text-primary">
                <ShieldCheck size={28} />
              </div>
              <h2 className="text-2xl font-black tracking-tight text-primary">
                {isVietnamese ? 'Truy cập và mật mã' : 'Access and Cryptography'}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
              <div className="space-y-6">
                <div>
                  <h3 className="mb-1 text-base font-bold text-on-surface">
                    {isVietnamese ? 'Bắt buộc chứng chỉ SSL' : 'SSL Certificate Enforcement'}
                  </h3>
                  <p className="text-xs font-medium leading-relaxed text-on-surface-variant/60">
                    {isVietnamese
                      ? 'Yêu cầu HTTPS cho toàn bộ giao dịch hệ thống.'
                      : 'Require HTTPS for all critical system transactions.'}
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-primary/5 bg-primary/[0.03] p-6">
                  <div>
                    <span className="mb-1 block text-xs font-black uppercase tracking-widest text-primary">
                      {isVietnamese ? 'Trạng thái: Đang bật' : 'Status: Active'}
                    </span>
                    <span className="text-[11px] font-bold text-on-surface-variant/60">
                      Let&apos;s Encrypt Authority X3
                    </span>
                  </div>
                  <Toggle active />
                </div>
                <p className="flex items-center gap-2 px-1 text-[10px] font-black uppercase tracking-widest text-primary">
                  <Activity size={12} />{' '}
                  {isVietnamese
                    ? 'Chứng chỉ hết hạn sau 84 ngày'
                    : 'Certificate expires in 84 days'}
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="mb-1 text-base font-bold text-on-surface">
                    {isVietnamese ? 'Giảm thiểu bot (Captcha)' : 'Bot Mitigation (Captcha)'}
                  </h3>
                  <p className="text-xs font-medium leading-relaxed text-on-surface-variant/60">
                    {isVietnamese
                      ? 'Cấu hình reCAPTCHA v3 cho các điểm vào công khai.'
                      : 'Configure reCAPTCHA v3 for public-facing entry points.'}
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40">
                      {isVietnamese ? 'Site key' : 'Site Key'}
                    </label>
                    <div className="flex rounded-xl border border-transparent bg-on-surface-variant/5 transition-all focus-within:border-primary/20">
                      <input
                        type="text"
                        readOnly
                        value="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
                        className="flex-1 border-none bg-transparent px-4 py-3 text-xs font-mono text-on-surface outline-none"
                      />
                    </div>
                  </div>
                  <button className="ml-1 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary transition-colors hover:text-primary-container">
                    <Key size={14} />{' '}
                    {isVietnamese ? 'Cập nhật khóa mã hóa' : 'Update cryptographic keys'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-on-surface-variant/5 bg-white p-10 shadow-sm">
            <div className="mb-10 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/5 bg-primary/10 text-primary">
                <Globe size={28} />
              </div>
              <h2 className="text-2xl font-black tracking-tight text-primary">
                {isVietnamese ? 'Lập chỉ mục và khám phá' : 'Index and Discovery'}
              </h2>
            </div>

            <div className="space-y-8">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40">
                    {isVietnamese ? 'Mẫu tiêu đề' : 'Title Format Pattern'}
                  </label>
                  <input
                    type="text"
                    value="%page_title% | %site_name% - Agricultural Analytics"
                    className="w-full rounded-xl border-none bg-on-surface-variant/5 px-5 py-3.5 text-sm font-bold text-on-surface outline-none transition-all focus:ring-2 focus:ring-primary/10"
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-on-surface-variant/40">
                    {isVietnamese ? 'Tần suất sitemap' : 'Sitemap Frequency'}
                  </label>
                  <select className="w-full cursor-pointer rounded-xl border-none bg-on-surface-variant/5 px-5 py-3.5 text-sm font-bold text-on-surface outline-none">
                    <option>{isVietnamese ? 'Tạo hằng ngày' : 'Daily Generation'}</option>
                    <option>{isVietnamese ? 'Tạo hằng tuần' : 'Weekly Generation'}</option>
                    <option>{isVietnamese ? 'Chỉ chạy thủ công' : 'Manual Trigger Only'}</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col items-center justify-between gap-6 rounded-2xl border border-primary/5 bg-primary/5 p-6 md:flex-row">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
                    <History size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-on-surface">
                      {isVietnamese ? 'Điều khiển XML Sitemap' : 'XML Sitemap Control'}
                    </h4>
                    <p className="mt-0.5 text-xs font-medium text-on-surface-variant/60">
                      {isVietnamese
                        ? 'Lần đồng bộ gần nhất: Hôm nay, 04:30 AM'
                        : 'Last successful sync: Today, 04:30 AM'}
                    </p>
                  </div>
                </div>
                <button className="rounded-xl border border-primary/10 bg-white px-6 py-2.5 text-xs font-black uppercase tracking-widest text-primary shadow-sm transition-all hover:shadow-md">
                  {isVietnamese ? 'Tạo lại ngay' : 'Regenerate Now'}
                </button>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-6 lg:col-span-4">
          <div className="rounded-xl bg-primary p-8 text-white shadow-sm shadow-primary/20">
            <h3 className="mb-8 text-xs font-black uppercase tracking-[0.2em] text-white/50">
              {isVietnamese ? 'Vận hành hệ thống' : 'System Operations'}
            </h3>
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <History size={18} className="text-accent" />
                  <span className="text-sm font-bold">
                    {isVietnamese ? 'Bộ nhớ đệm' : 'Memory Cache'}
                  </span>
                </div>
                <p className="text-[11px] font-medium leading-relaxed text-white/60">
                  {isVietnamese
                    ? 'Xóa template đã biên dịch và cache query để buộc frontend render mới.'
                    : 'Clear compiled templates and cached query results to force a fresh frontend render.'}
                </p>
                <button className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-3 text-xs font-black uppercase tracking-widest transition-all hover:bg-white/20">
                  <Trash size={14} /> {isVietnamese ? 'Xóa cache' : 'Purge Cache'}
                </button>
              </div>

              <div className="space-y-3 border-t border-white/10 pt-6">
                <div className="flex items-center gap-3">
                  <Activity size={18} className="text-accent" />
                  <span className="text-sm font-bold">
                    {isVietnamese ? 'Cổng API' : 'API Gateways'}
                  </span>
                </div>
                <p className="text-[11px] font-medium leading-relaxed text-white/60">
                  {isVietnamese
                    ? 'Theo dõi độ ổn định của kết nối ngoài và webhook giữa các node.'
                    : 'Monitor external connection integrity and node-to-node webhook responsiveness.'}
                </p>
                <button className="py-2 text-center text-xs font-black uppercase tracking-widest text-accent transition-all hover:text-white">
                  {isVietnamese ? 'Cấu hình endpoint →' : 'Configure endpoints →'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-4 rounded-2xl bg-on-surface-variant/5 px-6 py-4 text-on-surface-variant/40">
            <Info size={24} className="shrink-0" />
            <p className="text-[11px] font-bold leading-relaxed">
              {isVietnamese
                ? 'Thay đổi giao thức bảo mật có thể yêu cầu khởi động lại toàn cụm. Các phiên đang hoạt động sẽ bị vô hiệu khi xoay vòng chứng chỉ SSL.'
                : 'Changing security protocols may require a full cluster restart. Active sessions will be invalidated after SSL certificate rotation.'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Toggle({ active }: { active?: boolean }) {
  return (
    <button
      className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        active ? 'bg-primary' : 'bg-on-surface-variant/10'
      }`}
    >
      <span
        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          active ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
