import { useEffect, useRef } from 'react';
import { Renderer, Camera, Geometry, Program, Mesh, RenderTarget, Vec2, Vec3 } from 'ogl';

// Shaders for the fluid simulation
const baseVertex = `
    attribute vec2 position;
    attribute vec2 uv;
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position, 0, 1);
    }
`;

const clearShader = `
    precision highp float;
    uniform sampler2D tWater;
    varying vec2 vUv;
    void main() {
        gl_FragColor = vec4(0, 0, 0, 0);
    }
`;

const splatShader = `
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

const advectShader = `
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

const externalForcesShader = `
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

interface FluidCanvasProps {
    viscosity?: number;
    density?: number;
    color?: string;
    resetTrigger?: number;
}

export default function FluidCanvas({ viscosity = 0.98, density = 0.96, color = '#00f2ff', resetTrigger = 0 }: FluidCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mouse = useRef({ pos: new Vec2(), prev: new Vec2(), vel: new Vec2() });
    const particles = useRef<any[]>([]);
    
    // Refs for real-time param updates without re-init
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

        // Triangle geometry for full-screen quad
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

        // Create RenderTargets for ping-ponging
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

        // Programs
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
        
        // Manual velocity sampling for particles
        const velocityBuffer = new Float32Array(options.width * options.height * 4);
        
        const update = () => {
            rafId = requestAnimationFrame(update);

            // Update current parameters from refs
            const currentParams = paramsRef.current;
            const rgbColor = hexToRgb(currentParams.color);

            // 1. Splat density if moving
            if (mouse.current.vel.len() > 0.0001) {
                // Add density
                splatProgram.uniforms.tWater.value = targetDensityA.texture;
                splatProgram.uniforms.uPoint.value.copy(mouse.current.pos);
                splatProgram.uniforms.uRadius.value = 0.05;
                splatProgram.uniforms.uColor.value = rgbColor;
                
                mesh.program = splatProgram;
                renderer.render({ scene: mesh, target: targetDensityB });
                swapDensity();

                // Add force
                forceProgram.uniforms.tVelocity.value = targetVelocityA.texture;
                forceProgram.uniforms.uPoint.value.copy(mouse.current.pos);
                forceProgram.uniforms.uForce.value.copy(mouse.current.vel).multiply(5.0);
                forceProgram.uniforms.uRadius.value = 0.05;

                mesh.program = forceProgram;
                renderer.render({ scene: mesh, target: targetVelocityB });
                swapVelocity();

                mouse.current.vel.set(0);
            }

            // 2. Advect velocity
            advectProgram.uniforms.tWater.value = targetVelocityA.texture;
            advectProgram.uniforms.tVelocity.value = targetVelocityA.texture;
            advectProgram.uniforms.uDissipation.value = currentParams.viscosity;
            
            mesh.program = advectProgram;
            renderer.render({ scene: mesh, target: targetVelocityB });
            swapVelocity();

            // 3. Advect density
            advectProgram.uniforms.tWater.value = targetDensityA.texture;
            advectProgram.uniforms.tVelocity.value = targetVelocityA.texture;
            advectProgram.uniforms.uDissipation.value = currentParams.density;
            
            mesh.program = advectProgram;
            renderer.render({ scene: mesh, target: targetDensityB });
            swapDensity();

            // 4. Update and Render Particles
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

                // Boundary check
                if (Math.abs(particlePositions[i * 3]) > 2 || Math.abs(particlePositions[i * 3 + 1]) > 2) {
                    particlePositions[i * 3] = (Math.random() - 0.5) * 4;
                    particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 4;
                }
            }
            particleGeometry.attributes.position.needsUpdate = true;
            particleProgram.uniforms.uColor.value.set(rgbColor[0], rgbColor[1], rgbColor[2]);

            // 5. Render to screen
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            displayProgram.uniforms.tWater.value = targetDensityA.texture;
            mesh.program = displayProgram;
            renderer.render({ scene: mesh });
            
            renderer.render({ scene: particleMesh, camera });
        };

        rafId = requestAnimationFrame(update);

        // Expose reset to local variable context
        (window as any).__resetFluid = resetSimulation;

        return () => {
            window.removeEventListener('resize', resize);
            container.removeEventListener('mousemove', onMouseMove);
            container.removeEventListener('touchstart', onMouseMove);
            container.removeEventListener('touchmove', onMouseMove);
            cancelAnimationFrame(rafId);
            if (gl.canvas.parentNode) {
                gl.canvas.parentNode.removeChild(gl.canvas);
            }
        };
    }, []);

    // Listen to resetTrigger from parents
    useEffect(() => {
        if (resetTrigger > 0 && (window as any).__resetFluid) {
            (window as any).__resetFluid();
        }
    }, [resetTrigger]);

    return <div ref={containerRef} className="absolute inset-0 z-0 pointer-events-auto" />;
}
