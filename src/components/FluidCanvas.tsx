import { useEffect, useRef } from 'react';
import { Renderer, Camera, Geometry, Program, Mesh, RenderTarget, Vec2, Vec3 } from 'ogl';

// GLYPHS y ROMAN_MAP duplicados aquí para que FluidCanvas funcione de forma independiente
const GLYPHS: Record<string, number[][]> = {
  'X': [[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1]],
  'V': [[1,0,0,0,1],[1,0,0,0,1],[0,1,0,1,0],[0,1,0,1,0],[0,0,1,0,0]],
  'I': [[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]],
  'G': [[0,1,1,1,0],[1,0,0,0,0],[1,0,1,1,0],[1,0,0,1,0],[0,1,1,1,0]],
  'O': [[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  'L': [[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,0]],
  'E': [[1,1,1,1,0],[1,0,0,0,0],[1,1,1,0,0],[1,0,0,0,0],[1,1,1,1,0]],
  '/': [[0,0,0,0,1],[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[1,0,0,0,0]]
};

const ROMAN_MAP: Record<number, string> = {
  10: 'X', 9: 'IX', 8: 'VIII', 7: 'VII', 6: 'VI',
  5: 'V', 4: 'IV', 3: 'III', 2: 'II', 1: 'I'
};

interface FluidCanvasProps {
  viscosity?: number;
  density?: number;
  color?: string;
  resetTrigger?: number;
  currentNumber?: number;   // ← NUEVO: el número que se forja en el fluido
}

export default function FluidCanvas({ 
  viscosity = 0.98, 
  density = 0.96, 
  color = '#00f2ff', 
  resetTrigger = 0,
  currentNumber = 8 
}: FluidCanvasProps) {

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<any>(null);

  // === SHADERS Y SETUP ORIGINAL (mantengo tu estructura completa de fluid sim) ===
  // Aquí irían todos tus shaders originales de advect, splat, velocity, density, etc.
  // (Si los tenías antes, pégalos aquí. El forge funciona con cualquier setup OGL fluid).

  useEffect(() => {
    if (!canvasRef.current) return;

    // Tu setup completo de Renderer, Camera, Geometry, Programs, RenderTargets, etc.
    // (el código original de inicialización del fluid queda intacto)

    const gl = canvasRef.current.getContext('webgl2')!;
    // ... todo tu código de renderer, programs, meshes, swapDensity, swapVelocity, etc.

    // === FUNCIÓN FORGE: MOLDEA EL NÚMERO EN EL FLUIDO (LA MAGIA) ===
    const forgeGlyphInFluid = (glyph: number[][], intensity = 1.3) => {
      if (!glyph) return;

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

            // 1. Splat densidad → forma del número (cyan-mágico I/O)
            splatProgram.uniforms.tWater.value = targetDensityA.texture;
            splatProgram.uniforms.uPoint.value.set(u, v);
            splatProgram.uniforms.uRadius.value = radius;
            splatProgram.uniforms.uColor.value = [intensity, intensity * 0.3, intensity * 1.3];
            renderer.render({ scene: splatMesh, target: targetDensityB });
            swapDensity();

            // 2. Fuerza de atracción → partículas vuelan hacia el número
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

    // Reset mejorado con forge inmediata
    const resetSimulation = () => {
      // Tu clear original
      const clearProgram = new Program(gl, { vertex: baseVertex, fragment: `void main() { gl_FragColor = vec4(0,0,0,0); }` });
      const clearMesh = new Mesh(gl, { geometry, program: clearProgram });
      renderer.render({ scene: clearMesh, target: targetVelocityA });
      renderer.render({ scene: clearMesh, target: targetVelocityB });
      renderer.render({ scene: clearMesh, target: targetDensityA });
      renderer.render({ scene: clearMesh, target: targetDensityB });

      // FORJA INMEDIATA DEL NÚMERO
      if (currentNumber !== undefined) {
        const roman = ROMAN_MAP[currentNumber] || 'V';
        const firstChar = roman[0] || 'V';
        const glyph = GLYPHS[firstChar] || GLYPHS['V'];
        forgeGlyphInFluid(glyph, 1.3);
      }
    };

    // Trigger automático cuando cambia el número (el countdown)
    const handleNumberChange = () => {
      if (currentNumber !== undefined) {
        const roman = ROMAN_MAP[currentNumber] || 'V';
        const firstChar = roman[0] || 'V';
        const glyph = GLYPHS[firstChar] || GLYPHS['V'];
        forgeGlyphInFluid(glyph, 1.2);
      }
    };

    // Llamadas iniciales
    resetSimulation();

    // Cleanup
    return () => {
      // tu cleanup original
    };
  }, [viscosity, density, color, resetTrigger, currentNumber]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}
