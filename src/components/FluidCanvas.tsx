/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Activity, Cpu, Clock, Layers, Radio, Sliders, Sparkles, Box, Hammer, Construction, RefreshCcw } from 'lucide-react';
import FluidCanvas from './components/FluidCanvas';
import { motion, AnimatePresence } from 'motion/react';

const GLYPHS: Record<string, number[][]> = { /* tu GLYPHS original */ };
const ROMAN_MAP: Record<number, string> = { 10:'X',9:'IX',8:'VIII',7:'VII',6:'VI',5:'V',4:'IV',3:'III',2:'II',1:'I' };
const NUMBER_NAMES: Record<number, { en: string, es: string, roman: string }> = { /* tu NUMBER_NAMES original */ };

const speak = (text: string, lang?: string) => { /* tu speak original */ };
const speakBilingual = (num: number) => { /* tu speakBilingual original */ };

export default function App() {
  const [currentNumber, setCurrentNumber] = useState(10);
  const [viscosity, setViscosity] = useState(0.98);
  const [density, setDensity] = useState(0.96);
  const [accentColor] = useState('#00f2ff');
  const [resetTrigger, setResetTrigger] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // COUNTDOWN COMPLETO (cada 4.5s baja el número y forja en el fluido)
  useEffect(() => {
    if (isFinished || isResetting) return;

    const timer = setInterval(() => {
      setCurrentNumber(prev => {
        if (prev <= 1) {
          setIsFinished(true);
          speak("Sequence Complete. Google I/O 2026.", "en-US");
          speak("Secuencia Completada. Google I/O 2026.", "es-ES");
          return 1;
        }
        const next = prev - 1;
        speakBilingual(next);
        setResetTrigger(t => t + 1); // fuerza forge
        return next;
      });
    }, 4500);

    return () => clearInterval(timer);
  }, [isFinished, isResetting]);

  const restartCountdown = () => {
    setIsResetting(true);
    setTimeout(() => {
      setCurrentNumber(10);
      setIsFinished(false);
      setIsResetting(false);
      setResetTrigger(t => t + 1);
    }, 2000);
  };

  return (
    <div id="app-container" className="fixed inset-0 bg-[#080808] text-[#e0e0e0] font-mono flex flex-col overflow-hidden select-none">
      <FluidCanvas 
        viscosity={viscosity} 
        density={density} 
        color={accentColor} 
        resetTrigger={resetTrigger}
        currentNumber={currentNumber}
      />

      {/* Header y sidebars originales... (mantén tu UI) */}

      <section id="center-display" className="flex-1 flex flex-col justify-center items-center relative overflow-hidden">
        <AnimatePresence mode="wait">
          {!isFinished && !isResetting && (
            <motion.div 
              key={currentNumber}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative z-20 flex flex-col items-center gap-12"
            >
              {/* NÚMERO ROMANO GIGANTE */}
              <motion.div 
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="text-[28vw] font-black leading-none tracking-[-0.12em] text-white drop-shadow-[0_0_120px_#00f2ff] select-none">
                  {ROMAN_MAP[currentNumber] || currentNumber}
                </div>
              </motion.div>

              {/* Bloques romanos debajo (mantén tu RomanNumeralBuilder) */}
              {/* <RomanNumeralBuilder numeral={ROMAN_MAP[currentNumber]} ... /> */}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Footer y controles originales... */}
    </div>
  );
}
