
import React, { useState } from 'react';
import { Sale, Medicine, Language, Theme } from '../types';
import { translations } from '../translations';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

interface SalesAnalyticsProps {
  sales: Sale[];
  medicines: Medicine[];
  language: Language;
  theme: Theme;
}

const SalesAnalytics: React.FC<SalesAnalyticsProps> = ({ sales, medicines, language, theme }) => {
  const t = translations[language];
  const isDark = theme === 'dark';
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('30d');

  // Filter sales based on period
  const filteredSales = sales.filter(s => {
    if (period === 'all') return true;
    const now = new Date();
    const saleDate = new Date(s.timestamp);
    const diff = (now.getTime() - saleDate.getTime()) / (1000 * 3600 * 24);
    return diff <= (period === '7d' ? 7 : 30);
  });

  // 1. Sales Growth Over Time
  const getGrowthData = () => {
    const dailyData: Record<string, { date: string, revenue: number, profit: number }> = {};
    filteredSales.forEach(s => {
      const d = new Date(s.timestamp).toLocaleDateString();
      if (!dailyData[d]) dailyData[d] = { date: d, revenue: 0, profit: 0 };
      dailyData[d].revenue += s.total;
      const profit = s.items.reduce((acc, item) => acc + (item.price - item.buyPrice) * item.quantity, 0);
      dailyData[d].profit += profit;
    });
    return Object.values(dailyData).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // 2. Top Selling Items
  const getTopItems = () => {
    const itemCounts: Record<string, { name: string, quantity: number, revenue: number }> = {};
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        if (!itemCounts[item.medicineId]) itemCounts[item.medicineId] = { name: item.medicineName, quantity: 0, revenue: 0 };
        itemCounts[item.medicineId].quantity += item.quantity;
        itemCounts[item.medicineId].revenue += item.subtotal;
      });
    });
    return Object.values(itemCounts)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  };

  // 3. Category Breakdown
  const getCategoryData = () => {
    const catData: Record<string, number> = {};
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        const med = medicines.find(m => m.id === item.medicineId);
        const cat = med?.category || 'Other';
        catData[cat] = (catData[cat] || 0) + item.subtotal;
      });
    });
    return Object.entries(catData).map(([name, value]) => ({ name, value }));
  };

  // 4. Performance by Day of Week
  const getDayOfWeekData = () => {
    const days = language === 'ar' 
      ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayData = days.map(day => ({ day, revenue: 0 }));
    
    filteredSales.forEach(s => {
      const dayIndex = new Date(s.timestamp).getDay();
      dayData[dayIndex].revenue += s.total;
    });
    return dayData;
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const growthData = getGrowthData();
  const topItems = getTopItems();
  const categoryData = getCategoryData();
  const dayData = getDayOfWeekData();

  const totalRevenue = filteredSales.reduce((acc, s) => acc + s.total, 0);
  const totalProfit = filteredSales.reduce((acc, s) => acc + s.items.reduce((pAcc, item) => pAcc + (item.price - item.buyPrice) * item.quantity, 0), 0);
  const avgTrans = totalRevenue / (filteredSales.length || 1);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/20">
            📈
          </div>
          <div>
            <h1 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>{t.salesAnalytics}</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">{t.enterpriseAI} Diagnostic Suite</p>
          </div>
        </div>

        <div className={`flex p-1 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          {(['7d', '30d', 'all'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                period === p 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                  : isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {p === '7d' ? (language === 'ar' ? 'أسبوع' : '7 Days') : 
               p === '30d' ? (language === 'ar' ? 'شهر' : '30 Days') : 
               (language === 'ar' ? 'الكل' : 'All Time')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard label={t.totalRevenue} value={totalRevenue.toLocaleString()} sub={`${filteredSales.length} bills`} icon="💵" color="emerald" isDark={isDark} currency={t.currency} />
        <MetricCard label={t.totalProfit} value={totalProfit.toLocaleString()} sub={`${((totalProfit / (totalRevenue || 1)) * 100).toFixed(1)}% margin`} icon="📈" color="blue" isDark={isDark} currency={t.currency} />
        <MetricCard label={t.avgTransactionValue} value={Math.round(avgTrans).toLocaleString()} sub="Per customer visit" icon="⚖️" color="indigo" isDark={isDark} currency={t.currency} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sales Growth Chart */}
        <ChartBox title={t.salesGrowth} isDark={isDark}>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={growthData}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
              <XAxis dataKey="date" hide />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: isDark ? '#0f172a' : '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ fontWeight: 800, color: isDark ? '#fff' : '#1e293b' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              <Area type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} fillOpacity={0} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartBox>

        {/* Top Selling Items */}
        <ChartBox title={t.topSellingItems} isDark={isDark}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topItems} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: isDark ? '#0f172a' : '#fff' }}
              />
              <Bar dataKey="quantity" fill="#10b981" radius={[0, 8, 8, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>

        {/* Category Distribution */}
        <ChartBox title={t.revenueBreakdown} isDark={isDark}>
          <div className="flex items-center h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartBox>

        {/* Weekly Heatmap Replacement (Day of Week Performance) */}
        <ChartBox title={t.performanceByDay} isDark={isDark}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dayData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip 
                 contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: isDark ? '#0f172a' : '#fff' }}
              />
              <Line type="stepAfter" dataKey="revenue" stroke="#8b5cf6" strokeWidth={4} dot={{ r: 6, fill: '#8b5cf6' }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartBox>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ label: string, value: string, sub: string, icon: string, color: string, isDark: boolean, currency: string }> = ({ label, value, sub, icon, color, isDark, currency }) => {
  const colorMap: any = {
    emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  };

  return (
    <div className={`p-8 rounded-[2.5rem] border transition-all hover:scale-[1.02] ${isDark ? 'bg-slate-900 border-slate-800 shadow-2xl shadow-black/50' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl border ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <h3 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{value}</h3>
        <span className="text-[10px] font-bold text-slate-400 uppercase">{currency}</span>
      </div>
      <p className="text-[10px] font-bold text-slate-500 opacity-60 uppercase mt-1">{sub}</p>
    </div>
  );
};

const ChartBox: React.FC<{ title: string, isDark: boolean, children: React.ReactNode }> = ({ title, isDark, children }) => (
  <div className={`p-8 rounded-[2.5rem] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
    <h3 className={`text-xs font-black uppercase tracking-[0.2em] mb-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{title}</h3>
    {children}
  </div>
);

export default SalesAnalytics;
