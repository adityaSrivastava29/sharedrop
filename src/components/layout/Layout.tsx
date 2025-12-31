import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Share2, ArrowLeft } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  showBack?: boolean;
  title?: string;
}

export function Layout({ children, showBack = false, title }: LayoutProps) {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass-light sticky top-0 z-40 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBack ? (
              <button
                onClick={() => navigate('/')}
                className="p-2 rounded-lg hover:bg-surface-800 transition-colors"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5 text-surface-300" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center glow-sm">
                  <Share2 className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold gradient-text">ShareDrop</span>
              </div>
            )}
            
            {title && (
              <h1 className="text-lg font-semibold text-surface-100 ml-2">{title}</h1>
            )}
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 px-4 py-6">
        <div className="max-w-4xl mx-auto">
          {children}
        </div>
      </main>
      
      {/* Footer */}
      <footer className="py-4 text-center text-surface-500 text-sm">
        <p>Secure peer-to-peer file sharing</p>
      </footer>
    </div>
  );
}
