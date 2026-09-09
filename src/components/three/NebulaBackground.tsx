'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { useMotionPref } from '@/components/motion/MotionRoot';
import { DotGridOrbs } from '@/components/DotGridOrbs';

// A single full-screen quad running a fragment shader - no meshes, no
// lights, no scene graph beyond one plane, so the per-frame cost is one
// draw call regardless of how elaborate the visuals look. three.js is
// dynamically imported so its ~150KB never lands in the shared bundle;
// only this component's route pays for it.
//
// Colours are the app's own tokens (--ss-cyan #16c8d4, --ss-purple #a78bfa
// over --ss-bg #0a0d15), so this reads as the same site with depth added,
// not a generic WebGL demo bolted on.

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uPointer;   // 0..1, eased
  uniform float uIntensity;

  const vec3 BG     = vec3(0.039, 0.051, 0.082); // #0a0d15
  const vec3 CYAN   = vec3(0.086, 0.784, 0.831); // #16c8d4
  const vec3 PURPLE = vec3(0.655, 0.545, 0.980); // #a78bfa

  // Classic value-noise + fbm. Cheap, and at this scale/blur the lack of
  // gradient noise's crispness is invisible.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float total = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      total += noise(p) * amplitude;
      p *= 2.03;
      amplitude *= 0.5;
    }
    return total;
  }

  void main() {
    // Aspect-corrected coords so the field doesn't stretch on wide screens.
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

    float t = uTime * 0.045;

    // Domain warping: run fbm through itself so the field folds and drifts
    // instead of just scrolling.
    vec2 q = vec2(fbm(p * 1.6 + vec2(0.0, t)), fbm(p * 1.6 + vec2(4.3, -t)));
    vec2 r = vec2(fbm(p * 1.9 + q * 1.4 + vec2(1.7, 9.2) + t * 0.7),
                  fbm(p * 1.9 + q * 1.4 + vec2(8.3, 2.8) - t * 0.6));
    float field = fbm(p * 2.1 + r * 1.6);

    // Two colour bands pulled apart by the warped field.
    float cyanMask   = smoothstep(0.35, 0.85, field + r.x * 0.35);
    float purpleMask = smoothstep(0.40, 0.95, 1.0 - field + r.y * 0.30);

    vec3 color = BG;
    color += CYAN   * cyanMask   * 0.32;
    color += PURPLE * purpleMask * 0.30;

    // Pointer glow - the interactive part. Follows an eased pointer so it
    // trails rather than snapping.
    vec2 pointer = (uPointer - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
    float d = length(p - pointer);
    color += mix(CYAN, PURPLE, 0.5) * exp(-d * 3.2) * 0.16;

    // Vignette so the centre content (form, terminal) keeps its contrast.
    float vignette = smoothstep(1.25, 0.25, length(p));
    color = mix(BG, color, vignette);

    gl_FragColor = vec4(color * uIntensity, 1.0);
  }
`;

export function NebulaBackground() {
  const hostRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { pref } = useMotionPref();

  // 'pending' until we know whether WebGL + motion are actually available;
  // rendering the CSS fallback in the meantime means there's never a blank
  // frame, and never a hydration mismatch (server always renders 'pending').
  const [mode, setMode] = useState<'pending' | 'webgl' | 'fallback'>('pending');

  const animate = pref === 'on' || !reduced;

  useEffect(() => {
    // Reduced motion means no ambient animation at all - fall back to the
    // static CSS layer rather than rendering a frozen WebGL frame.
    if (!animate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resolves the deliberate 'pending' SSR state once client capabilities are known
      setMode('fallback');
      return;
    }

    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const THREE = await import('three');
      if (disposed) return;

      // Probe for a real context before committing - some devices expose
      // WebGLRenderingContext but fail to create a usable context.
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' });
      } catch {
        setMode('fallback');
        return;
      }

      setMode('webgl');

      // Capping DPR matters a lot here: this shader is fill-rate bound, so
      // a 3x retina backing store would triple the per-pixel cost for a
      // background nobody is inspecting closely.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(host.clientWidth, host.clientHeight, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      // Geometry is drawn in clip space by the vertex shader, so the camera
      // is a formality - no projection maths involved.
      const camera = new THREE.Camera();
      const geometry = new THREE.PlaneGeometry(2, 2);

      const uniforms = {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(host.clientWidth, host.clientHeight) },
        uPointer: { value: new THREE.Vector2(0.5, 0.5) },
        uIntensity: { value: 0 }, // fades in, so it never pops on load
      };

      const material = new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms,
        depthTest: false,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      const targetPointer = new THREE.Vector2(0.5, 0.5);
      function onPointerMove(e: PointerEvent) {
        targetPointer.set(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight);
      }
      window.addEventListener('pointermove', onPointerMove, { passive: true });

      function onResize() {
        if (!host) return;
        renderer.setSize(host.clientWidth, host.clientHeight, false);
        uniforms.uResolution.value.set(host.clientWidth, host.clientHeight);
      }
      const observer = new ResizeObserver(onResize);
      observer.observe(host);

      // Frame budget: this is decorative, so 30fps is plenty and halves the
      // GPU cost versus an uncapped loop.
      const FRAME_MS = 1000 / 30;
      let raf = 0;
      let last = 0;
      const start = performance.now();

      function loop(now: number) {
        raf = requestAnimationFrame(loop);
        if (now - last < FRAME_MS) return;
        last = now;

        uniforms.uTime.value = (now - start) / 1000;
        uniforms.uIntensity.value = Math.min(1, uniforms.uIntensity.value + 0.02);
        // Ease the pointer so the glow trails the cursor instead of snapping.
        uniforms.uPointer.value.lerp(targetPointer, 0.05);
        renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(loop);

      // A background tab shouldn't burn GPU. rAF already throttles when
      // hidden, but this stops the loop outright.
      function onVisibility() {
        if (document.hidden) {
          cancelAnimationFrame(raf);
        } else {
          last = 0;
          raf = requestAnimationFrame(loop);
        }
      }
      document.addEventListener('visibilitychange', onVisibility);

      cleanup = () => {
        cancelAnimationFrame(raf);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('pointermove', onPointerMove);
        observer.disconnect();
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [animate]);

  return (
    <>
      <div ref={hostRef} className="pointer-events-none absolute inset-0" aria-hidden="true" />
      {/* Kept mounted until WebGL is confirmed working, so a device without
          it (or with motion off) still gets the designed background rather
          than a flat colour. */}
      {mode !== 'webgl' && <DotGridOrbs />}
    </>
  );
}
