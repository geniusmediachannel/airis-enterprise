import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { DashboardView } from './components/DashboardView';
import { MasterDataView } from './components/MasterDataView';
import { ProductionView } from './components/ProductionView';
import { DistributionView } from './components/DistributionView';
import { StockView } from './components/StockView';
import { QCView } from './components/QCView';
import { FinanceView } from './components/FinanceView';
import { HRDView } from './components/HRDView';
import { AdminDocsView } from './components/AdminDocsView';
import { SupabaseModal } from './components/SupabaseModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { AppSettingsModal } from './components/AppSettingsModal';
import { NotificationDrawer } from './components/NotificationDrawer';
import { ToastContainer, showToast } from './components/ToastContainer';
import { ConfirmDialog, confirmAction } from './components/ConfirmDialog';
import { AuthModal } from './components/AuthModal';
import { LoginPage } from './components/LoginPage';
import { AccessLogView } from './components/AccessLogView';
import { LicenseLockScreen } from './components/LicenseLockScreen';
import { HyperAdminModal } from './components/HyperAdminModal';
import { LicenseTransferModal } from './components/LicenseTransferModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { 
  canAccessMenu, canEditModule, getAuthorizedRolesForModule, getDefaultViewForRole,
  isHyperAdmin
} from './services/permissionService';
import { checkLicenseStatus } from './services/licenseService';
import { Eye, Lock, ShieldCheck } from 'lucide-react';

import { 
  initializeDatabase, getTableData, saveTableData, getSupabaseConfig, saveSupabaseConfig,
  syncAllTablesFromSupabase, setupSupabaseRealtimeSync
} from './services/dbAdapter';
import { syncAllModulesToFinance } from './services/financeSyncService';
import { checkAndApplyScheduledPriceChanges } from './services/priceService';
import { 
  getStoredSession, signOut 
} from './services/supabaseAuth';
import { 
  getWebPushPermission, requestWebPushPermission, 
  calculateRealtimeNotifications, sendBrowserNotification,
  getReadNotificationIds 
} from './services/notificationService';
import { 
  ProductItem, CustomerItem, SupplierItem, RawMaterialItem, 
  BOMItem, EmployeeItem, UserAccount, SPKItem, ProductionItem, 
  DistributionItem, DistributionProductDetail, RawMaterialPurchase, 
  RawMaterialMutation, QCHeader, QCDetailCycle, AttendanceRecord, 
  OvertimeRecord, KasbonRecord, PayrollHistoryItem, COAItem, 
  GeneralJournalItem, DraftJournalItem, FixedAssetItem, 
  ReceivablePayableItem, SpecialPriceItem, SupabaseConfig, NotificationItem,
  OfficialLetterItem, DeliveryPlanItem, AuthSession
} from './types';
import { ExcelTemplateType } from './services/excelService';

export default function App() {
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(getSupabaseConfig());
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(getWebPushPermission());

  // Mobile responsive drawer
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modals
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelImportDefaultModule, setExcelImportDefaultModule] = useState<ExcelTemplateType>('produk');
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHyperAdminModal, setShowHyperAdminModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Status Lisensi & Masa Aktif Aplikasi (AIRIS App License)
  const [licenseStatus, setLicenseStatus] = useState(() => checkLicenseStatus());

  // Current logged in auth session
  const [session, setSession] = useState<AuthSession>(() => getStoredSession());
  const currentUser = session.user;

  // App State collections
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterialItem[]>([]);
  const [boms, setBoms] = useState<BOMItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [specialPrices, setSpecialPrices] = useState<SpecialPriceItem[]>([]);
  const [spks, setSpks] = useState<SPKItem[]>([]);
  const [productions, setProductions] = useState<ProductionItem[]>([]);
  const [distributions, setDistributions] = useState<DistributionItem[]>([]);
  const [distributionItems, setDistributionItems] = useState<DistributionProductDetail[]>([]);
  const [purchases, setPurchases] = useState<RawMaterialPurchase[]>([]);
  const [mutations, setMutations] = useState<RawMaterialMutation[]>([]);
  const [qcHeaders, setQcHeaders] = useState<QCHeader[]>([]);
  const [qcDetails, setQcDetails] = useState<QCDetailCycle[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [overtimes, setOvertimes] = useState<OvertimeRecord[]>([]);
  const [kasbons, setKasbons] = useState<KasbonRecord[]>([]);
  const [payrollHistory, setPayrollHistory] = useState<PayrollHistoryItem[]>([]);
  const [coas, setCoas] = useState<COAItem[]>([]);
  const [journals, setJournals] = useState<GeneralJournalItem[]>([]);
  const [draftJournals, setDraftJournals] = useState<DraftJournalItem[]>([]);
  const [assets, setAssets] = useState<FixedAssetItem[]>([]);
  const [receivables, setReceivables] = useState<ReceivablePayableItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // ── Sanitize Produksi table on load ──────────────────────────────────────
  // Converts non-string Tanggal (e.g. Excel numeric serial) to ISO date string,
  // and removes rows that are completely invalid, so views never crash.
  const sanitizeProductionsInStorage = () => {
    try {
      const raw = getTableData<any>('Produksi', []);
      let changed = false;
      const cleaned = raw.map((p: any) => {
        if (!p || typeof p !== 'object') { changed = true; return null; }
        let tgl = p.Tanggal;
        // Excel serial number (e.g. 45678) → convert to ISO
        if (typeof tgl === 'number' && tgl > 1000) {
          const d = new Date(Date.UTC(1899, 11, 30) + tgl * 86400000);
          tgl = d.toISOString().slice(0, 10);
          changed = true;
        } else if (tgl !== undefined && typeof tgl !== 'string') {
          tgl = String(tgl);
          changed = true;
        }
        const qty = Number(p.Jumlah);
        const cleanedQty = isNaN(qty) ? 0 : Math.round(qty);
        if (cleanedQty !== p.Jumlah) changed = true;
        return { ...p, Tanggal: tgl, Jumlah: cleanedQty };
      }).filter(Boolean);
      if (changed) {
        saveTableData('Produksi', cleaned);
      }
    } catch (e) {
      console.warn('[App] Could not sanitize Produksi table', e);
    }
  };

  // Reload all state from adapter
  const reloadData = () => {
    sanitizeProductionsInStorage();
    // Otomatis cek dan terapkan perubahan harga terjadwal (Bahan Penolong & Produk)
    checkAndApplyScheduledPriceChanges();
    // Auto-sync operational modules into Keuangan (Jurnal, Piutang, HPP)
    syncAllModulesToFinance({ autoPostToGeneralJournal: true });

    setProducts(getTableData<ProductItem>('MD_Produk', []));
    setCustomers(getTableData<CustomerItem>('MD_Pelanggan', []));
    setSuppliers(getTableData<SupplierItem>('MD_Supplier', []));
    setRawMaterials(getTableData<RawMaterialItem>('MD_BahanPenolong', []));
    setBoms(getTableData<BOMItem>('MD_BOM', []));
    setEmployees(getTableData<EmployeeItem>('MD_Karyawan', []));
    setUsers(getTableData<UserAccount>('MD_UserAkses', []));
    setSpecialPrices(getTableData<SpecialPriceItem>('MD_HargaKhusus', []));
    setSpks(getTableData<SPKItem>('SPK', []));
    setProductions(getTableData<ProductionItem>('Produksi', []));
    setDistributions(getTableData<DistributionItem>('Distribusi', []));
    setDistributionItems(getTableData<DistributionProductDetail>('Distribusi_Item', []));
    setPurchases(getTableData<RawMaterialPurchase>('Pembelian_Bahan', []));
    setMutations(getTableData<RawMaterialMutation>('Mutasi_Bahan', []));
    setQcHeaders(getTableData<QCHeader>('Data_QC', []));
    setQcDetails(getTableData<QCDetailCycle>('Data_QC_Detail', []));
    setAttendances(getTableData<AttendanceRecord>('Data_Presensi', []));
    setOvertimes(getTableData<OvertimeRecord>('Data_Lembur', []));
    setKasbons(getTableData<KasbonRecord>('Data_Kasbon', []));
    setPayrollHistory(getTableData<PayrollHistoryItem>('Histori_Penggajian', []));
    setCoas(getTableData<COAItem>('Master_COA', []));
    setJournals(getTableData<GeneralJournalItem>('Jurnal_Umum', []));
    setDraftJournals(getTableData<DraftJournalItem>('Draf_Jurnal', []));
    setAssets(getTableData<FixedAssetItem>('Data_Aset_Tetap', []));
    setReceivables(getTableData<ReceivablePayableItem>('Data_Piutang_Utang', []));
    
    const notifs = calculateRealtimeNotifications();
    setNotifications(notifs);
  };

  useEffect(() => {
    // 0. Recovery helper accessible from browser console
    // Usage: window.__AIRIS_RECOVER_PRODUKSI__()
    (window as any).__AIRIS_RECOVER_PRODUKSI__ = () => {
      localStorage.removeItem('AIRIS_ENTERPRISE_Produksi');
      console.info('[AIRIS Recovery] Tabel Produksi dihapus. Halaman akan dimuat ulang...');
      window.location.reload();
    };

    // 1. Initialize seed data
    initializeDatabase();

    // 1b. Apply saved theme & compact mode
    const savedTheme = localStorage.getItem('airis_theme') || 'light';
    const isDark = savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    if (localStorage.getItem('airis_compact') === 'true') {
      document.documentElement.classList.add('compact-mode');
    } else {
      document.documentElement.classList.remove('compact-mode');
    }

    // 2. Load data
    reloadData();

    // 3. Listen for internal DB updates
    const handleDbUpdate = () => {
      reloadData();
    };
    window.addEventListener('airis_db_updated', handleDbUpdate);

    // 4. Listen for Auth session changes
    const handleAuthChange = (e: any) => {
      if (e.detail?.session) {
        setSession(e.detail.session);
      } else if (e.detail?.user) {
        setSession({
          user: e.detail.user,
          isAuthenticated: true,
          isSupabaseAuth: false
        });
      } else {
        setSession(getStoredSession());
      }
    };
    window.addEventListener('airis_auth_changed', handleAuthChange);

    // 5. Listen for notification state changes (read/unread toggles)
    const handleNotifsUpdate = () => {
      const readSet = getReadNotificationIds();
      setNotifications(prev => prev.map(n => readSet.has(n.id) ? { ...n, read: true } : n));
    };
    window.addEventListener('airis_notifications_updated', handleNotifsUpdate);

    // 6. Periodic check for push notifications (every 30 seconds)
    const interval = setInterval(() => {
      const activeNotifs = calculateRealtimeNotifications();
      setNotifications(activeNotifs);
      const criticalNotif = activeNotifs.find(n => n.type === 'kritis');
      if (criticalNotif && pushPermission === 'granted') {
        sendBrowserNotification(criticalNotif.title, { body: criticalNotif.message });
      }
    }, 30000);

    // 7. Auto Cloud Sync & Realtime Multi-Device Sync
    const cfg = getSupabaseConfig();
    if (cfg.isConnected && cfg.url && cfg.anonKey) {
      // Pull seluruh data terbaru saat aplikasi dibuka
      syncAllTablesFromSupabase({ silent: true })
        .then(res => {
          if (res.success) {
            reloadData();
            setLicenseStatus(checkLicenseStatus());
          }
        })
        .catch(console.warn);

      // Aktifkan Realtime Listener agar device/browser lain langsung sinkron seketika
      setupSupabaseRealtimeSync(() => {
        reloadData();
      });
    }

    // Auto-sync saat tab browser aktif kembali (focus)
    const handleWindowFocus = () => {
      const curCfg = getSupabaseConfig();
      if (curCfg.isConnected && curCfg.url && curCfg.anonKey) {
        syncAllTablesFromSupabase({ silent: true })
          .then(res => {
            if (res.success) {
              reloadData();
              setLicenseStatus(checkLicenseStatus());
            }
          })
          .catch(console.warn);
      }
    };
    window.addEventListener('focus', handleWindowFocus);

    // Event listener saat terjadi sinkronisasi cloud
    const handleCloudSynced = () => {
      reloadData();
      setLicenseStatus(checkLicenseStatus());
    };
    window.addEventListener('airis_cloud_synced', handleCloudSynced);

    // Event listener saat lisensi diperbarui
    const handleLicenseUpdated = () => {
      setLicenseStatus(checkLicenseStatus());
    };
    window.addEventListener('airis_license_updated', handleLicenseUpdated);

    return () => {
      window.removeEventListener('airis_db_updated', handleDbUpdate);
      window.removeEventListener('airis_auth_changed', handleAuthChange);
      window.removeEventListener('airis_notifications_updated', handleNotifsUpdate);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('airis_cloud_synced', handleCloudSynced);
      window.removeEventListener('airis_license_updated', handleLicenseUpdated);
      clearInterval(interval);
    };
  }, [pushPermission]);

  // Deteksi apakah pengguna memiliki wewenang untuk MENGERJAKAN (input, edit, hapus) di modul saat ini
  // Mendukung multi-role: jika karyawan merangkap beberapa divisi, hak aksesnya digabungkan!
  const isWritable = useMemo(() => {
    return canEditModule(currentUser, currentView);
  }, [currentUser, currentView]);

  const handleRequestPush = async () => {
    const res = await requestWebPushPermission();
    setPushPermission(res);
  };

  const handleLogout = async () => {
    const ok = await confirmAction({
      title: 'Konfirmasi Keluar Akun',
      message: `Apakah Anda yakin ingin keluar dari sistem AIRIS Enterprise (${currentUser?.Nama || currentUser?.Username || 'Pengguna'})?`,
      confirmText: 'Ya, Keluar Akun',
      cancelText: 'Batal',
      type: 'warning'
    });
    if (!ok) return;

    await signOut(currentUser || undefined);
    setSession({ user: null, isAuthenticated: false, isSupabaseAuth: false });
    showToast('Sampai Jumpa', 'Anda telah berhasil keluar dari sistem.', 'info');
  };

  const handleOpenImportForModule = (moduleKey: ExcelTemplateType) => {
    if (!isWritable) {
      showToast(
        'Mode Lihat Saja',
        `Hak akses ${currentUser?.Role} hanya diizinkan melihat data pada menu ini. Import data dikhususkan untuk ${getAuthorizedRolesForModule(currentView)}.`,
        'warning'
      );
      return;
    }
    setExcelImportDefaultModule(moduleKey);
    setShowExcelModal(true);
  };

  // Interceptor klik cerdas: Mencegah aksi modifikasi data jika user hanya memiliki hak lihat saja
  const handleReadOnlyClickCapture = (e: React.MouseEvent) => {
    if (isWritable || currentView === 'dashboard') return;

    const target = e.target as HTMLElement | null;
    if (!target) return;

    const actionButton = target.closest('button, [role="button"]') as HTMLElement | null;
    if (!actionButton) return;

    const text = (actionButton.textContent || '').trim().toLowerCase();
    const title = (actionButton.title || '').toLowerCase();
    const aria = (actionButton.getAttribute('aria-label') || '').toLowerCase();
    const combined = `${text} ${title} ${aria}`;

    // Aksi yang tetap diizinkan saat read-only (navigasi, tab, search, filter, export, print)
    const isSafeReadOnlyAction = 
      actionButton.closest('nav') ||
      actionButton.closest('[role="tablist"]') ||
      actionButton.dataset.allowReadonly === 'true' ||
      combined.includes('ekspor') ||
      combined.includes('export') ||
      (combined.includes('excel') && !combined.includes('import') && !combined.includes('impor')) ||
      combined.includes('pdf') ||
      combined.includes('cetak') ||
      combined.includes('print') ||
      combined.includes('filter') ||
      combined.includes('cari') ||
      combined.includes('search') ||
      combined.includes('tutup') ||
      combined.includes('batal') ||
      combined.includes('close') ||
      combined.includes('refresh') ||
      combined.includes('tab') ||
      combined.includes('rincian') ||
      combined.includes('detail') ||
      combined.includes('lihat');

    // Aksi penambahan, pengubahan, atau penghapusan data
    const isMutationAction = 
      combined.includes('tambah') ||
      combined.includes('buat') ||
      combined.includes('simpan') ||
      combined.includes('save') ||
      combined.includes('edit') ||
      combined.includes('ubah') ||
      combined.includes('hapus') ||
      combined.includes('delete') ||
      combined.includes('import') ||
      combined.includes('impor') ||
      combined.includes('pulihkan') ||
      combined.includes('posting') ||
      combined.includes('proses') ||
      combined.includes('verifikasi') ||
      combined.includes('selesai') ||
      Boolean(actionButton.querySelector('svg.lucide-plus, svg.lucide-trash, svg.lucide-trash-2, svg.lucide-edit, svg.lucide-edit-2, svg.lucide-edit-3, svg.lucide-save'));

    if (isMutationAction && !isSafeReadOnlyAction) {
      e.preventDefault();
      e.stopPropagation();
      showToast(
        'Mode Lihat Saja (Read-Only)',
        `Hak akses ${currentUser?.Role} hanya diizinkan melihat data pada menu ini. Perubahan data dikhususkan untuk ${getAuthorizedRolesForModule(currentView)}.`,
        'warning'
      );
    }
  };

  // Badge counts for sidebar
  const badgeCounts = useMemo(() => ({
    spk: spks.filter(s => s.Status !== 'Selesai' && s.Status !== 'Diproses').length,
    produksi: productions.filter(p => !p.Jumlah || p.Jumlah === 0).length,
    kritis: notifications.filter(n => n.type === 'kritis').length,
    qc: notifications.filter(n => n.type === 'qc').length,
    keuangan: draftJournals.filter(d => d.Status === 'Menunggu Verifikasi').length
  }), [spks, productions, notifications, draftJournals]);

  const unreadNotifCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
  const isUserHyper = currentUser ? isHyperAdmin(currentUser) : false;

  // Proteksi Masa Aktif Aplikasi: Jika kedaluwarsa atau dikunci manual, tampilkan Layar Kunci Total
  if (licenseStatus.isExpired && !isUserHyper) {
    return (
      <ErrorBoundary viewName="Sistem Terkunci">
        <LicenseLockScreen
          licenseStatus={licenseStatus}
          onHyperAdminUnlock={(hyperUser) => {
            const newSession: AuthSession = {
              user: hyperUser,
              isAuthenticated: true,
              isSupabaseAuth: false
            };
            setSession(newSession);
            setLicenseStatus(checkLicenseStatus());
            setShowHyperAdminModal(true);
            reloadData();
            showToast('Otorisasi Hyper Admin', 'Selamat datang Hyper Admin. Panel konfigurasi masa aktif telah dibuka.', 'info');
          }}
        />
        <ToastContainer />
      </ErrorBoundary>
    );
  }

  // If user is not authenticated, show modern enterprise login page
  if (!session.isAuthenticated || !currentUser) {
    return (
      <ErrorBoundary viewName="Portal Autentikasi">
        <LoginPage
          onLoginSuccess={(user) => {
            const newSession: AuthSession = {
              user,
              isAuthenticated: true,
              isSupabaseAuth: false
            };
            setSession(newSession);
            const landing = getDefaultViewForRole(user.Role);
            setCurrentView(landing);
            reloadData();
            showToast('Selamat Datang', `Login berhasil sebagai ${user.Nama || user.Username} (${user.Role}).`, 'success');
          }}
        />
        <ToastContainer />
        <ConfirmDialog />
      </ErrorBoundary>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        currentUser={currentUser}
        badgeCounts={badgeCounts}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenHyperAdminModal={() => setShowHyperAdminModal(true)}
        onOpenTransferModal={() => setShowTransferModal(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          currentView={currentView}
          supabaseConfig={supabaseConfig}
          onOpenSupabaseModal={() => setShowSupabaseModal(true)}
          onOpenExcelModal={() => {
            if (!isWritable) {
              showToast(
                'Mode Lihat Saja',
                `Hak akses ${currentUser?.Role} hanya dapat melihat data pada menu ini. Hubungi ${getAuthorizedRolesForModule(currentView)} untuk melakukan perubahan data.`,
                'warning'
              );
              return;
            }
            setExcelImportDefaultModule('produk');
            setShowExcelModal(true);
          }}
          onOpenAuthModal={() => setShowAuthModal(true)}
          onToggleNotificationDrawer={() => setShowNotificationDrawer(!showNotificationDrawer)}
          unreadCount={unreadNotifCount}
          pushPermission={pushPermission}
          onRequestPush={handleRequestPush}
          currentUser={currentUser}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          onLogout={handleLogout}
          onOpenSettings={() => setShowSettingsModal(true)}
          onNavigateToAccessLog={() => setCurrentView('log_akses')}
          onOpenHyperAdminModal={() => setShowHyperAdminModal(true)}
          onOpenTransferModal={() => setShowTransferModal(true)}
        />

        {/* Dynamic View Container dengan Interceptor Proteksi Mode Lihat Saja */}
        <main 
          onClickCapture={handleReadOnlyClickCapture}
          className={`flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 pb-24 lg:pb-6 ${
            !isWritable && currentView !== 'dashboard' ? 'read-only-inspection-mode' : ''
          }`}
        >
          {currentView === 'dashboard' && (
            <ErrorBoundary viewName="Dashboard" autoPurgeTable="Produksi">
              <DashboardView
                products={products}
                productions={productions}
                distributions={distributions}
                distributionItems={distributionItems}
                notifications={notifications}
                journals={journals}
                onNavigateTo={setCurrentView}
              />
            </ErrorBoundary>
          )}

          {(currentView === 'master_data' || currentView === 'master') && (
            <MasterDataView
              products={products}
              customers={customers}
              suppliers={suppliers}
              rawMaterials={rawMaterials}
              boms={boms}
              employees={employees}
              users={users}
              specialPrices={specialPrices}
              onRefresh={reloadData}
              onOpenImport={handleOpenImportForModule}
            />
          )}

          {(currentView === 'produksi' || currentView === 'production') && (
            <ErrorBoundary viewName="Manajemen Produksi" autoPurgeTable="Produksi">
              <ProductionView
                spks={spks}
                productions={productions}
                products={products}
                boms={boms}
                rawMaterials={rawMaterials}
                onRefresh={reloadData}
                onOpenImport={handleOpenImportForModule}
              />
            </ErrorBoundary>
          )}

          {(currentView === 'distribusi' || currentView === 'distribution') && (
            <DistributionView
              distributions={distributions}
              distributionItems={distributionItems}
              products={products}
              customers={customers}
              specialPrices={specialPrices}
              onRefresh={reloadData}
              onOpenImport={handleOpenImportForModule}
            />
          )}

          {(currentView === 'stock' || currentView === 'stok') && (
            <StockView
              products={products}
              productions={productions}
              distributions={distributions}
              distributionItems={distributionItems}
              rawMaterials={rawMaterials}
              purchases={purchases}
              mutations={mutations}
              onRefresh={reloadData}
              onOpenImport={handleOpenImportForModule}
            />
          )}

          {currentView === 'qc' && (
            <QCView
              qcHeaders={qcHeaders}
              qcDetails={qcDetails}
              products={products}
              productions={productions}
              onRefresh={reloadData}
              onOpenImport={handleOpenImportForModule}
            />
          )}

          {(currentView === 'keuangan' || currentView === 'finance') && (
            <FinanceView
              journals={journals}
              coas={coas}
              draftJournals={draftJournals}
              assets={assets}
              receivables={receivables}
              distributions={distributions}
              distributionItems={distributionItems}
              customers={customers}
              purchases={purchases}
              onRefresh={reloadData}
              onOpenImport={handleOpenImportForModule}
            />
          )}

          {currentView === 'hrd' && (
            <HRDView
              employees={employees}
              attendances={attendances}
              overtimes={overtimes}
              kasbons={kasbons}
              payrollHistory={payrollHistory}
              onRefresh={reloadData}
              onOpenImport={handleOpenImportForModule}
            />
          )}

          {(currentView === 'administrasi' || currentView === 'admin') && (
            <AdminDocsView
              suppliers={suppliers}
              rawMaterials={rawMaterials}
              customers={customers}
              distributions={distributions}
              distributionItems={distributionItems}
              products={products}
              onRefresh={reloadData}
              onOpenImport={handleOpenImportForModule}
            />
          )}

          {(currentView === 'log_akses' || currentView === 'access_log') && (
            <ErrorBoundary viewName="Histori Akses Pengguna">
              <AccessLogView
                currentRole={currentUser?.Role}
                onRefresh={reloadData}
              />
            </ErrorBoundary>
          )}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <BottomNav
          currentView={currentView}
          onSelectView={setCurrentView}
          currentUserRole={currentUser?.Role}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          badgeCounts={{
            spk: badgeCounts.spk,
            kritis: badgeCounts.kritis,
            keuangan: badgeCounts.keuangan
          }}
        />
      </div>

      {/* Supabase Config Modal */}
      <SupabaseModal
        isOpen={showSupabaseModal}
        onClose={() => setShowSupabaseModal(false)}
        config={supabaseConfig}
        onConfigSaved={newCfg => {
          saveSupabaseConfig(newCfg);
          setSupabaseConfig(newCfg);
          reloadData();
        }}
        onSyncDatabase={reloadData}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        currentUser={currentUser}
        onLoginSuccess={user => {
          setSession({ user, isAuthenticated: true, isSupabaseAuth: false });
          reloadData();
        }}
      />

      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={showExcelModal}
        defaultModule={excelImportDefaultModule}
        onClose={() => setShowExcelModal(false)}
        onImportCompleted={() => {
          reloadData();
        }}
      />

      {/* Konfigurasi & Pengaturan Sistem Aplikasi Modal */}
      <AppSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        supabaseConfig={supabaseConfig}
        onOpenSupabaseModal={() => setShowSupabaseModal(true)}
        onOpenExcelModal={() => {
          setExcelImportDefaultModule('produk');
          setShowExcelModal(true);
        }}
        onOpenAuthModal={() => setShowAuthModal(true)}
        pushPermission={pushPermission}
        onRequestPush={handleRequestPush}
        currentUser={currentUser}
        onLogout={handleLogout}
        onRefreshData={reloadData}
      />

      {/* Real-time Notification Drawer */}
      <NotificationDrawer
        isOpen={showNotificationDrawer}
        onClose={() => setShowNotificationDrawer(false)}
        notifications={notifications}
        onNavigateTo={setCurrentView}
      />

      {/* Modal Kontrol Hyper Admin (Masa Aktif & Lisensi) */}
      <HyperAdminModal
        isOpen={showHyperAdminModal}
        onClose={() => setShowHyperAdminModal(false)}
        onLicenseUpdated={(newStatus) => {
          setLicenseStatus(newStatus);
          showToast(
            'Masa Aktif Diperbarui',
            `Lisensi aplikasi sekarang berlaku hingga ${newStatus.expiryDateFormatted}.`,
            'success'
          );
        }}
      />

      {/* Modal Dialog Kirim Bukti Transfer Lisensi untuk Seluruh Pengguna */}
      <LicenseTransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        licenseStatus={licenseStatus}
      />

      {/* Floating Interactive Toast System */}
      <ToastContainer />

      {/* Enterprise Confirmation Dialog Modal */}
      <ConfirmDialog />
    </div>
  );
}
