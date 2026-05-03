import { useEffect, useRef } from 'react';
import { Renderer, Camera, Geometry, Program, Mesh, RenderTarget, Vec2, Vec3 } from 'ogl';

// (Mantengo todos tus shaders originales - solo agrego la forge al final)
const baseVertex = `...`; // (todo tu código original de shaders queda igual)

// ... (todo el código que ya tenías hasta el final del useEffect)

export default function FluidCanvas({ 
  viscosity = 0.98, 
  density = 0.96, 
  color = '#00f2ff', 
  resetTrigger = 0,
  currentNumber = 8 // ← NUEVO PROP
}: FluidCanvasProps) {

  // ... todo tu código original ...

  // === NUEVA FUNCIÓN: FORJA EL NÚMERO EN EL FLUIDO ===
  const forgeGlyphInFluid = (glyph: number[][], intensity = 1.2) => {
    if (!GLYPHS || !glyph) return;

    const cols = 5;
    const rows = 5;
    const cellW = 1 / cols;
    const cellH = 1 / rows;
    const radius = 0.085;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (glyph[y][x] === 1) {
          const u = (x + 0.5) * cellW;
          const v = (y + 0.5) * cellH;

          // Splat densidad (forma del número)
          splatProgram.uniforms.tWater.value = targetDensityA.texture;
          splatProgram.uniforms.uPoint.value.set(u, v);
          splatProgram.uniforms.uRadius.value = radius;
          splatProgram.uniforms.uColor.value = [intensity, intensity * 0.3, intensity * 1.3]; // cyan-mágico I/O
          renderer.render({ scene: splatMesh, target: targetDensityB });
          swapDensity();

          // Fuerza de atracción para partículas
          forceProgram.uniforms.tVelocity.value = targetVelocityA.texture;
          forceProgram.uniforms.uPoint.value.set(u, v);
          forceProgram.uniforms.uForce.value.set(0, -1.2);
          forceProgram.uniforms.uRadius.value = radius * 1.6;
          renderer.render({ scene: forceMesh, target: targetVelocityB });
          swapVelocity();
        }
      }
    }
  };

  const resetSimulation = () => {
    // ... tu clear original ...
    const clearProgram = new Program(gl, { vertex: baseVertex, fragment: `void main() { gl_FragColor = vec4(0,0,0,0); }` });
    const clearMesh = new Mesh(gl, { geometry, program: clearProgram });
    renderer.render({ scene: clearMesh, target: targetVelocityA });
    renderer.render({ scene: clearMesh, target: targetVelocityB });
    renderer.render({ scene: clearMesh, target: targetDensityA });
    renderer.render({ scene: clearMesh, target: targetDensityB });

    // FORJA INMEDIATA DEL NÚMERO
    if (currentNumber) {
      const roman = ROMAN_MAP[currentNumber] || 'VIII';
      const firstChar = roman[0];
      const glyph = GLYPHS[firstChar] || GLYPHS['V'];
      forgeGlyphInFluid(glyph, 1.3);
    }
  };

  // Trigger cuando cambia el número
  useEffect(() => {
    if (currentNumber) {
      const roman = ROMAN_MAP[currentNumber] || 'VIII';
      const firstChar = roman[0];
      const glyph = GLYPHS[firstChar] || GLYPHS['V'];
      forgeGlyphInFluid(glyph);
    }
  }, [currentNumber]);

  // ... resto de tu useEffect original sin cambios ...
}
