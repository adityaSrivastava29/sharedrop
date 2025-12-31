import { useNavigate } from 'react-router-dom';
import { Upload, Download, Zap, Shield, Globe } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { ConnectionCard } from '../components/ConnectionCard';

export function HomePage() {
  const navigate = useNavigate();
  
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        {/* Hero Section */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">Share Files</span>
            <br />
            <span className="text-surface-100">Instantly</span>
          </h1>
          <p className="text-surface-400 text-lg max-w-md mx-auto">
            Send files directly between devices. No cloud storage, no size limits, 
            just fast peer-to-peer transfers.
          </p>
        </div>
        
        {/* Action Cards */}
        <div className="w-full max-w-2xl grid md:grid-cols-2 gap-4 animate-slide-up">
          <ConnectionCard
            title="Send Files"
            description="Share files with another device"
            icon={<Upload className="w-7 h-7 text-white" />}
            onClick={() => navigate('/send')}
            variant="send"
          />
          
          <ConnectionCard
            title="Receive Files"
            description="Get files from another device"
            icon={<Download className="w-7 h-7 text-white" />}
            onClick={() => navigate('/receive')}
            variant="receive"
          />
        </div>
        
        {/* Features */}
        <div className="mt-16 grid grid-cols-3 gap-8 text-center max-w-lg animate-fade-in">
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center mx-auto">
              <Zap className="w-6 h-6 text-primary-400" />
            </div>
            <p className="text-surface-300 text-sm font-medium">Lightning Fast</p>
          </div>
          
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-xl bg-success-500/20 flex items-center justify-center mx-auto">
              <Shield className="w-6 h-6 text-success-400" />
            </div>
            <p className="text-surface-300 text-sm font-medium">Secure P2P</p>
          </div>
          
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-xl bg-secondary-500/20 flex items-center justify-center mx-auto">
              <Globe className="w-6 h-6 text-secondary-400" />
            </div>
            <p className="text-surface-300 text-sm font-medium">Cross Platform</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
