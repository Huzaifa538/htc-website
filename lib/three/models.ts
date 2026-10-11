/**
 * Parametric 3D model templates for HTC products.
 *
 * Each builder returns a THREE.Group of the product, modeled to look like
 * the real hardware (units are roughly centimeters). The viewer auto-frames
 * every model from its bounding box, so templates don't need to match scale.
 *
 * To add a product type: write a builder, register it in MODEL_TEMPLATES,
 * and it appears in the admin product form's "3D model" dropdown.
 */
import * as THREE from "three";

type Builder = () => THREE.Group;

function mesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** Shared metal material — the viewer swaps finishes on top of this. */
function metal(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0x1b1b1d,
    metalness: 1.0,
    roughness: 0.42,
    clearcoat: 0.5,
    clearcoatRoughness: 0.35,
    envMapIntensity: 1.1,
  });
}

/** T-bar cabinet / door rod handle (4"/6"/8" variants scale fine). */
function barHandle(): THREE.Group {
  const g = new THREE.Group();
  const m = metal();
  g.add(mesh(new THREE.CapsuleGeometry(1.05, 17.5, 12, 32), m, 0, 0, 0));
  const post = new THREE.CylinderGeometry(0.68, 0.68, 3.6, 24);
  post.rotateX(Math.PI / 2);
  g.add(mesh(post, m, 0, 6.4, -1.8));
  g.add(mesh(post.clone(), m, 0, -6.4, -1.8));
  const rose = new THREE.CylinderGeometry(1.45, 1.45, 0.55, 32);
  rose.rotateX(Math.PI / 2);
  g.add(mesh(rose, m, 0, 6.4, -3.8));
  g.add(mesh(rose.clone(), m, 0, -6.4, -3.8));
  const collar = new THREE.CylinderGeometry(0.95, 0.95, 0.7, 24);
  collar.rotateX(Math.PI / 2);
  g.add(mesh(collar, m, 0, 6.4, -0.35));
  g.add(mesh(collar.clone(), m, 0, -6.4, -0.35));
  return g;
}

/** Round drawer / cupboard knob with rosette base. */
function knob(): THREE.Group {
  const g = new THREE.Group();
  const m = metal();
  const head = new THREE.SphereGeometry(1.7, 32, 24);
  head.scale(1, 0.88, 1);
  g.add(mesh(head, m, 0, 2.1, 0));
  const stem = new THREE.CylinderGeometry(0.55, 0.7, 1.4, 20);
  g.add(mesh(stem, m, 0, 0.7, 0));
  const rose = new THREE.CylinderGeometry(1.15, 1.25, 0.45, 28);
  g.add(mesh(rose, m, 0, 0.05, 0));
  return g;
}

/** Mortise door-lock body with faceplate and latch bolt. */
function mortiseLock(): THREE.Group {
  const g = new THREE.Group();
  const m = metal();
  g.add(mesh(new THREE.BoxGeometry(2.4, 9, 1.7), m, 0, 0, -1.1)); // case
  g.add(mesh(new THREE.BoxGeometry(0.9, 10.5, 0.35), m, 0, 0, 0)); // faceplate
  const bolt = new THREE.BoxGeometry(0.8, 1.6, 1.4);
  g.add(mesh(bolt, m, 0, 2.2, 0.6)); // latch bolt sticking out
  const dead = new THREE.BoxGeometry(0.8, 1.2, 1.8);
  g.add(mesh(dead, m, 0, -1.6, 0.7)); // deadbolt
  const hub = new THREE.CylinderGeometry(0.55, 0.55, 2.6, 20);
  hub.rotateX(Math.PI / 2);
  g.add(mesh(hub, m, 0, 0.2, -1.1)); // handle hub hole boss
  return g;
}

/** Padlock with shackle. */
function padlock(): THREE.Group {
  const g = new THREE.Group();
  const m = metal();
  const body = new THREE.BoxGeometry(4.4, 3.6, 1.7);
  g.add(mesh(body, m, 0, -1.4, 0));
  const shackle = new THREE.TorusGeometry(1.55, 0.42, 16, 32, Math.PI);
  const s = mesh(shackle, m, 0, 0.4, 0);
  g.add(s);
  // shackle legs into body
  const leg = new THREE.CylinderGeometry(0.42, 0.42, 1.2, 16);
  g.add(mesh(leg, m, -1.55, -0.1, 0));
  g.add(mesh(leg.clone(), m, 1.55, -0.1, 0));
  const keyhole = new THREE.CylinderGeometry(0.35, 0.35, 0.2, 16);
  keyhole.rotateX(Math.PI / 2);
  const dark = new THREE.MeshBasicMaterial({ color: 0x050505 });
  g.add(mesh(keyhole, dark, 0, -1.4, 0.86));
  return g;
}

/** Butt door hinge, leaves half open. */
function hinge(): THREE.Group {
  const g = new THREE.Group();
  const m = metal();
  const leafGeo = new THREE.BoxGeometry(2.6, 6, 0.28);
  const left = mesh(leafGeo, m, -1.45, 0, 0.55);
  left.rotation.y = 0.5;
  const right = mesh(leafGeo.clone(), m, 1.45, 0, 0.55);
  right.rotation.y = -0.5;
  g.add(left, right);
  const pin = new THREE.CylinderGeometry(0.32, 0.32, 6.6, 16);
  g.add(mesh(pin, m, 0, 0, 0));
  // knuckles
  const kn = new THREE.CylinderGeometry(0.45, 0.45, 1.1, 16);
  g.add(mesh(kn, m, 0, 2.2, 0));
  g.add(mesh(kn.clone(), m, 0, -2.2, 0));
  const cap = new THREE.SphereGeometry(0.45, 16, 12);
  g.add(mesh(cap, m, 0, 3.3, 0));
  g.add(mesh(cap.clone(), m, 0, -3.3, 0));
  return g;
}

/** Tower bolt / chatkhani for doors. */
function towerBolt(): THREE.Group {
  const g = new THREE.Group();
  const m = metal();
  g.add(mesh(new THREE.BoxGeometry(1.9, 11, 0.35), m, 0, 0, 0)); // back plate
  const rod = new THREE.CylinderGeometry(0.5, 0.5, 9.5, 18);
  g.add(mesh(rod, m, 0, 0.4, 0.65)); // sliding rod
  const knobStem = new THREE.CylinderGeometry(0.28, 0.28, 1.1, 12);
  knobStem.rotateX(Math.PI / 2);
  g.add(mesh(knobStem, m, 0, 0.4, 1.2));
  g.add(mesh(new THREE.SphereGeometry(0.55, 18, 14), m, 0, 0.4, 1.85)); // knob
  // guide brackets
  const guide = new THREE.BoxGeometry(1.9, 1.2, 1.1);
  g.add(mesh(guide, m, 0, 3.6, 0.35));
  g.add(mesh(guide.clone(), m, 0, -2.8, 0.35));
  return g;
}

/** Hydraulic door closer with arm. */
function doorCloser(): THREE.Group {
  const g = new THREE.Group();
  const m = metal();
  const body = new THREE.BoxGeometry(7.5, 2.6, 2.2);
  g.add(mesh(body, m, 0, 0, 0));
  const capGeo = new THREE.CylinderGeometry(1.3, 1.3, 7.5, 24);
  capGeo.rotateZ(Math.PI / 2);
  // arm: two segments
  const arm1 = new THREE.BoxGeometry(4.5, 0.55, 0.55);
  const a1 = mesh(arm1, m, -4.6, 1.1, 0.9);
  a1.rotation.z = 0.35;
  const arm2 = new THREE.BoxGeometry(4.2, 0.55, 0.55);
  const a2 = mesh(arm2, m, -7.6, 2.6, 0.9);
  a2.rotation.z = -0.5;
  g.add(a1, a2);
  g.add(mesh(new THREE.BoxGeometry(1.6, 0.5, 1.6), m, -9.2, 3.4, 0.9)); // shoe
  return g;
}

/** Single wall hook / khuti. */
function wallHook(): THREE.Group {
  const g = new THREE.Group();
  const m = metal();
  const base = new THREE.CylinderGeometry(1.25, 1.35, 0.5, 28);
  base.rotateX(Math.PI / 2);
  g.add(mesh(base, m, 0, 0, 0));
  const hookCurve = new THREE.TorusGeometry(1.35, 0.34, 14, 28, 4.0);
  const h = mesh(hookCurve, m, 0, 1.1, 0.9);
  h.rotation.z = -0.6;
  g.add(h);
  g.add(mesh(new THREE.SphereGeometry(0.42, 16, 12), m, 0.62, 2.62, 0.9)); // tip ball
  return g;
}

/** Caster / trolley wheel with fork and top plate. */
function casterWheel(): THREE.Group {
  const g = new THREE.Group();
  const m = metal();
  const wheelGeo = new THREE.CylinderGeometry(1.9, 1.9, 1.3, 28);
  wheelGeo.rotateZ(Math.PI / 2);
  const rubber = new THREE.MeshPhysicalMaterial({
    color: 0x17171a, metalness: 0.1, roughness: 0.85, envMapIntensity: 0.4,
  });
  g.add(mesh(wheelGeo, rubber, 0, -2.6, 0));
  const hubGeo = new THREE.CylinderGeometry(0.55, 0.55, 1.5, 16);
  hubGeo.rotateZ(Math.PI / 2);
  g.add(mesh(hubGeo, m, 0, -2.6, 0));
  // fork arms
  const fork = new THREE.BoxGeometry(0.5, 3.2, 1.9);
  g.add(mesh(fork, m, 0, -0.6, 0.75));
  g.add(mesh(fork.clone(), m, 0, -0.6, -0.75));
  // swivel + top plate
  g.add(mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.8, 20), m, 0, 1.2, 0));
  g.add(mesh(new THREE.BoxGeometry(3.4, 0.45, 3.4), m, 0, 1.85, 0));
  return g;
}

/** L-shaped metal corner bracket. */
function lBracket(): THREE.Group {
  const g = new THREE.Group();
  const m = metal();
  g.add(mesh(new THREE.BoxGeometry(5, 0.35, 2.2), m, 0, -2.3, 0)); // horizontal leg
  g.add(mesh(new THREE.BoxGeometry(0.35, 5, 2.2), m, -2.3, 0, 0)); // vertical leg
  const hole = new THREE.CylinderGeometry(0.32, 0.32, 0.5, 14);
  const dark = new THREE.MeshBasicMaterial({ color: 0x050505 });
  g.add(mesh(hole, dark, -1.2, -2.3, 0));
  g.add(mesh(hole.clone(), dark, 1.2, -2.3, 0));
  const hole2 = new THREE.CylinderGeometry(0.32, 0.32, 0.5, 14);
  hole2.rotateZ(Math.PI / 2);
  g.add(mesh(hole2, dark, -2.3, 1.2, 0));
  g.add(mesh(hole2.clone(), dark, -2.3, -1.2, 0));
  return g;
}

/** Bib cock / water tap. */
function bibTap(): THREE.Group {
  const g = new THREE.Group();
  const m = metal();
  const body = new THREE.CylinderGeometry(1.0, 1.15, 3.4, 24);
  g.add(mesh(body, m, 0, 0, 0));
  const spout = new THREE.CylinderGeometry(0.62, 0.62, 3.6, 20);
  spout.rotateX(Math.PI / 2);
  g.add(mesh(spout, m, 0, -0.5, 2.1));
  const nozzle = new THREE.CylinderGeometry(0.72, 0.62, 1.2, 20);
  g.add(mesh(nozzle, m, 0, -1.4, 3.8));
  // bonnet + cross handle
  g.add(mesh(new THREE.CylinderGeometry(0.8, 0.9, 0.9, 20), m, 0, 2.1, 0));
  const stem = new THREE.CylinderGeometry(0.3, 0.3, 1.0, 12);
  g.add(mesh(stem, m, 0, 2.9, 0));
  const crossGeo = new THREE.CylinderGeometry(0.28, 0.28, 3.4, 12);
  crossGeo.rotateZ(Math.PI / 2);
  g.add(mesh(crossGeo, m, 0, 3.4, 0));
  const cross2 = mesh(crossGeo.clone(), m, 0, 3.4, 0);
  cross2.rotation.y = Math.PI / 2;
  g.add(cross2);
  // wall flange
  const flange = new THREE.CylinderGeometry(1.5, 1.5, 0.4, 24);
  flange.rotateX(Math.PI / 2);
  g.add(mesh(flange, m, 0, 0.4, -1.4));
  return g;
}

export const MODEL_TEMPLATES: { id: string; label: string; build: Builder }[] = [
  { id: "bar-handle", label: "Bar Handle (cabinet / door rod)", build: barHandle },
  { id: "knob", label: "Round Knob", build: knob },
  { id: "mortise-lock", label: "Mortise Lock Body", build: mortiseLock },
  { id: "padlock", label: "Padlock", build: padlock },
  { id: "hinge", label: "Door Hinge", build: hinge },
  { id: "tower-bolt", label: "Tower Bolt / Chatkhani", build: towerBolt },
  { id: "door-closer", label: "Door Closer", build: doorCloser },
  { id: "wall-hook", label: "Wall Hook", build: wallHook },
  { id: "caster-wheel", label: "Caster Wheel", build: casterWheel },
  { id: "l-bracket", label: "L Corner Bracket", build: lBracket },
  { id: "bib-tap", label: "Bib Cock / Water Tap", build: bibTap },
];

export const MODEL_TEMPLATE_IDS = new Set(MODEL_TEMPLATES.map((t) => t.id));

/** Build a model group for a template id, or null when unknown. */
export function buildModel(templateId: string): THREE.Group | null {
  const t = MODEL_TEMPLATES.find((x) => x.id === templateId);
  return t ? t.build() : null;
}
