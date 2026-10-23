import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { FloorPlan, Room } from "@imora/shared";

/**
 * "3D Libre" mode. Builds a dollhouse model from the floor-plan rooms (dimensions,
 * ceiling heights, positions) — or loads an uploaded glTF model when the tour has one
 * (photogrammetry / LiDAR / generated reconstructions plug in here).
 */


interface Options {
  onRoomSelect?: (roomId: string) => void;
  dark?: boolean;
}

const FLOOR_HEIGHT = 3.4;
const WALL = 0.14;

export class DollhouseEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private model = new THREE.Group();
  private roomMeshes = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>();
  private floorGroups = new Map<number, THREE.Group>();
  private labels: { el: HTMLElement; pos: THREE.Vector3; level: number }[] = [];
  private raycaster = new THREE.Raycaster();
  private pointerDown = { x: 0, y: 0 };
  private resizeObserver: ResizeObserver;
  private camTarget: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
  private center = new THREE.Vector3();
  private radius = 20;
  private selectedId: string | null = null;
  private visibleLevel = Infinity;

  constructor(private container: HTMLElement, private labelLayer: HTMLElement, private opts: Options = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.cssText = "display:block;width:100%;height:100%;touch-action:none;outline:none";
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    this.camera.position.set(18, 22, 26);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 120;
    this.controls.addEventListener("start", () => (this.camTarget = null));

    const hemi = new THREE.HemisphereLight(0xfff6e6, 0x8a7a60, 1.6);
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(20, 40, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    this.scene.add(hemi, sun, this.model);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(80, 64),
      new THREE.MeshStandardMaterial({ color: opts.dark ? 0x1b1814 : 0xefe7da, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", (e) => (this.pointerDown = { x: e.clientX, y: e.clientY }));
    el.addEventListener("pointerup", this.onClick);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.renderer.setAnimationLoop(this.tick);
  }

  /** Procedural model from the floor plan. */
  buildFromPlan(floors: FloorPlan[], rooms: Room[], labelFor: (r: Room) => string) {
    this.clearModel();
    const palette: Record<string, number> = {
      living: 0xe9dcc3, dining: 0xe6d6b8, kitchen: 0xdfe3dc, bedroom: 0xe8ddd0, bathroom: 0xd9e4e8,
      garage: 0xd6d3cc, patio: 0xcfe0e6, pool: 0x9cc9d9, terrace: 0xe4d7bf,
    };
    for (const floor of floors) {
      const W = floor.width_m ?? 20;
      const D = floor.depth_m ?? 12;
      const group = new THREE.Group();
      group.position.y = floor.level * FLOOR_HEIGHT;
      group.userData.level = floor.level;
      this.floorGroups.set(floor.level, group);
      this.model.add(group);

      // Slab
      const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.2, D + 0.6), new THREE.MeshStandardMaterial({ color: 0xf6f1e8, roughness: 0.9 }));
      slab.position.set(W / 2, -0.1, D / 2);
      slab.receiveShadow = true;
      slab.castShadow = true;
      group.add(slab);

      for (const room of rooms.filter((r) => r.floor_plan_id === floor.id && r.plan_rect)) {
        const [rx, ry, rw, rh] = room.plan_rect!;
        const x = rx * W, z = ry * D, w = rw * W, d = rh * D;
        const height = room.ceiling_height_m ?? (room.room_type === "patio" || room.room_type === "terrace" ? 0.9 : 3);

        const floorMat = new THREE.MeshStandardMaterial({ color: palette[room.room_type ?? ""] ?? 0xebe2d3, roughness: 0.75 });
        const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(w - WALL, 0.06, d - WALL), floorMat);
        floorMesh.position.set(x + w / 2, 0.03, z + d / 2);
        floorMesh.receiveShadow = true;
        floorMesh.userData.roomId = room.id;
        this.roomMeshes.set(room.id, floorMesh);
        group.add(floorMesh);

        // Walls: four thin boxes, cut lower on the camera side for a dollhouse look
        const wallMat = new THREE.MeshStandardMaterial({ color: 0xfbf8f2, roughness: 0.6, transparent: true, opacity: 0.96 });
        const walls: [number, number, number, number, number][] = [
          [x + w / 2, z, w, WALL, height],
          [x + w / 2, z + d, w, WALL, height * 0.35],
          [x, z + d / 2, WALL, d, height],
          [x + w, z + d / 2, WALL, d, height * 0.35],
        ];
        for (const [cx, cz, sx, sz, h] of walls) {
          const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), wallMat);
          wall.position.set(cx, h / 2, cz);
          wall.castShadow = true;
          wall.receiveShadow = true;
          group.add(wall);
        }

        // Pool / water rooms get a water surface
        if (room.room_type === "patio" || room.room_type === "pool") {
          const water = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.6, 0.05, d * 0.45),
            new THREE.MeshStandardMaterial({ color: 0x5fb3cf, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 }),
          );
          water.position.set(x + w / 2, 0.08, z + d / 2);
          group.add(water);
        }

        const label = document.createElement("div");
        label.className = "dollhouse-label";
        label.textContent = labelFor(room);
        label.style.cssText = "position:absolute;left:0;top:0;padding:4px 10px;border-radius:999px;background:rgba(17,17,16,.82);color:#fff;font:600 11.5px var(--font-body),sans-serif;white-space:nowrap;pointer-events:none;will-change:transform";
        this.labelLayer.appendChild(label);
        this.labels.push({ el: label, pos: new THREE.Vector3(x + w / 2, floor.level * FLOOR_HEIGHT + height + 0.3, z + d / 2), level: floor.level });
      }
    }
    this.frame();
  }

  /** Load a real 3D model (glTF/GLB) produced by photogrammetry, LiDAR or generation. */
  async loadModel(url: string) {
    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
    const gltf = await new GLTFLoader().loadAsync(url);
    this.clearModel();
    gltf.scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.model.add(gltf.scene);
    this.frame();
  }

  setVisibleLevel(level: number) {
    this.visibleLevel = level;
    for (const [lvl, group] of this.floorGroups) group.visible = lvl <= level;
  }

  selectRoom(roomId: string | null) {
    this.selectedId = roomId;
    for (const [id, mesh] of this.roomMeshes) {
      mesh.material.emissive.setHex(id === roomId ? 0xc9a246 : 0x000000);
      mesh.material.emissiveIntensity = id === roomId ? 0.55 : 0;
    }
  }

  /** Exterior orbit view framing the whole model. */
  exteriorView() {
    const look = this.center.clone();
    const pos = this.center.clone().add(new THREE.Vector3(this.radius * 0.9, this.radius * 1.05, this.radius * 1.25));
    this.camTarget = { pos, look };
  }

  /** Eye-level view inside the selected room. */
  interiorView(roomId: string) {
    const mesh = this.roomMeshes.get(roomId);
    if (!mesh) return;
    const world = new THREE.Vector3();
    mesh.getWorldPosition(world);
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const look = world.clone().setY(world.y + 1.4);
    const pos = world.clone().add(new THREE.Vector3(size.x * 0.42, 1.65, size.z * 0.42));
    this.camTarget = { pos, look };
  }

  focusRoom(roomId: string) {
    const mesh = this.roomMeshes.get(roomId);
    if (!mesh) return;
    const world = new THREE.Vector3();
    mesh.getWorldPosition(world);
    this.camTarget = { pos: world.clone().add(new THREE.Vector3(6, 9, 9)), look: world };
  }

  screenshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/jpeg", 0.92);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.clearModel();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private clearModel() {
    this.model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
      }
    });
    this.model.clear();
    this.roomMeshes.clear();
    this.floorGroups.clear();
    this.labels.forEach((l) => l.el.remove());
    this.labels = [];
  }

  private frame() {
    const box = new THREE.Box3().setFromObject(this.model);
    if (box.isEmpty()) return;
    box.getCenter(this.center);
    // Pull back on portrait screens so the whole model fits horizontally
    this.radius = box.getSize(new THREE.Vector3()).length() * 0.6 * Math.max(1, 1.25 / this.camera.aspect);
    this.controls.target.copy(this.center);
    this.camera.position.copy(this.center).add(new THREE.Vector3(this.radius * 0.9, this.radius * 1.05, this.radius * 1.25));
    this.controls.update();
  }

  private onClick = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - this.pointerDown.x, e.clientY - this.pointerDown.y) > 6) return; // was a drag
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const meshes = [...this.roomMeshes.values()].filter((m) => m.parent?.visible);
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    if (hit) this.opts.onRoomSelect?.(hit.object.userData.roomId as string);
  };

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private tick = () => {
    if (this.camTarget) {
      this.camera.position.lerp(this.camTarget.pos, 0.08);
      this.controls.target.lerp(this.camTarget.look, 0.08);
      if (this.camera.position.distanceTo(this.camTarget.pos) < 0.02) this.camTarget = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    for (const l of this.labels) {
      if (l.level > this.visibleLevel) {
        l.el.style.visibility = "hidden";
        continue;
      }
      const p = l.pos.clone().project(this.camera);
      const visible = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
      l.el.style.visibility = visible ? "visible" : "hidden";
      l.el.style.transform = `translate3d(${((p.x + 1) / 2) * w}px, ${((1 - p.y) / 2) * h}px, 0) translate(-50%, -100%)`;
    }
  };
}
