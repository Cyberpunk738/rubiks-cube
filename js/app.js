/**
 * NexusCube 3D - Master Application Controller
 * Connects 3D rendering, gesture recognition, notation inputs, scrambler,
 * solver assistant, speed timer, modals, and keyboard shortcuts.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize 3D Engine & Modules
  const cube3d = new Cube3D('canvas-container');
  window.cube3d = cube3d;

  const gestures = new GestureController(cube3d);
  window.gestures = gestures;

  const solver = new CubeSolver(cube3d);
  window.cubeSolver = solver;

  const timer = new SpeedTimer(cube3d);
  window.speedTimer = timer;

  // 2. DOM Elements
  const btnMix = document.getElementById('btn-mix');
  const btnSolve = document.getElementById('btn-solve');
  const btnToggleTimer = document.getElementById('btn-toggle-timer');
  const btnCloseTimer = document.getElementById('btn-close-timer');
  const btnToggleSound = document.getElementById('btn-toggle-sound');
  const btnTheme = document.getElementById('btn-theme');
  const btnHelp = document.getElementById('btn-help');
  const btnCopyScramble = document.getElementById('btn-copy-scramble');
  const scrambleText = document.getElementById('scramble-text');

  // Floating Camera Buttons
  const camFront = document.getElementById('cam-front');
  const camTop = document.getElementById('cam-top');
  const camRight = document.getElementById('cam-right');
  const camIso = document.getElementById('cam-iso');
  const btnResetCube = document.getElementById('btn-reset-cube');
  const btnUndoMove = document.getElementById('btn-undo-move');

  // Move History
  const moveHistoryList = document.getElementById('move-history-list');
  const moveCountBadge = document.getElementById('move-count-badge');

  // Modals
  const modalTheme = document.getElementById('modal-theme');
  const modalHelp = document.getElementById('modal-help');
  const solvedBanner = document.getElementById('solved-banner');
  const btnCloseSolved = document.getElementById('btn-close-solved');
  const solvedTimeStat = document.getElementById('solved-time-stat');

  // 3. Scramble Handler
  function performScramble() {
    if (cube3d.isAnimating) return;

    solver.closeAssistant();
    const scrambleSeq = window.scrambleGenerator.generate(21);
    const scrambleStr = scrambleSeq.join(' ');

    if (scrambleText) {
      scrambleText.textContent = scrambleStr;
      scrambleText.classList.add('active');
    }

    if (window.soundEngine) {
      window.soundEngine.playSwoosh();
    }

    // Fast animated scramble
    cube3d.turnSequence(scrambleSeq, {
      recordHistory: true,
      speedMultiplier: 3.5,
      onDone: () => {
        updateMoveHistoryUI();
      }
    });
  }

  if (btnMix) {
    btnMix.addEventListener('click', performScramble);
  }

  // 4. Solve Handler
  if (btnSolve) {
    btnSolve.addEventListener('click', () => {
      solver.solve();
    });
  }

  // 5. Copy Scramble
  if (btnCopyScramble) {
    btnCopyScramble.addEventListener('click', () => {
      const text = scrambleText.textContent;
      navigator.clipboard.writeText(text).then(() => {
        const origHtml = btnCopyScramble.innerHTML;
        btnCopyScramble.innerHTML = '<i data-lucide="check"></i>';
        if (window.lucide) window.lucide.createIcons();
        setTimeout(() => {
          btnCopyScramble.innerHTML = origHtml;
          if (window.lucide) window.lucide.createIcons();
        }, 1500);
      });
    });
  }

  // 6. Manual Notation Buttons (Bottom Bar)
  document.querySelectorAll('.move-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const move = btn.getAttribute('data-move');
      if (move) {
        cube3d.turn(move, { recordHistory: true });
      }
    });
  });

  // 7. Move History UI Updates
  function updateMoveHistoryUI() {
    if (!moveHistoryList || !moveCountBadge) return;
    const history = cube3d.moveHistory;
    moveCountBadge.textContent = history.length;

    if (history.length === 0) {
      moveHistoryList.innerHTML = '<span class="history-empty">No moves yet</span>';
      return;
    }

    moveHistoryList.innerHTML = '';
    history.slice(-20).forEach(m => {
      const item = document.createElement('span');
      item.className = 'history-item';
      item.textContent = m;
      moveHistoryList.appendChild(item);
    });

    moveHistoryList.scrollLeft = moveHistoryList.scrollWidth;
  }

  cube3d.onMoveComplete = (move) => {
    updateMoveHistoryUI();
  };

  // 8. Solved Celebration Event
  cube3d.onSolved = () => {
    if (solvedBanner && !cube3d.isAnimating) {
      if (solvedTimeStat) {
        solvedTimeStat.textContent = `Completed in ${cube3d.moveHistory.length} moves!`;
      }
      solvedBanner.classList.remove('hidden');
      if (window.soundEngine) {
        window.soundEngine.playVictoryChime();
      }
    }
  };

  if (btnCloseSolved) {
    btnCloseSolved.addEventListener('click', () => {
      solvedBanner.classList.add('hidden');
    });
  }

  // 9. Camera Preset Angle Controls
  if (camFront) camFront.addEventListener('click', () => cube3d.setCameraPreset(0, Math.PI / 2, 9.2));
  if (camTop) camTop.addEventListener('click', () => cube3d.setCameraPreset(0, 0.05, 9.2));
  if (camRight) camRight.addEventListener('click', () => cube3d.setCameraPreset(-Math.PI / 2, Math.PI / 2, 9.2));
  if (camIso) camIso.addEventListener('click', () => cube3d.setCameraPreset(0.65, 0.45, 9.2));

  // Reset Cube
  if (btnResetCube) {
    btnResetCube.addEventListener('click', () => {
      cube3d.resetSolved();
      updateMoveHistoryUI();
      if (scrambleText) scrambleText.textContent = "Ready to scramble...";
      solver.closeAssistant();
    });
  }

  // Undo Last Move
  if (btnUndoMove) {
    btnUndoMove.addEventListener('click', () => {
      if (cube3d.moveHistory.length > 0) {
        const lastMove = cube3d.moveHistory.pop();
        const inverse = CubeNotation.getInverse(lastMove);
        cube3d.turn(inverse, { recordHistory: false });
        updateMoveHistoryUI();
      }
    });
  }

  // 10. Timer Toggle
  if (btnToggleTimer) {
    btnToggleTimer.addEventListener('click', () => {
      timer.togglePanel();
      btnToggleTimer.classList.toggle('active');
    });
  }

  if (btnCloseTimer) {
    btnCloseTimer.addEventListener('click', () => {
      timer.togglePanel();
      btnToggleTimer.classList.remove('active');
    });
  }

  // 11. Sound Effects Toggle
  if (btnToggleSound) {
    btnToggleSound.addEventListener('click', () => {
      const isMuted = window.soundEngine.toggleMute();
      btnToggleSound.innerHTML = isMuted ? '<i data-lucide="volume-x"></i>' : '<i data-lucide="volume-2"></i>';
      btnToggleSound.classList.toggle('active', !isMuted);
      if (window.lucide) window.lucide.createIcons();
    });
  }

  // 12. Modals (Theme & Help)
  if (btnTheme && modalTheme) {
    btnTheme.addEventListener('click', () => modalTheme.classList.remove('hidden'));
  }
  if (btnHelp && modalHelp) {
    btnHelp.addEventListener('click', () => modalHelp.classList.remove('hidden'));
  }

  document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.modal-backdrop').classList.add('hidden');
    });
  });

  // Close modals when clicking backdrop
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.add('hidden');
    });
  });

  // Theme Picker Buttons
  document.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const themeKey = card.getAttribute('data-theme');
      window.themeManager.setTheme(themeKey);
    });
  });

  // Background Atmosphere Buttons
  document.querySelectorAll('.bg-theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bg-theme-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const bgClass = btn.getAttribute('data-bg');
      window.themeManager.setBg(bgClass);
    });
  });

  // Animation Speed Slider
  const animSpeedSlider = document.getElementById('anim-speed-slider');
  if (animSpeedSlider) {
    animSpeedSlider.value = window.themeManager.animationSpeed;
    animSpeedSlider.addEventListener('input', (e) => {
      window.themeManager.setSpeed(parseInt(e.target.value, 10));
    });
  }

  // 13. Keyboard Shortcuts Listener
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Undo: Ctrl+Z
    if (e.ctrlKey && e.code === 'KeyZ') {
      e.preventDefault();
      if (btnUndoMove) btnUndoMove.click();
      return;
    }

    // Key to notation mapping
    const keyMap = {
      'KeyU': 'U',
      'KeyD': 'D',
      'KeyL': 'L',
      'KeyR': 'R',
      'KeyF': 'F',
      'KeyB': 'B',
      'KeyM': 'M',
      'KeyE': 'E',
      'KeyS': 'S',
      'KeyX': 'x',
      'KeyY': 'y',
      'KeyZ': 'z'
    };

    let baseMove = keyMap[e.code];
    if (baseMove) {
      e.preventDefault();
      let finalMove = baseMove;
      if (e.shiftKey) {
        finalMove += "'";
      }
      cube3d.turn(finalMove, { recordHistory: true });
    }
  });
});
