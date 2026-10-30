"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type ReactNode } from "react";
import type { Group } from "three";
import type { InteractionController, Rotation } from "./interaction";

const DEG = Math.PI / 180;

interface InteractionRigProps {
  controller: InteractionController;
  /** Receives the rotation every animated frame (used for test/debug attributes). */
  onRotate?: (r: Rotation) => void;
  children: ReactNode;
}

/**
 * Rotates its children (the normalised model, pivot at the origin) by the
 * controller's combined rotation. The camera never moves. With
 * frameloop="demand" the loop only runs while something is moving.
 */
export function InteractionRig({ controller, onRotate, children }: InteractionRigProps) {
  const group = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    controller.setWake(() => invalidate());
    invalidate();
    return () => controller.setWake(null);
  }, [controller, invalidate]);

  useFrame((state, delta) => {
    const r = controller.step(performance.now(), delta);
    // Yaw first, then pitch around the head's own horizontal axis: a natural neck turn.
    group.current?.rotation.set(-r.pitch * DEG, r.yaw * DEG, 0, "YXZ");
    onRotate?.(r);
    if (!r.settled) state.invalidate();
  });

  return <group ref={group}>{children}</group>;
}
