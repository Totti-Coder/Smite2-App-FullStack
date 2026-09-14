'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Center, OrbitControls, useGLTF } from '@react-three/drei';

/**
 * The 3D god model at the centre of the orbital build view.
 *
 * Loaded through a dynamic import by its parent (never at module scope) and
 * only mounted once the section is actually on screen - the .glb files are
 * multi-megabyte, so mounting this eagerly would make every god page pay for
 * an asset most visitors never scroll to.
 */
function Model({ src }: { src: string }) {
  const { scene } = useGLTF(src);


  // <Bounds fit clip> measures the loaded scene and frames the camera to it,
  // and <Center> moves its pivot to the origin. Both matter because the model
  // is authored elsewhere: its units, origin and orientation are unknown here,
  // so any hardcoded scale/position would be a guess that breaks the moment a
  // second god's model is added.
  // NOTE: no `observe`. With it, Bounds re-fits the camera every frame and
  // silently overwrites whatever OrbitControls just did - auto-rotation was
  // running and being reset instantly, measured as a camera position frozen
  // at (-0.00, 3.60). Fitting once on mount leaves the camera to the controls.
  return (
    <Bounds fit clip margin={1.1}>
      <Center>
        <primitive object={scene} />
      </Center>
    </Bounds>
  );
}

export default function GodModelCanvas({
  src,
  accent,
  autoRotate,
}: {
  src: string;
  /** The god's damage-type colour, reused for the rim light. */
  accent: string;
  /** False under reduced motion - the model is still fully rotatable by hand. */
  autoRotate: boolean;
}) {
  return (
    <Canvas
      // Transparent so the orbit rings and nodes behind/around it stay visible;
      // the canvas is one layer in a stack, not a background.
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 4], fov: 40 }}
      style={{ background: 'transparent' }}
    >
      {/* Lighting is deliberately restrained. The model carries its own
          baseColor and normal textures, and the first pass at this (ambient
          0.6 plus two point lights at intensity 18/10) blew them out to a
          flat white silhouette - r3f uses physically-based units, so those
          numbers are far brighter than they look. A neutral key light lets
          the texture read, and the accent-coloured lights are kept low
          enough to tint the rim rather than repaint the model. */}
      <ambientLight intensity={1.1} />
      <directionalLight position={[2, 4, 5]} intensity={1.6} />
      <pointLight position={[3, 1, 3]} intensity={4} color={accent} />
      <pointLight position={[-4, -2, -3]} intensity={3} color="#a78bfa" />

      <Suspense fallback={null}>
        <Model src={src} />
      </Suspense>

      <OrbitControls
        // makeDefault registers these as the scene's controls, so Bounds
        // performs its one-off fit THROUGH them instead of writing to the
        // camera behind their back.
        makeDefault
        // Rotation only: panning would slide the model out from under the
        // orbiting nodes, and zoom would let it swallow them.
        enablePan={false}
        enableZoom={false}
        autoRotate={autoRotate}
        // 0.9 is roughly one turn per minute - technically moving, but slow
        // enough that it reads as a static model. 2.4 is about 25s a turn:
        // clearly alive without being distracting behind the orbiting nodes.
        autoRotateSpeed={2.4}
        // Keeps the model from being tipped fully upside down.
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={(Math.PI * 3) / 4}
      />
    </Canvas>
  );
}
