
import React, { useState, useEffect, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { View, Moment, GardenState, TimeSlot, DailyQuote } from './types';
import { TIME_SLOTS, EMOJIS } from './constants.tsx';
import { 
  getQuoteForDate, 
  formatDate, 
  getChineseDateStr, 
  getDaysInMonth, 
  getYesterday 
} from './utils';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const fetchDailyQuotes = async (): Promise<DailyQuote[] | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "为‘情绪补给站’生成今日的4条能量文案。时间：08:00, 11:00, 18:00, 22:00。要求：极其温柔、极其治愈。返回JSON格式：[{time: string, text: string, emoji: string}]",
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text);
  } catch (e) {
    return null;
  }
};

// --- Main App ---

const App: React.FC = () => {
  const [view, setView] = useState<View>('intro');
  const [moments, setMoments] = useState<Moment[]>([]);
  const [garden, setGarden] = useState<GardenState>({ roses: [], streak: 0, lastCollectionDate: null });
  const [aiQuotes, setAiQuotes] = useState<DailyQuote[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const m = localStorage.getItem('garden_moments_v3');
    if (m) setMoments(JSON.parse(m));
    const g = localStorage.getItem('garden_state_v3');
    if (g) setGarden(JSON.parse(g));
    fetchDailyQuotes().then(q => q && setAiQuotes(q));
  }, []);

  useEffect(() => {
    localStorage.setItem('garden_moments_v3', JSON.stringify(moments));
    localStorage.setItem('garden_state_v3', JSON.stringify(garden));
  }, [moments, garden]);

  // Daily Rose
  useEffect(() => {
    const todayStr = formatDate(new Date());
    if (garden.lastCollectionDate !== todayStr) {
      const day = new Date().getDate();
      const isStreak = garden.lastCollectionDate === getYesterday(todayStr);
      setGarden(prev => ({
        ...prev,
        roses: [...new Set([...prev.roses, day])],
        streak: isStreak ? prev.streak + 1 : 1,
        lastCollectionDate: todayStr
      }));
    }
  }, [garden.lastCollectionDate]);

  const addMoment = (content: string) => {
    const nm: Moment = {
      id: Date.now().toString(),
      content,
      timestamp: Date.now(),
      hasRose: false,
      isReceived: false
    };
    setMoments([nm, ...moments]);
  };

  const handlePartnerAction = (id: string, type: 'rose' | 'received') => {
    setMoments(prev => prev.map(m => {
      if (m.id === id) {
        return type === 'rose' ? { ...m, hasRose: !m.hasRose } : { ...m, isReceived: !m.isReceived };
      }
      return m;
    }));
  };

  if (view === 'intro') return (
    <div className="flex flex-col items-center justify-center min-h-screen px-10 text-center animate-fadeIn relative overflow-hidden">
       <div className="w-64 h-64 bg-[#fcd5ce] rounded-full blur-[80px] absolute -top-10 -left-10 opacity-60 animate-float" />
       <div className="w-64 h-64 bg-[#ffb5a7] rounded-full blur-[80px] absolute -bottom-10 -right-10 opacity-40 animate-float" style={{animationDelay: '-3s'}} />
       
       <h1 className="text-4xl font-light tracking-[0.4em] text-[#5d5c5a] serif mb-6 relative z-10">爱意花园</h1>
       <p className="text-[#8a8987] font-light leading-loose serif relative z-10 max-w-[240px] mx-auto">在粉色的梦境里，<br/>收集每一份细微的温柔。</p>
       <button onClick={() => setView('home')} className="mt-20 px-14 py-4 bg-[#ffb5a7] text-white rounded-full shadow-2xl shadow-pink-200 active:scale-90 transition-all font-bold tracking-[0.2em] text-sm relative z-10 border border-white/20">开启补给</button>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen pb-36 relative no-scrollbar">
      {view === 'home' && <HomeView aiQuotes={aiQuotes} time={currentTime} />}
      {view === 'timeline' && (
        <TimelineView 
          moments={moments} 
          onAdd={addMoment} 
          onPartnerAction={handlePartnerAction}
        />
      )}
      {view === 'garden' && <GardenView garden={garden} moments={moments} />}

      {/* Main Navigation - Pink Themed */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm h-18 bg-white/60 backdrop-blur-3xl rounded-[2.5rem] flex items-center justify-around px-8 z-50 shadow-2xl border border-white/50">
        {[
          { id: 'home', label: '补给', icon: '☁️' },
          { id: 'timeline', label: '此刻', icon: '✍️' },
          { id: 'garden', label: '花园', icon: '🌹' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id as View)}
            className={`flex flex-col items-center transition-all duration-500 py-2 ${view === tab.id ? 'text-[#e5989b] scale-110 drop-shadow-md' : 'text-gray-400 opacity-60'}`}
          >
            <span className="text-2xl mb-1">{tab.icon}</span>
            <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
            {view === tab.id && <div className="w-1.5 h-1.5 bg-[#e5989b] rounded-full mt-1" />}
          </button>
        ))}
      </div>
    </div>
  );
};

// --- Home View (Station) ---

const HomeView: React.FC<{ aiQuotes: DailyQuote[], time: Date }> = ({ aiQuotes, time }) => {
  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = getChineseDateStr(time);

  const activeSlot = useMemo(() => {
    const hr = time.getHours();
    if (hr >= 22 || hr < 8) return '22:00';
    if (hr >= 18) return '18:00';
    if (hr >= 11) return '11:00';
    return '08:00';
  }, [time]);

  const currentQuote = useMemo(() => {
    const aiQ = aiQuotes.find(q => q.time === activeSlot);
    const fallback = getQuoteForDate(time, activeSlot as TimeSlot);
    return aiQ || fallback;
  }, [aiQuotes, activeSlot, time]);

  return (
    <div className="p-8 space-y-14 animate-fadeIn text-center">
      <div className="pt-16 space-y-3 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-56 bg-[#ffb5a7] rounded-full blur-[90px] opacity-30 -z-10" />
        <h1 className="big-time serif text-[#5d5c5a] tracking-tight">{timeStr}</h1>
        <div className="space-y-1">
          <p className="text-xl font-light text-[#5d5c5a] serif tracking-[0.1em]">{dateStr}</p>
          <div className="w-8 h-0.5 bg-[#e5989b] mx-auto mt-4 rounded-full opacity-40" />
        </div>
      </div>

      <div className="dreamy-card p-12 rounded-[3.5rem] animate-float mt-8 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
        <div className="text-5xl mb-8 drop-shadow-lg scale-110 group-hover:scale-125 transition-transform duration-700">{currentQuote.emoji}</div>
        <p className="serif text-2xl leading-[1.8] text-[#5d5c5a] font-medium tracking-wide px-2">
          {currentQuote.text}
        </p>
        <div className="mt-10 flex justify-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ffb5a7] shadow-inner" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#fcd5ce] shadow-inner" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#bde0fe] shadow-inner opacity-60" />
        </div>
      </div>
    </div>
  );
};

// --- Timeline View ---

const TimelineView: React.FC<{ moments: Moment[]; onAdd: (c: string) => void; onPartnerAction: (id: string, type: 'rose' | 'received') => void; }> = ({ moments, onAdd, onPartnerAction }) => {
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);

  return (
    <div className="p-8 space-y-10 animate-fadeIn">
      <header className="flex flex-col items-start gap-1">
        <h2 className="text-3xl font-bold text-[#5d5c5a] serif">写下此刻</h2>
        <div className="h-1 w-12 bg-[#ffb5a7] rounded-full" />
      </header>

      <div className="dreamy-card p-8 rounded-[2.5rem] space-y-6 shadow-2xl border-white/70">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="此刻的心情是粉色的吗？"
          className="w-full h-28 bg-transparent border-none focus:ring-0 text-base serif placeholder:opacity-30 placeholder:text-[#5d5c5a] resize-none"
        />
        <div className="flex justify-between items-center pt-2">
          <button 
            onClick={() => setShowEmoji(!showEmoji)} 
            className={`w-12 h-12 flex items-center justify-center rounded-full shadow-inner transition-colors ${showEmoji ? 'bg-[#ffb5a7] text-white' : 'bg-white/50 text-gray-500'}`}
          >
            😊
          </button>
          <button 
            onClick={() => { if(input.trim()){ onAdd(input); setInput(''); setShowEmoji(false); } }}
            className="px-10 py-3 bg-[#ffb5a7] text-white font-black text-xs tracking-[0.3em] rounded-full shadow-xl shadow-pink-100 hover:brightness-105 active:scale-95 transition-all"
          >
            发布心声
          </button>
        </div>
        {showEmoji && (
          <div className="grid grid-cols-6 gap-4 pt-4 p-5 bg-white/50 rounded-3xl animate-popIn border border-white/40">
            {EMOJIS.map(e => (
              <button 
                key={e} 
                onClick={() => setInput(i => i + e)} 
                className="text-2xl hover:scale-125 transition-transform flex items-center justify-center p-1"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-8 pb-24">
        {moments.map(m => (
          <div key={m.id} className="dreamy-card p-8 rounded-[3rem] animate-fadeIn hover:shadow-2xl transition-all duration-500 border-white/60">
            <p className="text-[17px] serif leading-relaxed mb-6 text-[#5d5c5a] font-medium">{m.content}</p>
            <div className="flex justify-between items-center border-t border-white/40 pt-6">
              <span className="text-[11px] opacity-50 font-black tracking-tighter text-[#8d8c8a]">
                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <div className="flex gap-3">
                <button 
                  onClick={() => onPartnerAction(m.id, 'rose')}
                  className={`px-5 py-2.5 rounded-full text-[10px] font-black transition-all border shadow-sm ${m.hasRose ? 'bg-[#ffb5a7] border-transparent text-white scale-105' : 'bg-white/50 border-white/30 text-gray-400 hover:bg-white/80'}`}
                >
                  🌹 {m.hasRose ? '对方已送花' : '送花'}
                </button>
                <button 
                  onClick={() => onPartnerAction(m.id, 'received')}
                  className={`px-5 py-2.5 rounded-full text-[10px] font-black transition-all border shadow-sm ${m.isReceived ? 'bg-[#95d5b2] border-transparent text-white scale-105' : 'bg-white/50 border-white/30 text-gray-400 hover:bg-white/80'}`}
                >
                  ✓ {m.isReceived ? '对方已接收' : '我收到了'}
                </button>
              </div>
            </div>
          </div>
        ))}
        {moments.length === 0 && (
          <div className="text-center py-20 animate-pulse opacity-40">
             <div className="text-4xl mb-4">✍️</div>
             <p className="serif text-sm">写下第一句温柔的话语吧</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Garden View ---

const GardenView: React.FC<{ garden: GardenState, moments: Moment[] }> = ({ garden, moments }) => {
  const days = getDaysInMonth(new Date().getFullYear(), new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const dayMoments = useMemo(() => {
    if (selectedDay === null) return [];
    return moments.filter(m => {
      const d = new Date(m.timestamp);
      return d.getDate() === selectedDay && d.getMonth() === new Date().getMonth();
    });
  }, [selectedDay, moments]);

  return (
    <div className="p-8 space-y-12 animate-fadeIn">
      <header className="flex justify-between items-end pt-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold text-[#5d5c5a] serif">爱意花园</h2>
          <div className="h-1 w-10 bg-[#ffb5a7] rounded-full" />
        </div>
        <span className="text-[11px] bg-[#ffb5a7] text-white px-5 py-2 rounded-full font-black shadow-lg shadow-pink-100 tracking-widest">
          连击 {garden.streak} 天
        </span>
      </header>

      <div className="dreamy-card p-10 rounded-[3.5rem] grid grid-cols-5 gap-y-10 gap-x-4 shadow-pink-100/20">
        {Array.from({ length: days }).map((_, i) => {
          const day = i + 1;
          const hasRose = garden.roses.includes(day);
          return (
            <button 
              key={day}
              onClick={() => setSelectedDay(day)}
              className="flex flex-col items-center gap-2 active:scale-90 transition-transform"
            >
              <div className={`w-14 h-14 flex items-center justify-center transition-all duration-1000 ${hasRose ? 'opacity-100 scale-110' : 'opacity-20 scale-90'}`}>
                <span className={`text-3xl ${hasRose && garden.streak >= 7 ? 'glow-rose' : ''}`}>🌹</span>
              </div>
              <span className={`text-[11px] font-black tracking-tighter ${hasRose ? 'text-[#e5989b]' : 'text-gray-300'}`}>{day}</span>
            </button>
          );
        })}
      </div>

      {selectedDay !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-6 bg-black/10 backdrop-blur-xl animate-fadeIn" onClick={() => setSelectedDay(null)}>
          <div className="dreamy-card w-full max-h-[80vh] overflow-y-auto p-12 rounded-[4rem] animate-popIn relative shadow-3xl" onClick={e => e.stopPropagation()}>
             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#ffb5a7] via-[#fcd5ce] to-[#bde0fe]" />
            <div className="flex justify-between items-center mb-10">
              <div className="space-y-1">
                <h3 className="serif font-black text-2xl text-[#5d5c5a]">{selectedDay}日 溯源</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Memories</p>
              </div>
              <button onClick={() => setSelectedDay(null)} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full text-2xl text-gray-300 hover:text-[#ffb5a7] transition-colors">×</button>
            </div>
            <div className="space-y-8">
              {dayMoments.length > 0 ? dayMoments.map(m => (
                <div key={m.id} className="bg-white/50 p-8 rounded-[2rem] border border-white/60 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-base serif mb-4 text-[#5d5c5a] leading-loose italic">"{m.content}"</p>
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-gray-100" />
                    <span className="text-[10px] opacity-40 font-black tracking-widest">{new Date(m.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                  </div>
                </div>
              )) : <div className="text-center py-24">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl opacity-30">☁️</div>
                    <p className="opacity-40 italic serif text-sm">那天风很轻，<br/>花园里只有玫瑰盛开的声音。</p>
                  </div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
