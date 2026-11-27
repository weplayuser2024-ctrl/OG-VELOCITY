import React, { useEffect, useState } from 'react';
import { Check, Clock, Copy, QrCode, RotateCw, ShieldCheck, Upload, X } from 'lucide-react';
import { uploadImageAsset } from '../utils/mediaUpload';

export interface ActivePaymentOrderPayload {
  order: {
    orderId: string;
    orderType: 'vip' | 'coins';
    packageId: string;
    packageName: string;
    amountInr: number;
    coinsAmount: number;
    grantedVipLevel: number;
    status: string;
    utrNumber?: string | null;
    qrVersionId?: number | null;
    expiresAt?: string | null;
  };
  upiConfig: {
    qrVersionId?: number;
    currentVersionId?: number | null;
    accountName: string;
    upiId: string;
    provider: string;
    qrDataUrl: string;
    upiUri: string;
    note?: string;
  };
}

interface UpiPaymentModalProps {
  activeOrder: ActivePaymentOrderPayload | null;
  authToken: string | null;
  onClose: () => void;
  onProofSubmitted: (order: ActivePaymentOrderPayload['order'], message: string) => void;
}

export const UpiPaymentModal: React.FC<UpiPaymentModalProps> = ({
  activeOrder,
  authToken,
  onClose,
  onProofSubmitted,
}) => {
  const [utr, setUtr] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [paymentDateTime, setPaymentDateTime] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [note, setNote] = useState('');
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | undefined>(undefined);
  const [screenshotName, setScreenshotName] = useState('');
  const [lastScreenshotFile, setLastScreenshotFile] = useState<File | null>(null);
  const [screenshotUploading, setScreenshotUploading] = useState(false);
  const [screenshotProgress, setScreenshotProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!activeOrder?.order.expiresAt) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [activeOrder?.order.orderId, activeOrder?.order.expiresAt]);

  if (!activeOrder) return null;
  const { order, upiConfig } = activeOrder;

  const expiresMs = order.expiresAt ? new Date(order.expiresAt).getTime() : null;
  const remainingSec =
    expiresMs !== null && Number.isFinite(expiresMs)
      ? Math.max(0, Math.floor((expiresMs - nowMs) / 1000))
      : null;
  const isExpired = remainingSec !== null && remainingSec <= 0;
  const countdownText =
    remainingSec !== null
      ? `${String(Math.floor(remainingSec / 60)).padStart(2, '0')}:${String(remainingSec % 60).padStart(2, '0')}`
      : null;

  const handleCopyUpi = () => {
    navigator.clipboard?.writeText(upiConfig.upiId).catch(() => {});
    setCopiedUpi(true);
    window.setTimeout(() => setCopiedUpi(false), 1800);
  };

  const processScreenshotUpload = async (file: File) => {
    setError('');
    setLastScreenshotFile(file);
    setScreenshotName(file.name);
    setScreenshotUploading(true);
    setScreenshotProgress(10);
    try {
      const uploadedUrl = await uploadImageAsset(file, {
        authToken,
        maxDim: 1280,
        quality: 0.85,
        maxCompressedBytes: 750_000,
        onProgress: (pct) => setScreenshotProgress(pct),
      });
      setScreenshotDataUrl(uploadedUrl);
    } catch (err) {
      setScreenshotDataUrl(undefined);
      setError(err instanceof Error ? err.message : 'Failed to upload screenshot. Tap Retry.');
    } finally {
      setScreenshotUploading(false);
    }
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void processScreenshotUpload(file);
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (isExpired) {
      setError('This payment order has expired. Close and create a fresh order.');
      return;
    }
    const cleanHolderName = accountHolderName.trim();
    if (cleanHolderName.length < 2) {
      setError('Enter the Bank Account Holder / Sender Name (at least 2 characters).');
      return;
    }
    const cleanUtr = utr.trim().toUpperCase();
    if (!/^[A-Z0-9]{8,35}$/.test(cleanUtr)) {
      setError('Enter your valid 8–35 character UPI UTR / Reference Number.');
      return;
    }

    setSubmitting(true);
    try {
      const resp = await fetch(`/api/payments/orders/${encodeURIComponent(order.orderId)}/submit-proof`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          utrNumber: cleanUtr,
          accountHolderName: cleanHolderName,
          paymentDateTime: paymentDateTime.trim() || undefined,
          screenshotDataUrl,
          payerNote: note.trim() || undefined,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        order?: ActivePaymentOrderPayload['order'];
      };
      if (!resp.ok || !data.ok || !data.order) {
        setError(data.error || 'Failed to submit payment proof.');
        return;
      }
      onProofSubmitted(
        data.order,
        data.message || 'Payment proof submitted! Pending Admin review before activation.'
      );
      onClose();
    } catch {
      setError('Network error while submitting UTR proof.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="zayro-scroll max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-amber-400/30 bg-[#0D1526] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-wider text-amber-300 uppercase">
              <span>Verified UPI Payment · {upiConfig.provider}</span>
              {countdownText && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] ${
                    isExpired
                      ? 'bg-red-500/20 text-red-300'
                      : 'bg-amber-400/15 text-amber-200'
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  <span>{isExpired ? 'Expired' : `Expires ${countdownText}`}</span>
                </span>
              )}
            </div>
            <h2 className="font-display mt-1 text-xl font-extrabold text-white">
              {order.packageName}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-slate-400">
              Order {order.orderId} · Amount:{' '}
              <span className="font-bold text-emerald-300">₹{order.amountInr} INR</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/10 p-2 text-slate-300 hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isExpired && (
          <div className="mt-3 rounded-xl border border-red-400/40 bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-200">
            This payment window has expired. Please close this window and tap Pay again to generate a fresh order.
          </div>
        )}

        {/* Permanent UPI QR & Account Details */}
        <div className="mt-4 grid grid-cols-1 items-center gap-4 rounded-2xl border border-white/10 bg-[#132038] p-4 sm:grid-cols-12">
          <div className="flex flex-col items-center sm:col-span-5">
            {upiConfig.qrDataUrl ? (
              <img
                src={upiConfig.qrDataUrl}
                alt="Permanent UPI QR Code"
                className="h-40 w-40 rounded-xl bg-white p-2 shadow-lg"
              />
            ) : (
              <div className="flex h-40 w-40 items-center justify-center rounded-xl bg-white/10">
                <QrCode className="h-14 w-14 text-amber-300" />
              </div>
            )}
          </div>
          <div className="space-y-2 text-xs sm:col-span-7">
            <div>
              <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                Account Name
              </div>
              <div className="text-sm font-extrabold text-white">{upiConfig.accountName}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                UPI ID ({upiConfig.provider})
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <code className="rounded-lg bg-black/40 px-2.5 py-1 font-mono text-xs font-bold text-amber-300">
                  {upiConfig.upiId}
                </code>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-400/20 px-2 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-400/30"
                >
                  {copiedUpi ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-300">
              Scan this QR or pay{' '}
              <strong className="text-white">₹{order.amountInr}</strong> to{' '}
              <strong className="text-amber-300">{upiConfig.upiId}</strong>, then enter your sender name, UTR, and payment time below.
            </p>
          </div>
        </div>

        {/* Submit UTR & Screenshot Form */}
        <form onSubmit={handleSubmitProof} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-200">
                Account Holder / Sender Name *
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                placeholder="Name on bank / UPI account"
                className="w-full rounded-xl border border-white/15 bg-[#070B14] px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-200">
                Payment Date &amp; Time
              </label>
              <input
                type="datetime-local"
                value={paymentDateTime}
                onChange={(e) => setPaymentDateTime(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-[#070B14] px-3 py-2.5 font-mono text-xs text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-200">
              UTR / UPI Reference Number *
            </label>
            <input
              type="text"
              required
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              placeholder="e.g. 432619847210"
              className="w-full rounded-xl border border-white/15 bg-[#070B14] px-3.5 py-2.5 font-mono text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-200">
              Payment Screenshot (PNG / JPEG / WEBP · Supports 3 MB+)
            </label>
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-white/25 bg-[#070B14] px-4 py-3 text-xs text-slate-300 hover:border-amber-400/60">
              <span className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-amber-300" />
                <span>
                  {screenshotUploading
                    ? `Uploading screenshot (${screenshotProgress}%)...`
                    : screenshotName || 'Upload payment confirmation screenshot'}
                </span>
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleScreenshotChange}
                className="hidden"
              />
            </label>
            {screenshotUploading && (
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-amber-400 transition-all duration-200"
                  style={{ width: `${screenshotProgress}%` }}
                />
              </div>
            )}
            {error && lastScreenshotFile && !screenshotDataUrl && !screenshotUploading && (
              <button
                type="button"
                onClick={() => void processScreenshotUpload(lastScreenshotFile)}
                className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-2.5 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-500/30"
              >
                <RotateCw className="h-3 w-3" />
                <span>Retry Screenshot Upload</span>
              </button>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-200">
              Payer Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Paid via GPay / PhonePe / Paytm"
              className="w-full rounded-xl border border-white/15 bg-[#070B14] px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-400/40 bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-200">
              {error}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-3 text-[11px] text-cyan-200">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
            <span>
              Security policy: VIP status and Coins never auto-activate on submission. An Admin reviews your sender name, UTR &amp; screenshot and approves activation.
            </span>
          </div>

          <button
            type="submit"
            disabled={submitting || screenshotUploading || isExpired}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 py-3 text-sm font-black text-slate-950 shadow-lg hover:brightness-105 disabled:opacity-60"
          >
            {isExpired
              ? 'Order Expired — Create New Order'
              : submitting
                ? 'Submitting Payment Proof...'
                : 'Submit UTR & Proof for Verification'}
          </button>
        </form>
      </div>
    </div>
  );
};
