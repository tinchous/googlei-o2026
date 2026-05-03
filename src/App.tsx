/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Activity, Cpu, Clock, Layers, Radio, Sliders, Sparkles, Box, Hammer, Construction, RefreshCcw } from 'lucide-react';
import FluidCanvas from './components/FluidCanvas';
import { motion, AnimatePresence } from 'motion/react';

const GLYPHS: Record<string, number[][]> = {
  'X': [
    [1, 0, 0, 0, 1],
    [0, 1, 0, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 0, 1, 0],
    [1, 0, 0, 0, 1]
  ],
  'V': [
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 0, 1, 0],
    [0, 1, 0, 1, 0],
    [0, 0, 1, 0, 0]
  ],
  'I': [
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0]
  ],
  'G': [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 1, 1, 0],
    [1, 0, 0, 1, 0],
    [0, 1, 1, 1, 0]
  ],
  'O': [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0]
  ],
  'L': [
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 1, 1, 1, 0]
  ],
  'E': [
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 0],
    [1, 1, 1, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 1, 1, 1, 0]
  ],
  '/': [
    [0, 0, 0, 0, 1],
    [0, 0, 0, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 0, 0, 0],
    [1, 0, 0, 0, 0]
  ]
};

const ROMAN_MAP: Record<number, string> = {
  10: 'X',
  9: 'IX',
  8: 'VIII',
  7: 'VII',
  6: 'VI',
  5: 'V',
  4: 'IV',
  3: 'III',
  2: 'II',
  1: 'I'
};

const NUMBER_NAMES: Record<number, { en: string, es: string, roman: string }> = {
  10: { en: 'Ten', es: 'Diez', roman: 'X' },
  9: { en: 'Nine', es: 'Nueve', roman: 'IX' },
  8: { en: 'Eight', es: 'Ocho', roman: 'VIII' },
  7: { en: 'Seven', es: 'Siete', roman: 'VII' },
  6: { en: 'Six', es: 'Seis', roman: 'VI' },
  5: { en: 'Five', es: 'Cinco', roman: 'V' },
  4: { en: 'Four', es: 'Cuatro', roman: 'IV' },
  3: { en: 'Three', es: 'Tres', roman: 'III' },
  2: { en: 'Two', es: 'Dos', roman: 'II' },
  1: { en: 'One', es: 'Uno', roman: 'I' }
};

const speak = (text: string, lang?: string) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  if (lang) utterance.lang = lang;
  utterance.rate = 0.8;
  utterance.pitch = 0.7; 
  utterance.volume = 0.5;
  window.speechSynthesis.speak(utterance);
};

const speakBilingual = (num: number) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const names = NUMBER_NAMES[num];
  if (!names) return;
  
  speak(`Stage ${num}, ${names.en}`, 'en-US');
  speak(`${names.es}`, 'es-ES');
};

function getBlockCount(text: string): number {
  let count = 0;
  for (const char of text) {
    if (GLYPHS[char]) {
      GLYPHS[char].forEach(row => {
        row.forEach(v => { if (v === 1) count++; });
      });
    }
  }
  return count;
}

function BlockTextBuilder({ text, accentColor, onBlockPlaced, size = 'md' }: { text: string, accentColor: string, onBlockPlaced?: () => void, size?: 'sm' | 'md' }) {
  const chars = text.split('').filter(c => GLYPHS[c]);
  const blockSize = size === 'sm' ? 'w-2 h-2' : 'w-6 h-6 sm:w-10 sm:h-10';
  const gapSize = size === 'sm' ? 'gap-0.5' : 'gap-1 sm:gap-2';
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 30;
      const y = (e.clientY / window.innerHeight - 0.5) * 30;
      setMousePos({ x, y });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
  
  return (
    <motion.div 
      animate={{ 
        y: [0, -15, 0],
        rotateX: mousePos.y - 5,
        rotateY: mousePos.x,
        translateZ: 100
      }}
      transition={{ 
        y: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
        rotateX: { type: 'spring', stiffness: 50, damping: 20 },
        rotateY: { type: 'spring', stiffness: 50, damping: 20 },
        translateZ: { duration: 1 }
      }}
      style={{ perspective: '800px', transformStyle: 'preserve-3d' }}
      className={`flex flex-wrap gap-4 items-center justify-center p-16 rounded-xl relative z-40`}
    >
      {chars.map((char, charIdx) => (
        <div key={`${char}-${charIdx}`} className={`grid grid-cols-5 ${gapSize}`} style={{ transformStyle: 'preserve-3d' }}>
          {GLYPHS[char].map((row, y) => 
            row.map((active, x) => {
              const buildingOrder = (4 - y) * 5 + x;
              const randomOffset = Math.random() * 0.15;
              const delay = (charIdx * 20 + buildingOrder) * 0.025 + randomOffset;
              const randomX = (Math.random() - 0.5) * 40;
              const randomRotate = (Math.random() - 0.5) * 60;
              
              return (
                <div 
                  key={`${charIdx}-${y}-${x}`} 
                  className={`${blockSize} ${active ? '' : 'opacity-0'}`}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  {active ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.2, y: -700, x: randomX, rotate: randomRotate, translateZ: 0 }}
                        animate={{ 
                          opacity: 1, 
                          scale: 1, 
                          y: 0, 
                          x: 0,
                          rotate: 0,
                          translateZ: Math.sin(buildingOrder * 0.7) * 25
                        }}
                        onAnimationComplete={() => onBlockPlaced?.()}
                        transition={{ 
                          opacity: { duration: 0.3, delay },
                          scale: { duration: 0.5, delay, type: 'spring' },
                          y: { 
                            duration: 0.9, 
                            delay,
                            type: 'spring',
                            damping: 10,
                            stiffness: 70
                          },
                          rotate: { duration: 0.8, delay },
                          translateZ: { duration: 4, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
                        }}
                        className={`w-full h-full limestone-block rounded-sm relative ${Math.random() > 0.8 ? 'spark shadow-[0_0_15px_#fff]' : ''}`}
                        style={{ 
                          boxShadow: `0 0 15px ${accentColor}aa, 4px 4px 15px rgba(0,0,0,0.9)`,
                          border: `1px solid ${accentColor}aa`,
                          '--accent-color': accentColor,
                          transformStyle: 'preserve-3d'
                        } as any}
                      >
                        {/* 3D Depth Faces */}
                        <div className="block-3d-side block-3d-right"></div>
                        <div className="block-3d-side block-3d-bottom"></div>
                        <div className="block-3d-side block-3d-left"></div>
                        <div className="block-3d-side block-3d-top"></div>
                      
                      <div className="absolute -inset-[1px] rounded-sm border border-white/40 mix-blend-overlay"></div>
                      
                      <motion.div 
                        animate={{ opacity: [0.1, 0.5, 0.1] }}
                        transition={{ duration: 3, repeat: Infinity, delay: Math.random() * 2 }}
                        className="absolute inset-0 rounded-sm" 
                        style={{ background: accentColor }}
                      />
                    </motion.div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      ))}
    </motion.div>
  );
}

function IOBanner({ size = 'large' }: { size?: 'small' | 'large' }) {
  const isSmall = size === 'small';
  return (
    <div className={`flex flex-col items-center gap-1 ${isSmall ? 'scale-75 origin-left' : 'scale-110 sm:scale-125'}`}>
      <div className="relative group">
        <div className="absolute -inset-2 bg-gradient-to-r from-amber-500 via-yellow-200 to-amber-500 rounded-lg blur-lg opacity-20 group-hover:opacity-60 transition duration-1000 animate-tilt"></div>
        <div className="relative flex flex-col items-center">
          <motion.span 
            animate={{ 
              textShadow: [
                '0 0 10px rgba(255,255,255,0.5)',
                '0 0 30px rgba(255,255,255,0.8), 0 0 50px rgba(255,255,255,0.4)',
                '0 0 10px rgba(255,255,255,0.5)'
              ]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="text-white font-black tracking-[0.2em] text-2xl sm:text-4xl italic"
          >
            I/O <span className="text-amber-400">2026</span>
          </motion.span>
        </div>
      </div>
      {!isSmall && (
        <div className="text-[10px] tracking-[1.5em] font-black text-amber-500/40 uppercase mt-2">EPIC_FINALE</div>
      )}
    </div>
  );
}

function RomanNumeralBuilder({ numeral, accentColor, onBlockPlaced }: { numeral: string, accentColor: string, onBlockPlaced?: () => void }) {
  return <BlockTextBuilder text={numeral} accentColor={accentColor} onBlockPlaced={onBlockPlaced} />;
}

function OlympusBackground({ isLightning, onLightningStrike }: { isLightning?: boolean, onLightningStrike?: () => void }) {
  useEffect(() => {
    if (isLightning) {
      onLightningStrike?.();
    }
  }, [isLightning, onLightningStrike]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10 flex items-end justify-between px-10 pb-0">
      {/* Zeus Figure - Left */}
      <motion.div 
        animate={{ 
          y: [0, -15, 0],
          opacity: isLightning ? 1 : [0.4, 0.7, 0.4],
          filter: isLightning 
            ? 'brightness(3) blur(0px) drop-shadow(0 0 50px white)' 
            : ['brightness(1.5) blur(1px)', 'brightness(2.2) blur(0px)', 'brightness(1.5) blur(1px)']
        }}
        transition={{ duration: isLightning ? 0.1 : 5, repeat: isLightning ? 0 : Infinity, ease: 'easeInOut' }}
        className="w-[35vw] max-w-[600px] text-white drop-shadow-[0_0_80px_rgba(255,255,255,0.6)] relative -mb-10"
      >
        <svg viewBox="0 0 100 200" fill="currentColor">
          <path d="M50 20 L65 40 L85 60 L75 90 L90 130 L60 125 L50 190 L40 125 L10 130 L25 90 L15 60 L35 40 Z" />
          
          {/* Animated Lightning Bolt */}
          <motion.path 
            d="M45 40 L50 10 L55 40 Z" 
            animate={isLightning ? {
              opacity: [0, 1, 0, 1, 0],
              scale: [1, 1.5, 1.2, 2, 1],
              fill: ['#fff', '#00f2ff', '#fff']
            } : {
              opacity: [0.6, 1, 0.6],
            }}
            transition={{ duration: isLightning ? 0.3 : 2, repeat: isLightning ? 0 : Infinity }}
            fill="white" 
          />
          <path d="M30 70 L50 65 L70 70" stroke="white" strokeWidth="2" fill="none" />
        </svg>

        {/* Lightning strike visual effect from bolt */}
        {isLightning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-[1000px] bg-white blur-xl"
            style={{ transform: 'rotate(15deg) translateY(-200px)' }}
          />
        )}
      </motion.div>

      {/* Venus/Aphrodite - Far Left */}
      <motion.div 
        animate={{ 
          y: [0, -20, 0],
          x: [0, 10, 0],
          opacity: [0.3, 0.6, 0.3]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute left-[5%] bottom-[10%] w-[18vw] max-w-[300px] text-pink-400 drop-shadow-[0_0_40px_rgba(244,114,182,0.5)] blur-[0.5px] hidden md:block"
      >
        <svg viewBox="0 0 100 200" fill="currentColor">
          <path d="M50 30 C 50 30 70 40 75 70 C 80 100 70 140 50 180 C 30 140 20 100 25 70 C 30 40 50 30 50 30" />
          <circle cx="50" cy="20" r="10" />
          <path d="M30 100 L20 120 L30 140 Z" opacity="0.5" />
          <path d="M70 100 L80 120 L70 140 Z" opacity="0.5" />
        </svg>
      </motion.div>

      {/* Hera Figure - Center-Right */}
      <motion.div 
        animate={{ 
          y: [0, -15, 0],
          opacity: [0.2, 0.4, 0.2]
        }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="w-[20vw] max-w-[350px] text-white hidden xl:block relative"
      >
        <svg viewBox="0 0 100 200" fill="currentColor">
          <path d="M50 30 C 70 30 80 60 80 100 L 90 180 L 10 180 L 20 100 C 20 60 30 30 50 30" />
          <circle cx="50" cy="20" r="8" />
          
          {/* Shimmering Crown */}
          <motion.g
            animate={{ 
              filter: ['brightness(1) drop-shadow(0 0 5px gold)', 'brightness(2.5) drop-shadow(0 0 20px gold)', 'brightness(1) drop-shadow(0 0 5px gold)'],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <path d="M35 15 L50 0 L65 15 L50 10 Z" fill="gold" />
            <circle cx="50" cy="5" r="3" fill="white" className="animate-pulse" />
          </motion.g>
        </svg>
      </motion.div>

      {/* Apollo/Jupiter - Center-Left */}
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.1, 0.2, 0.1]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        className="absolute left-[35%] top-[15%] w-[20vw] max-w-[300px] text-yellow-200 blur-[1px] hidden lg:block"
      >
        <svg viewBox="0 0 100 100" fill="currentColor">
           <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
           <path d="M50 5 L55 45 L95 50 L55 55 L50 95 L45 55 L5 50 L45 45 Z" />
           <circle cx="50" cy="50" r="10" />
        </svg>
      </motion.div>

      {/* Poseidon Figure - Right */}
      <motion.div 
        animate={{ 
          y: [0, -12, 0],
          opacity: [0.4, 0.8, 0.4]
        }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="w-[35vw] max-w-[600px] text-cyan-300 drop-shadow-[0_0_60px_rgba(34,211,238,0.6)] relative -mb-10"
      >
        <svg viewBox="0 0 100 200" fill="currentColor">
          <path d="M45 10 L55 10 L55 190 L45 190 Z" />
          
          {/* Trident with pulse */}
          <motion.path 
            d="M25 30 L45 60 L55 60 L75 30 L65 25 L55 50 L45 50 L35 25 Z" 
            animate={{ 
              filter: ['brightness(1) drop-shadow(0 0 0px cyan)', 'brightness(2) drop-shadow(0 0 15px cyan)', 'brightness(1) drop-shadow(0 0 0px cyan)'],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          
          <path d="M20 120 C 30 100 70 100 80 120 L 85 190 L 15 190 Z" />
          
          {/* Wave Effects */}
          <motion.circle 
            cx="50" cy="50" r="0" 
            stroke="rgba(0, 242, 255, 0.8)" strokeWidth="2" fill="none"
            animate={{ r: [0, 100], opacity: [0.8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.circle 
            cx="50" cy="50" r="0" 
            stroke="rgba(111, 0, 255, 0.5)" strokeWidth="1" fill="none"
            animate={{ r: [0, 120], opacity: [0.5, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeOut', delay: 2.5 }}
          />
        </svg>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [fps] = useState(120.0);
  
  const [viscosity, setViscosity] = useState(0.98);
  const [density, setDensity] = useState(0.96);
  const [accentColor, setAccentColor] = useState('#a1a1aa');
  const [activeEngine, setActiveEngine] = useState('ANCIENT');
  const [resetTrigger, setResetTrigger] = useState(0);
  const [currentNumber, setCurrentNumber] = useState(10);
  const [isCounting, setIsCounting] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [isLightning, setIsLightning] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [quarryProduction, setQuarryProduction] = useState<{ active: boolean, progress: number }>({ active: false, progress: 0 });
  const [quarryInventory, setQuarryInventory] = useState<{ id: number, type: string }[]>([]);
  
  const requiredCount = isFinished ? getBlockCount("GOOGLEI/O") : getBlockCount(ROMAN_MAP[currentNumber] || "");

  const playThunder = () => {
    try {
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      const audioCtx = new AudioCtx();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(40, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 1.5);

      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 1.5);
      
      // Add noise for a crackling effect
      const bufferSize = audioCtx.sampleRate * 0.5;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      noise.connect(noiseGain);
      noiseGain.connect(audioCtx.destination);
      noise.start();
    } catch (e) {
      console.warn("Audio Context error", e);
    }
  };

  const handlePurge = () => {
    setIsPurging(true);
    setResetTrigger(prev => prev + 1);
    playThunder();
    // Visual Glitch feedback
    setTimeout(() => setIsPurging(false), 500);
  };

  const playThud = () => {
    try {
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
    }
  };

  useEffect(() => {
    if (isFinished) return;
    const interval = setInterval(() => {
      if (Math.random() > 0.95) {
        setIsLightning(true);
        setTimeout(() => setIsLightning(false), 50 + Math.random() * 100);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isFinished]);

  useEffect(() => {
    if (isFinished || isResetting) return;
    
    const prodInterval = setInterval(() => {
      setQuarryProduction(prev => {
        if (quarryInventory.length >= requiredCount) return { active: false, progress: 0 };
        
        if (!prev.active && Math.random() > 0.6) {
          return { active: true, progress: 0 };
        }
        if (prev.active) {
          const nextProgress = prev.progress + 25;
          if (nextProgress >= 100) {
            setQuarryInventory(inv => [{ id: Date.now() + Math.random(), type: 'Standard' }, ...inv]);
            return { active: false, progress: 0 };
          }
          return { ...prev, progress: nextProgress };
        }
        return prev;
      });
    }, 200);

    return () => clearInterval(prodInterval);
  }, [isFinished, isResetting, quarryInventory.length, requiredCount]);

  useEffect(() => {
    if (!isCounting || isFinished || isResetting) return;

    // Speak initial number
    if (currentNumber === 10) speakBilingual(10);

    const timer = setInterval(() => {
      setCurrentNumber(prev => {
        if (prev <= 1) {
          setIsFinished(true);
          setIsCounting(false);
          speak("Sequence Complete. Google I/O 2026.", "en-US");
          speak("Secuencia Completada. Google I/O 2026.", "es-ES");
          return 1;
        }
        const next = prev - 1;
        speakBilingual(next);
        setIsLightning(true);
        setTimeout(() => setIsLightning(false), 300);
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 300);
        // Clear inventory for next number
        setQuarryInventory([]);
        return next;
      });
    }, 4500); 

    return () => clearInterval(timer);
  }, [isCounting, isFinished, isResetting]);

  const restartCountdown = () => {
    setIsResetting(true);
    setTimeout(() => {
      setCurrentNumber(10);
      setIsFinished(false);
      setIsCounting(true);
      setIsResetting(false);
      setResetTrigger(prev => prev + 1);
    }, 2000);
  };

  const presets = [
    { name: 'Ancient', colors: ['#a1a1aa', '#71717a', '#3f3f46'], viscosity: 0.97, density: 0.98 },
    { name: 'Giza Sun', colors: ['#fde047', '#fbbf24', '#b45309'], viscosity: 0.985, density: 0.95 },
    { name: 'Nile Mist', colors: ['#0ea5e9', '#0284c7', '#0369a1'], viscosity: 0.99, density: 0.99 },
    { name: 'Emerald Tablet', colors: ['#10b981', '#059669', '#047857'], viscosity: 0.98, density: 0.97 },
    { name: 'Google', colors: ['#4285F4', '#EA4335', '#FBBC05', '#34A853'], viscosity: 0.98, density: 0.96 },
    { name: 'Cyberpunk', colors: ['#00f2ff', '#ff0055', '#a200ff', '#ffffff'], viscosity: 0.99, density: 0.95 },
  ];

  const applyPreset = (p: typeof presets[0]) => {
    setAccentColor(p.colors[0]);
    setViscosity(p.viscosity);
    setDensity(p.density);
    setActiveEngine(p.name.toUpperCase());
    setResetTrigger(prev => prev + 1);
  };

  return (
    <div id="app-container" className="fixed inset-0 bg-[#080808] text-[#e0e0e0] font-mono flex flex-col overflow-hidden select-none">
      <div id="bg-mesh" className="absolute inset-0 opacity-20 pointer-events-none mesh-pattern"></div>
      <div className="absolute inset-0 pointer-events-none tech-scanline opacity-30"></div>
      
      <FluidCanvas viscosity={viscosity} density={density} color={accentColor} resetTrigger={resetTrigger} />
      <OlympusBackground isLightning={isLightning} onLightningStrike={playThunder} />

      <AnimatePresence>
        {showFlash && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="fixed inset-0 z-50 pointer-events-none bg-white mix-blend-overlay shadow-[inset_0_0_100px_rgba(255,255,255,0.5)]"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isLightning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.5, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lightning-strike"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPurging && (
          <div className="glitch-flash" />
        )}
      </AnimatePresence>

      <header id="main-header" className="flex justify-between items-center px-8 py-6 border-b border-white/10 relative z-20 shrink-0 backdrop-blur-sm bg-black/20">
        <div className="flex items-center gap-6">
          <IOBanner size="small" />
          <div className="h-6 w-[1px] bg-white/10 hidden sm:block"></div>
          <div className="hidden sm:flex items-center gap-4">
            <div className="w-3 h-3 bg-[#00f2ff] rounded-full animate-pulse shadow-[0_0_8px_#00f2ff]"></div>
            <span className="text-xs tracking-[0.3em] uppercase font-bold text-white/60">TEMPLE_OF_FLUID</span>
          </div>
        </div>
        <div className="flex gap-8 text-[10px] tracking-[0.2em] uppercase text-white/40">
          <div className="flex items-center gap-2">
            <Radio size={12} className="text-white/20" />
            <span>Realm: <span className="text-[#00f2ff]">OLYMPUS_CLOUD_01</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Cpu size={12} className="text-white/20" />
            <span>Aura: <span className="text-white/70">{activeEngine}</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={12} className="text-white/20" />
            <span className="text-white/80">AGE: 4000y</span>
          </div>
        </div>
      </header>

      <main id="main-content" className="flex flex-1 relative z-10 overflow-hidden">
        <aside id="left-sidebar" className="w-72 border-r border-white/10 p-8 flex flex-col gap-10 overflow-y-auto backdrop-blur-md bg-black/40">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h3 className="text-[11px] uppercase tracking-widest text-[#00f2ff] mb-6 flex items-center gap-2 neon-glow" style={{'--color-accent': accentColor} as any}>
              <Sliders size={14} />
              Quarry Control
            </h3>
            <div className="space-y-8">
              <div className="space-y-3">
                <div className="flex justify-between text-[10px] text-white/50 uppercase italic">
                  <span>Excavation</span>
                  <span className="text-[#00f2ff]">{viscosity.toFixed(3)}</span>
                </div>
                <input 
                  type="range" min="0.8" max="0.999" step="0.001" 
                  value={viscosity} 
                  onChange={(e) => setViscosity(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-full appearance-none accent-[#00f2ff] cursor-pointer"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-[10px] text-white/50 uppercase italic">
                  <span>Friction</span>
                  <span className="text-[#00f2ff]">{density.toFixed(3)}</span>
                </div>
                <input 
                  type="range" min="0.75" max="0.999" step="0.001" 
                  value={density} 
                  onChange={(e) => setDensity(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-full appearance-none accent-[#00f2ff] cursor-pointer"
                />
              </div>
            </div>
          </motion.div>

          <div className="space-y-4">
            <h3 className="text-[11px] uppercase tracking-widest text-white/60 mb-6 flex items-center gap-2 neon-glow" style={{'--color-accent': accentColor} as any}>
              <Sparkles size={14} />
              I/O Presets
            </h3>
            <div className="flex flex-col gap-2">
              {presets.map(p => (
                <button 
                  key={p.name}
                  onClick={() => applyPreset(p)}
                  className={`py-3 px-4 text-left border text-[10px] uppercase transition-all flex justify-between items-center ${activeEngine === p.name.toUpperCase() ? 'border-[#00f2ff] text-[#00f2ff] bg-[#00f2ff]/10' : 'border-white/10 hover:bg-white/5 opacity-50'}`}
                >
                  {p.name}
                  <div className="flex gap-1">
                    {p.colors.slice(0, 2).map(c => <div key={c} className="w-1.5 h-1.5 rounded-full" style={{ background: c }}></div>)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto border-t border-white/5 pt-6 flex flex-col gap-4">
             <button 
               onClick={handlePurge}
               className="w-full py-3 border border-[#00f2ff]/40 text-[10px] uppercase tracking-[0.3em] font-black hover:bg-[#00f2ff]/20 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,242,255,0.1)] hover:shadow-[0_0_30px_rgba(0,242,255,0.2)] text-[#00f2ff] rounded-sm group"
             >
               <Activity size={14} className="group-hover:rotate-180 transition-transform duration-500" />
               Purge Simulation
               <div className="absolute inset-0 bg-[#00f2ff]/5 translate-y-full group-hover:translate-y-0 transition-transform"></div>
             </button>
             <div className="text-[9px] text-white/30 space-y-1">
                <p>SIM_STEP: 0.016s</p>
                <p>PARTICLES: 2,000</p>
                <p>THREADS: WEBGL_2.0</p>
              </div>
          </div>
        </aside>

        <section id="center-display" className="flex-1 flex flex-col justify-center items-center relative overflow-hidden">
          <AnimatePresence mode="wait">
            {isResetting ? (
              <motion.div 
                key="resetting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-6"
              >
                <div className="w-12 h-12 border-4 border-[#00f2ff]/20 border-t-[#00f2ff] rounded-full animate-spin"></div>
                <div className="space-y-4 text-center">
                  <span className="text-[10px] tracking-[0.5em] text-[#00f2ff] font-bold uppercase block">Recalibrating Quarry</span>
                  <div className="w-64 h-1 bg-white/5 rounded-full overflow-hidden border border-white/10">
                    <motion.div 
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 2 }}
                      className="h-full bg-[#00f2ff]/40"
                    />
                  </div>
                </div>
              </motion.div>
            ) : !isFinished ? (
              <motion.div 
                key={currentNumber}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative z-20 flex flex-col items-center gap-12"
              >
                <RomanNumeralBuilder 
                  numeral={ROMAN_MAP[currentNumber]} 
                  accentColor={accentColor} 
                  onBlockPlaced={playThud}
                />
                
                <div className="text-center space-y-2">
                  <span className="text-[10px] tracking-[1em] text-white/30 uppercase">Building sequence...</span>
                  <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden mx-auto border border-white/5">
                    <motion.div 
                      key={`bar-${currentNumber}`}
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 4.5, ease: 'linear' }}
                      className="h-full bg-emerald-500/40"
                    />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="restart"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-30 flex flex-col items-center justify-center gap-6 w-full max-w-4xl"
              >
                <div className="absolute -inset-64 pointer-events-none opacity-40">
                  <motion.div 
                    animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 via-amber-500/5 to-blue-500/10 blur-[150px] rounded-full"
                  />
                  <motion.div 
                    animate={{ rotate: -360, scale: [1.2, 1, 1.2] }}
                    transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-cyan-500/5 to-rose-500/10 blur-[150px] rounded-full"
                  />
                </div>

                <div className="text-center space-y-6 relative flex flex-col items-center">
                  <div className="flex flex-col gap-2 scale-75 sm:scale-90 overflow-hidden pt-4 pb-8">
                    <BlockTextBuilder text="GOOGLE" accentColor={accentColor} onBlockPlaced={playThud} size="sm" />
                    <BlockTextBuilder text="I/O" accentColor={accentColor} onBlockPlaced={playThud} size="sm" />
                  </div>
                  
                  <div className="space-y-6 flex flex-col items-center">
                    <motion.a 
                      href="https://io.google/2026/"
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
                      animate={{ opacity: 1, scale: 1.1, filter: 'blur(0px)' }}
                      whileHover={{ scale: 1.2, filter: 'brightness(1.5)' }}
                      transition={{ delay: 0.3, duration: 1 }}
                      className="drop-shadow-[0_0_40px_rgba(0,242,255,0.3)] cursor-pointer no-underline block"
                    >
                      <IOBanner />
                    </motion.a>
                    <div className="space-y-2">
                       <p className="text-white/60 text-[10px] sm:text-xs tracking-[1em] uppercase">Pyramid Sequence Active</p>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={restartCountdown}
                  className="group relative px-10 py-4 bg-[#00f2ff] text-black text-xs font-black tracking-[0.4em] uppercase overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(0,242,255,0.4)] rounded-sm mt-4"
                >
                  <span className="relative z-10 flex items-center gap-3"><RefreshCcw size={14} /> RESTART SEQUENCE</span>
                  <div className="absolute inset-0 bg-white translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute bottom-12 text-center pointer-events-none">
             <span className="text-[10px] tracking-[0.5em] text-white/20 uppercase">
               TEMPORAL EXCAVATION IN PROGRESS // I/O 2026
             </span>
          </div>
        </section>

        <aside id="right-sidebar" className="w-72 border-l border-white/10 p-8 flex flex-col gap-8 backdrop-blur-md bg-black/40">
          <div className="flex-1 bg-black/40 border border-white/10 rounded-sm relative overflow-hidden flex flex-col">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-emerald-500/40 z-20 animate-quarry-scan"></div>
            
            <div className="p-4 border-b border-white/10 bg-white/5">
              <h3 className="text-[10px] uppercase tracking-widest text-[#00f2ff] flex items-center gap-2">
                <Hammer size={12} />
                Quarry Production
              </h3>
            </div>
            
            <div className="flex-1 flex flex-col min-h-0 relative">
               <div className="flex-1 p-4 border-b border-white/5 relative overflow-hidden flex flex-col">
                  <span className="text-[8px] text-white/40 mb-2 uppercase tracking-widest">Forging Site</span>
                  <div className="flex-1 flex items-center justify-center relative">
                     <div className="absolute inset-0 z-0 pointer-events-none opacity-10 flex justify-around items-center">
                        <svg viewBox="0 0 100 100" className="w-16 h-16 text-white fill-current">
                           <path d="M50 10 L60 40 L40 40 Z M50 40 L50 80 M30 60 L70 60" />
                        </svg>
                        <svg viewBox="0 0 100 100" className="w-16 h-16 text-white fill-current">
                           <path d="M50 5 L70 25 L80 60 L50 95 L20 60 L30 25 Z" />
                        </svg>
                     </div>

                     {quarryProduction.active ? (
                        <div className="flex flex-col items-center gap-2 relative z-10">
                           <motion.div 
                              animate={{ 
                                scale: [1, 1.1, 1], 
                                rotate: [0, 5, -5, 0],
                                filter: ['brightness(1)', 'brightness(1.5)', 'brightness(1)']
                              }}
                              transition={{ duration: 0.3, repeat: Infinity }}
                              className="w-12 h-12 limestone-block border-emerald-500/50 border rounded-sm flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                              style={{'--accent-color': '#10b981'} as any}
                           >
                              <Construction size={18} className="text-emerald-400" />
                           </motion.div>
                           <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden border border-white/5">
                              <div className="h-full bg-emerald-500/60" style={{ width: `${quarryProduction.progress}%` }}></div>
                           </div>
                           <span className="text-[7px] text-[#00f2ff] uppercase tracking-widest animate-pulse">Forging...</span>
                        </div>
                     ) : (
                        <div className="text-[10px] text-white/10 uppercase font-black italic">Awaiting Raw Stone...</div>
                     )}
                  </div>
               </div>

               <div className="flex-1 flex flex-col relative bg-black/20 overflow-hidden">
                  <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                    <span className="text-[8px] text-white/40 mb-2 uppercase tracking-widest block">Ready Stockpile</span>
                    <div className="flex flex-wrap content-start gap-1">
                       <AnimatePresence>
                          {quarryInventory.map((block) => (
                             <motion.div
                                key={block.id}
                                initial={{ y: -50, opacity: 0, scale: 0.5, rotate: 45 }}
                                animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ type: 'spring', damping: 15 }}
                                className="w-4 h-4 limestone-block border-white/20 border rounded-sm flex items-center justify-center group relative overflow-hidden"
                             >
                                <div className="absolute inset-0 bg-[#00f2ff]/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                             </motion.div>
                          ))}
                       </AnimatePresence>
                    </div>
                  </div>
                  
                  <div className="p-2 border-t border-white/10 flex justify-between items-center text-[7px] text-white/60 uppercase tracking-[0.2em] bg-black/40">
                     <span>CONSTRUCTED: {quarryInventory.length}/{requiredCount}</span>
                     <span className="text-[#00f2ff] animate-pulse">REQUIRED_FOR_STAGE</span>
                  </div>
               </div>
            </div>

            <div className="p-4 border-t border-white/10 bg-black/60 text-[9px] text-white/30 space-y-1">
               <div className="flex justify-between">
                  <span>CAPACITY:</span>
                  <span className="text-emerald-500">OPTIMAL</span>
               </div>
               <div className="flex justify-between">
                  <span>SITE LOAD:</span>
                  <span>{Math.floor(Math.random() * 20 + 80)}%</span>
               </div>
            </div>
          </div>
          
          <div className="p-4 bg-[#00f2ff]/10 border border-[#00f2ff]/30 rounded-sm shadow-[0_0_20px_rgba(0,242,255,0.1)]">
             <h4 className="text-[10px] uppercase text-[#00f2ff] mb-2 font-black tracking-widest neon-glow" style={{'--color-accent': accentColor} as any}>Divine Decree</h4>
             <p className="text-[9px] text-[#00f2ff]/60 leading-relaxed font-bold italic uppercase tracking-tighter">
               "Forging the future from the fires of the past."
             </p>
             <div className="mt-3 flex items-center gap-2">
                <Activity size={10} className="text-[#00f2ff]" />
                <div className="flex-1 h-[1px] bg-white/10 relative overflow-hidden">
                   <div className="absolute inset-0 bg-[#00f2ff] w-1/2 animate-slide-infinite"></div>
                </div>
             </div>
          </div>
        </aside>
      </main>

      <footer id="main-footer" className="px-8 py-4 bg-white/5 border-t border-white/10 flex justify-between items-center relative z-20 shrink-0 backdrop-blur-md">
        <div className="flex gap-6 items-center text-[10px] text-white/60">
          <span className="flex items-center gap-2 font-bold">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_#22c55e]"></div> 
            ENGINE_STABLE
          </span>
          <span className="opacity-50">|</span>
          <span className="flex items-center gap-2">
            BUF: <span className="text-white">640.4 MB</span>
          </span>
          <span className="opacity-50">|</span>
          <span className="flex items-center gap-2">
            FPS: <span className="text-white font-mono">{fps.toFixed(1)}</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-white/40 uppercase tracking-widest hidden sm:inline">ANCIENT RECONSTRUCTION // Google I/O 26</span>
          <div className="px-4 py-1.5 border border-white/10 text-[9px] text-white/50 uppercase tracking-widest flex items-center gap-2">
            <Construction size={12} />
            Phase_Final
          </div>
        </div>
      </footer>
    </div>
  );
}
