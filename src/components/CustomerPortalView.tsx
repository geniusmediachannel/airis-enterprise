import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShoppingBag, Truck, Receipt, RefreshCw, UserCheck, 
  Plus, Minus, CheckCircle2, Clock, AlertCircle, 
  MapPin, Phone, Mail, Building2, Calendar, FileText, 
  ExternalLink, ArrowRight, ShieldCheck, ChevronRight, 
  Download, Printer, Sparkles, LogOut, Check, X, 
  PackageCheck, AlertTriangle, ArrowLeft, Send, Landmark
} from 'lucide-react';
import { 
  CustomerItem, ProductItem, SpecialPriceItem, DeliveryPlanItem, 
  DistributionItem, UserAccount, ReceivablePayableItem 
} from '../types';
import { getTableData, setTableData, notifyDbChange } from '../services/dbAdapter';
import { showToast } from './ToastContainer';
import { printInvoicePDF, generateInvoicePDF } from '../services/pdfService';

interface CustomerPortalViewProps {
  currentUser: UserAccount;
  onLogout: () => void;
  onSwitchToFactoryAdmin?: () => void;
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  currentUser,
  onLogout,
  onSwitchToFactoryAdmin
}) => {
  // Ambil data pelanggan yang sedang aktif
  const [customers, setCustomers] = useState<CustomerItem[]>(() => getTableData<CustomerItem>('MD_Pelanggan', []));
  const [products, setProducts] = useState<ProductItem[]>(() => getTableData<ProductItem>('MD_Produk', []));
  const [specialPrices, setSpecialPrices] = useState<SpecialPriceItem[]>(() => getTableData<SpecialPriceItem>('MD_HargaKhusus', []));
  const [deliveryPlans, setDeliveryPlans] = useState<DeliveryPlanItem[]>(() => getTableData<DeliveryPlanItem>('Rencana_Distribusi', []));
  const [distributions, setDistributions] = useState<DistributionItem[]>(() => getTableData<DistributionItem>('Distribusi', []));
  const [receivables, setReceivables] = useState<ReceivablePayableItem[]>(() => getTableData<ReceivablePayableItem>('Data_Piutang', []));

  // Tab aktif di Portal Pelanggan
  const [activeTab, setActiveTab] = useState<'katalog' | 'tracking' | 'invoice' | 'galon' | 'profil'>('katalog');

  // Pelanggan yang sedang login
  const currentCustomer: CustomerItem = useMemo(() => {
    // 1. Coba cari berdasarkan ID_Pelanggan di akun
    if (currentUser.ID_Pelanggan) {
      const found = customers.find(c => c.ID_Pelanggan === currentUser.ID_Pelanggan);
      if (found) return found;
    }
    // 2. Coba cari berdasarkan Email
    if (currentUser.Email) {
      const found = customers.find(c => c.Email && c.Email.toLowerCase() === currentUser.Email?.toLowerCase());
      if (found) return found;
    }
    // 3. Fallback ke pelanggan pertama jika dibuka oleh SuperAdmin
    return customers[0] || {
      ID_Pelanggan: 'PLG-0001',
      Nama_Pelanggan: currentUser.Nama || 'Mitra As-Shofaa',
      No_Telp: '081234567890',
      Alamat: 'Klaten, Jawa Tengah',
      Level_Pelanggan: 'Distributor',
      Status: 'Aktif',
      Email: currentUser.Email || 'mitra@airis-amdk.com'
    };
  }, [customers, currentUser]);

  // Listener sinkronisasi perubahan database lokal/cloud
  useEffect(() => {
    const handleDbChange = () => {
      setCustomers(getTableData<CustomerItem>('MD_Pelanggan', []));
      setProducts(getTableData<ProductItem>('MD_Produk', []));
      setSpecialPrices(getTableData<SpecialPriceItem>('MD_HargaKhusus', []));
      setDeliveryPlans(getTableData<DeliveryPlanItem>('Rencana_Distribusi', []));
      setDistributions(getTableData<DistributionItem>('Distribusi', []));
      setReceivables(getTableData<ReceivablePayableItem>('Data_Piutang', []));
    };

    window.addEventListener('airis_db_changed', handleDbChange);
    return () => window.removeEventListener('airis_db_changed', handleDbChange);
  }, []);

  // -------------------------------------------------------------
  // STATE & LOGIKA PEMESANAN BARU (TAB KATALOG)
  // -------------------------------------------------------------
  // Keranjang belanja: { [ID_Produk]: jumlah }
  const [cart, setCart] = useState<Record<string, number>>({});
  
  // Besok sebagai default tanggal rencana kirim
  const defaultDeliveryDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const [orderDate, setOrderDate] = useState<string>(defaultDeliveryDate);
  const [shippingMethod, setShippingMethod] = useState<'Kirim Armada' | 'Ambil Sendiri'>('Kirim Armada');
  const [shippingAddress, setShippingAddress] = useState<string>(currentCustomer.Alamat || '');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<DistributionItem | null>(null);

  // Update alamat pengiriman jika customer berubah
  useEffect(() => {
    if (currentCustomer.Alamat) {
      setShippingAddress(currentCustomer.Alamat);
    }
  }, [currentCustomer]);

  // Hitung harga satuan produk untuk pelanggan ini (memperhitungkan Harga Khusus Kontrak)
  const getProductPriceForCustomer = (product: ProductItem): { price: number; isSpecial: boolean; originalPrice: number } => {
    // 1. Cek apakah ada harga khusus di MD_HargaKhusus
    const special = specialPrices.find(
      sp => sp.ID_Pelanggan === currentCustomer.ID_Pelanggan && sp.ID_Produk === product.ID_Produk
    );
    
    // Harga tier standar sesuai Level Pelanggan
    let basePrice = product.Harga_Distributor || 0;
    const lvl = (currentCustomer.Level_Pelanggan || '').toLowerCase();
    if (lvl.includes('distributor')) {
      basePrice = product.Harga_Distributor || 0;
    } else if (lvl.includes('agen')) {
      basePrice = product.Harga_Agen || product.Harga_Distributor || 0;
    } else if (lvl.includes('reseller')) {
      basePrice = product.Harga_Reseller || product.Harga_Agen || 0;
    } else if (lvl.includes('sekolah') || lvl.includes('mitra')) {
      basePrice = product.Harga_Distributor || 0;
    } else {
      basePrice = product.Harga_Konsumen || product.Harga_Reseller || 0;
    }

    if (special && special.Harga_Custom > 0) {
      return { price: special.Harga_Custom, isSpecial: true, originalPrice: basePrice };
    }
    return { price: basePrice, isSpecial: false, originalPrice: basePrice };
  };

  // Update kuantitas produk di keranjang
  const handleUpdateQty = (productId: string, delta: number) => {
    setCart(prev => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: next };
    });
  };

  const handleSetExactQty = (productId: string, val: string) => {
    const num = parseInt(val) || 0;
    setCart(prev => {
      if (num <= 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: num };
    });
  };

  // Ringkasan pesanan di keranjang
  const orderSummary = useMemo(() => {
    let totalItems = 0;
    let totalAmount = 0;
    const itemsList: {
      product: ProductItem;
      qty: number;
      price: number;
      subtotal: number;
      isSpecial: boolean;
    }[] = [];

    Object.entries(cart).forEach(([prodId, qty]) => {
      if (qty <= 0) return;
      const prod = products.find(p => p.ID_Produk === prodId);
      if (prod) {
        const { price, isSpecial } = getProductPriceForCustomer(prod);
        const subtotal = qty * price;
        totalItems += qty;
        totalAmount += subtotal;
        itemsList.push({ product: prod, qty, price, subtotal, isSpecial });
      }
    });

    return { totalItems, totalAmount, itemsList };
  }, [cart, products, currentCustomer, specialPrices]);

  // Kirim Pesanan Baru ke Pabrik
  const handleSubmitOrder = () => {
    if (orderSummary.itemsList.length === 0) {
      showToast('Keranjang Kosong', 'Silakan pilih produk dan jumlah pesanan terlebih dahulu.', 'warning');
      return;
    }

    if (!shippingAddress.trim() && shippingMethod === 'Kirim Armada') {
      showToast('Alamat Wajib Diisi', 'Mohon lengkapi alamat tujuan pengiriman armada.', 'warning');
      return;
    }

    setSubmittingOrder(true);

    try {
      const orderId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
      const allDeliveryPlans = getTableData<DeliveryPlanItem>('Rencana_Distribusi', []);

      const newPlan: DeliveryPlanItem = {
        ID_Rencana: orderId,
        Tanggal_Rencana: orderDate,
        ID_Pelanggan: currentCustomer.ID_Pelanggan,
        Nama_Pelanggan: currentCustomer.Nama_Pelanggan,
        Level_Pelanggan: currentCustomer.Level_Pelanggan,
        Metode_Kirim: shippingMethod,
        Alamat_Tujuan: shippingMethod === 'Kirim Armada' ? shippingAddress : 'Ambil Sendiri di Pabrik',
        Sopir: '-',
        Status: 'Menunggu',
        Keterangan: orderNotes || `Pemesanan mandiri via Portal Mitra (${currentCustomer.Nama_Pelanggan})`,
        Items: orderSummary.itemsList.map(item => ({
          ID_Produk: item.product.ID_Produk,
          Nama_Produk: item.product.Nama_Produk,
          Qty: item.qty,
          Harga_Satuan: item.price,
          Subtotal: item.subtotal
        }))
      };

      const updatedPlans = [newPlan, ...allDeliveryPlans];
      setTableData('Rencana_Distribusi', updatedPlans);
      notifyDbChange();

      // Reset form
      setCart({});
      setOrderNotes('');
      setSubmittingOrder(false);

      showToast(
        'Pesanan Berhasil Dikirim!',
        `No. Pesanan: ${orderId}. Pesanan Anda telah diterima oleh bagian distribusi pabrik dan sedang menunggu konfirmasi jadwal.`,
        'success'
      );

      // Pindahkan ke tab pelacakan pesanan
      setActiveTab('tracking');
    } catch (err: any) {
      setSubmittingOrder(false);
      showToast('Gagal Mengirim Pesanan', err.message || 'Terjadi kesalahan sistem.', 'error');
    }
  };

  // Batalkan pesanan mandiri jika status masih 'Menunggu'
  const handleCancelOrder = (orderId: string) => {
    if (!window.confirm(`Yakin ingin membatalkan pesanan ${orderId}?`)) return;

    const allPlans = getTableData<DeliveryPlanItem>('Rencana_Distribusi', []);
    const updated = allPlans.map(p => {
      if (p.ID_Rencana === orderId && p.Status === 'Menunggu') {
        return { ...p, Status: 'Dibatalkan' as const };
      }
      return p;
    });

    setTableData('Rencana_Distribusi', updated);
    notifyDbChange();
    showToast('Pesanan Dibatalkan', `Pesanan ${orderId} berhasil dibatalkan.`, 'info');
  };

  // -------------------------------------------------------------
  // DATA FILTER KHUSUS PELANGGAN INI
  // -------------------------------------------------------------
  
  // Daftar rencana pesanan milik pelanggan ini
  const myDeliveryPlans = useMemo(() => {
    return deliveryPlans.filter(p => 
      p.ID_Pelanggan === currentCustomer.ID_Pelanggan || 
      p.Nama_Pelanggan.trim().toLowerCase() === currentCustomer.Nama_Pelanggan.trim().toLowerCase()
    );
  }, [deliveryPlans, currentCustomer]);

  // Daftar pengiriman riil / surat jalan / invoice milik pelanggan ini
  const myDistributions = useMemo(() => {
    return distributions.filter(d => 
      d.ID_Pelanggan === currentCustomer.ID_Pelanggan || 
      d.Nama_Pelanggan.trim().toLowerCase() === currentCustomer.Nama_Pelanggan.trim().toLowerCase() ||
      d.Tujuan.toLowerCase().includes(currentCustomer.Nama_Pelanggan.toLowerCase())
    );
  }, [distributions, currentCustomer]);

  // Data piutang / tagihan invoice
  const myInvoices = useMemo(() => {
    return myDistributions.filter(d => Boolean(d.No_Invoice || d.Total_Tagihan));
  }, [myDistributions]);

  // Total statistik
  const stats = useMemo(() => {
    const activeOrders = myDeliveryPlans.filter(p => p.Status === 'Menunggu' || p.Status === 'Disetujui').length;
    const completedOrders = myDistributions.length;
    
    // Hitung total tagihan dan pelunasan
    let totalTagihan = 0;
    myInvoices.forEach(inv => {
      totalTagihan += (inv.Total_Tagihan || 0);
    });

    // Saldo galon
    let totalGalonKirim = 0;
    let totalGalonKembali = 0;
    myDistributions.forEach(d => {
      totalGalonKirim += (Number(d.G19) || 0);
      totalGalonKembali += (Number(d.Galon_Kosong_Kembali) || 0);
    });
    const saldoGalon = totalGalonKirim - totalGalonKembali;

    return {
      activeOrders,
      completedOrders,
      totalTagihan,
      saldoGalon: Math.max(0, saldoGalon)
    };
  }, [myDeliveryPlans, myDistributions, myInvoices]);

  // Format IDR
  const formatRp = (val: number) => {
    return `Rp ${(val || 0).toLocaleString('id-ID')}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      
      {/* =========================================================
          BANNER NOTIFIKASI JIKA DIAKSES OLEH SUPERADMIN
      ========================================================= */}
      {currentUser.Role !== 'Pelanggan' && (
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-2 text-xs flex items-center justify-between shadow-sm z-50">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-black/20 font-bold uppercase">Mode Pratinjau SuperAdmin</span>
            <span>Anda sedang melihat tampilan persis yang dilihat oleh <strong>{currentCustomer.Nama_Pelanggan}</strong>.</span>
          </div>
          {onSwitchToFactoryAdmin && (
            <button
              onClick={onSwitchToFactoryAdmin}
              className="flex items-center gap-1.5 px-3 py-1 bg-white text-orange-800 hover:bg-orange-50 rounded-md font-bold text-xs transition shadow"
            >
              <ArrowLeft size={13} />
              Kembali ke Menu Pabrik
            </button>
          )}
        </div>
      )}

      {/* =========================================================
          HEADER RESMI PORTAL MITRA & PELANGGAN
      ========================================================= */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            
            {/* Logo Brand As-Shofaa */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <span className="font-extrabold text-xl sm:text-2xl tracking-tighter">AIR</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight">
                    PORTAL MITRA AS-SHOFAA
                  </h1>
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    Self-Service AMDK
                  </span>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block">
                  PT. Anugerah Illahi Rabbi • Layanan Pemesanan & Tagihan Mandiri
                </p>
              </div>
            </div>

            {/* Profil Mitra Aktif & Tombol Keluar */}
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="text-right hidden sm:block">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="font-bold text-slate-900 text-sm">{currentCustomer.Nama_Pelanggan}</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {currentCustomer.Level_Pelanggan}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-slate-500">
                  {currentUser.Email || currentCustomer.Email || currentCustomer.ID_Pelanggan}
                </p>
              </div>

              {currentUser.Avatar ? (
                <img 
                  src={currentUser.Avatar} 
                  alt={currentCustomer.Nama_Pelanggan} 
                  className="w-10 h-10 rounded-full border-2 border-blue-100 shadow-sm"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center border border-blue-200">
                  {currentCustomer.Nama_Pelanggan.slice(0, 2).toUpperCase()}
                </div>
              )}

              <button
                onClick={onLogout}
                className="p-2 sm:px-3 sm:py-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition flex items-center gap-1.5 text-xs font-semibold"
                title="Keluar dari Portal"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            </div>
          </div>

          {/* Navigation Bar Tabs */}
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto border-t border-slate-100 py-2 no-scrollbar">
            <button
              onClick={() => setActiveTab('katalog')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                activeTab === 'katalog' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <ShoppingBag size={16} />
              <span>Katalog & Pesan Produk</span>
              {orderSummary.totalItems > 0 && (
                <span className="w-5 h-5 rounded-full bg-white text-blue-700 text-[11px] font-bold flex items-center justify-center shadow-xs">
                  {orderSummary.totalItems}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('tracking')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                activeTab === 'tracking' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Truck size={16} />
              <span>Lacak Pesanan</span>
              {stats.activeOrders > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-900 text-[11px] font-bold flex items-center justify-center">
                  {stats.activeOrders}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('invoice')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                activeTab === 'invoice' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Receipt size={16} />
              <span>Faktur & Tagihan</span>
            </button>

            <button
              onClick={() => setActiveTab('galon')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                activeTab === 'galon' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <RefreshCw size={16} />
              <span>Saldo Galon 19L</span>
            </button>

            <button
              onClick={() => setActiveTab('profil')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                activeTab === 'profil' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <UserCheck size={16} />
              <span>Profil & Bantuan</span>
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================
          MAIN PORTAL BODY CONTENT
      ========================================================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Banner Ringkasan Status Cepat */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <ShoppingBag size={20} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Pesanan Aktif</p>
              <p className="text-lg sm:text-xl font-bold text-slate-900">{stats.activeOrders} Pengiriman</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Truck size={20} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Riwayat Terkirim</p>
              <p className="text-lg sm:text-xl font-bold text-slate-900">{stats.completedOrders} Surat Jalan</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
              <RefreshCw size={20} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Saldo Galon di Mitra</p>
              <p className="text-lg sm:text-xl font-bold text-slate-900">{stats.saldoGalon} Unit Galon</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Receipt size={20} />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Level Kemitraan</p>
              <p className="text-sm sm:text-base font-bold text-slate-900 truncate">{currentCustomer.Level_Pelanggan}</p>
            </div>
          </div>
        </div>

        {/* =========================================================
            TAB 1: KATALOG & PEMESANAN BARU (ORDERING)
        ========================================================= */}
        {activeTab === 'katalog' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Daftar Produk (Katalog) */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">Katalog Produk AMDK As-Shofaa</h2>
                  <p className="text-xs text-slate-500">Harga otomatis disesuaikan dengan kontrak kemitraan resmi Anda</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {products.length} Varian Tersedia
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {products.map(prod => {
                  const { price, isSpecial, originalPrice } = getProductPriceForCustomer(prod);
                  const inCartQty = cart[prod.ID_Produk] || 0;

                  return (
                    <div 
                      key={prod.ID_Produk}
                      className={`bg-white rounded-2xl border p-4 sm:p-5 transition hover:shadow-md flex flex-col justify-between ${
                        inCartQty > 0 ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-slate-200'
                      }`}
                    >
                      <div>
                        {/* Header card produk */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {prod.ID_Produk}
                            </span>
                            <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug mt-0.5">
                              {prod.Nama_Produk}
                            </h3>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                            {prod.Satuan || 'Dus'}
                          </span>
                        </div>

                        {/* Badge Harga Khusus Kontrak */}
                        {isSpecial && (
                          <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Sparkles size={11} className="text-amber-600" />
                            <span>Harga Khusus Kontrak</span>
                          </div>
                        )}

                        {/* Harga Satuan */}
                        <div className="mt-3">
                          <div className="flex items-baseline gap-2">
                            <span className="text-lg sm:text-xl font-extrabold text-blue-700">
                              {formatRp(price)}
                            </span>
                            <span className="text-xs text-slate-400">/ {prod.Satuan || 'Dus'}</span>
                          </div>
                          {isSpecial && originalPrice > price && (
                            <p className="text-[11px] text-slate-400 line-through">
                              Normal: {formatRp(originalPrice)}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Stepper Kuantitas */}
                      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600">Jumlah Pesanan:</span>
                        
                        {inCartQty === 0 ? (
                          <button
                            onClick={() => handleUpdateQty(prod.ID_Produk, 1)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-xs"
                          >
                            <Plus size={14} />
                            <span>Pesan</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
                            <button
                              onClick={() => handleUpdateQty(prod.ID_Produk, -1)}
                              className="w-7 h-7 rounded bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs transition shadow-xs"
                              title="Kurangi"
                            >
                              <Minus size={14} />
                            </button>
                            <input
                              type="number"
                              min={0}
                              value={inCartQty}
                              onChange={e => handleSetExactQty(prod.ID_Produk, e.target.value)}
                              className="w-12 text-center bg-transparent font-bold text-slate-900 text-sm outline-none"
                            />
                            <button
                              onClick={() => handleUpdateQty(prod.ID_Produk, 1)}
                              className="w-7 h-7 rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center font-bold text-xs transition shadow-xs"
                              title="Tambah"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Form Checkout & Ringkasan Keranjang */}
            <div className="lg:col-span-5 xl:col-span-4 sticky top-28 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <ShoppingBag size={18} className="text-blue-600" />
                    <h3 className="font-bold text-slate-900 text-base">Keranjang Pesanan</h3>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                    {orderSummary.totalItems} Unit
                  </span>
                </div>

                {/* List item dalam keranjang */}
                {orderSummary.itemsList.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    <ShoppingBag size={36} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-medium">Belum ada produk yang dipilih</p>
                    <p className="text-[11px] text-slate-400 mt-1">Pilih jumlah produk pada katalog di sebelah kiri</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {orderSummary.itemsList.map(item => (
                      <div key={item.product.ID_Produk} className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-slate-900 truncate">{item.product.Nama_Produk}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {item.qty} {item.product.Satuan || 'Dus'} × {formatRp(item.price)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-blue-700 font-mono">{formatRp(item.subtotal)}</p>
                          <button
                            onClick={() => handleUpdateQty(item.product.ID_Produk, -item.qty)}
                            className="text-[10px] text-red-500 hover:underline"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Detail Pengiriman */}
                <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                      <Calendar size={13} className="text-blue-600" />
                      <span>Rencana Tanggal Kirim / Butuh</span>
                    </label>
                    <input
                      type="date"
                      value={orderDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={e => setOrderDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                      <Truck size={13} className="text-blue-600" />
                      <span>Metode Pengiriman</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setShippingMethod('Kirim Armada')}
                        className={`p-2 rounded-lg border text-center font-bold text-xs transition ${
                          shippingMethod === 'Kirim Armada' 
                            ? 'bg-blue-50 border-blue-600 text-blue-700' 
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        🚚 Diantar Armada
                      </button>
                      <button
                        type="button"
                        onClick={() => setShippingMethod('Ambil Sendiri')}
                        className={`p-2 rounded-lg border text-center font-bold text-xs transition ${
                          shippingMethod === 'Ambil Sendiri' 
                            ? 'bg-blue-50 border-blue-600 text-blue-700' 
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        🏭 Ambil di Pabrik
                      </button>
                    </div>
                  </div>

                  {shippingMethod === 'Kirim Armada' && (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                        <MapPin size={13} className="text-blue-600" />
                        <span>Alamat Tujuan Pengiriman</span>
                      </label>
                      <textarea
                        rows={2}
                        value={shippingAddress}
                        onChange={e => setShippingAddress(e.target.value)}
                        placeholder="Alamat lengkap tujuan kirim..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Catatan Pesanan (Opsional)
                    </label>
                    <input
                      type="text"
                      value={orderNotes}
                      onChange={e => setOrderNotes(e.target.value)}
                      placeholder="Contoh: Tolong kirim pagi sebelum jam 10..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                {/* Total & Tombol Kirim Pesanan */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-600">Total Estimasi:</span>
                    <span className="text-lg font-black text-blue-700 font-mono">
                      {formatRp(orderSummary.totalAmount)}
                    </span>
                  </div>

                  <button
                    onClick={handleSubmitOrder}
                    disabled={submittingOrder || orderSummary.itemsList.length === 0}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={16} />
                    <span>{submittingOrder ? 'Mengirim Pesanan...' : 'Kirim Pesanan ke Pabrik'}</span>
                  </button>

                  <p className="text-[11px] text-center text-slate-400">
                    Pesanan akan langsung masuk ke jadwal bagian Distribusi & Pengiriman Pabrik.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 2: TRACKING STATUS PESANAN
        ========================================================= */}
        {activeTab === 'tracking' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Status & Riwayat Pesanan Saya</h2>
                <p className="text-xs text-slate-500">Pantau proses persiapan dan pengiriman armada pesanan Anda secara real-time</p>
              </div>
              <button
                onClick={() => setActiveTab('katalog')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs shadow-xs"
              >
                <Plus size={14} />
                <span>Buat Pesanan Baru</span>
              </button>
            </div>

            {myDeliveryPlans.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                <Truck size={48} className="mx-auto mb-3 opacity-30" />
                <h3 className="text-base font-bold text-slate-700">Belum Ada Riwayat Pesanan</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Anda belum memiliki pesanan aktif. Silakan buat pesanan baru melalui tab Katalog & Pemesanan.
                </p>
                <button
                  onClick={() => setActiveTab('katalog')}
                  className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-xs"
                >
                  Buka Katalog Produk
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {myDeliveryPlans.map(plan => {
                  const isWaiting = plan.Status === 'Menunggu';
                  const isApproved = plan.Status === 'Disetujui';
                  const isRealized = plan.Status === 'Realisasi';
                  const isCancelled = plan.Status === 'Dibatalkan';

                  return (
                    <div 
                      key={plan.ID_Rencana}
                      className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs"
                    >
                      {/* Header baris pesanan */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                            isRealized ? 'bg-emerald-50 text-emerald-600' :
                            isCancelled ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                          }`}>
                            <PackageCheck size={18} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900 text-sm">{plan.ID_Rencana}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isRealized ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                isApproved ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                isCancelled ? 'bg-red-50 text-red-700 border border-red-200' :
                                'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}>
                                {isWaiting ? '⏳ Menunggu Konfirmasi Pabrik' :
                                 isApproved ? '📋 Disetujui & Dijadwalkan' :
                                 isRealized ? '✅ Selesai / Terkirim' : '⛔ Dibatalkan'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Rencana Kirim: <strong>{plan.Tanggal_Rencana}</strong> • Metode: {plan.Metode_Kirim}
                            </p>
                          </div>
                        </div>

                        {/* Aksi batalkan jika masih menunggu */}
                        {isWaiting && (
                          <button
                            onClick={() => handleCancelOrder(plan.ID_Rencana)}
                            className="px-3 py-1 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-red-200 transition"
                          >
                            Batalkan Pesanan
                          </button>
                        )}
                      </div>

                      {/* Stepper Progress Visual */}
                      {!isCancelled && (
                        <div className="py-2">
                          <div className="grid grid-cols-4 gap-2 text-center text-xs">
                            <div className="flex flex-col items-center">
                              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs mb-1">
                                1
                              </div>
                              <span className="font-bold text-slate-800 text-[11px]">Dipesan</span>
                              <span className="text-[10px] text-slate-400">Via Portal</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs mb-1 ${
                                isApproved || isRealized ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                              }`}>
                                2
                              </div>
                              <span className={`text-[11px] font-bold ${isApproved || isRealized ? 'text-slate-800' : 'text-slate-400'}`}>
                                Konfirmasi
                              </span>
                              <span className="text-[10px] text-slate-400">Admin Pabrik</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs mb-1 ${
                                isApproved || isRealized ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                              }`}>
                                3
                              </div>
                              <span className={`text-[11px] font-bold ${isApproved || isRealized ? 'text-slate-800' : 'text-slate-400'}`}>
                                Armada
                              </span>
                              <span className="text-[10px] text-slate-400">{plan.Sopir && plan.Sopir !== '-' ? `Sopir: ${plan.Sopir}` : 'Menunggu Sopir'}</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs mb-1 ${
                                isRealized ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                              }`}>
                                4
                              </div>
                              <span className={`text-[11px] font-bold ${isRealized ? 'text-emerald-700' : 'text-slate-400'}`}>
                                Selesai
                              </span>
                              <span className="text-[10px] text-slate-400">Diterima Mitra</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Rincian Barang yang Dipesan */}
                      <div className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-600 pb-1 border-b border-slate-200">
                          <span>Rincian Barang Dipesan</span>
                          <span>Tujuan: {plan.Alamat_Tujuan}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {plan.Items?.map((it, idx) => (
                            <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
                              <p className="font-bold text-slate-900 truncate">{it.Nama_Produk}</p>
                              <div className="flex items-center justify-between mt-1 text-slate-600 font-mono">
                                <span>{it.Qty} unit</span>
                                <span className="font-bold text-blue-700">{formatRp(it.Subtotal)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            TAB 3: FAKTUR & PEMBAYARAN (INVOICES)
        ========================================================= */}
        {activeTab === 'invoice' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Faktur, Invoice & Tagihan Resmi</h2>
                <p className="text-xs text-slate-500">Unduh dokumen resmi invoice dan lakukan konfirmasi pembayaran transfer</p>
              </div>
            </div>

            {myInvoices.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                <Receipt size={48} className="mx-auto mb-3 opacity-30" />
                <h3 className="text-base font-bold text-slate-700">Belum Ada Faktur / Invoice</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Faktur dan invoice resmi akan diterbitkan oleh Admin Pabrik begitu pesanan Anda dikirim oleh armada.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myInvoices.map(inv => {
                  return (
                    <div key={inv.ID_Distribusi} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-xs font-bold text-blue-700">
                            {inv.No_Invoice || `SJ-${inv.No_Surat_Jalan}`}
                          </span>
                          <h3 className="font-bold text-slate-900 text-sm mt-0.5">
                            Surat Jalan: {inv.No_Surat_Jalan}
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Tanggal: {inv.Tanggal} • Pengirim/Armada: {inv.Pengirim || '-'}
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          Resmi PT. AIR
                        </span>
                      </div>

                      {/* Rincian Produk Terkirim */}
                      <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs text-center font-mono">
                        {Number(inv.C120) > 0 && <div><span className="text-slate-500">Cup 120:</span> <strong>{inv.C120}</strong></div>}
                        {Number(inv.C220) > 0 && <div><span className="text-slate-500">Cup 220:</span> <strong>{inv.C220}</strong></div>}
                        {Number(inv.B330) > 0 && <div><span className="text-slate-500">Btl 330:</span> <strong>{inv.B330}</strong></div>}
                        {Number(inv.B600) > 0 && <div><span className="text-slate-500">Btl 600:</span> <strong>{inv.B600}</strong></div>}
                        {Number(inv.G19) > 0 && <div><span className="text-slate-500">Galon 19L:</span> <strong>{inv.G19}</strong></div>}
                      </div>

                      {/* Tagihan & Tombol Aksi */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase font-semibold">Total Tagihan</p>
                          <p className="text-base font-extrabold text-blue-700 font-mono">
                            {formatRp(inv.Total_Tagihan || 0)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => printInvoicePDF(inv)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
                            title="Cetak Faktur"
                          >
                            <Printer size={13} />
                            <span>Cetak</span>
                          </button>
                          <button
                            onClick={() => generateInvoicePDF(inv)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-xs"
                            title="Unduh PDF Resmi"
                          >
                            <Download size={13} />
                            <span>Unduh PDF</span>
                          </button>
                          <button
                            onClick={() => setPaymentModalInvoice(inv)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs"
                            title="Konfirmasi Pembayaran Transfer"
                          >
                            <Landmark size={13} />
                            <span>Bayar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            TAB 4: SALDO GALON 19L
        ========================================================= */}
        {activeTab === 'galon' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Monitoring Saldo & Perputaran Galon 19L</h2>
              <p className="text-xs text-slate-500">Rekapitulasi sirkulasi galon isi yang dikirim pabrik versus galon kosong yang kembali</p>
            </div>

            {/* Banner Saldo */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left">
                <div>
                  <p className="text-xs text-blue-300 uppercase tracking-wider font-semibold">Total Galon Terkirim</p>
                  <p className="text-2xl sm:text-3xl font-extrabold mt-1">
                    {myDistributions.reduce((acc, curr) => acc + (Number(curr.G19) || 0), 0)} Galon
                  </p>
                </div>
                <div>
                  <p className="text-xs text-emerald-300 uppercase tracking-wider font-semibold">Total Galon Kembali (Kosong)</p>
                  <p className="text-2xl sm:text-3xl font-extrabold mt-1 text-emerald-400">
                    {myDistributions.reduce((acc, curr) => acc + (Number(curr.Galon_Kosong_Kembali) || 0), 0)} Galon
                  </p>
                </div>
                <div className="sm:border-l sm:border-white/10 sm:pl-6">
                  <p className="text-xs text-amber-300 uppercase tracking-wider font-semibold">Saldo Galon di Mitra Saat Ini</p>
                  <p className="text-2xl sm:text-3xl font-extrabold mt-1 text-amber-400">
                    {stats.saldoGalon} Unit Galon
                  </p>
                </div>
              </div>
            </div>

            {/* Riwayat Mutasi Galon */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">Riwayat Pengiriman & Pengembalian Galon</h3>
                <span className="text-xs text-slate-500">{myDistributions.length} Transaksi Tercatat</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Tanggal</th>
                      <th className="p-3">No. Surat Jalan</th>
                      <th className="p-3 text-center">Galon Isi Terkirim</th>
                      <th className="p-3 text-center">Galon Kosong Kembali</th>
                      <th className="p-3">Armada / Sopir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {myDistributions.map(d => (
                      <tr key={d.ID_Distribusi} className="hover:bg-slate-50">
                        <td className="p-3 text-slate-700">{d.Tanggal}</td>
                        <td className="p-3 font-bold text-blue-700">{d.No_Surat_Jalan}</td>
                        <td className="p-3 text-center font-bold text-slate-900">{Number(d.G19) || 0}</td>
                        <td className="p-3 text-center font-bold text-emerald-600">{Number(d.Galon_Kosong_Kembali) || 0}</td>
                        <td className="p-3 font-sans text-slate-600">{d.Pengirim || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 5: PROFIL & BANTUAN PABRIK
        ========================================================= */}
        {activeTab === 'profil' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Kartu Profil Mitra */}
            <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-xs">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-extrabold text-lg">
                  {currentCustomer.Nama_Pelanggan.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{currentCustomer.Nama_Pelanggan}</h3>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Kemitraan Resmi: {currentCustomer.Level_Pelanggan}
                  </span>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">ID Pelanggan Resmi:</span>
                  <span className="font-mono font-bold text-slate-900">{currentCustomer.ID_Pelanggan}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Email Akun Google (Login):</span>
                  <span className="font-mono text-blue-700 font-semibold">{currentUser.Email || currentCustomer.Email || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">No. Telepon / WhatsApp:</span>
                  <span className="font-mono text-slate-800">{currentCustomer.No_Telp || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Alamat Pengiriman Utama:</span>
                  <span className="text-slate-800 leading-relaxed">{currentCustomer.Alamat || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Status Akun:</span>
                  <span className="font-bold text-emerald-600">Aktif & Terverifikasi</span>
                </div>
              </div>
            </div>

            {/* Informasi Kontak & Rekening Resmi Pabrik */}
            <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-xs">
              <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                <Building2 size={20} className="text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">Kontak Resmi Pabrik PT. AIR</h3>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <p className="font-bold text-slate-900 text-sm">PT. ANUGERAH ILLAHI RABBI</p>
                  <p className="text-slate-600 leading-relaxed">
                    Dk. Gading Baru, RT.03, RW.08, Ds. Belangwetan, Kec. Klaten Utara, Kab. Klaten, Jawa Tengah 57438
                  </p>
                  <p className="font-mono text-blue-700 font-bold">
                    📞 WhatsApp Sales / CS: 0856 4000 1926
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <Landmark size={16} className="text-blue-700" />
                    <p className="font-bold text-blue-950">Rekening Resmi Pembayaran Transfer Pabrik</p>
                  </div>
                  <div className="text-slate-800 space-y-1">
                    <p>Bank: <strong>BSI (Bank Syariah Indonesia)</strong></p>
                    <p>No. Rekening: <strong className="font-mono text-base text-blue-700">1607134444</strong></p>
                    <p>Atas Nama: <strong>KSPPS BMT SYECH HASYIM ASYARI</strong></p>
                  </div>
                  <p className="text-[11px] text-blue-800 italic mt-2">
                    *Harap sertakan bukti transfer saat melakukan pelunasan tagihan invoice.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* =========================================================
          MODAL KONFIRMASI PEMBAYARAN TRANSFER VIA WHATSAPP
      ========================================================= */}
      {paymentModalInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Landmark size={18} className="text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">Instruksi Pembayaran Transfer</h3>
              </div>
              <button
                onClick={() => setPaymentModalInvoice(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2 text-xs">
              <p className="text-emerald-900 font-semibold">Nomor Invoice: <strong>{paymentModalInvoice.No_Invoice || paymentModalInvoice.No_Surat_Jalan}</strong></p>
              <p className="text-emerald-900 text-base font-extrabold font-mono">
                Total: {formatRp(paymentModalInvoice.Total_Tagihan || 0)}
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">Silakan transfer ke rekening resmi pabrik:</p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono space-y-1">
                <p className="text-slate-500">Bank: <strong className="text-slate-900">BSI (Bank Syariah Indonesia)</strong></p>
                <p className="text-slate-500">No. Rekening: <strong className="text-base text-blue-700">1607134444</strong></p>
                <p className="text-slate-500">A/N: <strong className="text-slate-900">KSPPS BMT SYECH HASYIM ASYARI</strong></p>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPaymentModalInvoice(null)}
                className="w-1/3 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
              >
                Tutup
              </button>
              <a
                href={`https://wa.me/6285640001926?text=${encodeURIComponent(
                  `Halo Admin Keuangan PT. AIR (As-Shofaa), saya ingin konfirmasi pembayaran untuk Invoice No: ${paymentModalInvoice.No_Invoice || paymentModalInvoice.No_Surat_Jalan} sejumlah ${formatRp(paymentModalInvoice.Total_Tagihan || 0)} atas nama ${currentCustomer.Nama_Pelanggan}. Terima kasih.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition"
              >
                <span>Konfirmasi via WhatsApp</span>
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Footer Hak Cipta */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        <p>© 2026 PT. Anugerah Illahi Rabbi • AIRIS Enterprise Customer Portal</p>
      </footer>
    </div>
  );
};
