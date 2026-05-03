import { useEffect, useRef } from 'react';
import { Renderer, Camera, Geometry, Program, Mesh, RenderTarget, Vec2, Vec3 } from 'ogl';

// GLYPHS y ROMAN_MAP para forjar el número en el fluido
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
  currentNumber?: number;
}

export default function FluidCanvas({
  viscosity = 0.98,
  density = 0.96,
  color = '#00f2ff',
  resetTrigger = 0,
  currentNumber = 8
}: FluidCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new Renderer({ dpr: Math.min(2, window.devicePixelRatio), canvas, alpha: true });
    const gl = renderer.gl;
    const camera = new Camera(gl);
    camera.position.z = 1;

    const geometry = new Geometry(gl, {
      position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
      uv: { size: 2, data: new Float32Array([0, 0, 2, 0, 0, 2]) }
    });

    const baseVertex = `
      attribute vec2 position;
      attribute vec2 uv;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const splatFragment = `
      precision highp float;
      uniform sampler2D tWater;
      uniform vec2 uPoint;
      uniform float uRadius;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        vec3 data = texture2D(tWater, vUv).rgb;
        float dist = distance(vUv, uPoint);
        float strength = exp(-dist / uRadius);
        gl_FragColor = vec4(data + strength * uColor, 1.0);
      }
    `;

    const forceFragment = `
      precision highp float;
      uniform sampler2D tVelocity;
      uniform vec2 uPoint;
      uniform vec2 uForce;
      uniform float uRadius;
      varying vec2 vUv;
      void main() {
        vec2 vel = texture2D(tVelocity, vUv).xy;
        float dist = distance(vUv, uPoint);
        float strength = exp(-dist / uRadius);
        gl_FragColor = vec4(vel + strength * uForce, 0.0, 1.0);
      }
    `;

    const advectFragment = `
      precision highp float;
      uniform sampler2D tWater;
      uniform sampler2D tVelocity;
      uniform float uDt;
      uniform float uDissipation;
      varying vec2 vUv;
      void main() {
        vec2 velocity = texture2D(tVelocity, vUv).xy;
        vec2 prevUv = vUv - velocity * uDt;
        gl_FragColor = texture2D(tWater, prevUv) * uDissipation;
      }
    `;

    // RenderTargets (creados manualmente, sin .clone())
    const targetOptions = { width: canvas.width, height: canvas.height, type: gl.HALF_FLOAT || gl.FLOAT, format: gl.RGBA, minFilter: gl.LINEAR };
    const targetVelocityA = new RenderTarget(gl, targetOptions);
    const targetVelocityB = new RenderTarget(gl, targetOptions);
    const targetDensityA = new RenderTarget(gl, targetOptions);
    const targetDensityB = new RenderTarget(gl, targetOptions);

    const splatProgram = new Program(gl, { vertex: baseVertex, fragment: splatFragment });
    const forceProgram = new Program(gl, { vertex: baseVertex, fragment: forceFragment });
    const advectProgram = new Program(gl, { vertex: baseVertex, fragment: advectFragment });

    const splatMesh = new Mesh(gl, { geometry, program: splatProgram });
    const forceMesh = new Mesh(gl, { geometry, program: forceProgram });
    const advectMesh = new Mesh(gl, { geometry, program: advectProgram });

    const swap = (a: RenderTarget, b: RenderTarget) => { [a.texture, b.texture] = [b.texture, a.texture]; };

    const forgeGlyphInFluid = (glyph: number[][], intensity = 1.3) => {
      if (!glyph) return;
      const cols = 5; const rows = 5;
      const cellW = 1 / cols; const cellH = 1 / rows;
      const radius = 0.085;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (glyph[y][x] === 1) {
            const u = (x + 0.5) * cellW;
            const v = (y + 0.5) * cellH;

            // Splat densidad = forma del número
            splatProgram.uniforms.tWater = { value: targetDensityA.texture };
            splatProgram.uniforms.uPoint = { value: new Vec2(u, v) };
            splatProgram.uniforms.uRadius = { value: radius };
            splatProgram.uniforms.uColor = { value: [intensity, intensity * 0.3, intensity * 1.3] };
            renderer.render({ scene: splatMesh, target: targetDensityB });
            swap(targetDensityA, targetDensityB);

            // Fuerza atracción
            forceProgram.uniforms.tVelocity = { value: targetVelocityA.texture };
            forceProgram.uniforms.uPoint = { value: new Vec2(u, v) };
            forceProgram.uniforms.uForce = { value: new Vec2(0, -1.2) };
            forceProgram.uniforms.uRadius = { value: radius * 1.6 };
            renderer.render({ scene: forceMesh, target: targetVelocityB });
            swap(targetVelocityA, targetVelocityB);
          }
        }
      }
    };

    const resetSimulation = () => {
      // Clear
      const clearProgram = new Program(gl, { vertex: baseVertex, fragment: `precision highp float; out vec4 fragColor; void main() { fragColor = vec4(0.0); }` });
      const clearMesh = new Mesh(gl, { geometry, program: clearProgram });
      renderer.render({ scene: clearMesh, target: targetVelocityA });
      renderer.render({ scene: clearMesh, target: targetVelocityB });
      renderer.render({ scene: clearMesh, target: targetDensityA });
      renderer.render({ scene: clearMesh, target: targetDensityB });

      // FORJA INMEDIATA
      if (currentNumber !== undefined) {
        const roman = ROMAN_MAP[currentNumber] || 'V';
        const firstChar = roman[0] || 'V';
        const glyph = GLYPHS[firstChar] || GLYPHS['V'];
        forgeGlyphInFluid(glyph, 1.3);
      }
    };

    // Trigger forge cuando cambia el número
    useEffect(() => {
      if (currentNumber !== undefined) {
        const roman = ROMAN_MAP[currentNumber] || 'V';
        const firstChar = roman[0] || 'V';
        const glyph = GLYPHS[firstChar] || GLYPHS['V'];
        forgeGlyphInFluid(glyph, 1.2);
      }
    }, [currentNumber]);

    resetSimulation();

    // Cleanup
    return () => renderer.destroy();
  }, [viscosity, density, color, resetTrigger, currentNumber]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}
