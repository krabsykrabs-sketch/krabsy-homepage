// Block-level commute: walk out the front door onto the sidewalk ring, take
// the shorter way round (turning at corners), and enter the destination's
// door. No elevators, no stairs — the sidewalk IS the circulation.
import { squareArc } from './block.js';

/**
 * Plan a trip from plot (fromSide, fromI) to plot (toSide, toI).
 * Returns { wps:[Vector3 world…], boardI, alightI, elevC, fromF, toF } or null.
 * (boardI/alightI/elevC are kept for the Character commute contract; walking
 * never boards anything, so they stay -1/null.)
 */
export function planTrip(built, fromF, fromCol, toF, toCol) {
  if (fromF === toF && fromCol === toCol) return null;
  const A = built.plotAt(fromF, fromCol), B = built.plotAt(toF, toCol);
  if (!A || !B || !A.doorOut || !B.doorOut) return null;   // one of them has no building
  const K = built.geom.K, y = built.geom.walkY;
  const wps = [
    A.doorIn.clone(),                          // step to the door from inside
    A.doorOut.clone(),                         // out onto the sidewalk
    ...squareArc(K, A.t, B.t, y),              // round the ring (corners included)
    B.doorOut.clone(),                         // at the destination door
    B.doorIn.clone(),                          // step inside
  ];
  return { wps, boardI: -1, alightI: -1, elevC: null, fromF, toF };
}
