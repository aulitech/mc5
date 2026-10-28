// GestureVisualizer.tsx — 3D animation of a gesture recording using Three.js.
//
// This component creates a miniature 3D world inside a <canvas> element.
// It loads the Cato device's 3D model (an STL file) and animates it frame-by-frame
// using the recorded IMU data — gyroscope drives rotation, accelerometer drives
// position. The animation loops continuously so you can watch the gesture replay.
//
// Playback controls (pause/play, speed) communicate with the animation loop via
// refs. React state can't be read inside a requestAnimationFrame closure because
// the closure captures a snapshot of state at creation time — a ref always holds
// the current value.

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

interface GestureVisualizerProps {
  imuData: Sample[] | null | undefined;
}

const GestureVisualizer = ({ imuData }: GestureVisualizerProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const { data } = useConfig();
  const usbCode = data?.global_info?.orientation?.usb;
  const ledCode = data?.global_info?.orientation?.led;

  // Refs let the animation loop read the latest control values without
  // being re-created or capturing stale closures.
  const isPausedRef = useRef(false);
  const speedRef    = useRef(1);

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

  // Holds the AxesHelper once it's created inside the effect below, so the
  // separate showAxes-sync effect can toggle its visibility without tearing
  // down and rebuilding the whole Three.js scene.
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

  // Keep the AxesHelper's visibility in sync with the checkbox without
  // re-running the main scene-setup effect.
  useEffect(() => {
    showAxesRef.current = showAxes;
    if (axesHelperRef.current) axesHelperRef.current.visible = showAxes;
  }, [showAxes]);

  useEffect(() => {
    if (!imuData || imuData.length === 0) return;
    const samples = imuData; // narrowed, for use inside the animation closure

    // Auto-play whenever a new recording is selected (isPlaying is reset during render above).
    isPausedRef.current = false;
    axesHelperRef.current = null; // scene is being rebuilt; old helper is gone

    // ── Scene setup ─────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    //scene.background = new THREE.Color(0xfafafa);

    // PerspectiveCamera(fov, aspectRatio, near, far)
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 0, 50 );

    // WebGLRenderer draws the scene inside a <canvas>. We use alpha: true and setClearColor with 0 opacity to make the background transparent so the viz can blend into the page. Antialias: true makes edges smoother.
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(400, 400);
    renderer.setClearColor(0x000000, 0);

    const mount = mountRef.current;
    if (mount) mount.appendChild(renderer.domElement);

    // Lets the user click-and-drag to orbit the camera around the device.
    // Independent of deviceGroup's own orientation (set from the USB/LED
    // config below) — orbiting only ever moves the camera, never the model,
    // so the configured rest pose stays exactly where it's set regardless of
    // how the view has been dragged around. .reset() (wired to the "Reset
    // view" button) restores the camera to the position/target captured here.
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    // ── Gravity baseline ─────────────────────────────────────────────────────
    const meanAcc: [number, number, number] = [0, 0, 0];
    for (const sample of imuData) {
      meanAcc[0] += sample.acc[0];
      meanAcc[1] += sample.acc[1];
      meanAcc[2] += sample.acc[2];
    }
    meanAcc[0] /= imuData.length;
    meanAcc[1] /= imuData.length;
    meanAcc[2] /= imuData.length;

    // ── Lighting ─────────────────────────────────────────────────────────────
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 5, 5);
    scene.add(light);
    // Ambient light so MeshStandardMaterial surfaces aren't fully dark in shadow.
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
          vec3 yellow = vec3(.50, 0.5, 0.50);
          vec3 blue   = vec3(0.85, 0.85, 0.85);
          gl_FragColor = vec4(mix(blue, yellow, t), 1.0);
        }
      `,
    });
    // ── Load STL model ────────────────────────────────────────────────────────
    const loader = new STLLoader();
    const deviceGroup = new THREE.Group();
    const initialPosition = new THREE.Vector3(0, 0, 0);
    const initialQuat = computeOrientationQuaternion(usbCode, ledCode);
    deviceGroup.position.copy(initialPosition);
    deviceGroup.quaternion.copy(initialQuat);
    scene.add(deviceGroup);

    const meshGroup = new THREE.Group();
    meshGroup.rotation.copy(MESH_CORRECTION_EULER);
    deviceGroup.add(meshGroup);

    loader.load(
      "/cato%20model.stl",
      (geometry) => {
        const mesh = new THREE.Mesh(geometry, shaderMaterial);
        mesh.scale.set(0.5, 0.5, 0.5);
        meshGroup.add(mesh);

        // This mesh has no position/rotation offset relative to meshGroup, so
        // its local axes are exactly the STL file's own raw coordinate axes
        // (no IMU-alignment correction from meshGroup applied to it).
        const axesHelper = createAxesIndicator(25, 0.4);
        axesHelper.visible = showAxesRef.current;
        mesh.add(axesHelper);
        axesHelperRef.current = axesHelper;
      },
      undefined,
      (err) => console.error("GestureVisualizer: failed to load cato model.stl", err),
    );

    // ── Animation loop ────────────────────────────────────────────────────────
    // `accum` is a fractional accumulator. Each animation frame adds `speed`
    // to it. When it reaches 1.0 we consume one IMU sample. At 0.5× speed
    // it takes two animation frames to advance one sample — slow motion.
    let frame = 0;
    let accum = 0;
    let animId = 0;

    // Reused across frames to avoid allocating a new Vector3/Quaternion per sample.
    const deltaRotVec = new THREE.Vector3();
    const deltaQuat = new THREE.Quaternion();

    function animate() {
      animId = requestAnimationFrame(animate);
      controls.update();

      if (deviceGroup.children.length === 0 || isPausedRef.current) {
        renderer.render(scene, camera);
        return;
      }

      accum += speedRef.current;

      while (accum >= 1) {
        accum -= 1;

        if (frame >= samples.length) {
          // Loop: reset to starting pose and replay from the beginning.
          deviceGroup.position.copy(initialPosition);
          deviceGroup.quaternion.copy(initialQuat);
          frame = 0;
        }

        const { acc, gyro } = samples[frame];

        // Integrate body-frame angular velocity as a quaternion rotation rather
        // than summing independent Euler angles — Euler axes aren't orthogonal
        // once more than one axis is active (each later axis in the rotation
        // order inherits a tilt from whatever the earlier axes have already
        // accumulated), which warps the apparent rotation axis over time.
        // Composing a small quaternion per sample and right-multiplying it onto
        // the current orientation (i.e. applying it in the device's own local
        // frame, matching how gyro data is measured) avoids that entirely.
        deltaRotVec.set(
          THREE.MathUtils.degToRad(-gyro[0] / 100),
          THREE.MathUtils.degToRad(gyro[1] / 100),
          THREE.MathUtils.degToRad(-gyro[2] / 100),
        );
        const angle = deltaRotVec.length();
        if (angle > 0) {
          deltaQuat.setFromAxisAngle(deltaRotVec.normalize(), angle);
          deviceGroup.quaternion.multiply(deltaQuat);
        }

        deviceGroup.position.x += (acc[0] - meanAcc[0]) / 500;
        deviceGroup.position.y += (acc[1] - meanAcc[1]) / 500;
        deviceGroup.position.z += (acc[2] - meanAcc[2]) / 500;

        frame++;
      }

      renderer.render(scene, camera);
    }

    animate();

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animId);
      controls.dispose();
      controlsRef.current = null;
      renderer.dispose();
      if (mount && renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [imuData, usbCode, ledCode]);

  const hasData = imuData && imuData.length > 0;

  return (
    <div className={styles.visualizerWrap}>
      {!hasData && (
        <p className={styles.emptyMsg}>Select a gesture to visualize.</p>
      )}
      <div ref={mountRef} />

      {hasData && (
        <div className={styles.vizControls}>
          <button className={styles.vizBtn} onClick={handleTogglePlay} title={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button
            className={`${styles.vizBtn} ${speed === 0.5 ? styles.vizBtnActive : ""}`}
            onClick={handleToggleSpeed}
            title={speed === 0.5 ? "Normal speed" : "Slow motion"}
          >
            ½×
          </button>
          <button className={styles.vizBtn} onClick={handleResetView} title="Reset camera view">
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
