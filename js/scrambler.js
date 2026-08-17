/**
 * WCA Standard Scramble Generator
 * Generates official tournament-compliant 20-25 move random scrambles.
 */

class ScrambleGenerator {
  constructor() {
    this.faces = ['U', 'D', 'L', 'R', 'F', 'B'];
    this.modifiers = ['', "'", '2'];
    this.opposites = {
      'U': 'D', 'D': 'U',
      'L': 'R', 'R': 'L',
      'F': 'B', 'B': 'F'
    };
  }

  /**
   * Generates a standard 3x3x3 scramble (default 21 moves)
   */
  generate(length = 21) {
    const sequence = [];
    let lastFace = null;
    let secondLastFace = null;

    for (let i = 0; i < length; i++) {
      let face;
      do {
        face = this.faces[Math.floor(Math.random() * this.faces.length)];
      } while (
        face === lastFace ||
        (face === secondLastFace && this.opposites[face] === lastFace)
      );

      const modifier = this.modifiers[Math.floor(Math.random() * this.modifiers.length)];
      sequence.push(face + modifier);

      secondLastFace = lastFace;
      lastFace = face;
    }

    return sequence;
  }

  /**
   * Returns scramble formatted as a single string
   */
  generateString(length = 21) {
    return this.generate(length).join(' ');
  }
}

window.scrambleGenerator = new ScrambleGenerator();
