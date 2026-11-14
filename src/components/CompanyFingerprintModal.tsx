import { useState, useId } from "react";
import {
  X,
  Building2,
  FileText,
  Upload,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Percent,
  Wallet,
  ArrowRight,
} from "lucide-react";
import {
  INDUSTRY_PRICE_BOOKS,
  type IndustryPriceBook,
  getPriceBookById,
  formatPriceBookAsPromptRules,
} from "@/lib/industry-price-books";

export interface CompanyFingerprintData {
  industryId: string;
  companyName: string;
  targetNetMargin: number; // e.g. 38 for 38%
  maxDiscountAllowed: number; // e.g. 5 for 5%
  paymentMilestones: string[];
  rulesPrompt: string;
  sourceType: "turnkey_preset" | "uploaded_document";
  sourceFileName?: string;
  updatedAt: string;
}

export interface CompanyFingerprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply?: (data: CompanyFingerprintData) => void;
  initialData?: Partial<CompanyFingerprintData>;
}

const STORAGE_KEY = "rai2_company_fingerprint";

export function loadSavedFingerprint(): CompanyFingerprintData | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CompanyFingerprintData;
  } catch {
    return null;
  }
}

export function saveFingerprintToStorage(data: CompanyFingerprintData): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // Ignore storage write issues
  }
}

export function CompanyFingerprintModal({
  isOpen,
  onClose,
  onApply,
  initialData,
}: CompanyFingerprintModalProps) {
  const dialogTitleId = useId();
  const [activeTab, setActiveTab] = useState<"preset" | "upload">("preset");
  const [selectedIndustryId, setSelectedIndustryId] = useState<string>(
    initialData?.industryId || "interior_fitout"
  );
  const [customCompanyName, setCustomCompanyName] = useState<string>(
    initialData?.companyName || "Doanh Nghiệp Tiên Phong RAI²"
  );
  const [customMargin, setCustomMargin] = useState<number>(
    initialData?.targetNetMargin ?? 38
  );
  const [customDiscount, setCustomDiscount] = useState<number>(
    initialData?.maxDiscountAllowed ?? 5
  );

  // Upload state
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadContent, setUploadContent] = useState<string>("");
  const [isParsing, setIsParsing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const currentBook: IndustryPriceBook =
    getPriceBookById(selectedIndustryId) ||
    INDUSTRY_PRICE_BOOKS[0];

  const handleSelectIndustry = (id: string) => {
    setSelectedIndustryId(id);
    const book = getPriceBookById(id);
    if (book) {
      setCustomMargin(Math.round(book.defaultNetMargin * 100));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setIsParsing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || "";
      setUploadContent(text);
      setIsParsing(false);

      // Guess company name from file if empty
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      if (cleanName && cleanName.length > 2) {
        setCustomCompanyName(cleanName);
      }
    };
    reader.onerror = () => {
      setIsParsing(false);
    };

    if (file.type.includes("text") || file.name.endsWith(".txt") || file.name.endsWith(".csv") || file.name.endsWith(".json")) {
      reader.readAsText(file);
    } else {
      setUploadContent(`[Hồ sơ dữ liệu nạp từ tập tin: ${file.name}, kích thước: ${(file.size / 1024).toFixed(1)} KB]`);
      setIsParsing(false);
    }
  };

  const handleSaveAndApply = () => {
    const basePrompt = formatPriceBookAsPromptRules(currentBook);
    const rulesPrompt = [
      basePrompt,
      "",
      `### THÔNG TIN CÔNG TY ÁP DỤNG:`,
      `- Tên đơn vị: ${customCompanyName}`,
      `- Biên lợi nhuận ròng thiết lập: ${customMargin}%`,
      `- Giới hạn giảm giá tối đa: ${customDiscount}%`,
      activeTab === "upload" && uploadContent ? `\n### DỮ LIỆU ĐẶC THÙ BỔ SUNG TỪ HỒ SƠ:\n${uploadContent}` : "",
    ].join("\n");

    const fingerprint: CompanyFingerprintData = {
      industryId: selectedIndustryId,
      companyName: customCompanyName,
      targetNetMargin: customMargin,
      maxDiscountAllowed: customDiscount,
      paymentMilestones: currentBook.paymentTerms,
      rulesPrompt,
      sourceType: activeTab === "preset" ? "turnkey_preset" : "uploaded_document",
      sourceFileName: uploadedFileName || undefined,
      updatedAt: new Date().toISOString(),
    };

    saveFingerprintToStorage(fingerprint);
    if (onApply) {
      onApply(fingerprint);
    }

    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 900);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogTitleId}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] sm:max-h-[88dvh] w-full max-w-3xl flex-col rounded-2xl border border-hairline/60 bg-card shadow-2xl overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Voice-to-SOP (Image 3) */}
        <header className="flex items-center justify-between border-b border-hairline/50 px-4 py-3 sm:px-6 sm:py-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent shrink-0">
              <Building2 size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id={dialogTitleId} className="text-[15px] sm:text-[16px] font-semibold text-ink truncate">
                  Hồ Sơ Doanh Nghiệp & Sổ Giá Mẫu
                </h2>
                <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
                  Company DNA
                </span>
              </div>
              <p className="text-[12px] text-ink-secondary truncate">
                Nạp 80% DNA vận hành và rào chắn biên lợi nhuận ròng ≥ 35% tức thì.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-ink-secondary hover:bg-raised hover:text-ink transition-colors shrink-0"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </header>

        {/* Tab Selection */}
        <div className="mx-4 mt-3 sm:mx-6 sm:mt-4 flex rounded-xl bg-raised/70 p-1 border border-hairline/50 shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("preset")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-[11px] sm:text-xs font-semibold transition-all ${
              activeTab === "preset"
                ? "bg-card text-ink shadow-xs"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            <Sparkles className="size-3.5 text-accent shrink-0" />
            <span className="truncate">Sổ Giá Ngành Mẫu (0s)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-[11px] sm:text-xs font-semibold transition-all ${
              activeTab === "upload"
                ? "bg-card text-ink shadow-xs"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            <Upload className="size-3.5 text-accent shrink-0" />
            <span className="truncate">Kéo Thả Báo Giá Cũ</span>
          </button>
        </div>

        {/* Content Body - Scrollable */}
        <div className="flex-1 overflow-y-auto py-3">

        {/* Content Body */}
        {activeTab === "preset" ? (
          <div className="mt-5 space-y-4">
            <label className="block text-xs font-semibold text-ink-secondary uppercase tracking-wider">
              Chọn Lĩnh Vực Hoạt Động Doanh Nghiệp
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INDUSTRY_PRICE_BOOKS.map((book) => {
                const isSelected = book.id === selectedIndustryId;
                return (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => handleSelectIndustry(book.id)}
                    className={`text-left rounded-xl border p-3.5 transition-all ${
                      isSelected
                        ? "border-accent bg-accent/5 ring-1 ring-accent shadow-xs"
                        : "border-hairline/60 bg-raised/20 hover:border-hairline hover:bg-raised/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink">{book.name}</span>
                      {isSelected && <CheckCircle2 className="size-4 text-accent shrink-0" />}
                    </div>
                    <p className="mt-1 text-[11px] text-ink-secondary line-clamp-2 leading-relaxed">
                      {book.description}
                    </p>
                    <div className="mt-2.5 flex items-center gap-2 text-[10px] font-medium text-ink-tertiary">
                      <span className="rounded bg-raised px-1.5 py-0.5 text-ink-secondary">
                        Biên LN: ≥{(book.defaultNetMargin * 100).toFixed(0)}%
                      </span>
                      <span>·</span>
                      <span>{book.unitPrices.length} hạng mục mẫu</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Overrides */}
            <div className="mt-4 rounded-xl border border-hairline/50 bg-raised/30 p-4 space-y-3">
              <div className="text-xs font-bold text-ink flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>Rào Chắn Vận Hành Cốt Lõi (Tự Động Kích Hoạt)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-ink-secondary block mb-1">
                    Tên Doanh Nghiệp / Thương Hiệu
                  </label>
                  <input
                    type="text"
                    value={customCompanyName}
                    onChange={(e) => setCustomCompanyName(e.target.value)}
                    className="w-full rounded-lg border border-hairline bg-card px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-hidden"
                    placeholder="VD: Cty Cổ Phần ABC"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-ink-secondary block mb-1">
                    Biên Lợi Nhuận Ròng Mục Tiêu (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={20}
                      max={80}
                      value={customMargin}
                      onChange={(e) => setCustomMargin(Number(e.target.value))}
                      className="w-full rounded-lg border border-hairline bg-card px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-hidden pr-7"
                    />
                    <Percent className="size-3.5 absolute right-2.5 top-2 text-ink-tertiary" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-ink-secondary block mb-1">
                    Chiết Khấu Tối Đa Cho Phép (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={customDiscount}
                      onChange={(e) => setCustomDiscount(Number(e.target.value))}
                      className="w-full rounded-lg border border-hairline bg-card px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-hidden pr-7"
                    />
                    <Percent className="size-3.5 absolute right-2.5 top-2 text-ink-tertiary" />
                  </div>
                </div>
              </div>

              {/* Payment Milestones Display */}
              <div className="mt-2 pt-2 border-t border-hairline/40">
                <div className="text-[11px] font-medium text-ink-secondary flex items-center gap-1.5 mb-1.5">
                  <Wallet className="size-3.5 text-accent" />
                  <span>Tiến độ thanh toán chuẩn hóa bảo vệ dòng tiền (Không rủi ro công nợ):</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {currentBook.paymentTerms.map((ms, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-md bg-card border border-hairline/60 px-2 py-0.5 text-[11px] font-medium text-ink"
                    >
                      <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                      <span className="truncate max-w-xs">{ms}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border-2 border-dashed border-hairline/80 bg-raised/20 p-8 text-center hover:border-accent transition-colors">
              <input
                type="file"
                id="file-dropzone"
                onChange={handleFileUpload}
                accept=".pdf,.docx,.xlsx,.txt,.csv,.json"
                className="hidden"
              />
              <label
                htmlFor="file-dropzone"
                className="cursor-pointer flex flex-col items-center justify-center space-y-2"
              >
                <div className="size-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                  <Upload className="size-6" />
                </div>
                <span className="text-xs font-semibold text-ink">
                  Kéo thả hoặc bấm để chọn tập tin Báo giá / Hợp đồng mẫu
                </span>
                <span className="text-[11px] text-ink-secondary">
                  Hỗ trợ định dạng .PDF, .DOCX, .XLSX, .TXT, .CSV (Tối đa 25MB)
                </span>
              </label>
            </div>

            {isParsing && (
              <div className="flex items-center justify-center gap-2 py-3 text-xs text-accent">
                <Sparkles className="size-4 animate-spin" />
                <span>Đang phân tích cấu trúc giá và điều khoản thanh toán...</span>
              </div>
            )}

            {uploadedFileName && !isParsing && (
              <div className="rounded-xl border border-hairline/60 bg-control/40 p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-accent shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-ink">{uploadedFileName}</span>
                    <p className="text-[11px] text-ink-secondary">
                      Đã trích xuất cấu trúc giá và dữ liệu điều khoản an toàn.
                    </p>
                  </div>
                </div>
                <CheckCircle2 className="size-4 text-accent shrink-0" />
              </div>
            )}
          </div>
        )}

        </div>
        {/* Footer Actions matching Image 3 */}
        <footer className="border-t border-hairline/50 px-4 py-3 sm:px-6 sm:py-3.5 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 shrink-0 bg-card">
          <div className="text-[12px] text-center sm:text-left text-ink-tertiary">
            RAI² First OS · Rào chắn an toàn 80/20 · Bảo vệ dòng tiền tuyệt đối
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-medium text-ink-secondary hover:text-ink rounded-lg transition-colors"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSaveAndApply}
              disabled={isSuccess}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-[13px] font-medium text-white shadow-sm hover:bg-accent/90 disabled:opacity-50 transition-opacity w-full sm:w-auto"
            >
              {isSuccess ? (
                <>
                  <CheckCircle2 className="size-3.5" />
                  <span>Đã Áp Dụng Thành Công!</span>
                </>
              ) : (
                <>
                  <span>Áp Dụng Cho Nhân Sự Số</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
