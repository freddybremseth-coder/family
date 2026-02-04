
import React from 'react';
import { SaaSUser, Currency } from '../types';
import { 
  Users, TrendingUp, TrendingDown, DollarSign, Activity, 
  UserPlus, UserMinus, ShieldCheck, CreditCard, Search, 
  BarChart3, PieChart, Globe, Briefcase, Zap, Star
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockSaaSUsers: SaaSUser[] = [
  { id: 'u1', email: 'john.doe@gmail.com', familyName: 'DOE', plan: 'Monthly', status: 'Paid', joinedDate: '2024-01-15', lastActive: '2024-07-20', revenue: 4 },
  { id: 'u2', email: 'sarah.smith@outlook.com', familyName: 'SMITH', plan: 'Annual', status: 'Paid', joinedDate: '2024-02-10', lastActive: '2024-07-19', revenue: 38 },
  { id: 'u3', email: 'kurt.vagner@gmx.de', familyName: 'VAGNER', plan: 'Monthly', status: 'Churned', joinedDate: '2024-03-05', lastActive: '2024-04-12', revenue: 0 },
  { id: 'u4', email: 'elena.rodriguez@me.com', familyName: 'RODRIGUEZ', plan: 'Annual', status: 'Pending', joinedDate: '2024-06-20', lastActive: '2024-07-15', revenue: 0 },
  { id: 'u5', email: 'freddy.bremseth@gmail.com', familyName: 'BREMSETH', plan: 'Lifetime', status: 'Paid', joinedDate: '2023-10-01', lastActive: '2024-07-21', revenue: 1000 },
];

const revenueData = [
  { month: 'Jan', rev: 420 },
  { month: 'Feb', rev: 850 },
  { month: 'Mar', rev: 1200 },
  { month: 'Apr', rev: 1100 },
  { month: 'May', rev: 1650 },
  { month: 'Jun', rev: 2100 },
  { month: 'Jul', rev: 2850 },
];

export const SuperAdminDashboard = () => {
  const stats = {
    totalUsers: mockSaaSUsers.length,
    activePaid: mockSaaSUsers.filter(u => u.status === 'Paid').length,
    mrr: mockSaaSUsers.filter(u => u.status === 'Paid' && u.plan === 'Monthly').reduce((acc, u) => acc + 4, 0),
    arr: mockSaaSUsers.filter(u => u.status === 'Paid' && u.plan === 'Annual').reduce((acc, u) => acc + 38, 0),
    churn: '20%',
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-6 border-l-4 border-l-purple-500 bg-purple-500/5">
          <p className="text-[10px] uppercase text-slate-500 font-black mb-1 tracking-widest">Total Subscribers</p>
          <div className="flex items-center justify-between">
            <p className="text-3xl font-black text-white font-mono">{stats.totalUsers}</p>
            <Users className="text-purple-400 w-6 h-6" />
          </div>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-emerald-500 bg-emerald-500/5">
          <p className="text-[10px] uppercase text-slate-500 font-black mb-1 tracking-widest">Active Revenue (MRR)</p>
          <div className="flex items-center justify-between">
            <p className="text-3xl font-black text-emerald-400 font-mono">€{stats.mrr}</p>
            <TrendingUp className="text-emerald-400 w-6 h-6" />
          </div>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-cyan-500 bg-cyan-500/5">
          <p className="text-[10px] uppercase text-slate-500 font-black mb-1 tracking-widest">Conversion Rate</p>
          <div className="flex items-center justify-between">
            <p className="text-3xl font-black text-cyan-400 font-mono">85%</p>
            <Zap className="text-cyan-400 w-6 h-6" />
          </div>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-rose-500 bg-rose-500/5">
          <p className="text-[10px] uppercase text-slate-500 font-black mb-1 tracking-widest">Churn Rate</p>
          <div className="flex items-center justify-between">
            <p className="text-3xl font-black text-rose-400 font-mono">{stats.churn}</p>
            <UserMinus className="text-rose-400 w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-panel p-8 border-l-4 border-l-purple-500">
          <h3 className="text-sm font-black text-white uppercase tracking-widest mb-8 flex items-center gap-2">
            <BarChart3 className="text-purple-400" /> SaaS Revenue Growth
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="month" stroke="#555" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis stroke="#555" fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#050505', border: '1px solid #333', fontSize: '10px' }} />
                <Area type="monotone" dataKey="rev" stroke="#a855f7" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel p-6 border-l-4 border-l-emerald-500 bg-emerald-500/5">
          <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <Activity className="text-emerald-400" /> Recent Activity Log
          </h3>
          <div className="space-y-4">
            {[
              { msg: "New subscription: Sarah Smith", time: "2h ago", type: "plus" },
              { msg: "Payment failed: Kurt Vagner", time: "5h ago", type: "alert" },
              { msg: "System backup completed", time: "12h ago", type: "check" },
              { msg: "New user registered: Elena R.", time: "1d ago", type: "user" },
            ].map((log, i) => (
              <div key={i} className="flex gap-4 p-3 bg-black/40 border border-white/5">
                <div className="w-1 h-full bg-slate-800" />
                <div>
                  <p className="text-[11px] text-white font-bold">{log.msg}</p>
                  <p className="text-[8px] text-slate-500 uppercase font-mono">{log.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-panel overflow-hidden border-l-4 border-l-purple-500">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h3 className="text-sm font-black text-white uppercase tracking-widest">Master User Directory</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input className="w-full bg-black border border-white/10 pl-10 pr-4 py-2 text-[10px] text-white outline-none focus:border-purple-500" placeholder="Search accounts..." />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[900px]">
            <thead className="bg-white/5 uppercase text-[9px] font-black tracking-widest border-b border-white/5">
              <tr>
                <th className="px-6 py-5">Email / Family</th>
                <th className="px-6 py-5">Plan</th>
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5">Joined</th>
                <th className="px-6 py-5 text-right">Lifetime Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {mockSaaSUsers.map(user => (
                <tr key={user.id} className="hover:bg-purple-500/5 transition-all group">
                  <td className="px-6 py-5">
                    <p className="text-white font-black uppercase tracking-tight">{user.familyName}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{user.email}</p>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-2 py-0.5 text-[8px] font-black uppercase border ${
                      user.plan === 'Lifetime' ? 'border-yellow-500 text-yellow-500 bg-yellow-500/5' : 
                      'border-slate-500 text-slate-400'
                    }`}>
                      {user.plan}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        user.status === 'Paid' ? 'bg-emerald-500' : 
                        user.status === 'Churned' ? 'bg-rose-500' : 'bg-yellow-500'
                      }`} />
                      <span className="text-[10px] font-black uppercase">{user.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-[10px] text-slate-500 font-mono">{user.joinedDate}</td>
                  <td className="px-6 py-5 text-right font-black text-emerald-400 font-mono">€{user.revenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
