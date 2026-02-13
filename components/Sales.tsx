
import React, { useState, useEffect, useRef } from 'react';
import { Medicine, Sale, SaleItem, Language, PrinterConfig } from '../types';
import { translations } from '../translations';

interface SalesProps {
  medicines: Medicine[];
  language: Language;
  onRecordSale: (sale: Sale) => void;
}

const Sales: React.FC<SalesProps> = ({ medicines, language, onRecordSale }) => {
  const t = translations[language];
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [bankIdInput, setBankIdInput] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [billItems, setBillItems] = useState<SaleItem[]>([]);
  const [showReceipt, setShowReceipt] = useState<Sale | null>(null);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const getPrinterConfig = (): PrinterConfig | null => {
    const saved = localStorage.getItem('pharma_printer_config');
    return saved ? JSON.parse(saved) : null;
  };

  useEffect(() => {
    const focusScanner = () => {
      if (barcodeRef.current && document.activeElement?.tagName !== 'INPUT' && !showReceipt) {
        barcodeRef.current.focus();
      }
    };
    const interval = setInterval(focusScanner, 500);
    window.addEventListener('click', focusScanner);
    return () => {
      clearInterval(interval);
      window.removeEventListener('click', focusScanner);
    };
  }, [showReceipt]);

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;

    const med = medicines.find(m => m.barcode === code || m.id === code);
    if (med) {
      // Check stock against what is already in the bill
      const alreadyInBill = billItems.find(i => i.medicineId === med.id)?.quantity || 0;
      if (med.stock > alreadyInBill) {
        addItemToBill(med);
        setLastAdded(med.name);
        setTimeout(() => setLastAdded(null), 2000);
      } else {
        alert(language === 'ar' ? 'نفد المخزون!' : 'Out of Stock!');
      }
    }
    setBarcodeInput('');
  };

  const addItemToBill = (medicine: Medicine) => {
    setBillItems(prev => {
      const existing = prev.find(item => item.medicineId === medicine.id);
      if (existing) {
        if (existing.quantity >= medicine.stock) return prev;
        return prev.map(item => 
          item.medicineId === medicine.id 
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price } 
            : item
        );
      }
      return [...prev, {
        medicineId: medicine.id,
        medicineName: medicine.name,
        quantity: 1,
        buyPrice: medicine.buyPrice,
        price: medicine.price,
        subtotal: medicine.price
      }];
    });
  };

  const removeItemFromBill = (id: string) => {
    setBillItems(prev => prev.filter(item => item.medicineId !== id));
  };

  const calculateTotal = () => billItems.reduce((acc, item) => acc + item.subtotal, 0);

  const handleCheckout = () => {
    if (billItems.length === 0) return;
    
    const newSale: Sale = {
      id: Math.random().toString(36).substr(2, 9).toUpperCase(),
      items: [...billItems],
      total: calculateTotal(),
      timestamp: new Date(),
      bankTransactionId: bankIdInput.trim() || undefined,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined
    };
    
    onRecordSale(newSale);
    setShowReceipt(newSale);
    
    const printerConfig = getPrinterConfig();
    if (printerConfig?.autoPrint) {
      setTimeout(() => {
        triggerRealPrint();
      }, 500); 
    }

    setBillItems([]);
    setBankIdInput('');
    setCustomerName('');
    setCustomerPhone('');
  };

  const triggerRealPrint = () => {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.printReceipt();
    } else {
      window.print();
    }
  };

  const filteredMedicines = medicines.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.genericName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.barcode.includes(searchTerm)
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
      <div className="flex-1 flex flex-col space-y-4 overflow-hidden relative no-print">
        {lastAdded && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-top-4 duration-300">
            <div className="bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 rtl:space-x-reverse border-2 border-emerald-400">
              <span className="text-xl">✨</span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">System Action</p>
                <p className="font-bold">{language === 'ar' ? 'تمت إضافة العنصر' : 'Item added to bill'}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">{t.pointOfSale}</h1>
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <form onSubmit={handleBarcodeSubmit} className="relative group">
              <span className="absolute inset-y-0 start-3 flex items-center text-slate-400">🏷️</span>
              <input 
                ref={barcodeRef}
                type="text" 
                placeholder={t.scanBarcode}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="w-48 ps-10 pe-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm transition-all focus:w-64"
              />
            </form>
            <div className="relative w-64">
              <span className="absolute inset-y-0 start-3 flex items-center text-slate-400">🔍</span>
              <input 
                type="text" 
                placeholder={t.searchMedicines} 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full ps-10 pe-4 py-2 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-4 px-1">
          {filteredMedicines.map(med => {
            const inBill = billItems.find(i => i.medicineId === med.id)?.quantity || 0;
            const remaining = med.stock - inBill;
            
            return (
              <button
                key={med.id}
                disabled={remaining <= 0}
                onClick={() => addItemToBill(med)}
                className={`group text-start p-5 bg-white border rounded-[2rem] transition-all shadow-sm hover:shadow-xl hover:border-emerald-500 flex flex-col justify-between relative overflow-hidden ${remaining <= 0 ? 'opacity-40 grayscale cursor-not-allowed' : 'hover:-translate-y-1'}`}
              >
                {inBill > 0 && (
                  <div className="absolute top-0 right-0 bg-emerald-600 text-white px-3 py-1 text-[10px] font-black rounded-bl-xl shadow-lg animate-in zoom-in">
                    {inBill} IN BILL
                  </div>
                )}
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg uppercase w-fit tracking-widest">{med.category}</span>
                      <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg uppercase w-fit tracking-widest">{t.forms[med.formType]}</span>
                    </div>
                    <div className={`text-end text-[10px] font-black px-2 py-1 rounded-lg border uppercase tracking-tighter ${remaining < 10 ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                      {language === 'ar' ? 'المتبقي' : 'Rem'}: {remaining}
                    </div>
                  </div>
                  <h3 className="font-black text-slate-800 tracking-tight leading-tight mb-1">{med.name}</h3>
                  <p className="text-[11px] text-slate-500 font-medium line-clamp-1 italic">{med.genericName}</p>
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-xl font-black text-slate-900">{med.price.toLocaleString()} <span className="text-[10px] opacity-40">{t.currency}</span></span>
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center font-black shadow-inner group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    {remaining > 0 ? '+' : '✕'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full lg:w-96 bg-white border rounded-[2.5rem] shadow-xl flex flex-col overflow-hidden no-print">
        <div className="p-6 border-b bg-slate-50/50">
          <h2 className="text-lg font-black text-slate-800 flex items-center tracking-tight"><span className="me-3">🧾</span> {t.currentBill}</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {billItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60">
              <span className="text-6xl mb-4">🛒</span>
              <p className="font-black uppercase tracking-widest text-xs">{t.emptyBill}</p>
            </div>
          ) : (
            billItems.map(item => (
              <div key={item.medicineId} className="flex items-center justify-between p-4 bg-slate-50 rounded-[1.5rem] border border-slate-100 group animate-in slide-in-from-right-4">
                <div className="flex-1">
                  <p className="text-sm font-black text-slate-800 tracking-tight">{item.medicineName}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{item.price.toLocaleString()} x {item.quantity}</p>
                </div>
                <div className="text-end flex items-center space-x-4 rtl:space-x-reverse">
                  <span className="text-sm font-black text-emerald-600">{item.subtotal.toLocaleString()}</span>
                  <button onClick={() => removeItemFromBill(item.medicineId)} className="w-8 h-8 bg-white text-rose-500 rounded-xl text-xs shadow-sm hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center">✕</button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-6 border-t bg-slate-50 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ps-1">{t.customerName}</label>
              <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full px-4 py-2.5 bg-white border rounded-xl text-xs font-bold shadow-sm" placeholder="Optional" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ps-1">{t.customerPhone}</label>
              <input type="text" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full px-4 py-2.5 bg-white border rounded-xl text-xs font-bold shadow-sm" placeholder="Optional" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ps-1">{t.bankTransactionId}</label>
            <input type="text" value={bankIdInput} onChange={e => setBankIdInput(e.target.value)} className="w-full px-4 py-2.5 bg-white border rounded-xl text-xs font-mono font-bold shadow-inner" placeholder="E-Receipt Ref" />
          </div>
          <div className="flex items-center justify-between text-lg font-black text-slate-800 border-t pt-4">
            <span className="uppercase tracking-[0.2em] text-[10px] text-slate-400">{t.total}</span>
            <span className="text-3xl text-emerald-600 tracking-tighter">{calculateTotal().toLocaleString()} <span className="text-xs">{t.currency}</span></span>
          </div>
          <button 
            onClick={handleCheckout} 
            disabled={billItems.length === 0} 
            className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-2xl transition-all active:scale-95 ${billItems.length > 0 ? 'bg-emerald-600 text-white shadow-emerald-500/20 hover:bg-emerald-500' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          >
            {t.checkout}
          </button>
        </div>
      </div>

      {showReceipt && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-[0_0_100px_rgba(0,0,0,0.3)] overflow-hidden animate-in zoom-in duration-300">
            <div className="p-10 text-center bg-emerald-600 text-white relative">
               <div className="absolute top-4 right-4 bg-white/20 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">Stock Updated</div>
               <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-6 shadow-inner animate-bounce">🛡️</div>
               <h2 className="text-3xl font-black tracking-tight mb-2">{t.paymentSuccess}</h2>
               <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-widest">Records Secured & Stock Decreased</p>
            </div>
            <div className="p-10 space-y-8">
              <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b pb-6">
                <div><p className="mb-1">{t.receipt}</p><p className="text-slate-800 text-sm font-mono">#{showReceipt.id}</p></div>
                <div className="text-end"><p className="mb-1">{t.customerName}</p><p className="text-slate-800 text-sm">{showReceipt.customerName || (language === 'ar' ? 'عميل عابر' : 'Walk-in')}</p></div>
              </div>
              
              <div className="space-y-4 max-h-48 overflow-y-auto pr-2">
                {showReceipt.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm items-center">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">{item.medicineName}</span>
                      <span className="text-[10px] text-slate-400 uppercase font-black">Qty: {item.quantity}</span>
                    </div>
                    <span className="font-black text-slate-900">{item.subtotal.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              
              <div className="pt-6 border-t border-dashed flex justify-between items-center text-xl font-black text-slate-900">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.total}</span>
                <span className="text-3xl tracking-tighter text-emerald-600">{showReceipt.total.toLocaleString()} <span className="text-xs">{t.currency}</span></span>
              </div>

              <div className="flex gap-4 no-print">
                <button 
                  onClick={triggerRealPrint}
                  className="flex-1 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all uppercase tracking-widest text-[10px]"
                >
                  🖨️ {t.printBill}
                </button>
                <button 
                  onClick={() => setShowReceipt(null)}
                  className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-500/20 hover:bg-emerald-500 transition-all uppercase tracking-widest text-[10px]"
                >
                  {t.done}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
