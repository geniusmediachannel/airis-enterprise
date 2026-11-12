import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, Plus, Printer, Download, Eye, 
  Trash2, Edit2, FileCheck, X, Building, Save, FileText,
  FileDown, Send, CheckCircle2, Copy, Search, Check, RefreshCw, Calendar,
  Settings, Image, Sliders, RotateCcw, Bold, Italic, Underline, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Palette, Table2, 
  UserPlus, UserMinus, ChevronDown, ChevronUp, BookOpen, Sparkles
} from 'lucide-react';
import { 
  OfficialLetterItem, SuratType, LetterSignatory, LetterDocumentSettings, TextStyleSettings
} from '../../types';
import { getTableData, setTableData, deleteTableRow } from '../../services/dbAdapter';
import { exportDataToExcel } from '../../services/excelService';
import { generateOfficialLetterPDF, sanitizeFilename } from '../../services/pdfService';
import { showToast as showToastGlobal } from '../ToastContainer';
import { confirmAction } from '../ConfirmDialog';
import { formatDateDDMMYYYY } from '../../services/formatters';

interface AdminSuratTabProps {
  onRefresh?: () => void;
}

export const AdminSuratTab: React.FC<AdminSuratTabProps> = ({ onRefresh }) => {
  const [letters, setLetters] = useState<OfficialLetterItem[]>(() => {
    const data = getTableData<OfficialLetterItem>('Data_Surat', []);
    return Array.isArray(data) ? data : [];
  });

  useEffect(() => {
    const handleDbChange = () => {
      setLetters(getTableData<OfficialLetterItem>('Data_Surat', []));
    };
    window.addEventListener('airis_db_updated', handleDbChange);
    window.addEventListener('storage', handleDbChange);
    return () => {
      window.removeEventListener('airis_db_updated', handleDbChange);
      window.removeEventListener('storage', handleDbChange);
    };
  }, []);
  const [letterSearchQuery, setLetterSearchQuery] = useState<string>('');
  const filteredLetters = useMemo(() => {
    let list = Array.isArray(letters) ? letters : [];
    if (letterSearchQuery.trim()) {
      const q = letterSearchQuery.toLowerCase();
      list = list.filter(l => 
        l && (
          String(l.Nomor_Surat || '').toLowerCase().includes(q) ||
          String(l.Perihal || '').toLowerCase().includes(q) ||
          String(l.Kepada || '').toLowerCase().includes(q) ||
          String(l.Tipe_Surat || '').toLowerCase().includes(q) ||
          String(l.Penandatangan_Nama || '').toLowerCase().includes(q) ||
          String(l.Isi_Surat || '').toLowerCase().includes(q) ||
          String(l.Tanggal || '').toLowerCase().includes(q)
        )
      );
    }
    return list;
  }, [letters, letterSearchQuery]);

  const [showLetterEditorModal, setShowLetterEditorModal] = useState(false);
  const [editingLetter, setEditingLetter] = useState<OfficialLetterItem | null>(null);
  const [viewLetterModal, setViewLetterModal] = useState<OfficialLetterItem | null>(null);

  // Form State for Letter Editor
  const [letterForm, setLetterForm] = useState<OfficialLetterItem>({
    ID_Surat: '',
    Nomor_Surat: '',
    Tipe_Surat: 'Surat Eksternal',
    Tanggal: new Date().toISOString().slice(0, 10),
    Perihal: '',
    Lampiran: '',
    Kepada: '',
    Alamat_Tujuan: '',
    Isi_Surat: '',
    Penandatangan_Nama: 'H. Mujiburrahman, SIP',
    Penandatangan_Jabatan: 'Direktur Utama',
    Tembusan: '',
    Dibuat_Oleh: 'Admin Sekretariat'
  });

  const defaultGlobalLetterSettings: LetterDocumentSettings = {
    namaPerusahaan: 'PT. ANUGERAH ILLAHI RABBI',
    subNamaPerusahaan: 'Produsen Air Minum Dalam Kemasan (AMDK) As-Shofaa',
    alamatPerusahaan: 'Dk. Gading Baru, RT.03, RW.08, Ds. Belangwetan, Kec. Klaten Utara, Kab. Klaten, 57438',
    kontakPerusahaan: '0856 4000 1926 | official@airis-amdk.com',
    customKopImage: '',
    useCustomKopImage: false,
    kopWidth: 100,
    kopHeight: 90,
    customCapImage: '',
    useCustomCapImage: false,
    showCap: true,
    capWidth: 80,
    capHeight: 80,
    customTtdImage: '',
    useCustomTtdImage: false,
    showTtd: true,
    ttdWidth: 110,
    ttdHeight: 75,
  };
  const [globalLetterSettings, setGlobalLetterSettings] = useState<LetterDocumentSettings>(() => {
    return getTableData<LetterDocumentSettings>('Pengaturan_Dokumen_Surat_Resmi', [defaultGlobalLetterSettings])[0] || defaultGlobalLetterSettings;
  });
  const [showGlobalLetterSettingsModal, setShowGlobalLetterSettingsModal] = useState<boolean>(false);
  const [tempGlobalLetterSettings, setTempGlobalLetterSettings] = useState<LetterDocumentSettings>(() => globalLetterSettings);

  // Rich Text Editor Ref and State
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [showInsertTableDialog, setShowInsertTableDialog] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [tableWidthPercent, setTableWidthPercent] = useState<string>('100%');
  const [editorKey, setEditorKey] = useState(0);

  // Per-letter document settings accordion state
  const [showLetterDocSettingsPanel, setShowLetterDocSettingsPanel] = useState(false);

  // Keyboard shortcut: Tekan tombol ESC untuk langsung menutup modal pratinjau surat atau modal aktif
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewLetterModal) setViewLetterModal(null);
        else if (showTemplateGalleryModal) setShowTemplateGalleryModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewLetterModal, showTemplateGalleryModal]);

  const execEditorCmd = useCallback((command: string, value: string | undefined = undefined) => {
    restoreSelection();
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, [restoreSelection]);

  const handleInsertTable = useCallback((rows: number, cols: number, width: string = '100%') => {
    const colWidth = (100 / cols).toFixed(1);
    const headerRow = `<tr>${Array(cols).fill(0).map((_, ci) => `<th style="border:1px solid #94a3b8;padding:8px 10px;background:#f1f5f9;font-weight:bold;text-align:left;width:${colWidth}%;resize:horizontal;overflow:auto;min-width:45px;">Kolom ${ci + 1}</th>`).join('')}</tr>`;
    const bodyRows = Array(Math.max(1, rows - 1)).fill(0).map(() =>
      `<tr>${Array(cols).fill(0).map(() => `<td style="border:1px solid #cbd5e1;padding:8px 10px;resize:both;overflow:auto;min-width:45px;min-height:24px;">&nbsp;</td>`).join('')}</tr>`
    ).join('');
    const tableHtml = `<br/><table class="airis-resizable-table" style="border-collapse:collapse;width:${width};margin:12px 0;font-size:12px;table-layout:fixed;resize:both;overflow:auto;"><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table><br/>`;
    restoreSelection();
    document.execCommand('insertHTML', false, tableHtml);
    if (editorRef.current) editorRef.current.focus();
    setShowInsertTableDialog(false);
  }, [restoreSelection]);

  const handleAddTableRowAtCursor = () => {
    if (!editorRef.current) return;
    const tables = editorRef.current.querySelectorAll('table');
    if (tables.length === 0) {
      showToastGlobal('Belum ada tabel pada naskah surat. Klik tombol "Tabel" terlebih dahulu.', 'warning');
      return;
    }
    const table = tables[tables.length - 1];
    const colCount = table.rows[0]?.cells.length || 3;
    const newRow = table.insertRow(-1);
    for (let i = 0; i < colCount; i++) {
      const cell = newRow.insertCell(i);
      cell.style.border = '1px solid #cbd5e1';
      cell.style.padding = '8px 10px';
      cell.style.resize = 'both';
      cell.style.overflow = 'auto';
      cell.innerHTML = '&nbsp;';
    }
    showToastGlobal('Baris tabel berhasil ditambahkan!', 'success');
  };

  const handleAddTableColAtCursor = () => {
    if (!editorRef.current) return;
    const tables = editorRef.current.querySelectorAll('table');
    if (tables.length === 0) {
      showToastGlobal('Belum ada tabel pada naskah surat', 'warning');
      return;
    }
    const table = tables[tables.length - 1];
    for (let r = 0; r < table.rows.length; r++) {
      const row = table.rows[r];
      if (r === 0 && row.cells[0]?.tagName === 'TH') {
        const th = document.createElement('th');
        th.style.border = '1px solid #94a3b8';
        th.style.padding = '8px 10px';
        th.style.background = '#f1f5f9';
        th.style.fontWeight = 'bold';
        th.style.textAlign = 'left';
        th.style.resize = 'horizontal';
        th.style.overflow = 'auto';
        th.textContent = `Kolom ${row.cells.length + 1}`;
        row.appendChild(th);
      } else {
        const cell = row.insertCell(-1);
        cell.style.border = '1px solid #cbd5e1';
        cell.style.padding = '8px 10px';
        cell.style.resize = 'both';
        cell.style.overflow = 'auto';
        cell.innerHTML = '&nbsp;';
      }
    }
    showToastGlobal('Kolom tabel berhasil ditambahkan!', 'success');
  };

  const handleSetLastTableWidth = (widthStr: string) => {
    if (!editorRef.current) return;
    const tables = editorRef.current.querySelectorAll('table');
    if (tables.length === 0) {
      showToastGlobal('Belum ada tabel pada naskah surat', 'warning');
      return;
    }
    const table = tables[tables.length - 1];
    table.style.width = widthStr;
    showToastGlobal(`Lebar tabel diatur ke ${widthStr}`, 'info');
  };

  const getEditorHTML = useCallback((): string => {
    return editorRef.current?.innerHTML || '';
  }, []);

  const getEditorPlainText = useCallback((): string => {
    return editorRef.current?.innerText || editorRef.current?.textContent || '';
  }, []);

  // ============================================================
  // SIGNATORY HANDLERS (Multiple Penandatangan)
  // ============================================================
  const handleAddSignatory = () => {
    const currentList: LetterSignatory[] = (letterForm.Penandatangan_List && letterForm.Penandatangan_List.length > 0)
      ? letterForm.Penandatangan_List
      : [{ id: 'sg-1', Keterangan: 'Hormat kami,', Nama: letterForm.Penandatangan_Nama, Jabatan: letterForm.Penandatangan_Jabatan }];
    const newSignatory: LetterSignatory = {
      id: `sg-${Date.now()}`,
      Keterangan: 'Mengetahui / Menyetujui,',
      Nama: 'Nama Penandatangan',
      Jabatan: 'Jabatan Terkait',
      useCustomTtdImage: false
    };
    setLetterForm(prev => ({ ...prev, Penandatangan_List: [...currentList, newSignatory] }));
  };

  const handleRemoveSignatory = (id: string) => {
    const currentList = letterForm.Penandatangan_List || [];
    if (currentList.length <= 1) {
      showToastGlobal('Minimal harus ada 1 penandatangan', 'warning');
      return;
    }
    setLetterForm(prev => ({ ...prev, Penandatangan_List: (prev.Penandatangan_List || []).filter(s => s.id !== id) }));
  };

  const handleUpdateSignatory = (id: string, field: keyof LetterSignatory, value: any) => {
    setLetterForm(prev => ({
      ...prev,
      Penandatangan_List: (prev.Penandatangan_List || []).map(s => s.id === id ? { ...s, [field]: value } : s)
    }));
  };

  // ============================================================
  // PER-LETTER DOC SETTINGS HANDLERS
  // ============================================================
  const handleUpdateLetterDocSetting = (field: keyof LetterDocumentSettings, value: any) => {
    setLetterForm(prev => ({
      ...prev,
      LetterDocSettings: { ...(prev.LetterDocSettings || {}), [field]: value } as LetterDocumentSettings
    }));
  };

  const compressUploadedImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = ev => {
        const img = document.createElement('img');
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          if (w > maxWidth || h > maxHeight) {
            const ratio = Math.min(maxWidth / w, maxHeight / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);
          }
          resolve(canvas.toDataURL('image/png'));
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Helper to format date in full Indonesian format (e.g. 16 September 2026)
  const formatIndonesianFullDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    if (/^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/.test(dateStr)) return dateStr;
    const parts = dateStr.slice(0, 10).split('-');
    if (parts.length === 3) {
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const y = parts[0];
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (m >= 0 && m < 12) {
        return `${d} ${months[m]} ${y}`;
      }
    }
    return dateStr;
  };

  // Helper to format date as standard DD-MM-YYYY (e.g. 15-10-2026)
  const formatDisplayDate = (dateStr?: string): string => {
    return formatDateDDMMYYYY(dateStr);
  };

  // Helper to group items by shipment (No_SJ_Referensi / Tanggal_Kirim / Kirim_Ke)
  interface OfficialLetterTemplate {
    id: string;
    tipe: SuratType;
    judul: string;
    deskripsi: string;
    perihal: string;
    lampiran?: string;
    kepada: string;
    alamatTujuan: string;
    isiHTML: string;
    isiPlain: string;
    signatories: LetterSignatory[];
  }

  const OFFICIAL_LETTER_TEMPLATES: OfficialLetterTemplate[] = [
    {
      id: 'tpl-ext-1',
      tipe: 'Surat Eksternal',
      judul: 'Penawaran Harga & Pasokan Produk AMDK',
      deskripsi: 'Surat resmi penawaran harga produk air minum untuk mitra distributor, agen, dan instansi lengkap dengan tabel harga.',
      perihal: 'Penawaran Kerjasama Pengadaan Air Minum Dalam Kemasan (AMDK)',
      lampiran: '1 Berkas Brosur & Price List',
      kepada: 'Yth. Pimpinan / Manager Pengadaan Mitra Usaha',
      alamatTujuan: 'Di Tempat',
      isiHTML: `<p>Dengan hormat,</p>
<p>Sehubungan dengan kebutuhan pasokan air minum berkualitas tinggi untuk operasional instansi/perusahaan Bapak/Ibu, kami dari <strong>PT. ANUGERAH ILLAHI RABBI</strong> selaku produsen AMDK merk <em>As-Shofaa</em> bermaksud mengajukan penawaran harga pasokan resmi.</p>
<p>Produk kami telah tersertifikasi <strong>SNI 3553:2023</strong>, <strong>Halal Indonesia</strong>, dan izin edar <strong>BPOM RI</strong> dengan rincian harga spesial distributor sebagai berikut:</p>
<table class="airis-resizable-table" style="border-collapse:collapse;width:100%;margin:12px 0;font-size:12px;table-layout:fixed;resize:both;overflow:auto;">
  <thead>
    <tr>
      <th style="border:1px solid #94a3b8;padding:8px 10px;background:#f1f5f9;font-weight:bold;text-align:left;width:10%;">No</th>
      <th style="border:1px solid #94a3b8;padding:8px 10px;background:#f1f5f9;font-weight:bold;text-align:left;width:35%;">Varian Produk</th>
      <th style="border:1px solid #94a3b8;padding:8px 10px;background:#f1f5f9;font-weight:bold;text-align:left;width:25%;">Kemasan</th>
      <th style="border:1px solid #94a3b8;padding:8px 10px;background:#f1f5f9;font-weight:bold;text-align:right;width:30%;">Harga Khusus (Rp)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">1</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;font-weight:bold;">Air Minum As-Shofaa Cup 220ml</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">Dus (isi 48 cup)</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;text-align:right;font-family:monospace;">Rp 16.500 / dus</td>
    </tr>
    <tr>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">2</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;font-weight:bold;">Air Minum As-Shofaa Botol 330ml</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">Dus (isi 24 botol)</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;text-align:right;font-family:monospace;">Rp 28.000 / dus</td>
    </tr>
    <tr>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">3</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;font-weight:bold;">Air Minum As-Shofaa Botol 600ml</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">Dus (isi 24 botol)</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;text-align:right;font-family:monospace;">Rp 34.000 / dus</td>
    </tr>
    <tr>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">4</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;font-weight:bold;">Air Minum As-Shofaa Galon 19L</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">Galon Refill Resmi</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;text-align:right;font-family:monospace;">Rp 6.000 / galon</td>
    </tr>
  </tbody>
</table>
<p>Harga di atas sudah termasuk pengiriman sampai ke gudang pemesan (area Klaten & Solo Raya) dengan armada logistik pabrik. Ketentuan pembayaran tempo dapat dibahas lebih lanjut.</p>
<p>Demikian penawaran ini kami sampaikan. Besar harapan kami untuk dapat menjalin kerjasama yang saling menguntungkan.</p>`,
      isiPlain: `Dengan hormat,\n\nSehubungan dengan kebutuhan pasokan air minum berkualitas tinggi untuk operasional instansi/perusahaan Bapak/Ibu, kami dari PT. ANUGERAH ILLAHI RABBI selaku produsen AMDK merk As-Shofaa bermaksud mengajukan penawaran harga pasokan resmi.\n\nProduk kami telah tersertifikasi SNI 3553:2023, Halal Indonesia, dan izin edar BPOM RI.\n\nDemikian penawaran ini kami sampaikan. Besar harapan kami untuk dapat menjalin kerjasama yang saling menguntungkan.`,
      signatories: [
        { id: 'sig-1', Keterangan: 'Hormat kami,', Nama: 'H. Mujiburrahman, SIP', Jabatan: 'Direktur Utama', useCustomTtdImage: false },
        { id: 'sig-2', Keterangan: 'Manager Penjualan,', Nama: 'Marko Dwi Nugroho', Jabatan: 'Head of Marketing', useCustomTtdImage: false }
      ]
    },
    {
      id: 'tpl-ext-2',
      tipe: 'Surat Eksternal',
      judul: 'Pemberitahuan Penyesuaian Pengiriman Produk',
      deskripsi: 'Surat resmi kepada distributor dan agen mengenai jadwal dan teknis pengiriman produk baru.',
      perihal: 'Pemberitahuan Penyesuaian Jadwal & Rute Pengiriman AMDK',
      lampiran: '-',
      kepada: 'Yth. Seluruh Mitra Distributor & Agen Resmi As-Shofaa',
      alamatTujuan: 'Di Tempat',
      isiHTML: `<p>Dengan hormat,</p>
<p>Sehubungan dengan optimalisasi armada logistik dan peningkatan kapasitas lini produksi di pabrik kami, bersama surat ini kami sampaikan penyesuaian jadwal pengiriman produk yang akan berlaku efektif mulai awal bulan mendatang:</p>
<ol style="margin-left:20px;padding-left:10px;">
  <li><strong>Wilayah Klaten Utara & Delanggu:</strong> Pengiriman dilakukan setiap hari <em>Senin, Rabu, dan Jumat</em>.</li>
  <li><strong>Wilayah Klaten Selatan, Wedi & Cawas:</strong> Pengiriman dilakukan setiap hari <em>Selasa, Kamis, dan Sabtu</em>.</li>
  <li><strong>Order Pemesanan (PO):</strong> Mohon diteruskan maksimal H-1 sebelum jadwal keberangkatan armada pukul 15.00 WIB.</li>
</ol>
<p>Langkah ini diambil guna menjamin ketersediaan stok produk selalu terjaga prima dan tepat waktu di gerai Bapak/Ibu sekalian.</p>
<p>Demikian pemberitahuan ini kami sampaikan. Atas perhatian, kepercayaan, dan kerjasamanya kami ucapkan terima kasih.</p>`,
      isiPlain: `Dengan hormat,\n\nSehubungan dengan optimalisasi armada logistik dan peningkatan kapasitas lini produksi di pabrik kami, bersama surat ini kami sampaikan penyesuaian jadwal pengiriman produk yang akan berlaku efektif mulai awal bulan mendatang.\n\nDemikian pemberitahuan ini kami sampaikan. Atas kerjasama dan kepercayaannya kami ucapkan terima kasih.`,
      signatories: [
        { id: 'sig-1', Keterangan: 'Hormat kami,', Nama: 'H. Mujiburrahman, SIP', Jabatan: 'Direktur Utama', useCustomTtdImage: false }
      ]
    },
    {
      id: 'tpl-ext-3',
      tipe: 'Surat Eksternal',
      judul: 'Perjanjian Kemitraan Distributor (Multi-TTD)',
      deskripsi: 'Surat persetujuan kemitraan resmi dengan format 2 penandatangan sejajar (Pihak Pertama & Pihak Kedua).',
      perihal: 'Surat Kesepakatan Kemitraan Distribusi Resmi AMDK As-Shofaa',
      lampiran: '1 Rangkap Perjanjian Kerjasama',
      kepada: 'Yth. Pimpinan CV. Mitra Berkah Bersama',
      alamatTujuan: 'Solo Baru, Sukoharjo',
      isiHTML: `<p>Dengan hormat,</p>
<p>Menindaklanjuti permohonan keagenan yang telah diajukan, bersama ini kedua belah pihak sepakat mengikatkan diri dalam kerjasama kemitraan distribusi produk AMDK As-Shofaa dengan ketentuan pokok:</p>
<p>1. <strong>Pihak Pertama (Produsen):</strong> PT. Anugerah Illahi Rabbi bertindak sebagai penjamin suplai produk resmi bersertifikasi SNI dan Halal secara berkesinambungan.<br/>
2. <strong>Pihak Kedua (Distributor):</strong> Bertindak sebagai distributor resmi untuk wilayah Solo Baru dan sekitarnya dengan target pemesanan minimal bulanan yang disepakati.</p>
<p>Kesepakatan ini dibuat dalam 2 (dua) rangkap bermaterai cukup dan memiliki kekuatan hukum yang sama bagi kedua belah pihak.</p>`,
      isiPlain: `Dengan hormat,\n\nMenindaklanjuti permohonan keagenan yang telah diajukan, bersama ini kedua belah pihak sepakat mengikatkan diri dalam kerjasama kemitraan distribusi produk AMDK As-Shofaa.\n\nKesepakatan ini dibuat dalam 2 rangkap untuk dipergunakan semestinya.`,
      signatories: [
        { id: 'sig-1', Keterangan: 'PIHAK PERTAMA (Produsen),', Nama: 'H. Mujiburrahman, SIP', Jabatan: 'Direktur Utama PT. AIR', useCustomTtdImage: false },
        { id: 'sig-2', Keterangan: 'PIHAK KEDUA (Mitra),', Nama: 'Ir. Hendra Suryanto', Jabatan: 'Direktur CV. Mitra Berkah', useCustomTtdImage: false }
      ]
    },
    {
      id: 'tpl-int-1',
      tipe: 'Surat Internal',
      judul: 'Instruksi Kerja & Penegakan SOP Kebersihan Pabrik',
      deskripsi: 'Memo penegakan Good Manufacturing Practice (GMP) dan standar higienitas ruang produksi.',
      perihal: 'Instruksi Kerja & Penegakan SOP Kebersihan Ruang Steril Produksi',
      lampiran: '-',
      kepada: 'Seluruh Operator & Staf Divisi Produksi Pabrik AIRIS',
      alamatTujuan: 'Area Pabrik Belangwetan, Klaten',
      isiHTML: `<p><strong><u>MEMO INTERNAL DIVISI OPERASIONAL</u></strong></p>
<p>Dalam rangka menjaga konsistensi mutu SNI 3553:2023 dan Good Manufacturing Practices (GMP), diinstruksikan kepada seluruh kepala shift dan operator produksi untuk mematuhi kewajiban berikut:</p>
<ol style="margin-left:20px;padding-left:10px;">
  <li>Wajib mengenakan Alat Pelindung Diri (APD) sanitasi lengkap: hairnet, masker medis, sarung tangan steril, dan sepatu boot sebelum memasuki ruang filling.</li>
  <li>Mencuci tangan dengan cairan antiseptik pada bak cuci tangan otomatis di pintu masuk koridor air shower.</li>
  <li>Dilarang membawa makanan, minuman pribadi, atau aksesoris logam ke dalam area pengisian cup dan galon.</li>
  <li>Mencatat parameter pH, TDS, dan ozon secara berkala setiap 2 jam sekali ke logbook QC.</li>
</ol>
<p>Instruksi ini berlaku terhitung mulai tanggal ditetapkan dan akan dipantau ketat oleh petugas Quality Control.</p>`,
      isiPlain: `MEMO INTERNAL\n\nDalam rangka menjaga standar mutu SNI 3553:2023 dan Good Manufacturing Practices (GMP), diinstruksikan kepada seluruh staf dan operator produksi untuk mematuhi SOP kebersihan yang berlaku.`,
      signatories: [
        { id: 'sig-1', Keterangan: 'Mengetahui & Menyetujui,', Nama: 'H. Mujiburrahman, SIP', Jabatan: 'Direktur Utama', useCustomTtdImage: false },
        { id: 'sig-2', Keterangan: 'Diterbitkan Oleh,', Nama: 'Agus Setiawan, ST', Jabatan: 'Supervisor Pabrik & QC', useCustomTtdImage: false }
      ]
    },
    {
      id: 'tpl-int-2',
      tipe: 'Surat Internal',
      judul: 'Jadwal Shift Kerja & Operasional Mesin',
      deskripsi: 'Pemberitahuan pembagian jam kerja dan shift operator mesin produksi lengkap dengan tabel jadwal.',
      perihal: 'Penetapan Jadwal Shift Kerja Operator Mesin Filling AMDK',
      lampiran: '1 Lembar Pembagian Shift',
      kepada: 'Seluruh Karyawan Shift Pabrik PT. AIR',
      alamatTujuan: 'Pabrik Klaten',
      isiHTML: `<p>Diberitahukan kepada seluruh operator mesin dan tim packing, terhitung mulai minggu depan diterapkan jadwal 2 shift kerja sebagai berikut:</p>
<table class="airis-resizable-table" style="border-collapse:collapse;width:100%;margin:12px 0;font-size:12px;table-layout:fixed;resize:both;overflow:auto;">
  <thead>
    <tr>
      <th style="border:1px solid #94a3b8;padding:8px 10px;background:#f1f5f9;font-weight:bold;text-align:left;width:20%;">Shift</th>
      <th style="border:1px solid #94a3b8;padding:8px 10px;background:#f1f5f9;font-weight:bold;text-align:left;width:30%;">Jam Kerja</th>
      <th style="border:1px solid #94a3b8;padding:8px 10px;background:#f1f5f9;font-weight:bold;text-align:left;width:25%;">PIC Shift</th>
      <th style="border:1px solid #94a3b8;padding:8px 10px;background:#f1f5f9;font-weight:bold;text-align:left;width:25%;">Target Produksi</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;font-weight:bold;">Shift 1 (Pagi)</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">07.00 - 15.00 WIB</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">Budi Santoso</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">1.500 Dus Cup</td>
    </tr>
    <tr>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;font-weight:bold;">Shift 2 (Siang)</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">15.00 - 23.00 WIB</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">Joko Susilo</td>
      <td style="border:1px solid #cbd5e1;padding:8px 10px;">1.200 Dus Cup</td>
    </tr>
  </tbody>
</table>
<p>Serah terima operasional mesin wajib dilakukan 15 menit sebelum pergantian shift. Demikian memo ini disampaikan untuk dilaksanakan dengan penuh rasa tanggung jawab.</p>`,
      isiPlain: `Diberitahukan kepada seluruh operator mesin dan tim packing mengenai pembagian shift kerja 07.00-15.00 dan 15.00-23.00 WIB. Harap hadir tepat waktu.`,
      signatories: [
        { id: 'sig-1', Keterangan: 'Manager Operasional,', Nama: 'Marko Dwi Nugroho', Jabatan: 'Manager Operasional & HRD', useCustomTtdImage: false }
      ]
    },
    {
      id: 'tpl-int-3',
      tipe: 'Surat Internal',
      judul: 'Surat Tugas Perjalanan Dinas / Logistik',
      deskripsi: 'Surat penugasan pengemudi dan helper untuk pengiriman produk atau urusan operasional luar kota.',
      perihal: 'Surat Perintah Perjalanan Dinas & Distribusi Logistik',
      lampiran: '1 Lembar Surat Jalan',
      kepada: 'Sdr. Tri Wahyudi (Driver) & Sdr. Wahyu Pratama (Helper)',
      alamatTujuan: 'Divisi Logistik & Armada',
      isiHTML: `<p>Yang bertanda tangan di bawah ini memberikan penugasan dinas resmi kepada:</p>
<p><strong>Nama / ID Driver:</strong> Tri Wahyudi (KAR-0004)<br/>
<strong>Nama / ID Helper:</strong> Wahyu Pratama (KAR-0012)<br/>
<strong>Kendaraan:</strong> Truk Engkel Box No. Pol AD 8129 LK<br/>
<strong>Tujuan Dinas:</strong> Pengiriman 800 Dus AMDK Cup 220ml ke Depo Distributor Solo Baru<br/>
<strong>Waktu Berangkat:</strong> Pukul 08.00 WIB s/d selesai</p>
<p>Demikian surat tugas ini diterbitkan untuk dilaksanakan sebaik-baiknya dengan senantiasa mengutamakan keselamatan berkendara.</p>`,
      isiPlain: `Memberikan tugas dinas resmi kepada driver dan helper untuk pengantaran produk AMDK ke mitra distributor.`,
      signatories: [
        { id: 'sig-1', Keterangan: 'Kepala Divisi Distribusi,', Nama: 'Marko Dwi Nugroho', Jabatan: 'Manager Distribusi & Logistik', useCustomTtdImage: false }
      ]
    },
    {
      id: 'tpl-ket-1',
      tipe: 'Surat Keterangan',
      judul: 'Surat Keterangan Kerja (Paklaring)',
      deskripsi: 'Surat bukti pengalaman kerja karyawan yang berprestasi dan berdedikasi baik di pabrik.',
      perihal: 'Surat Keterangan Pengalaman Kerja',
      lampiran: '-',
      kepada: 'Pihak yang Berkepentingan',
      alamatTujuan: 'Di Tempat',
      isiHTML: `<p style="text-align:center;font-weight:bold;font-size:14px;text-decoration:underline;">SURAT KETERANGAN KERJA</p>
<p style="text-align:center;font-size:11px;font-family:monospace;margin-top:-8px;">Nomor: 045/KET/HRD/X/2026</p>
<br/>
<p>Yang bertanda tangan di bawah ini menerangkan dengan sebenarnya bahwa:</p>
<table style="width:100%;margin:6px 0;font-size:12px;border:none;">
  <tr><td style="width:140px;padding:3px 0;">Nama Lengkap</td><td style="width:15px;">:</td><td><strong>Tri Wahyudi</strong></td></tr>
  <tr><td style="padding:3px 0;">ID Karyawan</td><td>:</td><td>KAR-0004</td></tr>
  <tr><td style="padding:3px 0;">Jabatan Terakhir</td><td>:</td><td>Driver / Pengemudi Distribusi Armada Pabrik</td></tr>
  <tr><td style="padding:3px 0;">Masa Kerja</td><td>:</td><td>20 Mei 2023 s/d 18 Oktober 2026</td></tr>
</table>
<br/>
<p>Adalah benar pernah tercatat sebagai karyawan tetap di PT. Anugerah Illahi Rabbi. Selama masa baktinya, yang bersangkutan senantiasa menunjukkan integritas, loyalitas, serta kedisiplinan kerja yang terpuji.</p>
<p>Demikian surat keterangan ini kami terbitkan atas permohonan yang bersangkutan untuk dapat dipergunakan sebagaimana mestinya.</p>`,
      isiPlain: `Yang bertanda tangan di bawah ini menerangkan bahwa Tri Wahyudi adalah benar pernah bekerja di PT. Anugerah Illahi Rabbi sejak 20 Mei 2023 sampai 18 Oktober 2026 dengan dedikasi dan kinerja yang sangat baik.`,
      signatories: [
        { id: 'sig-1', Keterangan: 'Hormat kami,', Nama: 'H. Mujiburrahman, SIP', Jabatan: 'Direktur Utama', useCustomTtdImage: false },
        { id: 'sig-2', Keterangan: 'Manager HRD,', Nama: 'Marko Dwi Nugroho', Jabatan: 'Manager Keuangan & HRD', useCustomTtdImage: false }
      ]
    },
    {
      id: 'tpl-ket-2',
      tipe: 'Surat Keterangan',
      judul: 'Surat Keterangan Penghasilan Karyawan',
      deskripsi: 'Surat rincian penghasilan untuk keperluan pengajuan bank, kredit, atau keperluan formal karyawan.',
      perihal: 'Surat Keterangan Penghasilan / Gaji Karyawan',
      lampiran: '-',
      kepada: 'Yth. Pimpinan Lembaga Pembiayaan / Bank',
      alamatTujuan: 'Di Tempat',
      isiHTML: `<p>Yang bertanda tangan di bawah ini menerangkan rincian penghasilan resmi karyawan PT. Anugerah Illahi Rabbi:</p>
<table style="width:100%;margin:6px 0;font-size:12px;">
  <tr><td style="width:140px;padding:3px 0;">Nama Karyawan</td><td style="width:15px;">:</td><td><strong>Supriyadi, A.Md</strong></td></tr>
  <tr><td style="padding:3px 0;">Jabatan</td><td>:</td><td>Teknisi Mesin Filling & Maintenance</td></tr>
  <tr><td style="padding:3px 0;">Status Kerja</td><td>:</td><td>Karyawan Tetap (sejak 2022)</td></tr>
</table>
<table class="airis-resizable-table" style="border-collapse:collapse;width:100%;margin:12px 0;font-size:12px;table-layout:fixed;resize:both;overflow:auto;">
  <thead>
    <tr>
      <th style="border:1px solid #94a3b8;padding:6px 10px;background:#f1f5f9;font-weight:bold;text-align:left;">Komponen Penghasilan</th>
      <th style="border:1px solid #94a3b8;padding:6px 10px;background:#f1f5f9;font-weight:bold;text-align:right;">Nominal (Rp)</th>
    </tr>
  </thead>
  <tbody>
    <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;">Gaji Pokok</td><td style="border:1px solid #cbd5e1;padding:6px 10px;text-align:right;font-family:monospace;">Rp 3.500.000</td></tr>
    <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;">Tunjangan Jabatan & Keahlian</td><td style="border:1px solid #cbd5e1;padding:6px 10px;text-align:right;font-family:monospace;">Rp 850.000</td></tr>
    <tr><td style="border:1px solid #cbd5e1;padding:6px 10px;">Insentif Kehadiran & Target</td><td style="border:1px solid #cbd5e1;padding:6px 10px;text-align:right;font-family:monospace;">Rp 500.000</td></tr>
    <tr style="font-weight:bold;background:#f8fafc;"><td style="border:1px solid #cbd5e1;padding:6px 10px;">TOTAL TAKE HOME PAY</td><td style="border:1px solid #cbd5e1;padding:6px 10px;text-align:right;font-family:monospace;color:#1e3a8a;">Rp 4.850.000</td></tr>
  </tbody>
</table>
<p>Surat keterangan ini dibuat dengan sebenar-benarnya untuk digunakan sebagai syarat administrasi perbankan.</p>`,
      isiPlain: `Surat rincian penghasilan resmi karyawan Supriyadi, A.Md dengan total take home pay Rp 4.850.000 per bulan.`,
      signatories: [
        { id: 'sig-1', Keterangan: 'Manager Keuangan & HRD,', Nama: 'Marko Dwi Nugroho', Jabatan: 'Manager Keuangan & HRD', useCustomTtdImage: false }
      ]
    },
    {
      id: 'tpl-ket-3',
      tipe: 'Surat Keterangan',
      judul: 'Surat Peringatan Pertama (SP 1)',
      deskripsi: 'Surat pembinaan disiplin kerja formal bagi karyawan yang melanggar SOP operasional.',
      perihal: 'Surat Peringatan Pertama (SP 1) Pelanggaran Disiplin Kerja',
      lampiran: '-',
      kepada: 'Sdr. Karyawan Terkait',
      alamatTujuan: 'Divisi Produksi Pabrik',
      isiHTML: `<p style="text-align:center;font-weight:bold;font-size:14px;color:#b91c1c;text-decoration:underline;">SURAT PERINGATAN PERTAMA (SP-1)</p>
<p style="text-align:center;font-size:11px;font-family:monospace;margin-top:-8px;">Nomor: 012/SP-1/HRD/X/2026</p>
<br/>
<p>Surat peringatan ini diterbitkan sehubungan dengan ketidakhadiran tanpa keterangan sah (alpa) dan keterlambatan berulang yang melanggar peraturan tata tertib perusahaan.</p>
<p>Diharapkan kepada yang bersangkutan untuk segera memperbaiki kedisiplinan dan etos kerja. Apabila dalam kurun waktu 3 (tiga) bulan ke depan terjadi pelanggaran serupa, maka perusahaan akan mengambil tindakan sanksi bertingkat (SP-2) sesuai ketentuan ketenagakerjaan.</p>
<p>Demikian surat peringatan ini dikeluarkan sebagai sarana pembinaan dan evaluasi kinerja bersama.</p>`,
      isiPlain: `Surat Peringatan Pertama (SP-1) diterbitkan atas ketidakhadiran dan keterlambatan berulang. Harap diperbaiki dan menjadi evaluasi kinerja ke depan.`,
      signatories: [
        { id: 'sig-1', Keterangan: 'Manager HRD,', Nama: 'Marko Dwi Nugroho', Jabatan: 'Manager Keuangan & HRD', useCustomTtdImage: false },
        { id: 'sig-2', Keterangan: 'Mengetahui Direktur Utama,', Nama: 'H. Mujiburrahman, SIP', Jabatan: 'Direktur Utama', useCustomTtdImage: false }
      ]
    }
  ];

  // Helper to load a template into the letter editor
  const handleApplyTemplate = (tpl: OfficialLetterTemplate) => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    const num = String(letters.length + 1).padStart(3, '0');
    const typeCode = tpl.tipe === 'Surat Eksternal' ? 'EXT' : tpl.tipe === 'Surat Internal' ? 'INT' : 'KET';

    setEditingLetter(null);
    setLetterForm({
      ID_Surat: `SRT-${Date.now().toString().slice(-6)}`,
      Nomor_Surat: `${num}/${typeCode}/AIRIS/${mm}/${yy}`,
      Tipe_Surat: tpl.tipe,
      Tanggal: d.toISOString().slice(0, 10),
      Perihal: tpl.perihal,
      Lampiran: tpl.lampiran || '-',
      Kepada: tpl.kepada,
      Alamat_Tujuan: tpl.alamatTujuan,
      Isi_Surat: tpl.isiPlain,
      Isi_Surat_HTML: tpl.isiHTML,
      Penandatangan_Nama: tpl.signatories[0]?.Nama || 'H. Mujiburrahman, SIP',
      Penandatangan_Jabatan: tpl.signatories[0]?.Jabatan || 'Direktur Utama',
      Penandatangan_List: tpl.signatories.map(s => ({ ...s })),
      LetterDocSettings: undefined,
      Tembusan: 'Arsip Sekretariat',
      Dibuat_Oleh: 'Admin Sekretariat'
    });
    setEditorKey(k => k + 1);
    setShowTemplateGalleryModal(false);
    setShowLetterEditorModal(true);
    showToastGlobal(`Template "${tpl.judul}" berhasil dimuat ke editor!`, 'success');
  };
  const applyLetterTemplate = (type: SuratType) => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    const num = String(letters.length + 1).padStart(3, '0');

    if (type === 'Surat Eksternal') {
      setLetterForm({
        ...letterForm,
        Tipe_Surat: 'Surat Eksternal',
        Nomor_Surat: `${num}/EXT/AIRIS/${mm}/${yy}`,
        Perihal: 'Pemberitahuan Penyesuaian Pengiriman Produk AMDK',
        Kepada: 'Yth. Seluruh Mitra Distributor & Agen Resmi',
        Alamat_Tujuan: 'Wilayah Klaten & Sekitarnya',
        Isi_Surat: `Dengan hormat,\n\nSehubungan dengan peningkatan kapasitas lini produksi mesin filling otomatis pabrik kami, bersama ini kami informasikan adanya jadwal operasional pengiriman baru yang akan mulai efektif berlaku per minggu depan.\n\nKami mengimbau kepada seluruh mitra distributor agar dapat mengirimkan purchase order (PO) H-1 sebelum jadwal pengiriman agar ketersediaan stok dapat teralokasi secara maksimal.\n\nDemikian pemberitahuan ini kami sampaikan. Atas kerjasama dan kepercayaannya, kami ucapkan terima kasih.`,
        Penandatangan_Nama: 'H. Mujiburrahman, SIP',
        Penandatangan_Jabatan: 'Direktur Utama'
      });
    } else if (type === 'Surat Internal') {
      setLetterForm({
        ...letterForm,
        Tipe_Surat: 'Surat Internal',
        Nomor_Surat: `${num}/INT/AIRIS/${mm}/${yy}`,
        Perihal: 'Instruksi Kerja & Penegakan SOP Kebersihan Pabrik',
        Kepada: 'Seluruh Karyawan dan Operator Divisi Pabrik',
        Alamat_Tujuan: 'Pabrik AIRIS Klaten',
        Isi_Surat: `MEMO INTERNAL\n\nDalam rangka menjaga standar mutu SNI 3553:2023 dan Good Manufacturing Practices (GMP), diinstruksikan kepada seluruh staf dan operator produksi untuk:\n\n1. Selalu mengenakan perlengkapan sanitasi steril (hairnet, masker, sarung tangan, sepatu kerja) di area water treatment dan packaging.\n2. Melakukan sterilisasi tangan dan alas kaki sebelum memasuki ruang steril.\n3. Melaporkan segera setiap indikasi kebocoran seal atau selisih takaran ke supervisor QC.\n\nInstruksi ini berlaku segera dan wajib dipatuhi dengan disiplin.`,
        Penandatangan_Nama: 'Agus Setiawan',
        Penandatangan_Jabatan: 'Supervisor Produksi'
      });
    } else if (type === 'Surat Keterangan') {
      setLetterForm({
        ...letterForm,
        Tipe_Surat: 'Surat Keterangan',
        Nomor_Surat: `${num}/KET/HRD/${mm}/${yy}`,
        Perihal: 'Surat Keterangan Kerja Karyawan',
        Kepada: 'Pihak yang Berkepentingan',
        Alamat_Tujuan: 'Di Tempat',
        Isi_Surat: `Yang bertanda tangan di bawah ini menerangkan dengan sebenarnya bahwa:\n\nNama        : Tri Wahyudi\nID Karyawan : KAR-0004\nJabatan     : Driver / Pengemudi Distribusi Armada\nAlamat      : Belangwetan, Klaten Utara\n\nAdalah benar tercatat sebagai karyawan tetap di PT. Anugerah Illahi Rabbi terhitung sejak tanggal 20 Mei 2023 sampai dengan saat ini.\n\nSelama bekerja di perusahaan kami, yang bersangkutan senantiasa menunjukkan kinerja, kedisiplinan, dan dedikasi yang sangat baik.\n\nDemikian surat keterangan ini kami buat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.`,
        Penandatangan_Nama: 'Marko Dwi Nugroho',
        Penandatangan_Jabatan: 'Manager Keuangan & HRD'
      });
    }
  };

  const handleOpenAddLetter = (type: SuratType = 'Surat Eksternal') => {
    setEditingLetter(null);
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    const num = String(letters.length + 1).padStart(3, '0');

    setLetterForm({
      ID_Surat: `SRT-${Date.now().toString().slice(-6)}`,
      Nomor_Surat: `${num}/${type === 'Surat Eksternal' ? 'EXT' : type === 'Surat Internal' ? 'INT' : 'KET'}/AIRIS/${mm}/${yy}`,
      Tipe_Surat: type,
      Tanggal: d.toISOString().slice(0, 10),
      Perihal: '',
      Lampiran: '',
      Kepada: '',
      Alamat_Tujuan: '',
      Isi_Surat: '',
      Isi_Surat_HTML: '',
      Penandatangan_Nama: 'H. Mujiburrahman, SIP',
      Penandatangan_Jabatan: 'Direktur Utama',
      Penandatangan_List: [{ id: 'sg-1', Keterangan: 'Hormat kami,', Nama: 'H. Mujiburrahman, SIP', Jabatan: 'Direktur Utama', useCustomTtdImage: false }],
      LetterDocSettings: undefined,
      Tembusan: '',
      Dibuat_Oleh: 'Admin'
    });
    setEditorKey(k => k + 1);
    setShowLetterDocSettingsPanel(false);
    setShowLetterEditorModal(true);
  };

  const handleOpenEditLetter = (letter: OfficialLetterItem) => {
    setEditingLetter(letter);
    const formWithList: OfficialLetterItem = {
      ...letter,
      Penandatangan_List: letter.Penandatangan_List && letter.Penandatangan_List.length > 0
        ? letter.Penandatangan_List.map((s, idx) => ({ ...s, Keterangan: s.Keterangan || (idx === 0 ? 'Hormat kami,' : 'Mengetahui / Menyetujui,') }))
        : [{ id: 'sg-1', Keterangan: 'Hormat kami,', Nama: letter.Penandatangan_Nama, Jabatan: letter.Penandatangan_Jabatan, useCustomTtdImage: false }]
    };
    setLetterForm(formWithList);
    setEditorKey(k => k + 1);
    setShowLetterDocSettingsPanel(false);
    setShowLetterEditorModal(true);
  };

  const handleDeleteLetter = async (id: string) => {
    const letter = letters.find(l => l.ID_Surat === id);
    const ok = await confirmAction({
      title: 'Hapus Surat Resmi',
      message: `Hapus dokumen surat "${letter?.Perihal || id}" secara permanen dari arsip persuratan?`,
      confirmText: 'Ya, Hapus Surat',
      cancelText: 'Batal',
      type: 'danger',
      itemDetails: {
        'No. Surat': id,
        'Perihal': letter?.Perihal || '-',
        'Tipe Surat': letter?.Tipe_Surat || '-'
      }
    });
    if (!ok) return;

    await deleteTableRow('Data_Surat', id);
    const updated = letters.filter(l => l.ID_Surat !== id);
    setLetters(updated);
    onRefresh();
    showToastGlobal('Surat Resmi Dihapus', `Surat ${id} berhasil dihapus dari arsip dan cloud.`, 'success');
  };

  const handleSaveLetter = () => {
    const htmlContent = getEditorHTML();
    const plainText = getEditorPlainText();
    const sigList = (letterForm.Penandatangan_List && letterForm.Penandatangan_List.length > 0)
      ? letterForm.Penandatangan_List
      : [{ id: 'sg-1', Nama: letterForm.Penandatangan_Nama, Jabatan: letterForm.Penandatangan_Jabatan }];
    const firstSig = sigList[0];
    
    const toSave: OfficialLetterItem = {
      ...letterForm,
      Isi_Surat: plainText || letterForm.Isi_Surat,
      Isi_Surat_HTML: htmlContent || letterForm.Isi_Surat_HTML || '',
      Penandatangan_Nama: firstSig?.Nama || letterForm.Penandatangan_Nama,
      Penandatangan_Jabatan: firstSig?.Jabatan || letterForm.Penandatangan_Jabatan,
      Penandatangan_List: sigList
    };

    const currentList = getTableData<OfficialLetterItem>('Data_Surat', []);
    if (editingLetter) {
      const updated = currentList.map(l => l.ID_Surat === editingLetter.ID_Surat ? toSave : l);
      setTableData('Data_Surat', updated);
      setLetters(updated);
    } else {
      const newSurat: OfficialLetterItem = {
        ...toSave,
        ID_Surat: toSave.ID_Surat || `SRT-${Date.now().toString().slice(-6)}`
      };
      const updated = [...currentList, newSurat];
      setTableData('Data_Surat', updated);
      setLetters(updated);
    }
    setShowLetterEditorModal(false);
    setEditingLetter(null);
    onRefresh();
  };

  const handleExportLetterPDF = (letter: OfficialLetterItem) => {
    generateOfficialLetterPDF({
      nomorSurat: letter.Nomor_Surat,
      tipeSurat: letter.Tipe_Surat,
      tanggal: letter.Tanggal,
      perihal: letter.Perihal,
      lampiran: letter.Lampiran,
      kepada: letter.Kepada,
      alamatTujuan: letter.Alamat_Tujuan,
      isiSurat: letter.Isi_Surat,
      penandatanganNama: letter.Penandatangan_Nama,
      penandatanganJabatan: letter.Penandatangan_Jabatan,
      tembusan: letter.Tembusan
    });
  };

  return (
    <div className="space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="text-blue-600" size={16} />
                Daftar Dokumen Persuratan Pabrik AIRIS
              </h3>
              <p className="text-xs text-slate-500">Mencakup Surat Eksternal ke Mitra, Surat Internal SOP/Memo, dan Surat Keterangan Karyawan.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Tombol Setting Format Surat Resmi */}
              <button
                onClick={handleOpenGlobalLetterSettings}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                title="Pengaturan Kop Surat, Cap, dan TTD Default untuk Surat Resmi"
              >
                <Settings size={14} className="text-slate-500" />
                <span>Setting Format Surat</span>
              </button>

              {/* Tombol Contoh Template Surat */}
              <button
                onClick={() => setShowTemplateGalleryModal(true)}
                className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                title="Pilih dari berbagai contoh template surat resmi siap pakai"
              >
                <Sparkles size={13} />
                <span>Contoh Template</span>
              </button>

              <div className="h-5 w-px bg-slate-300 hidden sm:block"></div>

              {/* Tombol Buat 3 Tipe Surat Resmi */}
              <button
                onClick={() => handleOpenAddLetter('Surat Eksternal')}
                className="px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Plus size={13} />
                <span>Surat Eksternal</span>
              </button>
              <button
                onClick={() => handleOpenAddLetter('Surat Internal')}
                className="px-2.5 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Plus size={13} />
                <span>Surat Internal</span>
              </button>
              <button
                onClick={() => handleOpenAddLetter('Surat Keterangan')}
                className="px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Plus size={13} />
                <span>Surat Keterangan</span>
              </button>

              <button
                onClick={() => exportDataToExcel(filteredLetters, 'Surat_Resmi', 'AIRIS_Arsip_Persuratan', 'ARSIP DOKUMEN PERSURATAN RESMI AMDK')}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download size={14} />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* Search Bar Surat Resmi */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari Nomor Surat, Perihal, Kepada/Tujuan, Penandatangan..."
                value={letterSearchQuery}
                onChange={e => setLetterSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
              />
              {letterSearchQuery && (
                <button
                  type="button"
                  onClick={() => setLetterSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-500 font-mono">
                {filteredLetters.length} Dokumen
              </span>
              {letterSearchQuery && (
                <button
                  type="button"
                  onClick={() => setLetterSearchQuery('')}
                  className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                >
                  <X size={12} />
                  <span>Reset Cari</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Nomor Surat</th>
                  <th className="p-3">Tipe Surat</th>
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Perihal Dokumen</th>
                  <th className="p-3">Tujuan / Kepada</th>
                  <th className="p-3">Penandatangan</th>
                  <th className="p-3 text-center">Cetak / PDF</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLetters.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 fst-italic">
                      {letterSearchQuery
                        ? `Tidak ada dokumen surat yang cocok dengan kata kunci "${letterSearchQuery}".`
                        : 'Belum ada dokumen surat yang dibuat. Klik salah satu tombol "Buat Surat" di atas.'}
                    </td>
                  </tr>
                ) : (
                  filteredLetters.map(letter => (
                    <tr key={letter.ID_Surat} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-blue-700">{letter.Nomor_Surat}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          letter.Tipe_Surat === 'Surat Eksternal' ? 'bg-blue-100 text-blue-800' :
                          letter.Tipe_Surat === 'Surat Internal' ? 'bg-amber-100 text-amber-800' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {letter.Tipe_Surat}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-500">{letter.Tanggal}</td>
                      <td className="p-3 font-semibold text-slate-900 max-w-xs">{letter.Perihal}</td>
                      <td className="p-3 text-slate-700">{letter.Kepada}</td>
                      <td className="p-3 text-slate-600">
                        {letter.Penandatangan_Nama}
                        <span className="block text-[10px] text-slate-400">{letter.Penandatangan_Jabatan}</span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewLetterModal(letter)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            title="Pratinjau Surat Resmi"
                          >
                            <Eye size={12} />
                            <span>Lihat</span>
                          </button>
                          <button
                            onClick={() => handleExportLetterPDF(letter)}
                            className="p-1 bg-red-50 hover:bg-red-100 text-red-600 rounded cursor-pointer"
                            title="Unduh PDF Resmi"
                          >
                            <FileDown size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditLetter(letter)}
                            className="p-1 text-slate-500 hover:text-blue-600 rounded cursor-pointer"
                            title="Edit Dokumen Surat"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteLetter(letter.ID_Surat)}
                            className="p-1 text-slate-500 hover:text-red-600 rounded cursor-pointer"
                            title="Hapus Surat"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      {showLetterEditorModal && (
        <div 
          className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-slate-900/75 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setShowLetterEditorModal(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white flex-shrink-0 sticky top-0 z-20 shadow-sm">
              <div className="flex items-center gap-2">
                <FileText className="text-cyan-400" size={18} />
                <h3 className="font-bold text-xs uppercase tracking-wider">
                  {editingLetter ? 'Edit Dokumen Surat Resmi' : 'Editor Surat Resmi AIRIS'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTemplateGalleryModal(true)}
                  className="px-2.5 py-1 text-xs font-semibold text-purple-200 bg-purple-900/60 hover:bg-purple-800 border border-purple-400/40 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  title="Pilih dari berbagai contoh template surat resmi siap pakai"
                >
                  <Sparkles size={13} className="text-purple-300" />
                  <span>Pilih Contoh Template</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setShowLetterEditorModal(false)} 
                  className="text-slate-400 hover:text-white cursor-pointer p-1"
                  title="Tutup (Esc)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 flex-1 overflow-y-auto text-xs">
              {/* Tipe Surat Selector Buttons */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Pilih Tipe Utama Surat:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Surat Eksternal', 'Surat Internal', 'Surat Keterangan'] as SuratType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => applyLetterTemplate(t)}
                      className={`p-2.5 rounded-lg border text-xs font-bold transition-all text-center cursor-pointer ${
                        letterForm.Tipe_Surat === t 
                          ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs' 
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Meta Data */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nomor Surat</label>
                  <input
                    type="text"
                    value={letterForm.Nomor_Surat}
                    onChange={e => setLetterForm({ ...letterForm, Nomor_Surat: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold text-blue-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Surat</label>
                  <input
                    type="date"
                    value={letterForm.Tanggal}
                    onChange={e => setLetterForm({ ...letterForm, Tanggal: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Perihal</label>
                  <input
                    type="text"
                    value={letterForm.Perihal}
                    onChange={e => setLetterForm({ ...letterForm, Perihal: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lampiran</label>
                  <input
                    type="text"
                    value={letterForm.Lampiran || '-'}
                    onChange={e => setLetterForm({ ...letterForm, Lampiran: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kepada Yth.</label>
                  <input
                    type="text"
                    value={letterForm.Kepada}
                    onChange={e => setLetterForm({ ...letterForm, Kepada: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alamat Tujuan / Lokasi</label>
                  <input
                    type="text"
                    value={letterForm.Alamat_Tujuan || ''}
                    onChange={e => setLetterForm({ ...letterForm, Alamat_Tujuan: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700"
                  />
                </div>
              </div>

              {/* Rich Text Editor: Formatting Toolbar + ContentEditable */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label className="block font-semibold text-slate-700">
                    Isi Naskah Surat (Rich Text Editor)
                  </label>
                  <span className="text-[11px] text-slate-500">Seleksi teks dahulu, lalu klik tombol format</span>
                </div>

                {/* Styling Toolbar */}
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-100 border border-slate-200 rounded-t-xl text-xs">
                  {/* Font Family */}
                  <select
                    title="Jenis Font"
                    onMouseDown={saveSelection}
                    onChange={e => { saveSelection(); execFormat('fontName', e.target.value); }}
                    className="px-2 py-1 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    <option value="sans-serif">Sans-Serif</option>
                    <option value="serif">Serif</option>
                    <option value="Times New Roman, Times, serif">Times New Roman</option>
                    <option value="Arial, Helvetica, sans-serif">Arial</option>
                    <option value="Calibri, Candara, Segoe, sans-serif">Calibri</option>
                    <option value="Roboto, sans-serif">Roboto</option>
                    <option value="monospace">Monospace</option>
                  </select>

                  {/* Font Size: execCommand fontSize uses 1-7 scale */}
                  <select
                    title="Ukuran Font"
                    onMouseDown={saveSelection}
                    onChange={e => { saveSelection(); execFormat('fontSize', e.target.value); }}
                    className="px-2 py-1 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    <option value="1">8pt</option>
                    <option value="2">10pt</option>
                    <option value="3">12pt (Normal)</option>
                    <option value="4">14pt</option>
                    <option value="5">18pt</option>
                    <option value="6">24pt</option>
                    <option value="7">36pt</option>
                  </select>

                  <div className="h-5 w-px bg-slate-300 mx-0.5"></div>

                  {/* Bold, Italic, Underline */}
                  <div className="flex items-center gap-0.5 bg-white border border-slate-300 rounded p-0.5">
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); saveSelection(); }}
                      onClick={() => execFormat('bold')}
                      className="p-1 rounded cursor-pointer text-slate-700 hover:bg-blue-100 hover:text-blue-700 font-bold"
                      title="Tebal (Bold) — Ctrl+B"
                    ><Bold size={13} /></button>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); saveSelection(); }}
                      onClick={() => execFormat('italic')}
                      className="p-1 rounded cursor-pointer text-slate-700 hover:bg-blue-100 hover:text-blue-700 italic"
                      title="Miring (Italic) — Ctrl+I"
                    ><Italic size={13} /></button>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); saveSelection(); }}
                      onClick={() => execFormat('underline')}
                      className="p-1 rounded cursor-pointer text-slate-700 hover:bg-blue-100 hover:text-blue-700 underline"
                      title="Garis Bawah (Underline) — Ctrl+U"
                    ><Underline size={13} /></button>
                  </div>

                  {/* Alignment */}
                  <div className="flex items-center gap-0.5 bg-white border border-slate-300 rounded p-0.5">
                    <button type="button" onMouseDown={e => { e.preventDefault(); saveSelection(); }} onClick={() => execFormat('justifyLeft')} className="p-1 rounded cursor-pointer text-slate-700 hover:bg-blue-100" title="Rata Kiri"><AlignLeft size={13} /></button>
                    <button type="button" onMouseDown={e => { e.preventDefault(); saveSelection(); }} onClick={() => execFormat('justifyCenter')} className="p-1 rounded cursor-pointer text-slate-700 hover:bg-blue-100" title="Rata Tengah"><AlignCenter size={13} /></button>
                    <button type="button" onMouseDown={e => { e.preventDefault(); saveSelection(); }} onClick={() => execFormat('justifyRight')} className="p-1 rounded cursor-pointer text-slate-700 hover:bg-blue-100" title="Rata Kanan"><AlignRight size={13} /></button>
                    <button type="button" onMouseDown={e => { e.preventDefault(); saveSelection(); }} onClick={() => execFormat('justifyFull')} className="p-1 rounded cursor-pointer text-slate-700 hover:bg-blue-100" title="Justify"><AlignJustify size={13} /></button>
                  </div>

                  <div className="h-5 w-px bg-slate-300 mx-0.5"></div>

                  {/* Text Color */}
                  <div className="flex items-center gap-1 bg-white border border-slate-300 rounded px-1.5 py-0.5">
                    <Palette size={13} className="text-slate-500" />
                    <input
                      type="color"
                      defaultValue="#1e293b"
                      onMouseDown={saveSelection}
                      onChange={e => { restoreSelection(); execFormat('foreColor', e.target.value); }}
                      className="w-5 h-5 p-0 border-0 rounded cursor-pointer bg-transparent"
                      title="Warna Teks"
                    />
                  </div>

                  {/* Insert Table Button & Size Controllers */}
                  <div className="flex items-center gap-1 bg-white border border-slate-300 rounded p-0.5">
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); saveSelection(); }}
                      onClick={() => setShowInsertTableDialog(true)}
                      className="flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-300 rounded text-xs font-semibold text-green-800 hover:bg-green-100 cursor-pointer"
                      title="Insert Tabel Baru"
                    >
                      <Table2 size={13} />
                      <span>+ Tabel</span>
                    </button>
                    
                    <div className="h-4 w-px bg-slate-300 mx-0.5"></div>

                    <span className="text-[10px] text-slate-500 font-medium px-1">Lebar:</span>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => handleSetLastTableWidth('100%')}
                      className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 rounded border border-slate-200"
                      title="Ubah lebar tabel ke 100% (Penuh)"
                    >
                      100%
                    </button>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => handleSetLastTableWidth('80%')}
                      className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 rounded border border-slate-200"
                      title="Ubah lebar tabel ke 80% (Sedang)"
                    >
                      80%
                    </button>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => handleSetLastTableWidth('60%')}
                      className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 rounded border border-slate-200"
                      title="Ubah lebar tabel ke 60% (Ringkas)"
                    >
                      60%
                    </button>

                    <div className="h-4 w-px bg-slate-300 mx-0.5"></div>

                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={handleAddTableRowAtCursor}
                      className="px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200"
                      title="Tambah baris baru pada tabel"
                    >
                      + Baris
                    </button>
                    <button
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={handleAddTableColAtCursor}
                      className="px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200"
                      title="Tambah kolom baru pada tabel"
                    >
                      + Kolom
                    </button>
                  </div>
                </div>

                {/* ContentEditable Editor */}
                <div
                  key={editorKey}
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onMouseUp={saveSelection}
                  onKeyUp={saveSelection}
                  onFocus={saveSelection}
                  dangerouslySetInnerHTML={{ __html: letterForm.Isi_Surat_HTML || letterForm.Isi_Surat.replace(/\n/g, '<br/>') }}
                  style={{ minHeight: '180px', outline: 'none', fontFamily: 'inherit', fontSize: '12px', lineHeight: '1.7' }}
                  className="w-full p-3 border border-t-0 border-slate-300 rounded-b-xl bg-white focus:ring-2 focus:ring-blue-400 leading-relaxed"
                />
              </div>

              {/* Multiple Signatories */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="block font-semibold text-slate-700">Daftar Penandatangan Surat</label>
                    <span className="text-[11px] text-slate-400">Posisi penandatangan akan otomatis disejajarkan rapi pada pratinjau & cetak</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSignatory}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded cursor-pointer"
                  >
                    <UserPlus size={13} />
                    <span>Tambah Penandatangan</span>
                  </button>
                </div>
                <div className="space-y-3">
                  {(letterForm.Penandatangan_List && letterForm.Penandatangan_List.length > 0
                    ? letterForm.Penandatangan_List
                    : [{ id: 'sg-1', Keterangan: 'Hormat kami,', Nama: letterForm.Penandatangan_Nama, Jabatan: letterForm.Penandatangan_Jabatan }]
                  ).map((sig, idx) => (
                    <div key={sig.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">
                            {idx + 1}
                          </span>
                          Penandatangan #{idx + 1}
                        </span>
                        {(letterForm.Penandatangan_List?.length || 1) > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSignatory(sig.id)}
                            className="px-2 py-0.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded cursor-pointer flex items-center gap-1"
                            title="Hapus penandatangan ini"
                          >
                            <UserMinus size={12} />
                            <span>Hapus</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Keterangan / Posisi</label>
                          <input
                            type="text"
                            placeholder={idx === 0 ? 'Hormat kami,' : 'Mengetahui / Menyetujui,'}
                            value={sig.Keterangan || ''}
                            onChange={e => handleUpdateSignatory(sig.id, 'Keterangan', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 text-xs bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Nama Lengkap</label>
                          <input
                            type="text"
                            value={sig.Nama}
                            onChange={e => handleUpdateSignatory(sig.id, 'Nama', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-900 text-xs bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Jabatan Resmi</label>
                          <input
                            type="text"
                            value={sig.Jabatan}
                            onChange={e => handleUpdateSignatory(sig.id, 'Jabatan', e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 text-xs bg-white"
                          />
                        </div>
                      </div>

                      {/* Gambar Tanda Tangan (Opsional - Bisa diisi atau dikosongkan) */}
                      <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                          <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                            <span>Gambar Tanda Tangan (Opsional):</span>
                          </label>
                          {sig.customTtdImage ? (
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateSignatory(sig.id, 'customTtdImage', '');
                                handleUpdateSignatory(sig.id, 'useCustomTtdImage', false);
                              }}
                              className="px-2 py-0.5 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded flex items-center gap-1 font-medium cursor-pointer"
                            >
                              <X size={11} />
                              <span>Kosongkan / Hapus TTD</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">
                              Dikosongkan (untuk tanda tangan basah/manual saat dicetak)
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const b64 = await compressUploadedImage(file, 300, 150);
                              handleUpdateSignatory(sig.id, 'customTtdImage', b64);
                              handleUpdateSignatory(sig.id, 'useCustomTtdImage', true);
                            }}
                            className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                          />
                          {sig.customTtdImage && (
                            <div className="flex items-center gap-2 p-1 border border-slate-200 rounded bg-slate-50">
                              <img src={sig.customTtdImage} alt="TTD Preview" className="h-9 w-auto object-contain" />
                              <span className="text-[10px] text-emerald-600 font-semibold">✓ TTD Terpasang</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-Letter Document Settings Accordion */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowLetterDocSettingsPanel(p => !p)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Settings size={13} className="text-slate-500" />
                    ⚙️ Pengaturan Kop, Cap & TTD Surat Ini
                  </span>
                  {showLetterDocSettingsPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showLetterDocSettingsPanel && (
                  <div className="p-4 bg-white space-y-3 border-t border-slate-200 text-xs">
                    <p className="text-[11px] text-slate-500 mb-2">Jika dikosongkan, surat akan menggunakan pengaturan global Invoice Custom.</p>
                    
                    {/* Nama Perusahaan */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Nama Perusahaan (Kop)</label>
                      <input
                        type="text"
                        placeholder={docSettings.namaPerusahaan}
                        value={letterForm.LetterDocSettings?.namaPerusahaan || ''}
                        onChange={e => handleUpdateLetterDocSetting('namaPerusahaan', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Sub Nama / Tagline</label>
                      <input
                        type="text"
                        placeholder={docSettings.subNamaPerusahaan}
                        value={letterForm.LetterDocSettings?.subNamaPerusahaan || ''}
                        onChange={e => handleUpdateLetterDocSetting('subNamaPerusahaan', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Alamat Perusahaan</label>
                      <input
                        type="text"
                        placeholder={docSettings.alamatPerusahaan}
                        value={letterForm.LetterDocSettings?.alamatPerusahaan || ''}
                        onChange={e => handleUpdateLetterDocSetting('alamatPerusahaan', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Kontak Perusahaan</label>
                      <input
                        type="text"
                        placeholder={docSettings.kontakPerusahaan}
                        value={letterForm.LetterDocSettings?.kontakPerusahaan || ''}
                        onChange={e => handleUpdateLetterDocSetting('kontakPerusahaan', e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>

                    {/* Upload Kop */}
                    <div className="pt-2 border-t border-slate-100">
                      <label className="block font-semibold text-slate-700 mb-1">Kop Surat Custom (Gambar)</label>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={letterForm.LetterDocSettings?.useCustomKopImage || false}
                            onChange={e => handleUpdateLetterDocSetting('useCustomKopImage', e.target.checked)}
                          />
                          <span className="text-slate-600">Gunakan Gambar Kop Custom</span>
                        </label>
                      </div>
                      {letterForm.LetterDocSettings?.useCustomKopImage && (
                        <div className="mt-1.5 space-y-1">
                          <input
                            type="file" accept="image/*"
                            onChange={async e => {
                              const file = e.target.files?.[0]; if (!file) return;
                              const b64 = await compressUploadedImage(file, 900, 180);
                              handleUpdateLetterDocSetting('customKopImage', b64);
                            }}
                            className="text-[11px] cursor-pointer"
                          />
                          {letterForm.LetterDocSettings?.customKopImage && (
                            <img src={letterForm.LetterDocSettings.customKopImage} alt="Kop" className="h-12 w-auto object-contain border border-slate-200 rounded" />
                          )}
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-slate-500">Lebar:</label>
                            <input type="range" min={30} max={100} value={letterForm.LetterDocSettings?.kopWidth ?? 100} onChange={e => handleUpdateLetterDocSetting('kopWidth', Number(e.target.value))} className="flex-1" />
                            <span className="text-[11px] font-mono w-10">{letterForm.LetterDocSettings?.kopWidth ?? 100}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-slate-500">Tinggi:</label>
                            <input type="range" min={40} max={200} value={letterForm.LetterDocSettings?.kopHeight ?? 90} onChange={e => handleUpdateLetterDocSetting('kopHeight', Number(e.target.value))} className="flex-1" />
                            <span className="text-[11px] font-mono w-12">{letterForm.LetterDocSettings?.kopHeight ?? 90}px</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Cap */}
                    <div className="pt-2 border-t border-slate-100">
                      <label className="block font-semibold text-slate-700 mb-1">Cap / Stempel</label>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={letterForm.LetterDocSettings?.showCap ?? true} onChange={e => handleUpdateLetterDocSetting('showCap', e.target.checked)} />
                          <span className="text-slate-600">Tampilkan Cap</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={letterForm.LetterDocSettings?.useCustomCapImage || false} onChange={e => handleUpdateLetterDocSetting('useCustomCapImage', e.target.checked)} />
                          <span className="text-slate-600">Gunakan Gambar Cap Custom</span>
                        </label>
                      </div>
                      {letterForm.LetterDocSettings?.useCustomCapImage && (
                        <div className="mt-1.5 space-y-1">
                          <input type="file" accept="image/*" onChange={async e => {
                            const file = e.target.files?.[0]; if (!file) return;
                            const b64 = await compressUploadedImage(file, 200, 200);
                            handleUpdateLetterDocSetting('customCapImage', b64);
                          }} className="text-[11px] cursor-pointer" />
                          {letterForm.LetterDocSettings?.customCapImage && (
                            <img src={letterForm.LetterDocSettings.customCapImage} alt="Cap" className="h-12 w-auto object-contain" />
                          )}
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-slate-500">Ukuran:</label>
                            <input type="range" min={40} max={160} value={letterForm.LetterDocSettings?.capWidth ?? 80} onChange={e => { handleUpdateLetterDocSetting('capWidth', Number(e.target.value)); handleUpdateLetterDocSetting('capHeight', Number(e.target.value)); }} className="flex-1" />
                            <span className="text-[11px] font-mono w-12">{letterForm.LetterDocSettings?.capWidth ?? 80}px</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* TTD */}
                    <div className="pt-2 border-t border-slate-100">
                      <label className="block font-semibold text-slate-700 mb-1">Tanda Tangan (Global untuk Surat Ini)</label>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={letterForm.LetterDocSettings?.showTtd ?? true} onChange={e => handleUpdateLetterDocSetting('showTtd', e.target.checked)} />
                          <span className="text-slate-600">Tampilkan TTD</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={letterForm.LetterDocSettings?.useCustomTtdImage || false} onChange={e => handleUpdateLetterDocSetting('useCustomTtdImage', e.target.checked)} />
                          <span className="text-slate-600">TTD Custom</span>
                        </label>
                      </div>
                      {letterForm.LetterDocSettings?.useCustomTtdImage && (
                        <div className="mt-1.5 space-y-1">
                          <input type="file" accept="image/*" onChange={async e => {
                            const file = e.target.files?.[0]; if (!file) return;
                            const b64 = await compressUploadedImage(file, 300, 150);
                            handleUpdateLetterDocSetting('customTtdImage', b64);
                          }} className="text-[11px] cursor-pointer" />
                          {letterForm.LetterDocSettings?.customTtdImage && (
                            <img src={letterForm.LetterDocSettings.customTtdImage} alt="TTD" className="h-10 w-auto object-contain" />
                          )}
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-slate-500">Lebar:</label>
                            <input type="range" min={60} max={200} value={letterForm.LetterDocSettings?.ttdWidth ?? 110} onChange={e => handleUpdateLetterDocSetting('ttdWidth', Number(e.target.value))} className="flex-1" />
                            <span className="text-[11px] font-mono w-12">{letterForm.LetterDocSettings?.ttdWidth ?? 110}px</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tembusan (Opsional)</label>
                <input
                  type="text"
                  value={letterForm.Tembusan || ''}
                  onChange={e => setLetterForm({ ...letterForm, Tembusan: e.target.value })}
                  placeholder="Contoh: Kepala Operasional, Arsip"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700"
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200 flex-shrink-0 sticky bottom-0 z-20">
              <button
                type="button"
                onClick={() => setShowLetterEditorModal(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Batal
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportLetterPDF(letterForm)}
                  className="px-4 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileDown size={14} />
                  <span>Download PDF Langsung</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveLetter}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Save size={14} />
                  <span>Simpan Surat Resmi</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Insert Table Dialog */}
      {showInsertTableDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-72 border border-slate-200">
            <h3 className="font-bold text-sm text-slate-800 mb-4">Insert Tabel</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jumlah Baris</label>
                <input
                  type="number" min={1} max={20}
                  value={tableRows}
                  onChange={e => setTableRows(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-center font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jumlah Kolom</label>
                <input
                  type="number" min={1} max={10}
                  value={tableCols}
                  onChange={e => setTableCols(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-center font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lebar Panjang Tabel</label>
                <select
                  value={tableWidthPercent}
                  onChange={e => setTableWidthPercent(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-800"
                >
                  <option value="100%">100% (Penuh Halaman)</option>
                  <option value="80%">80% (Sedang Proporsional)</option>
                  <option value="60%">60% (Ringkas Tengah)</option>
                  <option value="auto">Auto (Mengikuti Lebar Teks)</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowInsertTableDialog(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
              >Batal</button>
              <button
                type="button"
                onClick={() => handleInsertTable(tableRows, tableCols, tableWidthPercent)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg cursor-pointer flex items-center gap-1"
              >
                <Table2 size={13} />
                Insert Tabel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: PRATINJAU CETAK A4 SURAT RESMI (DAPAT DICETAK & PDF)    */}
      {/* ============================================================== */}
      {viewLetterModal && (
        <div 
          className="fixed inset-0 z-50 flex justify-center items-start sm:items-center bg-slate-900/75 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto printable-modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setViewLetterModal(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh] printable-modal-card">
            {/* Header Pratinjau Tetap (Sticky di Atas — Selalu Terlihat) */}
            <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white flex-shrink-0 sticky top-0 z-30 shadow-sm no-print">
              <div className="flex items-center gap-2">
                <FileCheck size={18} className="text-cyan-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider truncate max-w-md">
                  Pratinjau Dokumen Surat: {viewLetterModal.Nomor_Surat}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                >
                  <Printer size={13} />
                  <span>Cetak A4</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportLetterPDF(viewLetterModal)}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                >
                  <FileDown size={13} />
                  <span>Download PDF</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setViewLetterModal(null)} 
                  className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors ml-1"
                  title="Tutup Pratinjau (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* A4 Canvas Area: Scrollable di Layar, Penuh tanpa terpotong saat Cetak */}
            <div className="flex-1 overflow-y-auto p-8 sm:p-12 font-sans text-slate-900 bg-white printable-content printable-scroll-area" style={{ minHeight: '650px' }}>
              {/* Kop Surat Header (Per-letter settings with globalLetterSettings fallback) */}
              <div className="pb-4 border-b-2 border-slate-900 mb-6">
                {(viewLetterModal.LetterDocSettings?.useCustomKopImage ?? globalLetterSettings.useCustomKopImage) && (viewLetterModal.LetterDocSettings?.customKopImage || globalLetterSettings.customKopImage) ? (
                  <div className="flex justify-center mb-2">
                    <img
                      src={viewLetterModal.LetterDocSettings?.customKopImage || globalLetterSettings.customKopImage}
                      alt="Kop Surat"
                      style={{
                        width: `${viewLetterModal.LetterDocSettings?.kopWidth ?? globalLetterSettings.kopWidth ?? 100}%`,
                        height: `${viewLetterModal.LetterDocSettings?.kopHeight ?? globalLetterSettings.kopHeight ?? 90}px`,
                        objectFit: 'contain'
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-center">
                    <h1 className="text-xl font-black text-blue-900 tracking-wide uppercase">
                      {viewLetterModal.LetterDocSettings?.namaPerusahaan || globalLetterSettings.namaPerusahaan || 'PT. ANUGERAH ILLAHI RABBI'}
                    </h1>
                    <p className="text-xs text-slate-600 font-medium">
                      {viewLetterModal.LetterDocSettings?.subNamaPerusahaan || globalLetterSettings.subNamaPerusahaan || 'Produsen Air Minum Dalam Kemasan (AMDK) As-Shofaa'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {viewLetterModal.LetterDocSettings?.alamatPerusahaan || globalLetterSettings.alamatPerusahaan || 'Dk. Gading Baru, RT.03/RW.08, Belangwetan, Klaten Utara, Klaten, Jawa Tengah'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Telepon / Kontak: {viewLetterModal.LetterDocSettings?.kontakPerusahaan || globalLetterSettings.kontakPerusahaan || '(0272) 898123 • Email: official@airis-amdk.com'}
                    </p>
                  </div>
                )}
              </div>

              {/* Meta Surat */}
              <div className="my-6 text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Nomor: <strong className="font-mono">{viewLetterModal.Nomor_Surat}</strong></span>
                  <span>Klaten, {viewLetterModal.Tanggal}</span>
                </div>
                <div>Lampiran: {viewLetterModal.Lampiran || '-'}</div>
                <div>Perihal : <strong>{viewLetterModal.Perihal}</strong></div>
              </div>

              <div className="my-5 text-xs">
                <div>Kepada Yth.</div>
                <div className="font-bold text-slate-900">{viewLetterModal.Kepada}</div>
                {viewLetterModal.Alamat_Tujuan && <div className="text-slate-700">{viewLetterModal.Alamat_Tujuan}</div>}
                <div>Di Tempat</div>
              </div>

              {viewLetterModal.Tipe_Surat === 'Surat Keterangan' && (
                <div className="text-center my-6">
                  <h3 className="text-sm font-black underline uppercase tracking-widest text-slate-900">SURAT KETERANGAN</h3>
                  <p className="font-mono text-xs text-slate-600">Nomor: {viewLetterModal.Nomor_Surat}</p>
                </div>
              )}

              {/* Isi Surat with rich HTML support or plain text fallback */}
              <div className="my-6 leading-relaxed">
                {viewLetterModal.Isi_Surat_HTML ? (
                  <div 
                    className="prose prose-slate max-w-none text-xs leading-relaxed" 
                    dangerouslySetInnerHTML={{ __html: viewLetterModal.Isi_Surat_HTML }} 
                  />
                ) : (
                  <div 
                    className="whitespace-pre-wrap leading-relaxed"
                    style={{
                      fontFamily: letterTextStyle.fontFamily,
                      fontSize: `${letterTextStyle.fontSize}px`,
                      textAlign: letterTextStyle.textAlign,
                      fontWeight: letterTextStyle.fontWeight,
                      fontStyle: letterTextStyle.fontStyle,
                      textDecoration: letterTextStyle.textDecoration,
                      color: letterTextStyle.color
                    }}
                  >
                    {viewLetterModal.Isi_Surat}
                  </div>
                )}
              </div>

              {/* Tanda Tangan & Cap Resmi — Multiple Signatories (Sejajar Rapi) */}
              {(() => {
                const effectiveSig = (viewLetterModal.Penandatangan_List && viewLetterModal.Penandatangan_List.length > 0)
                  ? viewLetterModal.Penandatangan_List
                  : [{ 
                      id: 'sg-1', 
                      Keterangan: 'Hormat kami,',
                      Nama: viewLetterModal.Penandatangan_Nama || 'H. Mujiburrahman, SIP', 
                      Jabatan: viewLetterModal.Penandatangan_Jabatan || 'Direktur Utama', 
                      useCustomTtdImage: false, 
                      customTtdImage: undefined 
                    }];
                const ls = viewLetterModal.LetterDocSettings || globalLetterSettings;
                const effShowCap = ls?.showCap ?? globalLetterSettings.showCap ?? docSettings.showCap;
                const effShowTtd = ls?.showTtd ?? globalLetterSettings.showTtd ?? docSettings.showTtd;
                const effCapW = ls?.capWidth ?? globalLetterSettings.capWidth ?? docSettings.capWidth ?? 80;
                const effCapH = ls?.capHeight ?? globalLetterSettings.capHeight ?? docSettings.capHeight ?? 80;
                const effCapImg = (ls?.useCustomCapImage && ls.customCapImage) 
                  ? ls.customCapImage 
                  : ((globalLetterSettings.useCustomCapImage && globalLetterSettings.customCapImage) 
                      ? globalLetterSettings.customCapImage 
                      : (docSettings.useCustomCapImage ? docSettings.customCapImage : null));
                const effTtdW = ls?.ttdWidth ?? globalLetterSettings.ttdWidth ?? docSettings.ttdWidth ?? 110;
                const effTtdH = ls?.ttdHeight ?? globalLetterSettings.ttdHeight ?? docSettings.ttdHeight ?? 75;
                const effTtdImg = (ls?.useCustomTtdImage && ls.customTtdImage) 
                  ? ls.customTtdImage 
                  : ((globalLetterSettings.useCustomTtdImage && globalLetterSettings.customTtdImage) 
                      ? globalLetterSettings.customTtdImage 
                      : (docSettings.useCustomTtdImage ? docSettings.customTtdImage : null));
                const effNamaPerus = ls?.namaPerusahaan || globalLetterSettings.namaPerusahaan || docSettings.namaPerusahaan || 'PT. ANUGERAH ILLAHI RABBI';
                
                return (
                  <div className="mt-12 pt-6">
                    {/* Header Kota & Perusahaan di atas penandatangan */}
                    <div className="text-right mb-4">
                      <p className="text-xs text-slate-600 font-medium">Klaten, {viewLetterModal.Tanggal}</p>
                      <p className="text-xs font-bold text-blue-900">{effNamaPerus}</p>
                    </div>

                    {/* Container Penandatangan (Grid Rata Bawah - Nama Sejajar Horizontal) */}
                    <div 
                      className="flex flex-wrap justify-end gap-8"
                      style={{ 
                        display: 'grid', 
                        gridAutoFlow: 'column', 
                        gridAutoColumns: effectiveSig.length > 2 ? 'minmax(160px, 190px)' : 'minmax(190px, 220px)', 
                        justifyContent: 'end' 
                      }}
                    >
                      {effectiveSig.map((sig, idx) => (
                        <div key={sig.id} className="flex flex-col justify-between text-center min-w-[160px]">
                          {/* 1. Baris Keterangan Pengesahan (Tinggi Seragam h-8) */}
                          <div className="h-8 flex items-end justify-center text-xs text-slate-600 mb-1 font-medium">
                            <span>{sig.Keterangan || (idx === 0 ? 'Hormat kami,' : 'Mengetahui / Menyetujui,')}</span>
                          </div>

                          {/* 2. Area Tanda Tangan & Cap (Tinggi Seragam h-24) */}
                          <div className="h-24 relative flex items-center justify-center my-1 select-none pointer-events-none">
                            {/* Cap Stempel (hanya jika ada gambar cap custom) */}
                            {idx === 0 && effShowCap && effCapImg && (
                              <img src={effCapImg} alt="Cap" style={{ width: `${effCapW}px`, height: `${effCapH}px` }} className="absolute left-2 top-0 object-contain" />
                            )}

                            {/* TTD (hanya jika ada gambar TTD custom) */}
                            {effShowTtd && (
                              sig.useCustomTtdImage && sig.customTtdImage ? (
                                <img src={sig.customTtdImage} alt="TTD" style={{ width: `${effTtdW}px`, height: `${effTtdH}px` }} className="absolute left-10 -top-1 object-contain z-10" />
                              ) : (idx === 0 && !sig.useCustomTtdImage && effTtdImg) ? (
                                <img src={effTtdImg} alt="TTD" style={{ width: `${effTtdW}px`, height: `${effTtdH}px` }} className="absolute left-10 -top-1 object-contain z-10" />
                              ) : null
                            )}
                          </div>

                          {/* 3. Baris Nama & Jabatan (Garis & Nama Sejajar Sempurna Horizontal) */}
                          <div className="pt-2 border-t border-slate-900 mt-1">
                            <p className="text-xs font-bold text-slate-900 underline whitespace-nowrap">
                              {sig.Nama}
                            </p>
                            <p className="text-[11px] text-slate-500 whitespace-nowrap mt-0.5">
                              {sig.Jabatan}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {viewLetterModal.Tembusan && (
                <div className="mt-8 pt-4 border-t border-slate-100 text-[10px] text-slate-500">
                  <span>Tembusan: {viewLetterModal.Tembusan}</span>
                </div>
              )}
            </div>

            {/* Footer Pratinjau Tetap (Sticky di Bawah — Selalu Terlihat & Mudah Ditutup) */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center flex-shrink-0 sticky bottom-0 z-30 no-print">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Printer size={13} />
                  <span>Cetak Dokumen (A4)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportLetterPDF(viewLetterModal)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <FileDown size={13} />
                  <span>Unduh PDF</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setViewLetterModal(null)}
                className="px-5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Tutup Pratinjau Surat dan Kembali ke Daftar Arsip (Esc)"
              >
                <X size={14} />
                <span>Tutup & Kembali</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};