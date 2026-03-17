import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check } from 'lucide-react';

interface QRGeneratorProps {
  value: string;
}

export function QRGenerator({ value }: QRGeneratorProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="qr-container">
        <QRCodeSVG value={value} size={200} level="M" />
      </div>

      <button
        onClick={handleCopy}
        className="flex items-center gap-2 px-4 py-2 rounded-lg glass hover:bg-surface-700/50 transition-colors text-sm"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-success-400" />
            <span className="text-success-400">Copied!</span>
          </>
        ) : (
          <>
            <Copy className="w-4 h-4 text-surface-300" />
            <span className="text-surface-300">Copy link</span>
          </>
        )}
      </button>

      <p className="text-surface-500 text-xs text-center max-w-[250px] break-all font-mono">
        {value}
      </p>
    </div>
  );
}
