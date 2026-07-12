import { QRCodeSVG } from 'qrcode.react';

interface QRCodePanelProps {
  url?: string;
}

/**
 * QR Code Panel - Desktop only
 * Displays a QR code for mobile users to scan and open the app
 */
export function QRCodePanel({ url }: QRCodePanelProps) {
  const qrUrl = url || window.location.href;

  return (
    <div className="hidden md:flex flex-col items-center justify-center gap-6 bg-darkroom p-8 sticky top-0 h-screen">
      <div className="bg-paper p-8 rounded-2xl shadow-2xl">
        <QRCodeSVG
          value={qrUrl}
          size={256}
          level="H"
        />
      </div>
      <p className="font-mono text-[10px] tracking-[.22em] uppercase text-paper-dim">
        Scan to add or browse photos
      </p>
    </div>
  );
}
