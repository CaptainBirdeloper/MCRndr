import * as THREE from 'three';
import { ArmType, PlayerItem, ShaderPassMode } from '../../types';
import { MinecraftRig, createMinecraftRig } from '../rig/rig';
import { ShaderPassManager } from '../render/shaders';

export const MAX_PLAYERS = 8;
const PLAYER_SPACING = 0.85;

interface PlayerRecord {
  id: string;
  name: string;
  skinName: string | null;
  slot: number;
  rig: MinecraftRig;
  shader: ShaderPassManager;
  texture: THREE.CanvasTexture;
}

export type PlayerChangeListener = (players: PlayerItem[], activeId: string, rig: MinecraftRig) => void;

export interface PlayerManager {
  getPlayers: () => PlayerItem[];
  getAllRigs: () => MinecraftRig[];
  getActiveId: () => string;
  getActiveRig: () => MinecraftRig;
  getActiveShader: () => ShaderPassManager;
  createPlayer: () => string;
  deletePlayer: (id: string) => void;
  renamePlayer: (id: string, name: string) => boolean;
  selectPlayer: (id: string) => void;
  applySkin: (id: string, texture: THREE.CanvasTexture, armType: ArmType, skinName: string | null) => void;
  setShaderPass: (mode: ShaderPassMode) => void;
  setChangeListener: (cb: PlayerChangeListener) => void;
  removeChangeListener: (cb: PlayerChangeListener) => void;
  destroy: () => void;
}

export function createPlayerManager(
  scene: THREE.Scene,
  createDefaultTexture: () => THREE.CanvasTexture
): PlayerManager {
  const records: PlayerRecord[] = [];
  const listeners: PlayerChangeListener[] = [];
  let activeId = '';
  let nameCounter = 0;
  let currentPass: ShaderPassMode = 'beauty';

  function toItems(): PlayerItem[] {
    return records.map((r) => ({
      id: r.id,
      name: r.name,
      skinName: r.skinName,
      armType: r.rig.armType,
    }));
  }

  function getActiveRecord(): PlayerRecord {
    return records.find((r) => r.id === activeId) || records[0];
  }

  function notify() {
    const active = getActiveRecord();
    if (!active) return;
    const items = toItems();
    listeners.forEach((cb) => cb(items, active.id, active.rig));
  }

  function nextSlot(): number {
    const used = new Set(records.map((r) => r.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    return slot;
  }

  function disposeRecord(record: PlayerRecord) {
    scene.remove(record.rig.root);
    record.rig.dispose();
    record.shader.dispose();
    record.texture.dispose();
  }

  function createPlayer(): string {
    if (records.length >= MAX_PLAYERS) return activeId;

    const slot = nextSlot();
    const id = `player_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const texture = createDefaultTexture();
    const rig = createMinecraftRig(texture, 'steve');
    rig.root.position.set(slot * PLAYER_SPACING, 0, 0);
    rig.root.userData.playerId = id;
    scene.add(rig.root);

    const shader = new ShaderPassManager(rig, texture);
    if (currentPass !== 'beauty') shader.setPass(currentPass);
    records.push({
      id,
      name: `Player ${++nameCounter}`,
      skinName: null,
      slot,
      rig,
      shader,
      texture,
    });

    activeId = id;
    notify();
    return id;
  }

  function deletePlayer(id: string) {
    if (records.length <= 1) return;
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) return;

    const [record] = records.splice(index, 1);
    disposeRecord(record);

    if (activeId === id) {
      activeId = records[Math.min(index, records.length - 1)].id;
    }
    notify();
  }

  function renamePlayer(id: string, name: string): boolean {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const record = records.find((r) => r.id === id);
    if (!record) return false;
    if (records.some((r) => r.id !== id && r.name.toLowerCase() === trimmed.toLowerCase())) return false;

    record.name = trimmed;
    notify();
    return true;
  }

  function selectPlayer(id: string) {
    if (activeId === id) return;
    if (!records.some((r) => r.id === id)) return;
    activeId = id;
    notify();
  }

  function applySkin(id: string, texture: THREE.CanvasTexture, armType: ArmType, skinName: string | null) {
    const record = records.find((r) => r.id === id);
    if (!record) {
      texture.dispose();
      return;
    }

    record.texture.dispose();
    record.texture = texture;
    record.skinName = skinName;
    record.rig.setArmType(armType);
    record.rig.setSkinTexture(texture);
    record.shader.updateTexture(texture);
    notify();
  }

  function setShaderPass(mode: ShaderPassMode) {
    currentPass = mode;
    records.forEach((r) => r.shader.setPass(mode));
  }

  function setChangeListener(cb: PlayerChangeListener) {
    if (!listeners.includes(cb)) listeners.push(cb);
    notify();
  }

  function removeChangeListener(cb: PlayerChangeListener) {
    const index = listeners.indexOf(cb);
    if (index !== -1) listeners.splice(index, 1);
  }

  function destroy() {
    records.forEach(disposeRecord);
    records.length = 0;
    listeners.length = 0;
    activeId = '';
  }

  return {
    getPlayers: toItems,
    getAllRigs: () => records.map((r) => r.rig),
    getActiveId: () => activeId,
    getActiveRig: () => getActiveRecord().rig,
    getActiveShader: () => getActiveRecord().shader,
    createPlayer,
    deletePlayer,
    renamePlayer,
    selectPlayer,
    applySkin,
    setShaderPass,
    setChangeListener,
    removeChangeListener,
    destroy,
  };
}
