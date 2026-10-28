import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  viewName?: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  viewName?: string;
  /** If specified, will attempt to purge corrupt data for the table and reload */
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
        const keys = [
          `AIRIS_ENTERPRISE_${this.props.autoPurgeTable}`,
          `airis_db_${this.props.autoPurgeTable}`
        ];
        for (const key of keys) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed: any[] = JSON.parse(raw);
            const cleaned = parsed.filter((row: any) => {
              if (!row || typeof row !== 'object') return false;
              if (row.Jumlah !== undefined) {
                const qty = Number(row.Jumlah);
                if (isNaN(qty) || qty < 0) return false;
              }
              if (row.Tanggal !== undefined) {
                const str = String(row.Tanggal);
                if (str && !/^\d{4}-\d{2}-\d{2}/.test(str)) return false;
              }
              return true;
            });
            localStorage.setItem(key, JSON.stringify(cleaned));
          }
        }
      } catch (e) {
        console.warn('[ErrorBoundary] Could not purge table', e);
      }
    }
    window.location.reload();
  };

  handleHardReset = () => {
    if (this.props.autoPurgeTable) {
      localStorage.removeItem(`AIRIS_ENTERPRISE_${this.props.autoPurgeTable}`);
      localStorage.removeItem(`airis_db_${this.props.autoPurgeTable}`);
    }
    window.location.reload();
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const targetName = this.props.viewName || 'Modul';
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 gap-6 bg-red-50 rounded-2xl border border-red-200 text-center my-4 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center shadow-inner">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-red-900 mb-1">
              Terjadi Kesalahan di {targetName}
            </h3>
            <p className="text-sm text-red-700 mb-2">
              Terjadi kendala pada rendering data modul ini. Anda dapat memuat ulang halaman atau membersihkan cache data yang bermasalah.
            </p>
            {this.state.error && (
              <code className="block text-xs font-mono bg-red-100 text-red-800 rounded-lg px-3 py-2 text-left max-w-lg mx-auto break-all border border-red-200">
                {this.state.error.message}
              </code>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={this.handleReload}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow transition cursor-pointer active:scale-95"
            >
              🔄 Muat Ulang Halaman
            </button>
            {this.props.autoPurgeTable && (
              <>
                <button
                  onClick={this.handleRecovery}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl shadow transition cursor-pointer active:scale-95"
                >
                  🔧 Bersihkan Data Rusak & Refresh
                </button>
                <button
                  onClick={this.handleHardReset}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl shadow transition cursor-pointer active:scale-95"
                >
                  🗑️ Reset Data {targetName}
                </button>
              </>
            )}
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2.5 bg-slate-600 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl shadow transition cursor-pointer active:scale-95"
            >
              ← Coba Render Ulang
            </button>
          </div>
          <p className="text-xs text-red-500 max-w-md">
            Jika error masih berlanjut setelah muat ulang, periksa koneksi internet atau gunakan tombol Muat Ulang Halaman untuk mereset memori browser.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
