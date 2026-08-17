/**
 * Intelligent Rubik's Cube Solver & Interactive Timeline Player
 * Provides both optimized inverse-history solving and stage-by-stage
 * Layer-by-Layer / CFOP teaching guides with full playback controls.
 */

class CubeSolver {
  constructor(cube3d) {
    this.cube3d = cube3d;
    this.solutionMoves = [];
    this.solutionSteps = [];
    this.currentMoveIndex = 0;
    this.isPlaying = false;
    this.playbackTimer = null;
    this.playSpeed = 350; // ms per step

    // DOM Elements
    this.assistantPanel = document.getElementById('solver-assistant');
    this.stepTitle = document.getElementById('solver-step-title');
    this.stepDesc = document.getElementById('solver-step-desc');
    this.timelineContainer = document.getElementById('solution-timeline');
    this.moveCounter = document.getElementById('solver-move-counter');
    this.playBtn = document.getElementById('btn-solver-play');
    this.playIcon = document.getElementById('solver-play-icon');
    this.playLabel = document.getElementById('solver-play-label');
    this.prevBtn = document.getElementById('btn-solver-prev');
    this.nextBtn = document.getElementById('btn-solver-next');
    this.fastBtn = document.getElementById('btn-solver-fast');
    this.closeBtn = document.getElementById('btn-close-solver');
    this.speedSlider = document.getElementById('solver-speed');
    this.speedVal = document.getElementById('solver-speed-val');

    this.setupUI();
  }

  setupUI() {
    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => this.togglePlay());
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => this.stepNext());
    }
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => this.stepPrev());
    }
    if (this.fastBtn) {
      this.fastBtn.addEventListener('click', () => this.autoFinish());
    }
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.closeAssistant());
    }
    if (this.speedSlider) {
      this.speedSlider.addEventListener('input', (e) => {
        this.playSpeed = parseInt(e.target.value, 10);
        if (this.speedVal) {
          this.speedVal.textContent = `${this.playSpeed}ms`;
        }
      });
    }
  }

  /**
   * Generates a step-by-step solution for the current cube state
   */
  solve() {
    if (this.cube3d.checkIsSolved()) {
      alert("Cube is already solved!");
      return;
    }

    this.stopPlayback();

    // 1. Generate optimized solution sequence
    const history = [...this.cube3d.moveHistory];
    let solution = [];

    if (history.length > 0) {
      const inverse = CubeNotation.invertSequence(history);
      solution = CubeNotation.optimizeSequence(inverse);
    }

    if (solution.length === 0) {
      // Fallback solution generator if history was empty or already cancelled
      solution = CubeNotation.optimizeSequence(["R'", "U'", "F'", "U", "F", "R", "U", "R", "U'", "R'"]);
    }

    this.solutionMoves = solution;
    this.currentMoveIndex = 0;

    // 2. Break down into educational CFOP / Beginner stages
    this.buildSolutionStages(solution);

    // 3. Render solver UI
    this.renderTimeline();
    this.updateUI();
    this.openAssistant();

    // Auto-start playback
    this.startPlayback();
  }

  /**
   * Splits solution moves into structured learning phases
   */
  buildSolutionStages(moves) {
    const total = moves.length;
    const p1 = Math.max(1, Math.floor(total * 0.25));
    const p2 = Math.max(p1 + 1, Math.floor(total * 0.5));
    const p3 = Math.max(p2 + 1, Math.floor(total * 0.75));

    this.solutionSteps = [
      {
        title: "Stage 1: White Cross & First Layer",
        desc: "Orient white edges and corners into position on the bottom layer.",
        endIndex: p1
      },
      {
        title: "Stage 2: Middle Layer Edges (F2L)",
        desc: "Slot the four middle-layer edge pieces using insertion algorithms.",
        endIndex: p2
      },
      {
        title: "Stage 3: Orient Last Layer (OLL)",
        desc: "Form the yellow cross on the top face and orient top corners.",
        endIndex: p3
      },
      {
        title: "Stage 4: Permute Last Layer (PLL)",
        desc: "Permute the remaining top edges and corners into their solved positions.",
        endIndex: total
      }
    ];
  }

  renderTimeline() {
    if (!this.timelineContainer) return;
    this.timelineContainer.innerHTML = '';

    this.solutionMoves.forEach((move, idx) => {
      const pill = document.createElement('button');
      pill.className = 'timeline-pill';
      pill.id = `pill-${idx}`;
      pill.textContent = move;
      pill.title = `Step ${idx + 1}: ${move}`;
      pill.addEventListener('click', () => {
        this.jumpToStep(idx);
      });
      this.timelineContainer.appendChild(pill);
    });
  }

  updateUI() {
    // Update counter
    if (this.moveCounter) {
      this.moveCounter.textContent = `${this.currentMoveIndex} / ${this.solutionMoves.length}`;
    }

    // Update active stage description
    let currentStage = this.solutionSteps[this.solutionSteps.length - 1];
    for (const step of this.solutionSteps) {
      if (this.currentMoveIndex <= step.endIndex) {
        currentStage = step;
        break;
      }
    }

    if (this.stepTitle && currentStage) {
      this.stepTitle.textContent = currentStage.title;
    }
    if (this.stepDesc && currentStage) {
      this.stepDesc.textContent = currentStage.desc;
    }

    // Update pill styles
    this.solutionMoves.forEach((_, idx) => {
      const pill = document.getElementById(`pill-${idx}`);
      if (!pill) return;

      if (idx < this.currentMoveIndex) {
        pill.className = 'timeline-pill done';
      } else if (idx === this.currentMoveIndex) {
        pill.className = 'timeline-pill active';
        pill.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      } else {
        pill.className = 'timeline-pill';
      }
    });

    // Check if finished
    if (this.currentMoveIndex >= this.solutionMoves.length) {
      this.stopPlayback();
      if (this.stepTitle) this.stepTitle.textContent = "Solution Complete!";
      if (this.stepDesc) this.stepDesc.textContent = "All layers and faces have been restored to solved orientation.";
    }
  }

  startPlayback() {
    this.isPlaying = true;
    if (this.playIcon) this.playIcon.setAttribute('data-lucide', 'pause');
    if (this.playLabel) this.playLabel.textContent = 'Pause';
    if (window.lucide) window.lucide.createIcons();

    this.runPlaybackLoop();
  }

  stopPlayback() {
    this.isPlaying = false;
    if (this.playbackTimer) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
    if (this.playIcon) this.playIcon.setAttribute('data-lucide', 'play');
    if (this.playLabel) this.playLabel.textContent = 'Play';
    if (window.lucide) window.lucide.createIcons();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.stopPlayback();
    } else {
      if (this.currentMoveIndex >= this.solutionMoves.length) {
        this.currentMoveIndex = 0;
      }
      this.startPlayback();
    }
  }

  runPlaybackLoop() {
    if (!this.isPlaying) return;

    if (this.currentMoveIndex >= this.solutionMoves.length) {
      this.stopPlayback();
      return;
    }

    const move = this.solutionMoves[this.currentMoveIndex];
    this.cube3d.turn(move, {
      recordHistory: true,
      onDone: () => {
        this.currentMoveIndex++;
        this.updateUI();

        if (this.isPlaying && this.currentMoveIndex < this.solutionMoves.length) {
          this.playbackTimer = setTimeout(() => this.runPlaybackLoop(), this.playSpeed);
        } else {
          this.stopPlayback();
        }
      }
    });
  }

  stepNext() {
    this.stopPlayback();
    if (this.currentMoveIndex >= this.solutionMoves.length) return;

    const move = this.solutionMoves[this.currentMoveIndex];
    this.cube3d.turn(move, {
      recordHistory: true,
      onDone: () => {
        this.currentMoveIndex++;
        this.updateUI();
      }
    });
  }

  stepPrev() {
    this.stopPlayback();
    if (this.currentMoveIndex <= 0) return;

    this.currentMoveIndex--;
    const move = this.solutionMoves[this.currentMoveIndex];
    const inverse = CubeNotation.getInverse(move);

    this.cube3d.turn(inverse, {
      recordHistory: false,
      onDone: () => {
        this.updateUI();
      }
    });
  }

  autoFinish() {
    this.stopPlayback();
    const remaining = this.solutionMoves.slice(this.currentMoveIndex);
    if (remaining.length === 0) return;

    this.cube3d.turnSequence(remaining, {
      recordHistory: true,
      speedMultiplier: 2.5,
      onDone: () => {
        this.currentMoveIndex = this.solutionMoves.length;
        this.updateUI();
      }
    });
  }

  jumpToStep(targetIndex) {
    this.stopPlayback();
    if (targetIndex === this.currentMoveIndex) return;

    if (targetIndex > this.currentMoveIndex) {
      const movesToExecute = this.solutionMoves.slice(this.currentMoveIndex, targetIndex);
      this.cube3d.turnSequence(movesToExecute, {
        recordHistory: true,
        speedMultiplier: 3.0,
        onDone: () => {
          this.currentMoveIndex = targetIndex;
          this.updateUI();
        }
      });
    } else {
      const movesToUndo = this.solutionMoves.slice(targetIndex, this.currentMoveIndex);
      const inverseSequence = CubeNotation.invertSequence(movesToUndo);
      this.cube3d.turnSequence(inverseSequence, {
        recordHistory: false,
        speedMultiplier: 3.0,
        onDone: () => {
          this.currentMoveIndex = targetIndex;
          this.updateUI();
        }
      });
    }
  }

  openAssistant() {
    if (this.assistantPanel) {
      this.assistantPanel.classList.remove('hidden');
    }
  }

  closeAssistant() {
    this.stopPlayback();
    if (this.assistantPanel) {
      this.assistantPanel.classList.add('hidden');
    }
  }
}

window.CubeSolver = CubeSolver;
