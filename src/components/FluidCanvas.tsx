import { useEffect, useRef } from 'react';
import { Renderer, Camera, Geometry, Program, Mesh, RenderTarget, Vec2, Vec3 } from 'ogl';

// GLYPHS y ROMAN_MAP para forjar el número
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
  currentNumber?: number;  // ← NUEVO: número que se forja
}

export default function FluidCanvas({ viscosity = 0.98, density = 0.96, color = '#00f2ff', resetTrigger = 0, currentNumber = 8 }: FluidCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ pos: new Vec2(), prev: new Vec2(), vel: new Vec2() });
  const particles = useRef<any[]>([]);
  
  const paramsRef = useRef({ viscosity, density, color });

  useEffect(() => {
    paramsRef.current = { viscosity, density, color };
  }, [viscosity, density, color]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const renderer = new Renderer({ alpha: true, premultipliedAlpha: true });
    const gl = renderer.gl;
    container.appendChild(gl.canvas);

    const camera = new Camera(gl);
    camera.position.z = 5;

    // Initialize particles
    const particleCount = 4000;
    const particlePositions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 4;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 4;
      particlePositions[i * 3 + 2] = 0;
    }

    const particleGeometry = new Geometry(gl, {
      position: { size: 3, data: particlePositions },
    });

    const particleProgram = new Program(gl, {
      vertex: `
        attribute vec3 position;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        uniform float uPointSize;
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uPointSize * (1.0 + sin(position.x * 10.0) * 0.5);
        }
      `,
      fragment: `
        precision highp float;
        uniform vec3 uColor;
        void main() {
          float dist = distance(gl_PointCoord, vec2(0.5));
          if (dist > 0.5) discard;
          float alpha = smoothstep(0.5, 0.0, dist);
          gl_FragColor = vec4(uColor * 1.5, alpha * 0.8);
        }
      `,
      uniforms: {
        uColor: { value: new Vec3(0, 1, 1) },
        uPointSize: { value: 3.5 },
      },
      transparent: true,
      depthTest: false,
    });

    const particleMesh = new Mesh(gl, { mode: gl.POINTS, geometry: particleGeometry, program: particleProgram });

    const geometry = new Geometry(gl, {
      position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
      uv: { size: 2, data: new Float32Array([0, 0, 2, 0, 0, 2]) },
    });

    const resolution = { value: new Vec2() };
    const resize = () => {
      if (!container) return;
      renderer.setSize(container.offsetWidth, container.offsetHeight);
      resolution.value.set(gl.canvas.width, gl.canvas.height);
    };
    window.addEventListener('resize', resize);
    resize();

    const options = {
      width: gl.canvas.width / 4,
      height: gl.canvas.height / 4,
      type: (gl as any).HALF_FLOAT || gl.FLOAT,
      format: gl.RGBA,
      internalFormat: (gl as any).RGBA16F || (gl as any).RGBA32F || gl.RGBA,
      minFilter: gl.LINEAR,
      depth: false,
    };

    let targetVelocityA = new RenderTarget(gl, options);
    let targetVelocityB = new RenderTarget(gl, options);
    let targetDensityA = new RenderTarget(gl, options);
    let targetDensityB = new RenderTarget(gl, options);

    const resetSimulation = () => {
      const clearProgram = new Program(gl, {
        vertex: baseVertex,
        fragment: `void main() { gl_FragColor = vec4(0, 0, 0, 0); }`,
      });
      const clearMesh = new Mesh(gl, { geometry, program: clearProgram });
      renderer.render({ scene: clearMesh, target: targetVelocityA });
      renderer.render({ scene: clearMesh, target: targetVelocityB });
      renderer.render({ scene: clearMesh, target: targetDensityA });
      renderer.render({ scene: clearMesh, target: targetDensityB });
    };

    const swapVelocity = () => {
      const tmp = targetVelocityA;
      targetVelocityA = targetVelocityB;
      targetVelocityB = tmp;
    };

    const swapDensity = () => {
      const tmp = targetDensityA;
      targetDensityA = targetDensityB;
      targetDensityB = tmp;
    };

    const splatProgram = new Program(gl, {
      vertex: baseVertex,
      fragment: splatShader,
      uniforms: {
        tWater: { value: null },
        uPoint: { value: new Vec2() },
        uRadius: { value: 0.01 },
        uColor: { value: [0, 0, 0] },
      },
      depthTest: false,
      depthWrite: false,
    });

    const forceProgram = new Program(gl, {
      vertex: baseVertex,
      fragment: externalForcesShader,
      uniforms: {
        tVelocity: { value: null },
        uPoint: { value: new Vec2() },
        uForce: { value: new Vec2() },
        uRadius: { value: 0.01 },
      },
      depthTest: false,
      depthWrite: false,
    });

    const advectProgram = new Program(gl, {
      vertex: baseVertex,
      fragment: advectShader,
      uniforms: {
        tWater: { value: null },
        tVelocity: { value: null },
        uDt: { value: 0.016 },
        uDissipation: { value: 0.99 },
      },
      depthTest: false,
      depthWrite: false,
    });

    const displayProgram = new Program(gl, {
      vertex: baseVertex,
      fragment: `
        precision highp float;
        uniform sampler2D tWater;
        varying vec2 vUv;
        void main() {
          vec3 color = texture2D(tWater, vUv).rgb;
          gl_FragColor = vec4(color, length(color));
        }
      `,
      uniforms: {
        tWater: { value: null },
      },
      transparent: true,
    });

    const mesh = new Mesh(gl, { geometry, program: displayProgram });

    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return [r, g, b];
    };

    const onMouseMove = (e: MouseEvent | TouchEvent) => {
      const x = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const y = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      
      const rect = container.getBoundingClientRect();
      mouse.current.pos.set(
        (x - rect.left) / rect.width,
        1.0 - (y - rect.top) / rect.height
      );

      if (!mouse.current.prev.x) mouse.current.prev.copy(mouse.current.pos);
      
      mouse.current.vel.sub(mouse.current.pos, mouse.current.prev);
      mouse.current.prev.copy(mouse.current.pos);
    };

    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('touchstart', onMouseMove);
    container.addEventListener('touchmove', onMouseMove);

    let rafId: number;
    
    const velocityBuffer = new Float32Array(options.width * options.height * 4);
    
    const update = () => {
      rafId = requestAnimationFrame(update);

      const currentParams = paramsRef.current;
      const rgbColor = hexToRgb(currentParams.color);

      if (mouse.current.vel.len() > 0.0001) {
        splatProgram.uniforms.tWater.value = targetDensityA.texture;
        splatProgram.uniforms.uPoint.value.copy(mouse.current.pos);
        splatProgram.uniforms.uRadius.value = 0.05;
        splatProgram.uniforms.uColor.value = rgbColor;
        
        mesh.program = splatProgram;
        renderer.render({ scene: mesh, target: targetDensityB });
        swapDensity();

        forceProgram.uniforms.tVelocity.value = targetVelocityA.texture;
        forceProgram.uniforms.uPoint.value.copy(mouse.current.pos);
        forceProgram.uniforms.uForce.value.copy(mouse.current.vel).multiply(5.0);
        forceProgram.uniforms.uRadius.value = 0.05;

        mesh.program = forceProgram;
        renderer.render({ scene: mesh, target: targetVelocityB });
        swapVelocity();

        mouse.current.vel.set(0);
      }

      advectProgram.uniforms.tWater.value = targetVelocityA.texture;
      advectProgram.uniforms.tVelocity.value = targetVelocityA.texture;
      advectProgram.uniforms.uDissipation.value = currentParams.viscosity;
      
      mesh.program = advectProgram;
      renderer.render({ scene: mesh, target: targetVelocityB });
      swapVelocity();

      advectProgram.uniforms.tWater.value = targetDensityA.texture;
      advectProgram.uniforms.tVelocity.value = targetVelocityA.texture;
      advectProgram.uniforms.uDissipation.value = currentParams.density;
      
      mesh.program = advectProgram;
      renderer.render({ scene: mesh, target: targetDensityB });
      swapDensity();

      gl.bindFramebuffer(gl.FRAMEBUFFER, targetVelocityA.buffer);
      gl.readPixels(0, 0, options.width, options.height, gl.RGBA, gl.FLOAT, velocityBuffer);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      for (let i = 0; i < particleCount; i++) {
        const px = ((particlePositions[i * 3] / 4 + 0.5) * options.width) | 0;
        const py = ((particlePositions[i * 3 + 1] / 4 + 0.5) * options.height) | 0;
        
        if (px >= 0 && px < options.width && py >= 0 && py < options.height) {
          const idx = (py * options.width + px) * 4;
          const vx = velocityBuffer[idx];
          const vy = velocityBuffer[idx + 1];
          
          particlePositions[i * 3] += vx * 0.1;
          particlePositions[i * 3 + 1] += vy * 0.1;
        }

        if (Math.abs(particlePositions[i * 3]) > 2 || Math.abs(particlePositions[i * 3 + 1]) > 2) {
          particlePositions[i * 3] = (Math.random() - 0.5) * 4;
          particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 4;
        }
      }
      particleGeometry.attributes.position.needsUpdate = true;
      particleProgram.uniforms.uColor.value.set(rgbColor[0], rgbColor[1], rgbColor[2]);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      displayProgram.uniforms.tWater.value = targetDensityA.texture;
      mesh.program = displayProgram;
      renderer.render({ scene: mesh });
      
      renderer.render({ scene: particleMesh, camera });
    };

    rafId = requestAnimationFrame(update);

    (window as any).__resetFluid = resetSimulation;

    // === FUNCIÓN FORGE INTEGRADA ===
    const forgeGlyphInFluid = (glyph: number[][], intensity = 1.3) => {
      if (!glyph) return;
      const cols = 5;
      const rows = 5;
      const cellW = 1 / cols;
      const cellH = 1 / rows;
      const radius = 0.085;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (glyph[y]?.[x] === 1) {
            const u = (x + 0.5) * cellW;
            const v = (y + 0.5) * cellH;

            splatProgram.uniforms.tWater.value = targetDensityA.texture;
            splatProgram.uniforms.uPoint.value.set(u, v);
            splatProgram.uniforms.uRadius.value = radius;
            splatProgram.uniforms.uColor.value = [intensity, intensity * 0.3, intensity * 1.3];
            renderer.render({ scene: splatMesh, target: targetDensityB });
            swapDensity();

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

    // Reset con forge
    const originalReset = (window as any).__resetFluid;
    (window as any).__resetFluid = () => {
      originalReset();
      if (currentNumber !== undefined) {
        const roman = ROMAN_MAP[currentNumber] || 'V';
        const firstChar = roman[0] || 'V';
        const glyph = GLYPHS[firstChar] || GLYPHS['V'];
        forgeGlyphInFluid(glyph, 1.3);
      }
    };

    return () => {
      window.removeEventListener('resize', resize);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('touchstart', onMouseMove);
      container.removeEventListener('touchmove', onMouseMove);
      cancelAnimationFrame(rafId);
      if (gl.canvas.parentNode) gl.canvas.parentNode.removeChild(gl.canvas);
    };
  }, []);

  // Trigger forge cuando cambia el número
  useEffect(() => {
    if (resetTrigger > 0 && (window as any).__resetFluid) {
      (window as any).__resetFluid();
    }
  }, [resetTrigger, currentNumber]);

  return <div ref={containerRef} className="absolute inset-0 z-0 pointer-events-auto" />;
}
