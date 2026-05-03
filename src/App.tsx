/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Activity, Cpu, Clock, Layers, Radio, Sliders, Sparkles, Box, Hammer, Construction, RefreshCcw } from 'lucide-react';
import FluidCanvas from './components/FluidCanvas';
import { motion, AnimatePresence } from 'motion/react';

// (Todo tu código original de GLYPHS, ROMAN_MAP, NUMBER_NAMES, speak, BlockTextBuilder, etc. queda igual)

export default function App() {
  // ... todo tu state original (viscosity, density, currentNumber, etc.) queda igual

  return (
    <div id="app-container" className="fixed inset-0 bg-[#080808] text-[#e0e0e0] font-mono flex flex-col overflow-hidden select-none">
      {/* FluidCanvas con el número actual */}
      <FluidCanvas 
        viscosity={viscosity} 
        density={density} 
        color={accentColor} 
        resetTrigger={resetTrigger}
        currentNumber={currentNumber}   // ← NUEVO: pasa el número para forjarlo
      />

      {/* TODO EL RESTO DE TU JSX ORIGINAL (header, sidebars, OlympusBackground, etc.) queda igual */}

      <section id="center-display" className="flex-1 flex flex-col justify-center items-center relative overflow-hidden">
        <AnimatePresence mode="wait">
          {/* ... tu lógica de resetting / finished ... */}

          {!isFinished && !isResetting && (
            <motion.div 
              key={currentNumber}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative z-20 flex flex-col items-center gap-12"
            >
              {/* NÚMERO CENTRAL ÉPICO - GIGANTE Y PULSANTE */}
              <motion.div 
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="text-[32vw] font-black leading-none tracking-[-0.12em] text-white drop-shadow-[0_0_120px_#00f2ff] select-none">
                  {currentNumber}
                </div>
              </motion.div>

              {/* Tus bloques romanos debajo (se mantienen) */}
              <RomanNumeralBuilder 
                numeral={ROMAN_MAP[currentNumber]} 
                accentColor={accentColor} 
                onBlockPlaced={playThud}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* resto de tu footer y sidebars igual */}
    </div>
  );
}
