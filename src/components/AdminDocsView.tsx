import React, { useState } from 'react';
import { FileText, ShoppingBag, Receipt } from 'lucide-react';
import { 
  SupplierItem, RawMaterialItem, CustomerItem, 
  DistributionItem, DistributionProductDetail, ProductItem 
} from '../types';
import { AdminSuratTab } from './adminDocs/AdminSuratTab';
import { AdminPOTab } from './adminDocs/AdminPOTab';
import { AdminCustomInvoiceTab } from './adminDocs/AdminCustomInvoiceTab';

interface AdminDocsViewProps {
  suppliers: SupplierItem[];
  rawMaterials: RawMaterialItem[];
  customers?: CustomerItem[];
  distributions?: DistributionItem[];
  distributionItems?: DistributionProductDetail[];
  products?: ProductItem[];
  onRefresh: () => void;
}

export const AdminDocsView: React.FC<AdminDocsViewProps> = ({
  suppliers,
  rawMaterials,
  customers = [],
  distributions = [],
  distributionItems = [],
  products = [],
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'surat' | 'po' | 'invoice_custom'>('surat');

  return (
    <div className="space-y-6">
      {/* Tab Navigation Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('surat')}
            className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'surat'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <FileText size={15} />
            <span>Persuratan Resmi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('po')}
            className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'po'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <ShoppingBag size={15} />
            <span>Purchase Order (PO)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('invoice_custom')}
            className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'invoice_custom'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Receipt size={15} />
            <span>Invoice Custom Gabungan</span>
          </button>
        </div>
      </div>

      {/* Modular Tab Content */}
      {activeTab === 'surat' && (
        <AdminSuratTab onRefresh={onRefresh} />
      )}

      {activeTab === 'po' && (
        <AdminPOTab
          suppliers={suppliers}
          rawMaterials={rawMaterials}
          onRefresh={onRefresh}
        />
      )}

      {activeTab === 'invoice_custom' && (
        <AdminCustomInvoiceTab
          customers={customers}
          distributions={distributions}
          distributionItems={distributionItems}
          products={products}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
};
export default AdminDocsView;
