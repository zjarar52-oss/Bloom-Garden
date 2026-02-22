
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { View, Moment, GardenState, TimeSlot, DailyQuote } from './types';
import { TIME_SLOTS, EMOJIS } from './constants.tsx';
import { 
  getQuoteForDate, 
  formatDate, 
  getChineseDateStr, 
  getDaysInMonth, 
  getYesterday 
} from './utils';
import { dbClient } from './dbClient';

// --- DeepSeek API 集成 ---
const fetchDailyQuotes = async (): Promise<DailyQuote[] | null> => {
  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个治愈系情绪补给站的文案生成器。请严格输出JSON格式。JSON为一个对象，包含一个"quotes"数组，内含4个对象。字段：time (08:00, 11:00, 18:00, 22:00)，text (极度温柔治愈的高能量文案，不含恋爱词汇)，emoji (匹配的表情)。'
          }
        ],
        response_format: { type: 'json_object' }
      })
    });
    
    const data = await response.json();
    if (data.choices?.[0]?.message?.content) {
      const content = JSON.parse(data.choices[0].message.content);
      return content.quotes || [];
    }
    return null;
  } catch (e) {
    console.error("DeepSeek API failed:", e);
    return null;
  }
};

// --- Background Music Component ---
const BackgroundMusic: React.FC<{ isStarted: boolean }> = ({ isStarted }) => {
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const clickSoundRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.2; // Set a very gentle volume
    }
    if (clickSoundRef.current) {
      clickSoundRef.current.volume = 0.4;
    }

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isClickable = 
        target.tagName === 'BUTTON' || 
        target.tagName === 'A' || 
        target.closest('button') || 
        target.closest('a') ||
        window.getComputedStyle(target).cursor === 'pointer';

      if (isClickable && clickSoundRef.current) {
        clickSoundRef.current.currentTime = 0;
        clickSoundRef.current.play().catch(() => {});
      }
    };

    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  useEffect(() => {
    if (isStarted && audioRef.current) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log("Playback prevented by browser:", error);
        });
      }
    }
  }, [isStarted]);

  const toggleMute = () => {
    if (audioRef.current) {
      const newMutedState = !isMuted;
      audioRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
    }
  };

  return (
    <div className="fixed top-6 right-6 z-[100]">
      <audio
        ref={audioRef}
        src="https://cdn.pixabay.com/audio/2022/08/02/audio_88458c6146.mp3"
        loop
        preload="auto"
      />
      <audio
        ref={clickSoundRef}
        src="https://www.soundjay.com/misc/sounds/water-droplet-1.mp3"
        preload="auto"
      />
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={toggleMute}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-xl border border-white/40 text-[#5d5c5a] shadow-lg hover:bg-white/40 transition-colors"
      >
        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </motion.button>
    </div>
  );
};

// --- Main App ---

const App: React.FC = () => {
  const [view, setView] = useState<View>('intro');
  const [moments, setMoments] = useState<Moment[]>([]);
  const [garden, setGarden] = useState<GardenState>({ roses: [], streak: 0, lastCollectionDate: null });
  const [aiQuotes, setAiQuotes] = useState<DailyQuote[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSynced, setIsSynced] = useState(false);

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 实时数据库同步挂载
  useEffect(() => {
    const cleanup = dbClient.setupSync(
      (m) => setMoments(m),
      (g) => {
        setGarden(g);
        setIsSynced(true); // 确保云端数据加载完成后，才进行当天的玫瑰结算
      }
    );
    fetchDailyQuotes().then(q => q && setAiQuotes(q));
    return cleanup;
  }, []);

  // Daily Rose
  useEffect(() => {
    if (!isSynced) return; // 防竞态：云端数据未拉取前不进行覆盖
    
    const todayStr = formatDate(new Date());
    if (garden.lastCollectionDate !== todayStr) {
      const day = new Date().getDate();
      const isStreak = garden.lastCollectionDate === getYesterday(todayStr);
      const newGarden = {
        roses: [...new Set([...garden.roses, day])],
        streak: isStreak ? garden.streak + 1 : 1,
        lastCollectionDate: todayStr
      };
      setGarden(newGarden);
      dbClient.saveGarden(newGarden);
    }
  }, [garden.lastCollectionDate, isSynced]);

  const addMoment = (content: string) => {
    const nm: Moment = {
      id: Date.now().toString(),
      content,
      timestamp: Date.now(),
      hasRose: false,
      isReceived: false
    };
    const newMoments = [nm, ...moments];
    setMoments(newMoments);
    dbClient.saveMoments(newMoments); // 同步到云端
  };

  const handlePartnerAction = (id: string, type: 'rose' | 'received') => {
    const newMoments = moments.map(m => {
      if (m.id === id) {
        return type === 'rose' ? { ...m, hasRose: !m.hasRose } : { ...m, isReceived: !m.isReceived };
      }
      return m;
    });
    setMoments(newMoments);
    dbClient.saveMoments(newMoments); // 同步到云端
  };

  return (
    <div className="max-w-md mx-auto min-h-screen pb-40 relative no-scrollbar">
      <BackgroundMusic isStarted={view !== 'intro'} />
      {view === 'intro' ? (
        <div className="flex flex-col items-center justify-center min-h-screen px-10 text-center animate-fadeIn relative overflow-hidden bg-[#fff0f3] -mx-4 sm:-mx-8">
           <div className="w-80 h-80 bg-[#ffb5a7] rounded-full blur-[100px] absolute -top-20 -left-20 opacity-50 animate-float" />
           <div className="w-80 h-80 bg-[#ffccd5] rounded-full blur-[100px] absolute -bottom-20 -right-20 opacity-50 animate-float" style={{animationDelay: '-3s'}} />
           
           <div className="relative z-10 space-y-8">
             <div className="text-6xl mb-4 animate-float">🌸</div>
             <h1 className="text-4xl font-light tracking-[0.4em] text-[#5d5c5a] serif mb-4">爱意花园</h1>
             <p className="text-[#8a8987] font-light leading-loose serif max-w-[280px] mx-auto text-lg">
               治愈你的情绪，<br/>读懂你的心意，<br/>陪伴如约而至。
             </p>
             <button onClick={() => setView('home')} className="mt-12 px-16 py-4 bg-[#ffb5a7] text-white rounded-full shadow-2xl shadow-pink-300/50 active:scale-95 transition-all font-bold tracking-[0.2em] text-base border border-white/30">
               开启治愈
             </button>
           </div>
        </div>
      ) : (
        <>
          {view === 'home' && <HomeView aiQuotes={aiQuotes} time={currentTime} />}
          {view === 'timeline' && (
            <TimelineView 
              moments={moments} 
              onAdd={addMoment} 
              onPartnerAction={handlePartnerAction}
            />
          )}
          {view === 'garden' && <GardenView garden={garden} moments={moments} />}

          {/* Main Navigation */}
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[92%] max-w-sm h-20 bg-white/70 backdrop-blur-3xl rounded-[2.5rem] flex items-center justify-around px-8 z-50 shadow-2xl border border-pink-100/50">
            {[
              { id: 'home', label: '补给', icon: '☁️' },
              { id: 'timeline', label: '此刻', icon: '✍️' },
              { id: 'garden', label: '花园', icon: '🌹' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id as View)}
                className={`flex flex-col items-center transition-all duration-500 py-2 relative ${view === tab.id ? 'text-[#e5989b] scale-110' : 'text-gray-400 opacity-50'}`}
              >
                <span className="text-2xl mb-1">{tab.icon}</span>
                <span className="text-[10px] font-black uppercase tracking-[0.1em]">{tab.label}</span>
                {view === tab.id && (
                  <div className="absolute -bottom-1 w-1.5 h-1.5 bg-[#e5989b] rounded-full shadow-lg shadow-pink-200" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
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
    <div className="p-8 space-y-16 animate-fadeIn text-center">
      <div className="pt-20 space-y-4 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#ffb5a7] rounded-full blur-[100px] opacity-25 -z-10" />
        <h1 className="big-time serif text-[#5d5c5a] tracking-tighter drop-shadow-sm">{timeStr}</h1>
        <div className="space-y-1">
          <p className="text-2xl font-light text-[#5d5c5a] serif tracking-widest">{dateStr}</p>
          <div className="w-12 h-0.5 bg-[#ffb5a7] mx-auto mt-6 rounded-full opacity-60" />
        </div>
      </div>

      <div className="dreamy-card p-12 rounded-[4rem] animate-float mt-10">
        <div className="text-6xl mb-8 transform transition-transform hover:scale-125 duration-700">{currentQuote.emoji}</div>
        <p className="text-[#5d5c5a] serif text-2xl leading-relaxed font-light px-4 tracking-wide">
          {currentQuote.text}
        </p>
      </div>

      <div className="flex justify-center items-center gap-4 text-[#8a8987] font-light serif text-sm tracking-widest opacity-60">
        <span className="w-8 h-px bg-current" />
        <span>补给站正守护你的情绪</span>
        <span className="w-8 h-px bg-current" />
      </div>
    </div>
  );
};

// --- Timeline View ---
const TimelineView: React.FC<{ 
  moments: Moment[], 
  onAdd: (c: string) => void,
  onPartnerAction: (id: string, type: 'rose' | 'received') => void
}> = ({ moments, onAdd, onPartnerAction }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onAdd(input);
    setInput('');
  };

  return (
    <div className="p-8 space-y-12 animate-fadeIn pt-16">
      <div className="text-center space-y-2 mb-12">
        <h2 className="text-3xl font-light serif text-[#5d5c5a] tracking-widest">此刻的情绪</h2>
        <p className="text-xs text-[#8a8987] serif tracking-[0.2em] opacity-60 uppercase">Record your inner garden</p>
      </div>

      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute inset-0 bg-[#ffccd5] rounded-[2.5rem] blur-xl opacity-20 group-focus-within:opacity-40 transition-opacity" />
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="写下这一刻的感受..."
          className="w-full p-8 pr-20 bg-white/60 backdrop-blur-md rounded-[2.5rem] border border-pink-100 outline-none text-[#5d5c5a] serif placeholder:text-[#8a8987]/50 relative z-10 transition-all focus:bg-white"
        />
        <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-[#ffb5a7] text-white rounded-full z-20 flex items-center justify-center shadow-lg active:scale-90 transition-transform">
          ✨
        </button>
      </form>

      <div className="space-y-8 relative pb-20">
        <div className="absolute left-6 top-4 bottom-0 w-px bg-pink-100 opacity-50" />
        {moments.map((m, idx) => (
          <div key={m.id} className="flex gap-6 animate-slideIn" style={{ animationDelay: `${idx * 0.1}s` }}>
            <div className="relative z-10 w-12 h-12 bg-white rounded-full flex items-center justify-center border-4 border-[#fff0f3] shadow-sm text-lg">
              {idx % 3 === 0 ? '🌸' : idx % 3 === 1 ? '☁️' : '🌿'}
            </div>
            <div className="flex-1 space-y-4">
              <div className="bg-white/40 backdrop-blur-sm p-6 rounded-[2rem] border border-pink-50/50 shadow-sm">
                <p className="text-[#5d5c5a] serif leading-relaxed">{m.content}</p>
                <div className="mt-4 flex items-center justify-between text-[10px] text-[#8a8987] serif tracking-widest opacity-60 uppercase">
                  <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <div className="flex gap-4">
                    <button onClick={() => onPartnerAction(m.id, 'rose')} className={`transition-all ${m.hasRose ? 'grayscale-0 scale-125' : 'grayscale opacity-30'}`}>🌹</button>
                    <button onClick={() => onPartnerAction(m.id, 'received')} className={`transition-all ${m.isReceived ? 'grayscale-0 scale-125' : 'grayscale opacity-30'}`}>💌</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Garden View ---
const GardenView: React.FC<{ garden: GardenState, moments: Moment[] }> = ({ garden, moments }) => {
  const days = getDaysInMonth(new Date().getFullYear(), new Date().getMonth());
  const monthName = new Date().toLocaleString('en-US', { month: 'long' });

  return (
    <div className="p-8 space-y-12 animate-fadeIn pt-16 pb-32">
       <div className="text-center space-y-4 mb-12">
        <div className="inline-block px-4 py-1 bg-white/50 backdrop-blur-sm border border-pink-100 rounded-full text-[10px] text-[#e5989b] serif tracking-[0.2em] mb-2">
          MONTHLY BLOOMING
        </div>
        <h2 className="text-3xl font-light serif text-[#5d5c5a] tracking-widest">{monthName}</h2>
        <div className="flex justify-center gap-8 pt-4">
          <div className="text-center">
            <div className="text-2xl font-light text-[#5d5c5a] serif mb-1">{garden.roses.length}</div>
            <div className="text-[9px] text-[#8a8987] tracking-[0.2em] uppercase">Blossoms</div>
          </div>
          <div className="w-px h-8 bg-pink-100" />
          <div className="text-center">
            <div className="text-2xl font-light text-[#5d5c5a] serif mb-1">{garden.streak}d</div>
            <div className="text-[9px] text-[#8a8987] tracking-[0.2em] uppercase">Streak</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {Array.from({ length: days }).map((_, i) => {
          const day = i + 1;
          const collected = garden.roses.includes(day);
          const isToday = day === new Date().getDate();
          return (
            <div 
              key={day} 
              className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all duration-700 ${
                collected 
                ? 'bg-[#ffccd5] border-pink-100/50 shadow-inner' 
                : 'bg-white/30 border border-white/50'
              } ${isToday ? 'ring-2 ring-[#ffb5a7] ring-offset-4 ring-offset-[#fff0f3]' : ''}`}
            >
              <span className={`text-[8px] serif absolute top-1.5 left-2 ${collected ? 'text-[#e5989b]' : 'text-gray-300'}`}>
                {day.toString().padStart(2, '0')}
              </span>
              {collected && (
                <span className="text-lg animate-float" style={{ animationDelay: `${i * 0.05}s` }}>
                  {day % 2 === 0 ? '🌸' : '🌹'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="dreamy-card p-8 rounded-[3rem] mt-12 bg-white/40 border-white/50">
        <h3 className="text-center serif text-[#5d5c5a] text-sm tracking-widest mb-6 opacity-60">FLOWER LANGUAGE</h3>
        <p className="text-center text-[#8a8987] serif italic text-xs leading-loose px-4">
          "每一朵在爱里盛开的花，<br/>都记得你对抗寒冬的勇气。"
        </p>
      </div>
    </div>
  );
};

export default App;
