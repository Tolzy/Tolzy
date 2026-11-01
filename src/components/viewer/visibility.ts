import type { Object3D } from "three";

/**
 * Several systems can hide the same mesh for different reasons (the material
 * system hides brows/lashes under sculptural presets; the geometry system
 * hides regions). Each sets its own reason; the mesh shows only when none
 * remain, so systems never undo each other.
 */
export function setHiddenBy(obj: Object3D, reason: string, hidden: boolean) {
  const reasons: Set<string> = (obj.userData.hiddenBy ??= new Set<string>());
  if (hidden) reasons.add(reason);
  else reasons.delete(reason);
  obj.visible = reasons.size === 0;
}
