
import React, { useRef, useState, useEffect } from 'react';
import { CyberButton } from './CyberButton';
import { Camera, RefreshCw, Check, AlertCircle, Library, Scan, Trash2, Calendar, FileText, ExternalLink, BrainCircuit } from 'lucide-react';
import { analyzeReceipt } from '../services/geminiService';
import { ScannedReceipt, Currency } from '../types';

interface Props {
  receipts: ScannedReceipt[];
  onScan: (data: any, imageUrl: string) => void;
}

const formatCurrency = (amount: number, currency: Currency) => {
  const symbol = currency === 'NOK' ? 'kr' : '€';
  return `${symbol} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

export const ReceiptScanner: React.FC<Props> = ({ receipts, onScan }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'scanner' | 'archive'>('scanner');

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      setCapturedImage(null);
      setError(null);
    } catch (err) {
      setError("Kunne ikke få tilgang til kameraet.");
    }
  };

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        stream?.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }
  };

  const processImage = async () => {
    if (!capturedImage) return;
    setScanning(true);
    try {
      const base64 = capturedImage.split(',')[1];
      const result = await analyzeReceipt(base64);
      onScan(result, capturedImage);
      setView('archive');
    } catch (err) {
      setError("AI-analyse feilet. Prøv igjen.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* TABS VELGER */}
      <div className="flex gap-4 border-b border-white/10 pb-4 overflow-x-auto no-scrollbar">
        {[
          { id: 'scanner', label: 'Scanner', icon: <Scan className="w-4 h-4" /> },
          { id: 'archive', label: 'Digitalt Arkiv', icon: <Library className="w-4 h-4" /> },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setView(t.id as any)}
            className={`flex items-center gap-2 px-6 py-2 text-xs font-black uppercase tracking-widest transition-all shrink-0 ${
              view === t.id ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {view === 'scanner' && (
        <div className="glass-panel p-8 border-l-4 border-l-cyan-500 animate-in fade-in duration-500">
           <h2 className="text-xl font-bold mb-8 flex items-center gap-3">
            <Camera className="text-cyan-400" /> NY KVITTERINGSSCAN
          </h2>

          <div className="relative aspect-[3/4] max-w-sm mx-auto bg-black border border-cyan-500/30 overflow-hidden mb-8 shadow-[0_0_30px_rgba(0,243,255,0.1)]">
            {!stream && !capturedImage && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <Scan className="w-16 h-16 text-cyan-500/20 mb-6 animate-pulse" />
                <CyberButton onClick={startCamera}>Aktiver Optikk</CyberButton>
              </div>
            )}

            {stream && (
              <>
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute inset-0 pointer-events-none border-[30px] border-black/50">
                   <div className="w-full h-0.5 bg-cyan-400 shadow-[0_0_15px_#00f3ff] animate-bounce opacity-50"></div>
                </div>
              </>
            )}

            {capturedImage && (
              <img src={capturedImage} className="w-full h-full object-contain" alt="Captured" />
            )}

            {scanning && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
                <RefreshCw className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
                <p className="text-cyan-400 uppercase tracking-[0.3em] text-xs font-black animate-pulse text-center px-6">
                  Dekrypterer kvitteringsdata via Neural Engine...
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-center gap-4">
            {stream && <CyberButton onClick={capture}>Ta Bilde</CyberButton>}
            {capturedImage && !scanning && (
              <>
                <CyberButton onClick={startCamera} variant="ghost">Prøv på nytt</CyberButton>
                <CyberButton onClick={processImage} variant="primary">Analyser & Arkiver</CyberButton>
              </>
            )}
          </div>
        </div>
      )}

      {view === 'archive' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
           {receipts.length === 0 ? (
             <div className="glass-panel p-20 text-center border-2 border-dashed border-white/5 opacity-30">
                <Library className="w-16 h-16 mx-auto mb-6" />
                <p className="uppercase tracking-[0.4em] text-xs font-black">Arkivet er tomt // Ingen data funnet</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {receipts.map(rcpt => (
                 <div key={rcpt.id} className="glass-panel overflow-hidden border-l-2 border-l-magenta-500 group hover:border-l-4 transition-all bg-magenta-500/5">
                    <div className="aspect-[4/3] relative overflow-hidden bg-black/50">
                       <img src={rcpt.imageUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt={rcpt.vendor} />
                       <div className="absolute top-0 right-0 p-3 bg-black/80 border-b border-l border-magenta-500/30 text-[9px] font-black uppercase text-magenta-400 tracking-widest">
                          {rcpt.category}
                       </div>
                    </div>
                    <div className="p-5 space-y-4">
                       <div className="flex justify-between items-start">
                          <div>
                             <h4 className="text-sm font-black text-white uppercase tracking-tight">{rcpt.vendor}</h4>
                             <p className="text-[9px] text-slate-500 font-mono mt-1">{rcpt.date}</p>
                          </div>
                          <p className="text-lg font-black text-white font-mono">{formatCurrency(rcpt.amount, rcpt.currency)}</p>
                       </div>
                       
                       <div className="p-3 bg-black/40 border border-white/5 space-y-2">
                          <div className="flex items-center gap-2 mb-1">
                             <BrainCircuit className="w-3 h-3 text-magenta-500" />
                             <span className="text-[8px] font-black text-magenta-400 uppercase tracking-widest">AI Extraction Summary</span>
                          </div>
                          <div className="flex justify-between text-[9px] uppercase font-bold">
                             <span className="text-slate-500">Confidence Score</span>
                             <span className="text-emerald-400">{(rcpt.confidence * 100).toFixed(0)}%</span>
                          </div>
                          <div className="flex justify-between text-[9px] uppercase font-bold">
                             <span className="text-slate-500">Status</span>
                             <span className="text-cyan-400">Transaksjon Opprettet</span>
                          </div>
                       </div>

                       <div className="flex justify-between pt-2 border-t border-white/5">
                          <button className="text-[9px] font-black uppercase text-slate-500 hover:text-white transition-colors flex items-center gap-1">
                             <FileText className="w-3 h-3" /> Detaljer
                          </button>
                          <button className="text-[9px] font-black uppercase text-rose-500/50 hover:text-rose-500 transition-colors flex items-center gap-1">
                             <Trash2 className="w-3 h-3" /> Fjern
                          </button>
                       </div>
                    </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      )}
    </div>
  );
};
