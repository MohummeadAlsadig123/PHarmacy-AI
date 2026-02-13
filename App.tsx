
import React, { useState, useEffect, useRef } from 'react';
import { Medicine, Sale, Purchase, AppTab, Language, Theme, FontSize, AppSettings } from './types';
import { INITIAL_MEDICINES } from './constants';
import { translations } from './translations';
import { db } from './services/db';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import AIAssistant from './components/AIAssistant';
import Licensing from './components/Licensing';
import Sales from './components/Sales';
import SalesHistory from './components/SalesHistory';
import Wholesale from './components/Wholesale';
import SyncCenter from './components/SyncCenter';
import LockScreen from './components/LockScreen';
import Settings from './components/Settings';
import SalesAnalytics from './components/SalesAnalytics';

const App: React.FC = () => {
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [language, setLanguage] = useState<Language>('en');
  const [appVersion, setAppVersion] = useState<string>('3.1.0-Secured');
  const [dbStatus, setDbStatus] = useState<'synced' | 'saving' | 'error'>('synced');
  const [lastSaveTime, setLastSaveTime] = useState<Date>(new Date());
  
  const [settings, setSettings] = useState<AppSettings>({ pharmacyName: 'PharmaSmart AI', theme: 'light', fontSize: 'medium' });
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  
  const isHydrated = useRef(false);

  const t = translations[language];

  // --- BOOT ENGINE (Hard-Drive Recovery) ---
  useEffect(() => {
    const hydrate = async () => {
      setDbStatus('saving');
      try {
        await db.init();
        
        // 1. Recover Inventory
        let storedMeds = await db.getInventory();
        if (storedMeds.length === 0) {
          const legacy = localStorage.getItem('pharma_inventory_v4') || localStorage.getItem('pharma_inventory_v3');
          storedMeds = legacy ? JSON.parse(legacy) : INITIAL_MEDICINES;
          await db.saveInventory(storedMeds);
        }
        setMedicines(storedMeds);

        // 2. Recover Sales
        let storedSales = await db.getAllSales();
        if (storedSales.length === 0) {
          const legacy = localStorage.getItem('pharma_sales_history_v4') || localStorage.getItem('pharma_sales_history_v3');
          if (legacy) {
            storedSales = JSON.parse(legacy).map((s: any) => ({ ...s, timestamp: new Date(s.timestamp) }));
            for (const s of storedSales) await db.saveSale(s);
          }
        }
        setSales(storedSales.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));

        // 3. Recover Purchases
        let storedPurchases = await db.getAllPurchases();
        if (storedPurchases.length === 0) {
          const legacy = localStorage.getItem('pharma_purchases_v4') || localStorage.getItem('pharma_purchases_v3');
          if (legacy) {
            storedPurchases = JSON.parse(legacy).map((p: any) => ({ ...p, timestamp: new Date(p.timestamp) }));
            for (const p of storedPurchases) await db.savePurchase(p);
          }
        }
        setPurchases(storedPurchases);

        const savedSettings = localStorage.getItem('pharma_settings_v4');
        if (savedSettings) setSettings(JSON.parse(savedSettings));

        isHydrated.current = true;
        setDbStatus('synced');
        setLastSaveTime(new Date());
      } catch (err) {
        console.error("Database initialization failed", err);
        setDbStatus('error');
      }
    };
    hydrate();
  }, []);

  useEffect(() => {
    if (isHydrated.current) {
      localStorage.setItem('pharma_settings_v4', JSON.stringify(settings));
    }
  }, [settings]);

  // --- ACTION HANDLERS (Write-Through Architecture) ---

  const handleRecordSale = async (newSale: Sale) => {
    setDbStatus('saving');
    try {
      // 1. Calculate reduction immediately
      const updatedMeds = medicines.map(med => {
        const soldItem = newSale.items.find(item => item.medicineId === med.id);
        if (soldItem) {
          return { ...med, stock: Math.max(0, med.stock - soldItem.quantity) };
        }
        return med;
      });

      // 2. Persist to Disk (Wait for physical write)
      await db.saveSale(newSale);
      await db.saveInventory(updatedMeds);

      // 3. Update UI State ONLY after Disk Confirmation
      setSales(prev => [newSale, ...prev]);
      setMedicines(updatedMeds);
      
      setLastSaveTime(new Date());
      setDbStatus('synced');
      
      // Verification log
      console.log(`VERIFIED: Bill ${newSale.id} saved. Stock reduced. System OK.`);
    } catch (err) {
      setDbStatus('error');
      alert("CRITICAL ERROR: Data could not be saved to disk. Records may be inconsistent.");
    }
  };

  const handleRecordPurchase = async (newPurchase: Purchase) => {
    setDbStatus('saving');
    try {
      const updatedMeds = medicines.map(med => {
        const purchasedItem = newPurchase.items.find(item => item.medicineId === med.id);
        if (purchasedItem) {
          return { ...med, stock: med.stock + purchasedItem.quantity, buyPrice: purchasedItem.buyPrice };
        }
        return med;
      });

      await db.savePurchase(newPurchase);
      await db.saveInventory(updatedMeds);

      setPurchases(prev => [newPurchase, ...prev]);
      setMedicines(updatedMeds);
      
      setLastSaveTime(new Date());
      setDbStatus('synced');
    } catch (err) {
      setDbStatus('error');
    }
  };

  const handleDeleteSale = async (id: string) => {
    await db.deleteRecord('sales', id);
    setSales(prev => prev.filter(s => s.id !== id));
    setLastSaveTime(new Date());
  };

  const handleDeletePurchase = async (id: string) => {
    await db.deleteRecord('purchases', id);
    setPurchases(prev => prev.filter(p => p.id !== id));
    setLastSaveTime(new Date());
  };

  const handleAddMedicine = async (m: Omit<Medicine, 'id'>) => {
    const newMed = { ...m, id: Date.now().toString() };
    const updated = [newMed, ...medicines];
    await db.saveInventory(updated);
    setMedicines(updated);
    setLastSaveTime(new Date());
  };

  const handleUpdateMedicine = async (m: Medicine) => {
    const updated = medicines.map(med => med.id === m.id ? m : med);
    await db.saveInventory(updated);
    setMedicines(updated);
    setLastSaveTime(new Date());
  };

  const handleDeleteMedicine = async (id: string) => {
    const updated = medicines.filter(m => m.id !== id);
    await db.saveInventory(updated);
    setMedicines(updated);
    setLastSaveTime(new Date());
  };

  useEffect(() => {
    const savedLicense = localStorage.getItem('pharma_license_key');
    if (savedLicense) setIsLocked(false);
    
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const renderContent = () => {
    if (!isHydrated.current) return (
      <div className="h-full flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-black text-slate-400 uppercase tracking-widest text-xs animate-pulse">RECOVERING SYSTEM RECORDS...</p>
      </div>
    );

    switch (activeTab) {
      case 'dashboard': return <Dashboard medicines={medicines} sales={sales} language={language} />;
      case 'inventory': return <Inventory medicines={medicines} onAddMedicine={handleAddMedicine} onUpdateMedicine={handleUpdateMedicine} onDeleteMedicine={handleDeleteMedicine} language={language} />;
      case 'wholesale': return <Wholesale medicines={medicines} purchases={purchases} onRecordPurchase={handleRecordPurchase} onDeletePurchase={handleDeletePurchase} language={language} />;
      case 'ai-assistant': return <AIAssistant language={language} medicines={medicines} />;
      case 'licensing': return <Licensing language={language} onDeactivate={() => { localStorage.removeItem('pharma_license_key'); setIsLocked(true); }} />;
      case 'sales': return <Sales medicines={medicines} language={language} onRecordSale={handleRecordSale} />;
      case 'sales-history': return <SalesHistory sales={sales} onDeleteSale={handleDeleteSale} language={language} />;
      case 'sales-analytics': return <SalesAnalytics sales={sales} medicines={medicines} language={language} theme={settings.theme} />;
      case 'device-sync': return <SyncCenter language={language} onRemoteEntry={handleAddMedicine} printerStatus="disconnected" />;
      case 'settings': return <Settings settings={settings} setSettings={setSettings} language={language} sales={sales} purchases={purchases} />;
      default: return <Dashboard medicines={medicines} sales={sales} language={language} />;
    }
  };

  if (isLocked) {
    return <LockScreen language={language} onActivate={(key) => { localStorage.setItem('pharma_license_key', key); setIsLocked(false); }} />;
  }

  const fontSizeClass = { small: 'text-sm', medium: 'text-base', large: 'text-lg' }[settings.fontSize];

  return (
    <div className={`flex min-h-screen font-sans overflow-hidden transition-colors duration-300 ${settings.theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} ${fontSizeClass} ${language === 'ar' ? 'font-arabic' : ''}`}>
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        language={language} 
        onLock={() => setIsLocked(true)} 
        pharmacyName={settings.pharmacyName}
        theme={settings.theme}
      />
      
      <main className="flex-1 h-screen overflow-hidden flex flex-col">
        <header className={`border-b px-8 py-4 flex items-center justify-between z-30 transition-colors ${settings.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center space-x-6 rtl:space-x-reverse">
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">{t.currentView}:</span>
              <span className={`font-black capitalize ${settings.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{(t as any)[activeTab] || activeTab}</span>
            </div>
            
            <div className={`flex items-center space-x-2 rtl:space-x-reverse px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${
              dbStatus === 'synced' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
              dbStatus === 'saving' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
              'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              <div className="relative">
                <span className={`w-2.5 h-2.5 rounded-full block ${dbStatus === 'synced' ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse'}`}></span>
                {dbStatus === 'synced' && <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-25"></span>}
              </div>
              <span className="ps-1">{dbStatus === 'synced' ? 'Hard Drive: Healthy & Secured' : 'Transaction Processing...'}</span>
              <span className="opacity-40 ps-2">({lastSaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-6 rtl:space-x-reverse">
            <div className={`flex items-center space-x-2 rtl:space-x-reverse rounded-xl p-1 ${settings.theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <button onClick={() => setLanguage('en')} className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${language === 'en' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400'}`}>EN</button>
              <button onClick={() => setLanguage('ar')} className={`px-3 py-1.5 rounded-lg text-xs font-black transition ${language === 'ar' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400'}`}>AR</button>
            </div>

            <div className="flex items-center space-x-3 rtl:space-x-reverse border-s border-slate-700 ps-6">
              <div className="text-start">
                <p className={`text-xs font-black leading-none ${settings.theme === 'dark' ? 'text-white' : 'text-slate-700'}`}>{settings.pharmacyName}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">v{appVersion}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shadow-inner">PS</div>
            </div>
          </div>
        </header>

        <div className={`flex-1 overflow-y-auto p-8 ${settings.theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50/30'}`}>
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </main>

      <style>{`
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { 
          background: ${settings.theme === 'dark' ? '#334155' : '#cbd5e1'}; 
          border-radius: 10px; 
          border: 2px solid ${settings.theme === 'dark' ? '#020617' : '#f8fafc'}; 
        }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .font-arabic { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
      `}</style>
    </div>
  );
};

export default App;
