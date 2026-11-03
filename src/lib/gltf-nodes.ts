/**
 * Read the names out of a .glb or .gltf without a 3D library.
 *
 * Only used by the self-checks. Node names are how this project addresses
 * things inside the asset packs — the gear a character carries, the
 * `handslot.r` bone a skeleton's weapon bolts onto — and a name that doesn't
 * exist fails completely silently: no error, nothing rendered. This makes those
 * references checkable without starting a browser. Uses `Bun.file`, so it runs
 * under the same runtime as everything else.
 */


interface GltfJson {
  nodes?: { name?: string }[];
  meshes?: { primitives: { attributes: Record<string, number> }[] }[];
  accessors?: { min?: number[]; max?: number[] }[];
  animations?: { name?: string }[];
}

const GLB_MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"

/** Parse the JSON chunk of a binary glTF, or the whole file for plain .gltf. */
async function readGltfJson(path: string): Promise<GltfJson> {
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  const view = new DataView(bytes.buffer);
  if (bytes.length >= 20 && view.getUint32(0, true) === GLB_MAGIC) {
    const chunkLength = view.getUint32(12, true);
    if (view.getUint32(16, true) !== JSON_CHUNK) {
      throw new Error(`${path}: first GLB chunk is not JSON`);
    }
    const chunk = bytes.subarray(20, 20 + chunkLength);
    return JSON.parse(new TextDecoder().decode(chunk)) as GltfJson;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as GltfJson;
}

export async function gltfNodeNames(path: string): Promise<Set<string>> {
  const json = await readGltfJson(path);
  const names = new Set<string>();
  for (const node of json.nodes ?? []) {
    if (node.name) names.add(node.name);
  }
  return names;
}

export async function gltfClipNames(path: string): Promise<Set<string>> {
  const json = await readGltfJson(path);
  const names = new Set<string>();
  for (const clip of json.animations ?? []) {
    if (clip.name) names.add(clip.name);
  }
  return names;
}

/**
 * Bounding-box size from the accessor min/max of every POSITION attribute.
 *
 * This is the bind pose, which for a rigged character includes its spread arms
 * and loose gear — fine for static props like buildings, meaningless for
 * characters (see the note in `useModel.useCharacter`).
 */
export async function gltfSize(path: string): Promise<{ x: number; y: number; z: number }> {
  const json = await readGltfJson(path);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      const index = primitive.attributes.POSITION;
      const accessor = json.accessors?.[index];
      if (!accessor?.min || !accessor?.max) continue;
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], accessor.min[i]);
        max[i] = Math.max(max[i], accessor.max[i]);
      }
    }
  }
  return { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] };
}

/** The larger of the two ground dimensions — what the layout calls a footprint. */
export async function gltfFootprint(path: string): Promise<number> {
  const { x, z } = await gltfSize(path);
  return Math.max(x, z);
}
