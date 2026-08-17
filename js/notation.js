/**
 * Rubik's Cube Notation & Kinematic Definitions
 * Handles Singmaster notation, move inversion, sequence parsing, move simplification,
 * and cubelet coordinate transformations.
 */

const CubeNotation = {
  // Move metadata: axis ('x'|'y'|'z'), layer index (-1, 0, 1), angle in radians, and isFullCube
  MOVES: {
    // Face Clockwise
    "U":  { axis: 'y', layer: 1,  angle: -Math.PI / 2, name: "Up Clockwise" },
    "D":  { axis: 'y', layer: -1, angle: Math.PI / 2,  name: "Down Clockwise" },
    "L":  { axis: 'x', layer: -1, angle: Math.PI / 2,  name: "Left Clockwise" },
    "R":  { axis: 'x', layer: 1,  angle: -Math.PI / 2, name: "Right Clockwise" },
    "F":  { axis: 'z', layer: 1,  angle: -Math.PI / 2, name: "Front Clockwise" },
    "B":  { axis: 'z', layer: -1, angle: Math.PI / 2,  name: "Back Clockwise" },

    // Face Primes (Counter-Clockwise)
    "U'": { axis: 'y', layer: 1,  angle: Math.PI / 2,  name: "Up Prime" },
    "D'": { axis: 'y', layer: -1, angle: -Math.PI / 2, name: "Down Prime" },
    "L'": { axis: 'x', layer: -1, angle: -Math.PI / 2, name: "Left Prime" },
    "R'": { axis: 'x', layer: 1,  angle: Math.PI / 2,  name: "Right Prime" },
    "F'": { axis: 'z', layer: 1,  angle: Math.PI / 2,  name: "Front Prime" },
    "B'": { axis: 'z', layer: -1, angle: -Math.PI / 2, name: "Back Prime" },

    // Face Double Turns
    "U2": { axis: 'y', layer: 1,  angle: -Math.PI,     name: "Up Double" },
    "D2": { axis: 'y', layer: -1, angle: Math.PI,      name: "Down Double" },
    "L2": { axis: 'x', layer: -1, angle: Math.PI,      name: "Left Double" },
    "R2": { axis: 'x', layer: 1,  angle: -Math.PI,     name: "Right Double" },
    "F2": { axis: 'z', layer: 1,  angle: -Math.PI,     name: "Front Double" },
    "B2": { axis: 'z', layer: -1, angle: Math.PI,      name: "Back Double" },

    // Slices (M follows L, E follows D, S follows F)
    "M":  { axis: 'x', layer: 0,  angle: Math.PI / 2,  name: "Middle Slice" },
    "M'": { axis: 'x', layer: 0,  angle: -Math.PI / 2, name: "Middle Prime" },
    "M2": { axis: 'x', layer: 0,  angle: Math.PI,      name: "Middle Double" },

    "E":  { axis: 'y', layer: 0,  angle: Math.PI / 2,  name: "Equator Slice" },
    "E'": { axis: 'y', layer: 0,  angle: -Math.PI / 2, name: "Equator Prime" },
    "E2": { axis: 'y', layer: 0,  angle: Math.PI,      name: "Equator Double" },

    "S":  { axis: 'z', layer: 0,  angle: -Math.PI / 2, name: "Standing Slice" },
    "S'": { axis: 'z', layer: 0,  angle: Math.PI / 2,  name: "Standing Prime" },
    "S2": { axis: 'z', layer: 0,  angle: -Math.PI,     name: "Standing Double" },

    // Full Cube Rotations (x follows R, y follows U, z follows F)
    "x":  { axis: 'x', layer: null, angle: -Math.PI / 2, name: "Cube Rotate X", isFullCube: true },
    "x'": { axis: 'x', layer: null, angle: Math.PI / 2,  name: "Cube Rotate X'", isFullCube: true },
    "x2": { axis: 'x', layer: null, angle: -Math.PI,     name: "Cube Rotate X2", isFullCube: true },

    "y":  { axis: 'y', layer: null, angle: -Math.PI / 2, name: "Cube Rotate Y", isFullCube: true },
    "y'": { axis: 'y', layer: null, angle: Math.PI / 2,  name: "Cube Rotate Y'", isFullCube: true },
    "y2": { axis: 'y', layer: null, angle: -Math.PI,     name: "Cube Rotate Y2", isFullCube: true },

    "z":  { axis: 'z', layer: null, angle: -Math.PI / 2, name: "Cube Rotate Z", isFullCube: true },
    "z'": { axis: 'z', layer: null, angle: Math.PI / 2,  name: "Cube Rotate Z'", isFullCube: true },
    "z2": { axis: 'z', layer: null, angle: -Math.PI,     name: "Cube Rotate Z2", isFullCube: true }
  },

  /**
   * Inverts a single move (e.g. "R" -> "R'", "U'" -> "U", "F2" -> "F2")
   */
  getInverse(move) {
    if (!move) return "";
    if (move.endsWith("2")) return move;
    if (move.endsWith("'")) return move.slice(0, -1);
    return move + "'";
  },

  /**
   * Inverts a sequence of moves in reverse order
   * e.g. ["R", "U", "R'"] -> ["R", "U'", "R'"]
   */
  invertSequence(seq) {
    if (!Array.isArray(seq)) {
      seq = this.parseSequence(seq);
    }
    return seq.map(m => this.getInverse(m)).reverse();
  },

  /**
   * Parses string into array of normalized moves (e.g. "R U R' U'" -> ["R", "U", "R'", "U'"])
   */
  parseSequence(str) {
    if (!str || typeof str !== 'string') return [];
    // Normalize apostrophe variants (e.g., ’ or ` to ')
    const cleanStr = str.replace(/[’`]/g, "'");
    return cleanStr.trim().split(/\s+/).filter(m => this.MOVES[m]);
  },

  /**
   * Optimizes/reduces a move sequence by cancelling redundant moves
   * e.g. R + R' = empty, R + R = R2, R + R2 = R', R2 + R2 = empty
   */
  optimizeSequence(moves) {
    if (!moves || moves.length === 0) return [];
    const seq = Array.isArray(moves) ? [...moves] : this.parseSequence(moves);
    let changed = true;

    const baseFace = (m) => m.replace(/['2]/g, '');
    const getTurnAmount = (m) => {
      if (m.endsWith("2")) return 2;
      if (m.endsWith("'")) return 3; // 3 quarter turns counter-clockwise = 1 prime
      return 1;
    };
    const makeMove = (face, quarters) => {
      quarters = ((quarters % 4) + 4) % 4;
      if (quarters === 0) return null;
      if (quarters === 1) return face;
      if (quarters === 2) return face + "2";
      if (quarters === 3) return face + "'";
      return null;
    };

    while (changed) {
      changed = false;
      const result = [];
      let i = 0;
      while (i < seq.length) {
        if (i < seq.length - 1 && baseFace(seq[i]) === baseFace(seq[i + 1])) {
          const face = baseFace(seq[i]);
          const q1 = getTurnAmount(seq[i]);
          const q2 = getTurnAmount(seq[i + 1]);
          const combined = makeMove(face, q1 + q2);
          if (combined) {
            result.push(combined);
          }
          i += 2;
          changed = true;
        } else {
          result.push(seq[i]);
          i++;
        }
      }
      seq.length = 0;
      seq.push(...result);
    }
    return seq;
  }
};

window.CubeNotation = CubeNotation;
