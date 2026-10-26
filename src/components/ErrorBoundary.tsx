import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  viewName?: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  viewName?: string;
  /** If true, will attempt to purge corrupt Produksi data and reload */
  autoPurgeTable?: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error in', this.props.viewName, error, info);
  }

  handleRecovery = () => {
    if (this.props.autoPurgeTable) {
      try {
        // Purge corrupt rows from the given table
        const key = `airis_db_${this.props.autoPurgeTable}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed: any[] = JSON.parse(raw);
          // Keep only rows that have a valid Tanggal and positive numeric Jumlah
          const cleaned = parsed.filter((row: any) => {
            if (!row || typeof row !== 'object') return false;
            if (row.Jumlah !== undefined) {
              const qty = Number(row.Jumlah);
              if (isNaN(qty) || qty < 0) return false;
            }
            if (row.Tanggal !== undefined) {
              const str = String(row.Tanggal);
              // Accept YYYY-MM-DD or empty string (might be a planning item)
              if (str && !/^\d{4}-\d{2}-\d{2}/.test(str)) return false;
            }
            return true;
          });
          localStorage.setItem(key, JSON.stringify(cleaned));
          console.info(`[ErrorBoundary] Cleaned ${parsed.length - cleaned.length} corrupt rows from ${this.props.autoPurgeTable}`);
        }
      } catch (e) {
        console.warn('[ErrorBoundary] Could not purge table', e);
      }
    }
    this.setState({ hasError: false, error: null });
  };

  handleHardReset = () => {
    if (this.props.autoPurgeTable) {
      const key = `airis_db_${this.props.autoPurgeTable}`;
      localStorage.removeItem(key);
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 gap-6 bg-red-50 rounded-2xl border border-red-200 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-red-900 mb-1">
              Terjadi Kesalahan{this.props.viewName ? ` di ${this.props.viewName}` : ''}
            </h3>
            <p className="text-sm text-red-700 mb-2">
              Data yang diimport mungkin mengandung format tidak valid (tanggal, angka, atau kolom yang tidak sesuai).
            </p>
            {this.state.error && (
              <code className="block text-xs bg-red-100 text-red-800 rounded-lg px-3 py-2 text-left max-w-lg mx-auto break-all">
                {this.state.error.message}
              </code>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={this.handleRecovery}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow transition cursor-pointer"
            >
              🔧 Bersihkan Data Rusak & Muat Ulang
            </button>
            <button
              onClick={this.handleHardReset}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow transition cursor-pointer"
            >
              🗑️ Reset Data Produksi (Hapus Semua Import)
            </button>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white font-semibold rounded-xl shadow transition cursor-pointer"
            >
              ← Coba Kembali
            </button>
          </div>
          <p className="text-xs text-red-500">
            Setelah menekan tombol di atas, data import yang bermasalah akan dihapus. Silakan import ulang menggunakan template yang disediakan.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
