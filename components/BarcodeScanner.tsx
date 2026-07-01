import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Camera, Loader2, ScanLine, X } from 'lucide-react';
import { lookupByBarcode, ProductInfo, scoreColor } from '../services/openFoodFactsService';

interface Props {
  open: boolean;
  onClose: () => void;
  onProductFound: (product: ProductInfo) => void;
  onManualCode?: (code: string) => void;
}

// Bruker native BarcodeDetector API der tilgjengelig (Chrome/Edge/Safari 17+).
// Fallback: manuell inntasting av strekkode.
const hasNativeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

export const BarcodeScanner: React.FC<Props> = ({ open, onClose, onProductFound, onManualCode }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // Start kamera + detektor når modalen åpnes
  useEffect(() => {
    if (!open) return;
    let stopped = false;
    const start = async () => {
      setError(null);
      setProduct(null);
      setLastCode(null);
      try {
        if (!hasNativeDetector) {
          setError('Nettleseren støtter ikke barcode-scan. Bruk manuell inntasting under.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        detectorRef.current = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
        });
        setScanning(true);

        const loop = async () => {
          if (stopped || !videoRef.current || !detectorRef.current) return;
          try {
            const codes = await detectorRef.current.detect(videoRef.current);
            if (codes && codes.length > 0) {
              const code = codes[0].rawValue as string;
              if (code && code !== lastCode) {
                setLastCode(code);
                setScanning(false);
                await handleCode(code);
                return; // stopp løkken til bruker gjør nytt scan
              }
            }
          } catch { /* ignorer per-frame-feil */ }
          if (!stopped) requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      } catch (e: any) {
        setError(e?.message?.includes('Permission') ? 'Kamera-tilgang avvist. Tillat kamera i nettleseren og prøv igjen.' : (e?.message || 'Klarte ikke starte kamera.'));
      }
    };
    start();
    return () => {
      stopped = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      detectorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCode = async (code: string) => {
    setLoadingLookup(true);
    try {
      const p = await lookupByBarcode(code);
      if (p) {
        setProduct(p);
      } else {
        setError(`Fant ikke strekkode ${code} i Open Food Facts. Legg til manuelt.`);
        onManualCode?.(code);
      }
    } finally { setLoadingLookup(false); }
  };

  const handleAdd = () => {
    if (product) onProductFound(product);
    onClose();
  };

  const handleScanAgain = () => {
    setProduct(null);
    setLastCode(null);
    setError(null);
    setScanning(true);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/90" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700"><ScanLine className="h-5 w-5" /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Skann strekkode</h2>
              <p className="text-xs text-slate-500">Pek kamera mot EAN/UPC-koden på produktet</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-1.5 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex gap-2"><AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><p>{error}</p></div>}

          {!product && !loadingLookup && (
            <div className="relative overflow-hidden rounded-2xl bg-slate-900 aspect-video">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              {scanning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-64 h-32 border-4 border-emerald-400/70 rounded-2xl shadow-[0_0_40px_rgba(52,211,153,0.5)] animate-pulse" />
                </div>
              )}
              {lastCode && !product && !loadingLookup && (
                <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-white/95 p-2 text-xs font-mono">Kode: {lastCode}</div>
              )}
            </div>
          )}

          {loadingLookup && (
            <div className="flex items-center justify-center gap-3 p-8 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Slår opp {lastCode}...
            </div>
          )}

          {product && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="flex gap-3">
                {product.imageUrl ? (
                  <img src={product.imageSmallUrl || product.imageUrl} alt={product.name} className="h-24 w-24 rounded-2xl object-cover border border-slate-200" />
                ) : (
                  <div className="h-24 w-24 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400"><ScanLine className="h-8 w-8" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-black text-slate-900 text-lg">{product.name}</p>
                  {product.brand && <p className="text-sm text-slate-600">{product.brand}</p>}
                  {product.quantity && <p className="text-xs text-slate-500 mt-0.5">{product.quantity}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {product.nutriScore && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase text-white" style={{ background: scoreColor(product.nutriScore) }}>
                        Nutri-Score {product.nutriScore.toUpperCase()}
                      </span>
                    )}
                    {product.ecoScore && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase text-white" style={{ background: scoreColor(product.ecoScore) }}>
                        Eco {product.ecoScore.toUpperCase()}
                      </span>
                    )}
                    {product.novaGroup && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${product.novaGroup === 4 ? 'bg-rose-100 text-rose-800' : product.novaGroup === 3 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        NOVA {product.novaGroup} {product.novaGroup === 4 ? '(ultraprosessert)' : product.novaGroup === 1 ? '(uprosessert)' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {product.allergens && product.allergens.length > 0 && (
                <p className="text-xs text-rose-700"><span className="font-bold">Allergener:</span> {product.allergens.slice(0, 5).join(', ')}</p>
              )}
              <div className="flex gap-2">
                <button onClick={handleAdd} className="btn-primary flex-1 justify-center"><Camera className="h-4 w-4" /> Legg til handleliste</button>
                <button onClick={handleScanAgain} className="btn-secondary">Skann ny</button>
              </div>
            </div>
          )}

          {/* Manuell strekkode */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-600 mb-2">Manuell strekkode</p>
            <div className="flex gap-2">
              <input value={manualCode} onChange={e => setManualCode(e.target.value)} placeholder="F.eks. 8410100033747" className="flex-1 text-sm" inputMode="numeric" />
              <button
                onClick={() => { if (manualCode.length >= 8) handleCode(manualCode); }}
                disabled={manualCode.length < 8 || loadingLookup}
                className="btn-primary text-xs"
              >Slå opp</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
