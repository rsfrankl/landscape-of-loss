import { forceCollide, forceSimulation, forceX, forceY, type SimulationNodeDatum } from 'd3';

// Similar-county rank badges (spec 6.7): nudged apart where they collide, synchronously and
// deterministically (d3-force's own seeded random source), so they never drift on screen.

/** Badge radius in screen pixels (a 16 px circle). */
export const BADGE_RADIUS = 8;
/** Largest nudge away from the label point. */
export const MAX_SHIFT = 12;
/** Beyond this distance from its label point a badge gets a leader line. */
export const LEADER_MIN = 6;

export interface Badge {
  /** Badge centre. */
  x: number;
  y: number;
  /** The county's label point. */
  ax: number;
  ay: number;
  leader: boolean;
}

interface Node extends SimulationNodeDatum {
  ax: number;
  ay: number;
}

/** Places one badge per label point (screen pixels), in the same order. */
export function placeBadges(points: [number, number][]): Badge[] {
  const nodes: Node[] = points.map(([x, y]) => ({ x, y, ax: x, ay: y }));
  if (nodes.length > 1) {
    forceSimulation(nodes)
      .force('collide', forceCollide<Node>(BADGE_RADIUS + 1).iterations(4))
      .force('x', forceX<Node>((d) => d.ax).strength(0.05))
      .force('y', forceY<Node>((d) => d.ay).strength(0.05))
      .stop()
      .tick(120);
  }
  return nodes.map((n) => {
    let dx = n.x! - n.ax;
    let dy = n.y! - n.ay;
    const d = Math.hypot(dx, dy);
    if (d > MAX_SHIFT) {
      dx *= MAX_SHIFT / d;
      dy *= MAX_SHIFT / d;
    }
    return { x: n.ax + dx, y: n.ay + dy, ax: n.ax, ay: n.ay, leader: Math.min(d, MAX_SHIFT) > LEADER_MIN };
  });
}
