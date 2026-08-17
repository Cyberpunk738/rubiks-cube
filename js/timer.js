/**
 * Speedcubing Timer Engine (csTimer Style)
 * Supports hold-to-arm spacebar/touch mechanics, 15s WCA inspection,
 * real-time TPS & move counter, Personal Best (PB), and Ao5 calculation.
 */

class SpeedTimer {
  constructor(cube3d) {
    this.cube3d = cube3d;
    this.state = 'idle'; // 'idle' | 'arming' | 'ready' | 'running' | 'stopped'
    this.startTime = 0;
    this.elapsedTime = 0;
    this.timerInterval = null;
    this.armTimeout = null;
    this.inspectionInterval = null;
    this.inspectionTime = 15;

    this.solves = [];
    this.personalBest = Infinity;
    this.movesDuringSolve = 0;

    // DOM Elements
    this.panel = document.getElementById('timer-panel');
    this.display = document.getElementById('timer-display');
    this.hint = document.getElementById('timer-hint');
    this.inspectionDisplay = document.getElementById('timer-inspection');
    this.inspectionVal = document.getElementById('inspection-val');
    this.statPb = document.getElementById('stat-pb');
    this.statMoves = document.getElementById('stat-moves');
    this.statTps = document.getElementById('stat-tps');
    this.statAo5 = document.getElementById('stat-ao5');

    this.loadHistory();
    this.setupListeners();
  }

  setupListeners() {
    // Keyboard Spacebar listener
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        this.onArmStart();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        this.onArmEnd();
      }
    });

    // Stop timer on any cube rotation move
    if (this.cube3d) {
      this.cube3d.onMoveComplete = (move) => {
        if (this.state === 'running') {
          this.movesDuringSolve++;
          this.updateMetrics();
        }
      };

      this.cube3d.onSolved = () => {
        if (this.state === 'running') {
          this.stop();
        }
      };
    }
  }

  onArmStart() {
    if (this.state === 'running') {
      this.stop();
      return;
    }

    if (this.state === 'idle' || this.state === 'stopped') {
      this.state = 'arming';
      if (this.display) {
        this.display.className = 'timer-display armed';
      }
      if (this.hint) {
        this.hint.textContent = 'Keep holding...';
      }

      // Arm after 300ms
      this.armTimeout = setTimeout(() => {
        if (this.state === 'arming') {
          this.state = 'ready';
          if (this.display) {
            this.display.className = 'timer-display ready';
          }
          if (this.hint) {
            this.hint.textContent = 'Release to start!';
          }
          if (window.soundEngine) {
            window.soundEngine.playBeep(880, 0.05);
          }
        }
      }, 300);
    }
  }

  onArmEnd() {
    if (this.armTimeout) {
      clearTimeout(this.armTimeout);
      this.armTimeout = null;
    }

    if (this.state === 'ready') {
      this.start();
    } else if (this.state === 'arming') {
      // Released too early
      this.state = 'idle';
      if (this.display) {
        this.display.className = 'timer-display';
      }
      if (this.hint) {
        this.hint.textContent = 'Hold Space or touch to arm timer';
      }
    }
  }

  start() {
    this.state = 'running';
    this.startTime = performance.now();
    this.movesDuringSolve = 0;
    this.elapsedTime = 0;

    if (this.display) {
      this.display.className = 'timer-display running';
    }
    if (this.hint) {
      this.hint.textContent = 'Press Space or solve cube to stop';
    }

    this.timerInterval = setInterval(() => {
      this.elapsedTime = performance.now() - this.startTime;
      this.renderTime(this.elapsedTime);
      this.updateMetrics();
    }, 10);
  }

  stop() {
    if (this.state !== 'running') return;

    this.state = 'stopped';
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.elapsedTime = performance.now() - this.startTime;

    if (this.display) {
      this.display.className = 'timer-display';
      this.renderTime(this.elapsedTime);
    }
    if (this.hint) {
      this.hint.textContent = 'Hold Space to start again';
    }

    // Save solve
    this.solves.push({
      time: this.elapsedTime,
      moves: this.movesDuringSolve,
      date: new Date().toISOString()
    });

    if (this.elapsedTime < this.personalBest) {
      this.personalBest = this.elapsedTime;
      localStorage.setItem('nexus_pb', this.personalBest);
    }

    this.saveHistory();
    this.updateStats();

    if (window.soundEngine) {
      window.soundEngine.playVictoryChime();
    }
  }

  renderTime(ms) {
    if (!this.display) return;
    this.display.textContent = this.formatTime(ms);
  }

  formatTime(ms) {
    if (ms === Infinity || isNaN(ms)) return '--:--.--';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hundredths = Math.floor((ms % 1000) / 10);

    const pad = (n, len = 2) => String(n).padStart(len, '0');
    return `${pad(minutes)}:${pad(seconds)}.${pad(hundredths)}`;
  }

  updateMetrics() {
    if (this.statMoves) {
      this.statMoves.textContent = this.movesDuringSolve;
    }
    if (this.statTps && this.elapsedTime > 0) {
      const tps = (this.movesDuringSolve / (this.elapsedTime / 1000)).toFixed(1);
      this.statTps.textContent = tps;
    }
  }

  updateStats() {
    if (this.statPb && this.personalBest !== Infinity) {
      this.statPb.textContent = this.formatTime(this.personalBest);
    }

    if (this.statAo5 && this.solves.length >= 5) {
      const last5 = this.solves.slice(-5).map(s => s.time);
      // Ao5 trims fastest and slowest times
      last5.sort((a, b) => a - b);
      const middle3 = last5.slice(1, 4);
      const avg = middle3.reduce((a, b) => a + b, 0) / 3;
      this.statAo5.textContent = this.formatTime(avg);
    }
  }

  loadHistory() {
    const pb = localStorage.getItem('nexus_pb');
    if (pb) {
      this.personalBest = parseFloat(pb);
      if (this.statPb) {
        this.statPb.textContent = this.formatTime(this.personalBest);
      }
    }
    const savedSolves = localStorage.getItem('nexus_solves');
    if (savedSolves) {
      try {
        this.solves = JSON.parse(savedSolves);
        this.updateStats();
      } catch (e) {}
    }
  }

  saveHistory() {
    localStorage.setItem('nexus_solves', JSON.stringify(this.solves.slice(-50)));
  }

  togglePanel() {
    if (!this.panel) return;
    this.panel.classList.toggle('hidden');
  }
}

window.SpeedTimer = SpeedTimer;
