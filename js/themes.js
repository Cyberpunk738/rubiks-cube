/**
 * Themes and Visual Customization Manager
 * Supports multiple cube color palettes, body plastic materials, and ambient backgrounds.
 */
class ThemeManager {
  constructor() {
    this.currentTheme = 'classic';
    this.currentBg = 'bg-studio';
    this.animationSpeed = 280; // ms per 90 degree turn

    this.themes = {
      classic: {
        name: 'Classic WCA',
        body: 0x111318,
        colors: {
          U: 0xffffff, // White
          D: 0xffd500, // Yellow
          L: 0xff5800, // Orange
          R: 0xdc143c, // Red
          F: 0x009b48, // Green
          B: 0x0046ad  // Blue
        },
        roughness: 0.25,
        metalness: 0.05,
        clearcoat: 0.3
      },
      neon: {
        name: 'Cyberpunk Neon',
        body: 0x07090f,
        colors: {
          U: 0x00f0ff, // Neon Cyan
          D: 0xff007f, // Neon Magenta
          L: 0x7000ff, // Electric Purple
          R: 0xff4500, // Neon Orange
          F: 0x39ff14, // Neon Lime Green
          B: 0x0066ff  // Laser Blue
        },
        roughness: 0.15,
        metalness: 0.2,
        clearcoat: 0.7
      },
      carbon: {
        name: 'Carbon & Metallic',
        body: 0x18181b,
        colors: {
          U: 0xf8fafc, // Platinum
          D: 0xca8a04, // Brushed Gold
          L: 0xd97706, // Bronze
          R: 0x991b1b, // Crimson Carbon
          F: 0x065f46, // Emerald Metallic
          B: 0x1e3a8a  // Sapphire Metallic
        },
        roughness: 0.3,
        metalness: 0.65,
        clearcoat: 0.5
      },
      pastel: {
        name: 'Pastel Dream',
        body: 0x222630,
        colors: {
          U: 0xffffff, // Soft White
          D: 0xfef08a, // Pastel Yellow
          L: 0xfed7aa, // Pastel Orange
          R: 0xfecdd3, // Pastel Pink
          F: 0xbbf7d0, // Pastel Mint
          B: 0xbfdbfe  // Pastel Sky Blue
        },
        roughness: 0.4,
        metalness: 0.0,
        clearcoat: 0.1
      }
    };

    this.loadPreferences();
  }

  loadPreferences() {
    const savedTheme = localStorage.getItem('nexus_theme');
    if (savedTheme && this.themes[savedTheme]) {
      this.currentTheme = savedTheme;
    }
    const savedBg = localStorage.getItem('nexus_bg');
    if (savedBg) {
      this.currentBg = savedBg;
      document.body.className = `theme-${this.currentTheme} ${this.currentBg}`;
    }
    const savedSpeed = localStorage.getItem('nexus_speed');
    if (savedSpeed) {
      this.animationSpeed = parseInt(savedSpeed, 10);
    }
  }

  getThemeData() {
    return this.themes[this.currentTheme] || this.themes.classic;
  }

  setTheme(themeKey) {
    if (!this.themes[themeKey]) return;
    this.currentTheme = themeKey;
    localStorage.setItem('nexus_theme', themeKey);
    document.body.className = `theme-${this.currentTheme} ${this.currentBg}`;

    if (window.cube3d) {
      window.cube3d.updateMaterials();
    }
  }

  setBg(bgClass) {
    this.currentBg = bgClass;
    localStorage.setItem('nexus_bg', bgClass);
    document.body.className = `theme-${this.currentTheme} ${this.currentBg}`;
  }

  setSpeed(speedMs) {
    this.animationSpeed = Math.max(80, Math.min(800, speedMs));
    localStorage.setItem('nexus_speed', this.animationSpeed);
  }
}

window.themeManager = new ThemeManager();
