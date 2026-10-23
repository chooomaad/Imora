import * as THREE from "three";

/**
 * Equirectangular 360° viewer.
 * Conventions: yaw in degrees, 0 = centre of the panorama image, positive = turn right;
 * pitch in degrees, positive = look up.
 */

export interface View {
  yaw: number;
  pitch: number;
  fov: number;
}

export interface HotspotBinding {
  id: string;
  yaw: number;
  pitch: number;
  el: HTMLElement;
  /** Shown as a 3D marker inside VR (DOM overlays are not visible in a headset). */
  navigable?: boolean;
}

interface Options {
  onViewChange?: (view: View) => void;
  onProgress?: (progress: number | null) => void;
  onHotspotActivate?: (id: string) => void;
  onError?: (error: unknown) => void;
}

const MIN_FOV = 30;
const MAX_FOV = 100;
const DEG = THREE.MathUtils.DEG2RAD;

export function directionFromYawPitch(yaw: number, pitch: number, radius = 1) {
  const y = yaw * DEG;
  const p = pitch * DEG;
  return new THREE.Vector3(Math.cos(p) * Math.sin(y) * radius, Math.sin(p) * radius, -Math.cos(p) * Math.cos(y) * radius);
}

function yawPitchFromDirection(v: THREE.Vector3): { yaw: number; pitch: number } {
  const n = v.clone().normalize();
  return { yaw: Math.atan2(n.x, -n.z) / DEG, pitch: Math.asin(THREE.MathUtils.clamp(n.y, -1, 1)) / DEG };
}

/** Fetch with progress, cached as object URLs (panoramas are large). */
const blobCache = new Map<string, Promise<string>>();
function fetchWithProgress(url: string, onProgress?: (p: number) => void): Promise<string> {
  const cached = blobCache.get(url);
  if (cached) return cached;
  const promise = (async () => {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok || !res.body) throw new Error(`panorama_fetch_failed:${res.status}`);
    const total = Number(res.headers.get("content-length") ?? 0);
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      if (total) onProgress?.(loaded / total);
    }
    const blob = new Blob(chunks as BlobPart[], { type: res.headers.get("content-type") ?? "image/jpeg" });
    return URL.createObjectURL(blob);
  })();
  blobCache.set(url, promise);
  promise.catch(() => blobCache.delete(url));
  return promise;
}

export function prefetchPanorama(url: string) {
  void fetchWithProgress(url).catch(() => undefined);
}

export class PanoramaEngine {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private sphere: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null;
  private fading: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> | null = null;
  private fadeStart = 0;
  private view: View = { yaw: 0, pitch: 0, fov: 75 };
  private velocity = { yaw: 0, pitch: 0 };
  private target: { yaw: number; pitch: number } | null = null;
  private hotspots: HotspotBinding[] = [];
  private xrMarkers = new THREE.Group();
  private raf = 0;
  private dragging = false;
  private last = { x: 0, y: 0, t: 0 };
  private pinch: { dist: number; fov: number } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private gyro: { handler: (e: DeviceOrientationEvent) => void; offset: number | null; screen: number } | null = null;
  private resizeObserver: ResizeObserver;
  private loadToken = 0;
  private disposed = false;

  constructor(private container: HTMLElement, private opts: Options = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.xr.enabled = true;
    this.renderer.domElement.style.cssText = "display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline:none";
    this.renderer.domElement.tabIndex = 0;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(this.view.fov, 1, 0.1, 1100);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.xrMarkers);
    this.xrMarkers.visible = false;

    this.bindInput();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.renderer.setAnimationLoop(this.tick);
  }

  /* ------------------------------------------------------------ Scenes */

  async loadScene(url: string, view: { yaw: number; pitch: number }, transition = true) {
    const token = ++this.loadToken;
    this.opts.onProgress?.(0);
    try {
      const objectUrl = await fetchWithProgress(url, (p) => token === this.loadToken && this.opts.onProgress?.(p));
      const texture = await new THREE.TextureLoader().loadAsync(objectUrl);
      if (token !== this.loadToken || this.disposed) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

      const geometry = new THREE.SphereGeometry(500, 96, 64);
      geometry.scale(-1, 1, 1);
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: transition && this.sphere ? 0 : 1, depthWrite: false });
      const mesh = new THREE.Mesh(geometry, material);
      // Put the centre of the equirectangular image straight ahead (-Z)
      mesh.rotation.y = -Math.PI / 2;
      mesh.renderOrder = 1;

      if (this.fading) this.disposeMesh(this.fading);
      this.fading = transition ? this.sphere : null;
      if (!transition && this.sphere) this.disposeMesh(this.sphere);
      this.sphere = mesh;
      this.scene.add(mesh);
      this.fadeStart = performance.now();
      this.view.yaw = view.yaw;
      this.view.pitch = view.pitch;
      if (transition) this.view.fov = Math.min(this.view.fov, 75) - 6; // subtle "step forward"
      this.velocity = { yaw: 0, pitch: 0 };
      if (this.gyro) this.gyro.offset = null;
      this.opts.onProgress?.(null);
    } catch (e) {
      if (token === this.loadToken) {
        this.opts.onProgress?.(null);
        this.opts.onError?.(e);
      }
    }
  }

  setHotspots(list: HotspotBinding[]) {
    this.hotspots = list;
    // VR markers
    this.xrMarkers.clear();
    for (const h of list.filter((x) => x.navigable)) {
      const marker = new THREE.Mesh(
        new THREE.CircleGeometry(14, 32),
        new THREE.MeshBasicMaterial({ color: 0xc9a246, transparent: true, opacity: 0.9, depthTest: false }),
      );
      marker.position.copy(directionFromYawPitch(h.yaw, h.pitch, 300));
      marker.lookAt(0, 0, 0);
      marker.userData.hotspotId = h.id;
      marker.renderOrder = 5;
      this.xrMarkers.add(marker);
    }
  }

  /* -------------------------------------------------------------- View */

  getView(): View {
    return { ...this.view };
  }

  setView(yaw: number, pitch = this.view.pitch) {
    this.target = null;
    this.view.yaw = yaw;
    this.view.pitch = THREE.MathUtils.clamp(pitch, -85, 85);
  }

  animateTo(yaw: number, pitch = 0) {
    // shortest path
    let dy = ((yaw - this.view.yaw + 540) % 360) - 180;
    if (dy < -180) dy += 360;
    this.target = { yaw: this.view.yaw + dy, pitch };
  }

  zoomBy(deltaFov: number) {
    this.view.fov = THREE.MathUtils.clamp(this.view.fov + deltaFov, MIN_FOV, MAX_FOV);
  }

  /* ---------------------------------------------------------- Gyroscope */

  async enableGyro(): Promise<boolean> {
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<"granted" | "denied"> } | undefined;
    if (!DOE) return false;
    if (typeof DOE.requestPermission === "function") {
      const res = await DOE.requestPermission().catch(() => "denied" as const);
      if (res !== "granted") return false;
    }
    const zee = new THREE.Vector3(0, 0, 1);
    const euler = new THREE.Euler();
    const q0 = new THREE.Quaternion();
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
    const q = new THREE.Quaternion();
    const state = {
      offset: null as number | null,
      screen: 0,
      handler: (e: DeviceOrientationEvent) => {
        if (e.alpha == null || e.beta == null || e.gamma == null) return;
        const orient = ((screen.orientation?.angle ?? 0) * DEG);
        euler.set(e.beta * DEG, e.alpha * DEG, -e.gamma * DEG, "YXZ");
        q.setFromEuler(euler).multiply(q1).multiply(q0.setFromAxisAngle(zee, -orient));
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
        const { yaw, pitch } = yawPitchFromDirection(dir);
        if (state.offset == null) state.offset = this.view.yaw - yaw;
        this.view.yaw = yaw + state.offset;
        this.view.pitch = THREE.MathUtils.clamp(pitch, -85, 85);
      },
    };
    window.addEventListener("deviceorientation", state.handler);
    this.gyro = state;
    return true;
  }

  disableGyro() {
    if (this.gyro) window.removeEventListener("deviceorientation", this.gyro.handler);
    this.gyro = null;
  }

  get gyroEnabled() {
    return this.gyro != null;
  }

  /* ----------------------------------------------------------------- VR */

  static async isVRSupported(): Promise<boolean> {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported: (m: string) => Promise<boolean> } }).xr;
    return xr ? xr.isSessionSupported("immersive-vr").catch(() => false) : false;
  }

  async enterVR(): Promise<boolean> {
    const xr = (navigator as Navigator & { xr?: { requestSession: (m: string, o: unknown) => Promise<XRSession> } }).xr;
    if (!xr) return false;
    try {
      const session = await xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor"] });
      await this.renderer.xr.setSession(session);
      this.xrMarkers.visible = true;
      const raycaster = new THREE.Raycaster();
      const tmp = new THREE.Matrix4();
      for (const i of [0, 1]) {
        const controller = this.renderer.xr.getController(i);
        controller.addEventListener("select", () => {
          tmp.identity().extractRotation(controller.matrixWorld);
          raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
          raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tmp);
          const hit = raycaster.intersectObjects(this.xrMarkers.children, false)[0];
          if (hit) this.opts.onHotspotActivate?.(hit.object.userData.hotspotId as string);
        });
        this.scene.add(controller);
      }
      session.addEventListener("end", () => {
        this.xrMarkers.visible = false;
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Converts a click position (client px) to panorama yaw/pitch — used by the tour builder to place hotspots. */
  pick(clientX: number, clientY: number): { yaw: number; pitch: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const dir = new THREE.Vector3(ndc.x, ndc.y, 0.5).unproject(this.camera).sub(this.camera.position);
    const { yaw, pitch } = yawPitchFromDirection(dir);
    return { yaw: Math.round(((yaw % 360) + 540) % 360 - 180), pitch: Math.round(pitch) };
  }

  /* ------------------------------------------------------------ Utils */

  screenshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/jpeg", 0.92);
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    cancelAnimationFrame(this.raf);
    this.disableGyro();
    this.resizeObserver.disconnect();
    this.unbindInput?.();
    if (this.sphere) this.disposeMesh(this.sphere);
    if (this.fading) this.disposeMesh(this.fading);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private disposeMesh(mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>) {
    this.scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.map?.dispose();
    mesh.material.dispose();
  }

  /* ------------------------------------------------------------ Loop */

  private tick = (time: number) => {
    // Fade transition
    if (this.sphere && this.sphere.material.opacity < 1) {
      const k = Math.min(1, (time - this.fadeStart) / 550);
      this.sphere.material.opacity = k;
      if (this.fading) this.fading.material.opacity = 1 - k;
      if (k >= 1 && this.fading) {
        this.disposeMesh(this.fading);
        this.fading = null;
      }
    }
    // Ease fov back after a transition
    if (!this.dragging && !this.pinch && this.view.fov < 75 && this.fadeStart && time - this.fadeStart < 900) {
      this.view.fov += (75 - this.view.fov) * 0.08;
    }

    if (!this.renderer.xr.isPresenting && !this.gyro) {
      if (this.target) {
        this.view.yaw += (this.target.yaw - this.view.yaw) * 0.12;
        this.view.pitch += (this.target.pitch - this.view.pitch) * 0.12;
        if (Math.abs(this.target.yaw - this.view.yaw) < 0.05 && Math.abs(this.target.pitch - this.view.pitch) < 0.05) this.target = null;
      } else if (!this.dragging) {
        this.view.yaw += this.velocity.yaw;
        this.view.pitch = THREE.MathUtils.clamp(this.view.pitch + this.velocity.pitch, -85, 85);
        this.velocity.yaw *= 0.92;
        this.velocity.pitch *= 0.92;
      }
    }

    this.camera.fov = this.view.fov;
    this.camera.updateProjectionMatrix();
    if (!this.renderer.xr.isPresenting) {
      this.camera.rotation.set(this.view.pitch * DEG, -this.view.yaw * DEG, 0);
    }
    this.renderer.render(this.scene, this.camera);
    this.projectHotspots();
    this.opts.onViewChange?.(this.view);
  };

  private projectHotspots() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    for (const hs of this.hotspots) {
      const dir = directionFromYawPitch(hs.yaw, hs.pitch, 100);
      const visible = dir.clone().normalize().dot(forward) > 0.15;
      const ndc = dir.project(this.camera);
      if (!visible || Math.abs(ndc.x) > 1.3 || Math.abs(ndc.y) > 1.3) {
        hs.el.style.visibility = "hidden";
        continue;
      }
      const x = ((ndc.x + 1) / 2) * w;
      const y = ((1 - ndc.y) / 2) * h;
      hs.el.style.visibility = "visible";
      hs.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    }
  }

  /* ------------------------------------------------------------ Input */

  private unbindInput?: () => void;

  private bindInput() {
    const el = this.renderer.domElement;
    const degPerPx = () => this.view.fov / (this.container.clientHeight || 1);

    const down = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.target = null;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), fov: this.view.fov };
        this.dragging = false;
        return;
      }
      this.dragging = true;
      this.velocity = { yaw: 0, pitch: 0 };
      this.last = { x: e.clientX, y: e.clientY, t: performance.now() };
      el.style.cursor = "grabbing";
    };
    const move = (e: PointerEvent) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch && this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        this.view.fov = THREE.MathUtils.clamp(this.pinch.fov * (this.pinch.dist / dist), MIN_FOV, MAX_FOV);
        return;
      }
      if (!this.dragging || this.gyro) return;
      const dx = e.clientX - this.last.x;
      const dy = e.clientY - this.last.y;
      const k = degPerPx();
      this.view.yaw -= dx * k;
      this.view.pitch = THREE.MathUtils.clamp(this.view.pitch + dy * k, -85, 85);
      const now = performance.now();
      const dt = Math.max(1, now - this.last.t);
      this.velocity = { yaw: (-dx * k * 16) / dt, pitch: (dy * k * 16) / dt };
      this.last = { x: e.clientX, y: e.clientY, t: now };
    };
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (this.pointers.size === 0) {
        this.dragging = false;
        el.style.cursor = "grab";
        if (performance.now() - this.last.t > 80) this.velocity = { yaw: 0, pitch: 0 };
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      this.zoomBy(e.deltaY * 0.05);
    };
    const key = (e: KeyboardEvent) => {
      const step = 6;
      if (e.key === "ArrowLeft") this.animateTo(this.view.yaw - step * 3, this.view.pitch);
      else if (e.key === "ArrowRight") this.animateTo(this.view.yaw + step * 3, this.view.pitch);
      else if (e.key === "ArrowUp") this.animateTo(this.view.yaw, Math.min(85, this.view.pitch + step));
      else if (e.key === "ArrowDown") this.animateTo(this.view.yaw, Math.max(-85, this.view.pitch - step));
      else if (e.key === "+" || e.key === "=") this.zoomBy(-5);
      else if (e.key === "-") this.zoomBy(5);
      else return;
      e.preventDefault();
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("keydown", key);
    this.unbindInput = () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("keydown", key);
    };
  }
}
