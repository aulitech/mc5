// GestureVisualizer.tsx — 3D animation of gesture recordings using Three.js.
//
// Each pane is a miniature 3D world inside a <canvas>: the Cato device's 3D
// model (an STL file), animated from IMU data — gyroscope drives rotation,
// accelerometer drives position. A pane replays a recording or standard
// gesture in a loop, or shows "Live": the device's sensor stream in real time
// (rotation only — see the animation loop).
//
// "Compare" shows two panes side by side, kept in sync: one clock drives both
// replays (they start together and loop when the longer one ends), and they
// share one camera, so orbiting either view turns both. Clicking a pane makes
// it the one the next selected recording, standard gesture or Live fills.
// "Reset position" puts every pane back at its rest pose and restarts the
// replays together, which also undoes live gyro drift. The turn button in the
// first pane's corner turns every pane's model about the vertical axis
// (-22.5°, 0° or 22.5°), to see a gesture a little from the side. The record controls
// (RecordOverlay) are drawn over the first pane, and a pane that replays has
// a timeline (PlaybackTimeline) along its bottom that shows and moves that clock.
//
// One animation loop drives every pane and reads its inputs through refs —
// React state can't be read inside a requestAnimationFrame closure because
// the closure captures a snapshot of state at creation time, while a ref
// always holds the current value.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Rotate3d } from "lucide-react";
import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useConfig } from "../../../context/ConfigContext";
import { useOtaEvent } from "../../../device/useOtaEvent";
import type { Sample, Triple } from "../../../types/gestures";
import { STANDARD_GESTURES } from "../data/standardGestures";
import { fmtTime } from "../lib/format";
import { useGestureStore, type ViewSource } from "../state/GestureStoreContext";
import PlaybackTimeline from "./PlaybackTimeline";
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

// IMU samples per second. Replays consume samples at this rate (× speed),
// and the gyro integration below treats each sample as 1/SAMPLE_RATE_HZ s.
const SAMPLE_RATE_HZ = 100;
// Cap on how much time one animation frame may catch up (e.g. after the tab
// was hidden), so playback resumes rather than fast-forwarding.
const MAX_FRAME_MS = 100;
// Live samples waiting for the next animation frame are capped (e.g. while
// the tab is hidden and frames stop); beyond this the oldest are dropped.
const MAX_LIVE_BACKLOG = SAMPLE_RATE_HZ * 10;
// Pane edge length: a single pane, or each of the two when comparing.
const PANE_SIZE = 280;
const COMPARE_PANE_SIZE = 224;
// The turn button's steps about the vertical (Y) axis, in degrees, in the
// order it cycles through them.
const TURNS = [0, 22.5, -22.5];
// Where the camera starts, and returns to on "Reset camera view".
const CAMERA_HOME = new THREE.Vector3(0, 0, 50);

// The STL is fetched and parsed once per page and shared by every mount.
let catoGeometry: Promise<THREE.BufferGeometry> | null = null;
function loadCatoGeometry() {
  catoGeometry ??= new STLLoader().loadAsync("/cato%20model.stl").catch((err) => {
    catoGeometry = null; // allow a retry next time
    throw err;
  });
  return catoGeometry;
}

/** A recording or standard gesture prepared for replay. */
interface Playback {
  samples: Sample[];
  /** Gravity baseline subtracted from acceleration. */
  meanAcc: Triple;
}

function createPlayback(source: ViewSource | null): Playback | null {
  if (!source || source.kind === "live" || source.samples.length === 0) return null;
  const { samples } = source;
  const meanAcc: Triple = [0, 0, 0];
  for (const sample of samples) {
    meanAcc[0] += sample.acc[0];
    meanAcc[1] += sample.acc[1];
    meanAcc[2] += sample.acc[2];
  }
  meanAcc[0] /= samples.length;
  meanAcc[1] /= samples.length;
  meanAcc[2] /= samples.length;
  return { samples, meanAcc };
}

function sourceLabel(source: ViewSource) {
  switch (source.kind) {
    case "recording":
      return `${source.gestureName} · ${fmtTime(source.timestamp)}`;
    case "standard":
      return STANDARD_GESTURES.find((g) => g.id === source.id)?.label ?? source.id;
    case "live":
      return "Live";
  }
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

// Reused for every sample to avoid allocating a Vector3/Quaternion per sample.
const deltaRotVec = new THREE.Vector3();
const deltaQuat = new THREE.Quaternion();

// Integrate body-frame angular velocity as a quaternion rotation rather than
// summing independent Euler angles — Euler axes aren't orthogonal once more
// than one axis is active (each later axis in the rotation order inherits a
// tilt from whatever the earlier axes have already accumulated), which warps
// the apparent rotation axis over time. Composing a small quaternion per
// sample and right-multiplying it onto the current orientation (i.e. applying
// it in the device's own local frame, matching how gyro data is measured)
// avoids that entirely.
function applyGyro(device: THREE.Object3D, gyro: Triple) {
  deltaRotVec.set(
    THREE.MathUtils.degToRad(-gyro[0] / SAMPLE_RATE_HZ),
    THREE.MathUtils.degToRad(gyro[1] / SAMPLE_RATE_HZ),
    THREE.MathUtils.degToRad(-gyro[2] / SAMPLE_RATE_HZ),
  );
  const angle = deltaRotVec.length();
  if (angle > 0) {
    deltaQuat.setFromAxisAngle(deltaRotVec.normalize(), angle);
    device.quaternion.multiply(deltaQuat);
  }
}

/** One pane's scene, as the animation loop sees it. */
interface PaneScene {
  /** Carries the rest pose plus replayed or live motion. */
  device: THREE.Group;
  /** Samples of the pane's replay applied so far. */
  frame: number;
  /** False until the STL has loaded. */
  isReady: () => boolean;
  render: () => void;
  setSize: (size: number) => void;
  setShowAxes: (show: boolean) => void;
  /** Turn the model (rest pose and motion together) about Y, in degrees. */
  setTurn: (degrees: number) => void;
  dispose: () => void;
}

// Builds a pane's renderer and scene in `mount`. The camera and its orbit
// target are shared by every pane, so they're always seen from one angle.
function createPaneScene(mount: HTMLElement, camera: THREE.PerspectiveCamera, target: THREE.Vector3): PaneScene {
  const scene = new THREE.Scene();

  // alpha + a transparent clear colour let the viz blend into the page.
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  mount.appendChild(renderer.domElement);

  // Lets the user click-and-drag to orbit the camera around the device.
  // Orbiting only ever moves the camera, never the model, so the configured
  // rest pose stays where it's set. Every pane's controls drive the same
  // camera and target vector.
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target = target;
  controls.update();

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
  // turnGroup carries the turn button's angle; deviceGroup the rest pose +
  // motion; meshGroup the static STL→IMU axis correction.
  const turnGroup = new THREE.Group();
  scene.add(turnGroup);
  const deviceGroup = new THREE.Group();
  turnGroup.add(deviceGroup);
  const meshGroup = new THREE.Group();
  meshGroup.rotation.copy(MESH_CORRECTION_EULER);
  deviceGroup.add(meshGroup);

  let disposed = false;
  let showAxes = false;
  let axesHelper: THREE.Group | null = null;
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
      axesHelper = createAxesIndicator(25, 0.4);
      axesHelper.visible = showAxes;
      mesh.add(axesHelper);
    },
    (err) => console.error("GestureVisualizer: failed to load cato model.stl", err),
  );

  return {
    device: deviceGroup,
    frame: 0,
    isReady: () => meshGroup.children.length > 0,
    render: () => {
      controls.update();
      renderer.render(scene, camera);
    },
    setSize: (size) => renderer.setSize(size, size),
    setShowAxes: (show) => {
      showAxes = show;
      if (axesHelper) axesHelper.visible = show;
    },
    setTurn: (degrees) => turnGroup.rotation.set(0, THREE.MathUtils.degToRad(degrees), 0),
    dispose: () => {
      disposed = true;
      controls.dispose();
      disposeTree(scene, new Set([sharedGeometry])); // the STL geometry is shared
      shaderMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss(); // release the WebGL context now, not at GC
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    },
  };
}

interface ViewerPaneProps {
  index: number;
  source: ViewSource | null;
  size: number;
  showAxes: boolean;
  /** Model turn about Y, in degrees. */
  turn: number;
  camera: THREE.PerspectiveCamera;
  target: THREE.Vector3;
  register: (index: number, pane: PaneScene | null) => void;
  /** "Left"/"Right" when comparing; null for a single pane. */
  side: string | null;
  isTarget: boolean;
  onTarget: () => void;
  /** Drawn over the pane (the record controls). */
  overlay?: ReactNode;
  /** Drawn along the bottom of a replaying pane. */
  timeline?: ReactNode;
  /** Drawn in the top right corner (the turn button). */
  corner?: ReactNode;
}

const ViewerPane = ({
  index, source, size, showAxes, turn, camera, target, register, side, isTarget, onTarget, overlay, timeline, corner,
}: ViewerPaneProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<PaneScene | null>(null);

  // The scene is built once per mount and handed to the shared animation loop.
  useEffect(() => {
    const pane = createPaneScene(mountRef.current!, camera, target);
    paneRef.current = pane;
    register(index, pane);
    return () => {
      register(index, null);
      paneRef.current = null;
      pane.dispose();
    };
  }, [camera, target, index, register]);

  useEffect(() => {
    paneRef.current?.setSize(size);
  }, [size]);

  useEffect(() => {
    paneRef.current?.setShowAxes(showAxes);
  }, [showAxes]);

  useEffect(() => {
    paneRef.current?.setTurn(turn);
  }, [turn]);

  const label = source ? sourceLabel(source) : "empty";
  const captionClass = `${styles.vizCaption} ${corner ? styles.vizCaptionBesideCorner : ""}`;
  const emptyMsg = !side
    ? "Select a gesture to visualize, or choose Live to follow Cato in real time."
    : isTarget
      ? "Select a recording or standard gesture, or choose Live, to show it here."
      : "Click here, then select something to compare.";

  return (
    <div
      className={`${styles.visualizerWrap} ${side ? styles.vizPaneCompare : ""} ${isTarget ? styles.vizPaneTarget : ""}`}
      style={{ width: size, height: size }}
      onPointerDown={side ? onTarget : undefined}
    >
      {side ? (
        <button
          className={`btn-plain ${captionClass}`}
          onClick={onTarget}
          aria-pressed={isTarget}
          title="Selected recordings, standard gestures and Live load into the highlighted side"
        >
          {side}: {label}
        </button>
      ) : (
        source && <span className={captionClass}>{label}</span>
      )}
      {!source && !overlay && <p className={styles.emptyMsg}>{emptyMsg}</p>}
      <div ref={mountRef} style={source ? undefined : { display: "none" }} />
      {overlay}
      {timeline}
      {corner}
    </div>
  );
};

interface GestureVisualizerProps {
  /** The device's sensor stream is running (needed for the live view). */
  isStreaming: boolean;
  /** A take is in progress: the panes stay as they are until it's done. */
  isRecording: boolean;
  /** Drawn over the first pane (the record controls). */
  overlay?: ReactNode;
}

const GestureVisualizer = ({ isStreaming, isRecording, overlay }: GestureVisualizerProps) => {
  const {
    views, compare, setCompare, targetView, setTargetView, toggleLive, slowMotion, setSlowMotion,
    positionResets, resetPosition,
  } = useGestureStore();
  const { data } = useConfig();
  const usbCode = data?.global_info?.orientation?.usb;
  const ledCode = data?.global_info?.orientation?.led;

  const visible = compare ? views : views.slice(0, 1);
  const size = compare ? COMPARE_PANE_SIZE : PANE_SIZE;

  // Shared by every pane (see createPaneScene).
  const [camera] = useState(() => {
    const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    cam.position.copy(CAMERA_HOME);
    return cam;
  });
  const [target] = useState(() => new THREE.Vector3());

  // React state drives button rendering; refs carry the same values to the
  // animation loop.
  const [paused, setPaused] = useState(false);
  const speed = slowMotion ? 0.5 : 1;
  const [showAxes, setShowAxes] = useState(false);
  const [turn, setTurn] = useState(TURNS[0]);
  const nextTurn = TURNS[(TURNS.indexOf(turn) + 1) % TURNS.length];
  const pausedRef = useRef(paused);
  const speedRef = useRef(speed);
  useEffect(() => {
    pausedRef.current = paused;
    speedRef.current = speed;
  }, [paused, speed]);

  // Auto-play whenever a pane gets something new to show (adjusting state on
  // a prop change during render, rather than in an effect).
  const [prevViews, setPrevViews] = useState(views);
  if (views !== prevViews) {
    setPrevViews(views);
    setPaused(false);
  }

  const panesRef = useRef<(PaneScene | null)[]>([]);
  const playbacksRef = useRef<(Playback | null)[]>([]);
  const restQuatRef = useRef(new THREE.Quaternion());
  /** Replay clock, in samples, shared by every pane. */
  const clockRef = useRef(0);
  /** The timeline's playhead is being dragged: the clock holds still. */
  const scrubbingRef = useRef(false);
  /** Set to put every pane back at its rest pose and restart the clock on the next frame. */
  const needsResetRef = useRef(true);
  /** Pane following the sensor stream, or -1. */
  const liveIndexRef = useRef(-1);
  /** Set to put the live pane back at its rest pose on the next frame. */
  const liveResetRef = useRef(false);
  /** Gyro readings received since the last frame, for the live pane. */
  const liveQueueRef = useRef<Triple[]>([]);

  const register = useCallback((index: number, pane: PaneScene | null) => {
    panesRef.current[index] = pane;
    if (pane) needsResetRef.current = true; // start in step with the others
  }, []);

  // New sources → restart every pane together from the rest pose.
  useEffect(() => {
    playbacksRef.current = (compare ? views : views.slice(0, 1)).map(createPlayback);
    needsResetRef.current = true;
  }, [views, compare]);

  // The live pane follows the stream once it's running, from the rest pose.
  const liveIndex = isStreaming ? visible.findIndex((v) => v?.kind === "live") : -1;
  useEffect(() => {
    liveIndexRef.current = liveIndex;
    liveQueueRef.current = [];
    liveResetRef.current = true;
  }, [liveIndex]);

  // "Reset position" (⌂, or pressing Record) → every pane back to its rest pose.
  useEffect(() => {
    needsResetRef.current = true;
  }, [positionResets]);

  // New orientation config → new rest pose.
  useEffect(() => {
    restQuatRef.current = computeOrientationQuaternion(usbCode, ledCode);
    needsResetRef.current = true;
  }, [usbCode, ledCode]);

  useOtaEvent("sensor", ({ gyro }) => {
    if (liveIndexRef.current < 0) return;
    const queue = liveQueueRef.current;
    queue.push([gyro.x, gyro.y, gyro.z]);
    if (queue.length > MAX_LIVE_BACKLOG) queue.shift();
  });

  // ── Animation loop: one for every pane ─────────────────────────────────
  useEffect(() => {
    let animId = 0;
    let lastTime = performance.now();

    const resetPane = (pane: PaneScene) => {
      pane.device.position.set(0, 0, 0);
      pane.device.quaternion.copy(restQuatRef.current);
      pane.frame = 0;
    };

    function animate(now: number) {
      animId = requestAnimationFrame(animate);
      const elapsed = Math.min(MAX_FRAME_MS, now - lastTime);
      lastTime = now;

      const panes = panesRef.current;
      const playbacks = playbacksRef.current;

      if (needsResetRef.current) {
        clockRef.current = 0;
        for (const pane of panes) if (pane) resetPane(pane);
        liveQueueRef.current = [];
        needsResetRef.current = false;
        liveResetRef.current = false;
      }
      if (liveResetRef.current) {
        const live = panes[liveIndexRef.current];
        if (live) resetPane(live);
        liveResetRef.current = false;
      }

      // One clock for every replay, so compared gestures stay in step. It
      // counts samples (SAMPLE_RATE_HZ × speed per second, so 1× is real
      // time on any display refresh rate), waits until every replaying pane
      // has its model, and loops once the longest replay has finished.
      const loopLength = Math.max(0, ...playbacks.map((pb) => pb?.samples.length ?? 0));
      const ready = playbacks.every((pb, i) => !pb || panes[i]?.isReady());
      if (loopLength > 0 && ready && !pausedRef.current && !scrubbingRef.current) {
        clockRef.current += (elapsed / 1000) * SAMPLE_RATE_HZ * speedRef.current;
        if (clockRef.current >= loopLength) {
          clockRef.current = 0;
          playbacks.forEach((pb, i) => {
            const pane = panes[i];
            if (pb && pane) resetPane(pane);
          });
        }
      }

      panes.forEach((pane, i) => {
        if (!pane) return;
        const pb = playbacks[i];
        if (pb) {
          // Catch up with the clock; a shorter replay holds its last pose
          // until the loop restarts. Motion is integrated sample by sample,
          // so a clock moved back on the timeline replays from the start.
          const due = Math.min(Math.floor(clockRef.current), pb.samples.length);
          if (pane.frame > due) resetPane(pane);
          for (; pane.frame < due; pane.frame++) {
            const { acc, gyro } = pb.samples[pane.frame];
            applyGyro(pane.device, gyro);
            pane.device.position.x += (acc[0] - pb.meanAcc[0]) / 500;
            pane.device.position.y += (acc[1] - pb.meanAcc[1]) / 500;
            pane.device.position.z += (acc[2] - pb.meanAcc[2]) / 500;
          }
        } else if (i === liveIndexRef.current) {
          // Live: apply every reading that arrived since the last frame, at
          // the device's own pace. Rotation only — with no recording to take
          // a gravity baseline from, double-integrated acceleration would
          // just drift the model off screen.
          for (const gyro of liveQueueRef.current) applyGyro(pane.device, gyro);
          liveQueueRef.current = [];
        }
        pane.render();
      });
    }

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleResetView = () => {
    camera.position.copy(CAMERA_HOME);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    target.set(0, 0, 0);
  };

  const hasReplay = visible.some((v) => v && v.kind !== "live");
  const handleSeek = useCallback((samples: number) => {
    clockRef.current = samples;
  }, []);
  const handleScrub = useCallback((active: boolean) => {
    scrubbingRef.current = active;
  }, []);
  const targetIsLive = views[targetView]?.kind === "live";
  const liveTitle = isRecording
    ? "Unavailable while recording"
    : targetIsLive
      ? isStreaming
        ? "Stop the live view"
        : "Starting the sensor stream…"
      : compare
        ? "Show Cato's movement in real time on the highlighted side"
        : "Follow Cato's movement in real time";

  return (
    <div className={styles.visualizer}>
      <div className={styles.vizPanes}>
        {visible.map((source, i) => (
          <ViewerPane
            key={i}
            index={i}
            source={source}
            size={size}
            showAxes={showAxes}
            turn={turn}
            camera={camera}
            target={target}
            register={register}
            side={compare ? (i === 0 ? "Left" : "Right") : null}
            isTarget={compare && i === targetView}
            onTarget={() => setTargetView(i)}
            overlay={i === 0 ? overlay : undefined}
            corner={
              i === 0 && (
                <button
                  className={styles.vizTurnBtn}
                  onPointerDown={(e) => e.stopPropagation()} // not a click on the pane (Compare's targeting)
                  onClick={() => setTurn(nextTurn)}
                  title={`Model turned ${turn}° about the vertical axis. Click for ${nextTurn}°`}
                  aria-label={`Turn the model to ${nextTurn}° (now ${turn}°)`}
                >
                  {/* The icon leans the way the model is turned */}
                  <Rotate3d size={18} style={{ transform: `rotate(${-turn}deg)` }} aria-hidden="true" />
                </button>
              )
            }
            timeline={
              source && source.kind !== "live" && source.samples.length > 0 ? (
                <PlaybackTimeline
                  length={source.samples.length}
                  sampleRate={SAMPLE_RATE_HZ}
                  clockRef={clockRef}
                  onSeek={handleSeek}
                  onScrub={handleScrub}
                />
              ) : undefined
            }
          />
        ))}
      </div>

      <div className={styles.vizControls}>
        {hasReplay && (
          <>
            <button
              className={styles.vizBtn}
              onClick={() => setPaused(!paused)}
              title={paused ? "Play" : "Pause"}
              aria-label={paused ? "Play" : "Pause"}
            >
              {paused ? "▶" : "⏸"}
            </button>
            <button
              className={`${styles.vizBtn} ${slowMotion ? styles.vizBtnActive : ""}`}
              onClick={() => setSlowMotion(!slowMotion)}
              title={slowMotion ? "Normal speed" : "Slow motion"}
              aria-pressed={slowMotion}
            >
              ½×
            </button>
          </>
        )}
        <button
          className={`${styles.vizBtn} ${targetIsLive ? styles.vizBtnActive : ""}`}
          onClick={toggleLive}
          disabled={isRecording}
          title={liveTitle}
          aria-pressed={targetIsLive}
        >
          Live
        </button>
        <button
          className={styles.vizBtn}
          onClick={resetPosition}
          title="Reset position"
          aria-label="Reset position"
        >
          ⌂
        </button>
        <button
          className={styles.vizBtn}
          onClick={handleResetView}
          title="Reset camera view"
          aria-label="Reset camera view"
        >
          ⟲
        </button>
        <button
          className={`${styles.vizBtn} ${compare ? styles.vizBtnActive : ""}`}
          onClick={() => setCompare(!compare)}
          disabled={isRecording}
          title={compare ? "Show one view" : "Show two views side by side, in sync"}
          aria-pressed={compare}
        >
          Compare
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
    </div>
  );
};

export default GestureVisualizer;
