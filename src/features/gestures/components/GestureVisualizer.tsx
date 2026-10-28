// GestureVisualizer.tsx — 3D animation of a gesture recording using Three.js.
//
// This component creates a miniature 3D world inside a <canvas> element.
// It loads the Cato device's 3D model (an STL file) and animates it frame-by-frame
// using the recorded IMU data — gyroscope drives rotation, accelerometer drives
// position. The animation loops continuously so you can watch the gesture replay.
//
// The scene is built once per mount; selecting another recording only swaps
// the samples being replayed. Playback controls (pause/play, speed) and the
// samples reach the animation loop via refs — React state can't be read inside
// a requestAnimationFrame closure because the closure captures a snapshot of
// state at creation time, while a ref always holds the current value.

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useConfig } from "../../../context/ConfigContext";
import type { Sample } from "../../../types/gestures";
import styles from "../GestureTab.module.css";

// Three shades of yellow, one per axis — distinct enough to help judge depth
// while staying within a single color family (no red/green/blue coding).
const AXIS_COLORS = { X: 0xfff176, Y: 0xffd600, Z: 0xf57f17 }; // pale, medium, deep

// ── Device orientation → rest pose ──────────────────────────────────────────
//
// data.global_info.orientation.{usb,led} store which of 6 directions
// (u/d/l/r/f/b, relative to the user) the USB port and status LED physically
// point. These are fixed hardware facts about the STL's own raw/unrotated
// axes (confirmed empirically against the physical device): the USB port
// points along local -X, and the LED points along local +Z.
const LOCAL_USB_DIR_STL = new THREE.Vector3(-1, 0, 0);
const LOCAL_LED_DIR_STL = new THREE.Vector3(0, 0, 1);

// Static correction between the STL's raw axes and the IMU's own axes,
// applied to meshGroup (see scene setup below). Defined once here so
// meshGroup's rotation and the orientation math below can't drift apart.
const MESH_CORRECTION_EULER = new THREE.Euler(Math.PI / 2, 0, 0);
const MESH_CORRECTION_QUAT = new THREE.Quaternion().setFromEuler(MESH_CORRECTION_EULER);

// deviceGroup (which gets the orientation quaternion below) rotates in the
// IMU's own axis terms, not the STL's raw ones, so USB/LED directions need
// to be carried through the same correction before use.
const LOCAL_USB_DIR = LOCAL_USB_DIR_STL.clone().applyQuaternion(MESH_CORRECTION_QUAT);
const LOCAL_LED_DIR = LOCAL_LED_DIR_STL.clone().applyQuaternion(MESH_CORRECTION_QUAT);

// World-frame meaning of each direction code, from the viewer's perspective
// in the 3D scene: +Y is up, +X is the viewer's right, +Z points out of the
// screen toward the viewer ("front").
const WORLD_DIRS: Record<string, THREE.Vector3> = {
  u: new THREE.Vector3(0, 1, 0),
  d: new THREE.Vector3(0, -1, 0),
  l: new THREE.Vector3(-1, 0, 0),
  r: new THREE.Vector3(1, 0, 0),
  f: new THREE.Vector3(0, 0, 1),
  b: new THREE.Vector3(0, 0, -1),
};

// Build the quaternion that rotates the STL's local axes so the USB port and
// LED point the directions the device's orientation config says they should,
// in the scene's world frame. USB/LED directions are always perpendicular on
// the physical device, so together with their cross product they form a
// complete orthonormal basis — same on the local and world side — and the
// rotation mapping one basis onto the other is fully determined.
function computeOrientationQuaternion(usbCode?: string, ledCode?: string) {
  const worldUsb = usbCode ? WORLD_DIRS[usbCode] : undefined;
  const worldLed = ledCode ? WORLD_DIRS[ledCode] : undefined;
  if (!worldUsb || !worldLed) return new THREE.Quaternion(); // identity fallback

  const localThird = LOCAL_USB_DIR.clone().cross(LOCAL_LED_DIR);
  const worldThird = worldUsb.clone().cross(worldLed);

  // localToBasis expresses a vector in the (USB, LED, third) local basis;
  // basisToWorld then re-expresses those basis coordinates as world
  // directions. Composing the two carries the local axes onto the world ones.
  const localToBasis = new THREE.Matrix4()
    .makeBasis(LOCAL_USB_DIR, LOCAL_LED_DIR, localThird)
    .transpose();
  const basisToWorld = new THREE.Matrix4().makeBasis(worldUsb, worldLed, worldThird);

  const rotation = basisToWorld.multiply(localToBasis);
  return new THREE.Quaternion().setFromRotationMatrix(rotation);
}

// One solid-colored cylinder per axis (thicker/more visible than a thin
// Line, which WebGL caps at ~1px regardless of `linewidth`).
function createAxis(direction: THREE.Vector3, colorHex: number, length: number, radius: number) {
  const dir = direction.clone().normalize();
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 12),
    new THREE.MeshBasicMaterial({ color: colorHex, depthTest: false }),
  );
  cylinder.renderOrder = 998;
  // CylinderGeometry's axis is +Y by default; rotate it to point along `dir`.
  cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  cylinder.position.copy(dir).multiplyScalar(length / 2);
  return cylinder;
}

// Builds a thick-lined XYZ axes indicator (a beefed-up alternative to
// THREE.AxesHelper, which is thin and capped at ~1px line width).
function createAxesIndicator(length = 25, radius = 0.4) {
  const group = new THREE.Group();
  group.add(createAxis(new THREE.Vector3(1, 0, 0), AXIS_COLORS.X, length, radius));
  group.add(createAxis(new THREE.Vector3(0, 1, 0), AXIS_COLORS.Y, length, radius));
  group.add(createAxis(new THREE.Vector3(0, 0, 1), AXIS_COLORS.Z, length, radius));
  return group;
}

// IMU samples per second. Playback consumes samples at this rate (× speed),
// and the gyro integration below treats each sample as 1/SAMPLE_RATE_HZ s.
const SAMPLE_RATE_HZ = 100;
// Cap on how much time one animation frame may catch up (e.g. after the tab
// was hidden), so playback resumes rather than fast-forwarding.
const MAX_FRAME_MS = 100;
const CANVAS_SIZE = 400;

// The STL is fetched and parsed once per page and shared by every mount.
let catoGeometry: Promise<THREE.BufferGeometry> | null = null;
function loadCatoGeometry() {
  catoGeometry ??= new STLLoader().loadAsync("/cato%20model.stl").catch((err) => {
    catoGeometry = null; // allow a retry next time
    throw err;
  });
  return catoGeometry;
}

/** What the animation loop is replaying; replaced whenever the input changes. */
interface Playback {
  samples: Sample[];
  /** Gravity baseline subtracted from acceleration. */
  meanAcc: [number, number, number];
  frame: number;
  /** Fractional samples owed to playback (see the animation loop). */
  accum: number;
  /** Set to put the device back at its rest pose on the next frame. */
  needsReset: boolean;
}

function createPlayback(samples: Sample[] | null | undefined): Playback | null {
  if (!samples || samples.length === 0) return null;
  const meanAcc: [number, number, number] = [0, 0, 0];
  for (const sample of samples) {
    meanAcc[0] += sample.acc[0];
    meanAcc[1] += sample.acc[1];
    meanAcc[2] += sample.acc[2];
  }
  meanAcc[0] /= samples.length;
  meanAcc[1] /= samples.length;
  meanAcc[2] /= samples.length;
  return { samples, meanAcc, frame: 0, accum: 0, needsReset: true };
}

// Disposes every geometry/material under `root`, except ones in `keep`.
function disposeTree(root: THREE.Object3D, keep: Set<unknown>) {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (!keep.has(obj.geometry)) obj.geometry.dispose();
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of materials) if (!keep.has(m)) m.dispose();
  });
}

interface GestureVisualizerProps {
  imuData: Sample[] | null | undefined;
}

const GestureVisualizer = ({ imuData }: GestureVisualizerProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const { data } = useConfig();
  const usbCode = data?.global_info?.orientation?.usb;
  const ledCode = data?.global_info?.orientation?.led;

  // Refs let the animation loop read the latest values without the scene
  // being rebuilt or capturing stale closures.
  const isPausedRef = useRef(false);
  const speedRef    = useRef(1);
  const playbackRef = useRef<Playback | null>(null);
  const restQuatRef = useRef(new THREE.Quaternion());

  // React state drives button rendering only.
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed]         = useState(1);
  const [showAxes, setShowAxes]   = useState(false);
  const showAxesRef = useRef(showAxes);

  // Auto-play whenever a new recording is selected (adjusting state on a prop
  // change during render, rather than in an effect).
  const [prevImuData, setPrevImuData] = useState(imuData);
  if (imuData !== prevImuData) {
    setPrevImuData(imuData);
    setIsPlaying(true);
  }

  // Holds the axes indicator once the model has loaded, so the showAxes
  // effect can toggle it without touching the scene.
  const axesHelperRef = useRef<THREE.Group | null>(null);

  // Holds the OrbitControls instance so the "Reset view" button can call
  // .reset() without needing its own effect.
  const controlsRef = useRef<OrbitControls | null>(null);
  const handleResetView = () => controlsRef.current?.reset();

  const handleTogglePlay = () => {
    isPausedRef.current = !isPausedRef.current;
    setIsPlaying(!isPausedRef.current);
  };

  const handleToggleSpeed = () => {
    const next = speedRef.current === 1 ? 0.5 : 1;
    speedRef.current = next;
    setSpeed(next);
  };

  useEffect(() => {
    showAxesRef.current = showAxes;
    if (axesHelperRef.current) axesHelperRef.current.visible = showAxes;
  }, [showAxes]);

  // New samples → restart playback from the rest pose.
  useEffect(() => {
    playbackRef.current = createPlayback(imuData);
    isPausedRef.current = false;
  }, [imuData]);

  // New orientation config → new rest pose.
  useEffect(() => {
    restQuatRef.current = computeOrientationQuaternion(usbCode, ledCode);
    if (playbackRef.current) playbackRef.current.needsReset = true;
  }, [usbCode, ledCode]);

  // ── Scene: built once per mount ─────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;

    const scene = new THREE.Scene();

    // PerspectiveCamera(fov, aspectRatio, near, far)
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 0, 50);

    // alpha + a transparent clear colour let the viz blend into the page.
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(CANVAS_SIZE, CANVAS_SIZE);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // Lets the user click-and-drag to orbit the camera around the device.
    // Orbiting only ever moves the camera, never the model, so the
    // configured rest pose stays where it's set. .reset() (the "Reset view"
    // button) restores the camera captured here.
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    // ── Lighting ─────────────────────────────────────────────────────────────
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 5, 5);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    // ── Materials ─────────────────────────────────────────────────────────────
    const shaderMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float t = 0.5 * (1.0 + dot(vNormal, normalize(vec3(1.0, 1.0, 0.5))));
          vec3 dark  = vec3(0.50, 0.50, 0.50);
          vec3 light = vec3(0.85, 0.85, 0.85);
          gl_FragColor = vec4(mix(light, dark, t), 1.0);
        }
      `,
    });

    // ── Model ─────────────────────────────────────────────────────────────────
    // deviceGroup carries the rest pose + replayed motion; meshGroup the
    // static STL→IMU axis correction.
    const deviceGroup = new THREE.Group();
    scene.add(deviceGroup);
    const meshGroup = new THREE.Group();
    meshGroup.rotation.copy(MESH_CORRECTION_EULER);
    deviceGroup.add(meshGroup);

    let sharedGeometry: THREE.BufferGeometry | null = null;
    loadCatoGeometry().then(
      (geometry) => {
        if (disposed) return;
        sharedGeometry = geometry;
        const mesh = new THREE.Mesh(geometry, shaderMaterial);
        mesh.scale.set(0.5, 0.5, 0.5);
        meshGroup.add(mesh);

        // No offset relative to meshGroup, so these are the STL file's own
        // raw axes (no IMU-alignment correction applied).
        const axesHelper = createAxesIndicator(25, 0.4);
        axesHelper.visible = showAxesRef.current;
        mesh.add(axesHelper);
        axesHelperRef.current = axesHelper;
      },
      (err) => console.error("GestureVisualizer: failed to load cato model.stl", err),
    );

    // ── Animation loop ────────────────────────────────────────────────────────
    // Playback is paced by elapsed time: `accum` collects how many samples
    // are due (SAMPLE_RATE_HZ × speed per second) and whole ones are
    // consumed, so 1× is real time on any display refresh rate.
    let animId = 0;
    let lastTime = performance.now();

    // Reused across frames to avoid allocating a new Vector3/Quaternion per sample.
    const deltaRotVec = new THREE.Vector3();
    const deltaQuat = new THREE.Quaternion();

    const resetPose = () => {
      deviceGroup.position.set(0, 0, 0);
      deviceGroup.quaternion.copy(restQuatRef.current);
    };

    function animate(now: number) {
      animId = requestAnimationFrame(animate);
      const elapsed = Math.min(MAX_FRAME_MS, now - lastTime);
      lastTime = now;
      controls.update();

      const pb = playbackRef.current;
      if (!pb) return;
      if (pb.needsReset) {
        resetPose();
        pb.frame = 0;
        pb.accum = 0;
        pb.needsReset = false;
      }
      if (meshGroup.children.length === 0 || isPausedRef.current) {
        renderer.render(scene, camera);
        return;
      }

      pb.accum += (elapsed / 1000) * SAMPLE_RATE_HZ * speedRef.current;

      while (pb.accum >= 1) {
        pb.accum -= 1;

        if (pb.frame >= pb.samples.length) {
          // Loop: reset to starting pose and replay from the beginning.
          resetPose();
          pb.frame = 0;
        }

        const { acc, gyro } = pb.samples[pb.frame];

        // Integrate body-frame angular velocity as a quaternion rotation rather
        // than summing independent Euler angles — Euler axes aren't orthogonal
        // once more than one axis is active (each later axis in the rotation
        // order inherits a tilt from whatever the earlier axes have already
        // accumulated), which warps the apparent rotation axis over time.
        // Composing a small quaternion per sample and right-multiplying it onto
        // the current orientation (i.e. applying it in the device's own local
        // frame, matching how gyro data is measured) avoids that entirely.
        deltaRotVec.set(
          THREE.MathUtils.degToRad(-gyro[0] / SAMPLE_RATE_HZ),
          THREE.MathUtils.degToRad(gyro[1] / SAMPLE_RATE_HZ),
          THREE.MathUtils.degToRad(-gyro[2] / SAMPLE_RATE_HZ),
        );
        const angle = deltaRotVec.length();
        if (angle > 0) {
          deltaQuat.setFromAxisAngle(deltaRotVec.normalize(), angle);
          deviceGroup.quaternion.multiply(deltaQuat);
        }

        deviceGroup.position.x += (acc[0] - pb.meanAcc[0]) / 500;
        deviceGroup.position.y += (acc[1] - pb.meanAcc[1]) / 500;
        deviceGroup.position.z += (acc[2] - pb.meanAcc[2]) / 500;

        pb.frame++;
      }

      renderer.render(scene, camera);
    }

    animId = requestAnimationFrame(animate);

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      controls.dispose();
      controlsRef.current = null;
      axesHelperRef.current = null;
      disposeTree(scene, new Set([sharedGeometry])); // the STL geometry is shared
      shaderMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss(); // release the WebGL context now, not at GC
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  const hasData = imuData && imuData.length > 0;

  return (
    <div className={styles.visualizerWrap}>
      {!hasData && (
        <p className={styles.emptyMsg}>Select a gesture to visualize.</p>
      )}
      <div ref={mountRef} style={hasData ? undefined : { display: "none" }} />

      {hasData && (
        <div className={styles.vizControls}>
          <button
            className={styles.vizBtn}
            onClick={handleTogglePlay}
            title={isPlaying ? "Pause" : "Play"}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button
            className={`${styles.vizBtn} ${speed === 0.5 ? styles.vizBtnActive : ""}`}
            onClick={handleToggleSpeed}
            title={speed === 0.5 ? "Normal speed" : "Slow motion"}
            aria-pressed={speed === 0.5}
          >
            ½×
          </button>
          <button
            className={styles.vizBtn}
            onClick={handleResetView}
            title="Reset camera view"
            aria-label="Reset camera view"
          >
            ⟲
          </button>
          <label className={styles.checkLabel} title="Show the STL file's own raw X/Y/Z axes, unadjusted for the IMU's orientation">
            <input
              type="checkbox"
              checked={showAxes}
              onChange={(e) => setShowAxes(e.target.checked)}
            />
            Show axes
          </label>
        </div>
      )}
    </div>
  );
};

export default GestureVisualizer;
