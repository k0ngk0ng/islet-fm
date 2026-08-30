(() => {
  "use strict";

  const TAU = Math.PI * 2;
  const MAX_NODES = 18;
  const STORAGE_KEY = "islet-fm-session-v1";

  const moods = {
    dusk: {
      accent: "#ff8f70",
      rgb: "255, 143, 112",
      top: "#07111f",
      bottom: "#151427",
      star: [210, 231, 226],
      secondary: [116, 205, 194],
      scale: [0, 2, 4, 7, 9],
      root: 146.83,
      wave: "triangle",
      prefixes: ["绯色", "迟归", "琥珀", "薄暮", "温柔", "落日"],
      suffixes: ["旅人", "岛屿", "天鹅", "回声", "鲸群", "信笺"],
    },
    abyss: {
      accent: "#54d8ff",
      rgb: "84, 216, 255",
      top: "#03111a",
      bottom: "#081c2f",
      star: [197, 235, 244],
      secondary: [71, 138, 210],
      scale: [0, 3, 5, 7, 10],
      root: 130.81,
      wave: "sine",
      prefixes: ["深蓝", "潜行", "寂静", "潮汐", "远海", "失重"],
      suffixes: ["水母", "灯塔", "海沟", "雨幕", "蓝鲸", "暗流"],
    },
    dawn: {
      accent: "#f6d365",
      rgb: "246, 211, 101",
      top: "#121426",
      bottom: "#2b1d2c",
      star: [255, 239, 194],
      secondary: [238, 155, 129],
      scale: [0, 2, 5, 7, 11],
      root: 164.81,
      wave: "sine",
      prefixes: ["初醒", "金色", "清晨", "向阳", "晴朗", "柔光"],
      suffixes: ["候鸟", "原野", "云朵", "纸鸢", "花火", "山风"],
    },
  };

  const canvas = document.querySelector("#sky");
  const ctx = canvas.getContext("2d", { alpha: false });
  const root = document.documentElement;
  const playButton = document.querySelector("#playButton");
  const remixButton = document.querySelector("#remixButton");
  const clearButton = document.querySelector("#clearButton");
  const tempoRange = document.querySelector("#tempoRange");
  const tempoOutput = document.querySelector("#tempoOutput");
  const moodButtons = document.querySelector("#moodButtons");
  const hintCard = document.querySelector("#hintCard");
  const hintClose = document.querySelector("#hintClose");
  const nodeCount = document.querySelector("#nodeCount");
  const loopNumber = document.querySelector("#loopNumber");
  const constellationName = document.querySelector("#constellationName");
  const signalOutput = document.querySelector("#signalOutput");
  const meterBars = [...document.querySelectorAll("#meterBars i")];
  const coordinate = document.querySelector("#coordinate");
  const clock = document.querySelector("#clock");
  const toast = document.querySelector("#toast");
  const announcer = document.querySelector("#announcer");

  let width = 0;
  let height = 0;
  let dpr = 1;
  let backgroundGradient;
  let stars = [];
  let nodes = [];
  let ripples = [];
  let motes = [];
  let comets = [];
  let mood = "dusk";
  let bpm = 72;
  let isPlaying = false;
  let scanAngle = -Math.PI / 2;
  let previousAngle = scanAngle;
  let completedLoops = 0;
  let lastFrame = performance.now();
  let lastCometAt = lastFrame;
  let saveTimer;
  let toastTimer;
  let pointer = { x: -100, y: -100, tx: -100, ty: -100, active: false, down: false };
  let visualEnergy = 0;
  let audio;

  class AudioEngine {
    constructor() {
      this.context = null;
      this.master = null;
      this.delay = null;
      this.feedback = null;
      this.filter = null;
    }

    async ensure() {
      if (!this.context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return false;

        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = 0.52;

        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.knee.value = 18;
        compressor.ratio.value = 5;
        compressor.attack.value = 0.01;
        compressor.release.value = 0.32;

        this.filter = this.context.createBiquadFilter();
        this.filter.type = "lowpass";
        this.filter.frequency.value = 6200;
        this.filter.Q.value = 0.45;

        this.delay = this.context.createDelay(1.5);
        this.delay.delayTime.value = 0.34;
        this.feedback = this.context.createGain();
        this.feedback.gain.value = 0.24;

        this.filter.connect(this.master);
        this.filter.connect(this.delay);
        this.delay.connect(this.feedback);
        this.feedback.connect(this.delay);
        this.delay.connect(this.master);
        this.master.connect(compressor);
        compressor.connect(this.context.destination);
      }

      if (this.context.state === "suspended") await this.context.resume();
      return true;
    }

    note(frequency, strength, pan = 0) {
      if (!this.context || this.context.state !== "running") return;
      const now = this.context.currentTime;
      const duration = 1.25 + strength * 0.55;
      const oscillator = this.context.createOscillator();
      const overtone = this.context.createOscillator();
      const gain = this.context.createGain();
      const overtoneGain = this.context.createGain();
      const noteFilter = this.context.createBiquadFilter();
      const panner = this.context.createStereoPanner ? this.context.createStereoPanner() : null;

      oscillator.type = moods[mood].wave;
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.detune.setValueAtTime((Math.random() - 0.5) * 5, now);
      overtone.type = "sine";
      overtone.frequency.setValueAtTime(frequency * 2.005, now);

      const volume = 0.035 + strength * 0.045;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(volume * 0.34, now + 0.23);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      overtoneGain.gain.value = mood === "dawn" ? 0.2 : 0.12;

      noteFilter.type = "lowpass";
      noteFilter.frequency.setValueAtTime(1300 + strength * 3600, now);
      noteFilter.frequency.exponentialRampToValueAtTime(700, now + duration);
      noteFilter.Q.value = 1.2;

      oscillator.connect(gain);
      overtone.connect(overtoneGain);
      overtoneGain.connect(gain);
      gain.connect(noteFilter);
      if (panner) {
        panner.pan.value = Math.max(-0.9, Math.min(0.9, pan));
        noteFilter.connect(panner);
        panner.connect(this.filter);
      } else {
        noteFilter.connect(this.filter);
      }

      oscillator.start(now);
      overtone.start(now);
      oscillator.stop(now + duration + 0.05);
      overtone.stop(now + duration + 0.05);
    }

    chime(frequency = 880) {
      if (!this.context || this.context.state !== "running") return;
      this.note(frequency, 0.32, 0);
    }
  }

  function createStar(index) {
    const depth = 0.25 + Math.random() * 0.75;
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      r: 0.25 + Math.random() * 1.25 * depth,
      depth,
      alpha: 0.12 + Math.random() * 0.58,
      phase: Math.random() * TAU,
      speed: 0.0004 + Math.random() * 0.0012,
      warm: index % 11 === 0,
    };
  }

  function resize() {
    const oldWidth = width || window.innerWidth;
    const oldHeight = height || window.innerHeight;
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (nodes.length && oldWidth && oldHeight) {
      nodes.forEach((node) => {
        node.x = (node.x / oldWidth) * width;
        node.y = (node.y / oldHeight) * height;
      });
    }

    backgroundGradient = ctx.createLinearGradient(0, 0, width, height);
    backgroundGradient.addColorStop(0, moods[mood].top);
    backgroundGradient.addColorStop(1, moods[mood].bottom);
    const targetStars = Math.round(Math.min(230, Math.max(105, (width * height) / 7200)));
    stars = Array.from({ length: targetStars }, (_, i) => createStar(i));
  }

  function origin() {
    return {
      x: width > 760 ? width * 0.59 : width * 0.52,
      y: height > 700 ? height * 0.45 : height * 0.43,
    };
  }

  function playableBounds() {
    const compact = width < 760;
    return {
      left: compact ? 24 : Math.max(45, width * 0.23),
      right: width - 28,
      top: compact ? 190 : 105,
      bottom: height - (compact ? 190 : 170),
    };
  }

  function drawBackground(time) {
    const palette = moods[mood];
    ctx.fillStyle = backgroundGradient;
    ctx.fillRect(0, 0, width, height);

    const o = origin();
    const glow = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, Math.max(width, height) * 0.72);
    glow.addColorStop(0, `rgba(${palette.secondary.join(",")}, 0.055)`);
    glow.addColorStop(0.35, `rgba(${palette.secondary.join(",")}, 0.018)`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    for (const star of stars) {
      const driftX = pointer.active ? (pointer.x - width / 2) * star.depth * -0.004 : 0;
      const driftY = pointer.active ? (pointer.y - height / 2) * star.depth * -0.004 : 0;
      const twinkle = Math.sin(time * star.speed + star.phase) * 0.18;
      const color = star.warm ? palette.star : [205, 224, 230];
      ctx.beginPath();
      ctx.arc(star.x + driftX, star.y + driftY, star.r, 0, TAU);
      ctx.fillStyle = `rgba(${color.join(",")}, ${Math.max(0.05, star.alpha + twinkle)})`;
      ctx.fill();
    }

    drawOrbitalGrid(o, time);
  }

  function drawOrbitalGrid(o, time) {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.strokeStyle = "rgba(210, 231, 226, 0.035)";
    ctx.lineWidth = 1;

    const maxRadius = Math.hypot(Math.max(o.x, width - o.x), Math.max(o.y, height - o.y));
    for (let radius = 90; radius < maxRadius; radius += 88) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.stroke();
    }

    ctx.rotate(time * 0.000008);
    for (let i = 0; i < 24; i += 1) {
      ctx.rotate(TAU / 24);
      ctx.beginPath();
      ctx.moveTo(76, 0);
      ctx.lineTo(i % 3 === 0 ? 84 : 80, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawConnections() {
    if (nodes.length < 2) return;
    const palette = moods[mood];
    ctx.save();
    ctx.lineWidth = 0.7;

    for (let i = 0; i < nodes.length; i += 1) {
      const distances = [];
      for (let j = i + 1; j < nodes.length; j += 1) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const distance = Math.hypot(dx, dy);
        if (distance < Math.min(270, width * 0.3)) distances.push({ node: nodes[j], distance });
      }
      distances.sort((a, b) => a.distance - b.distance);
      distances.slice(0, 2).forEach(({ node, distance }) => {
        const alpha = (1 - distance / 280) * 0.14;
        const line = ctx.createLinearGradient(nodes[i].x, nodes[i].y, node.x, node.y);
        line.addColorStop(0, `rgba(${palette.star.join(",")}, ${alpha})`);
        line.addColorStop(0.5, `rgba(${palette.secondary.join(",")}, ${alpha * 0.45})`);
        line.addColorStop(1, `rgba(${palette.star.join(",")}, ${alpha})`);
        ctx.strokeStyle = line;
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(node.x, node.y);
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  function drawScanner(time) {
    const o = origin();
    const maxLength = Math.hypot(width, height);
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(scanAngle);

    const beam = ctx.createLinearGradient(0, 0, maxLength, 0);
    beam.addColorStop(0, `rgba(${moods[mood].rgb}, 0.23)`);
    beam.addColorStop(0.45, `rgba(${moods[mood].rgb}, 0.07)`);
    beam.addColorStop(1, `rgba(${moods[mood].rgb}, 0)`);
    ctx.strokeStyle = beam;
    ctx.lineWidth = 1;
    ctx.shadowColor = moods[mood].accent;
    ctx.shadowBlur = 9 + visualEnergy * 10;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(maxLength, 0);
    ctx.stroke();

    const tail = 0.14 + visualEnergy * 0.03;
    const sector = ctx.createRadialGradient(0, 0, 20, 0, 0, maxLength * 0.65);
    sector.addColorStop(0, `rgba(${moods[mood].rgb}, 0.045)`);
    sector.addColorStop(1, `rgba(${moods[mood].rgb}, 0)`);
    ctx.fillStyle = sector;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, maxLength, -tail, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(o.x, o.y);
    const pulse = 1 + Math.sin(time * 0.002) * 0.08;
    ctx.strokeStyle = `rgba(${moods[mood].rgb}, ${0.16 + visualEnergy * 0.12})`;
    ctx.fillStyle = moods[mood].accent;
    ctx.shadowColor = moods[mood].accent;
    ctx.shadowBlur = 14 + visualEnergy * 16;
    ctx.beginPath();
    ctx.arc(0, 0, 4 * pulse, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, 13 * pulse, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 23, -0.55, 1.5);
    ctx.strokeStyle = `rgba(${moods[mood].rgb}, 0.08)`;
    ctx.stroke();
    ctx.restore();
  }

  function drawNodes(time) {
    const palette = moods[mood];
    nodes.forEach((node, index) => {
      node.pulse *= 0.94;
      node.born = Math.min(1, node.born + 0.045);
      const bob = Math.sin(time * 0.0012 + node.phase) * 1.7;
      const size = (2.5 + node.energy * 2 + node.pulse * 2.8) * easeOutBack(node.born);

      ctx.save();
      ctx.translate(node.x, node.y + bob);
      ctx.globalAlpha = Math.min(1, node.born * 1.5);

      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 20 + node.pulse * 16);
      halo.addColorStop(0, `rgba(${palette.rgb}, ${0.17 + node.pulse * 0.16})`);
      halo.addColorStop(1, `rgba(${palette.rgb}, 0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, 22 + node.pulse * 16, 0, TAU);
      ctx.fill();

      ctx.strokeStyle = `rgba(${palette.star.join(",")}, ${0.2 + node.pulse * 0.36})`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(0, 0, 7 + node.pulse * 8, node.phase + time * 0.0002, node.phase + 3.8 + time * 0.0002);
      ctx.stroke();

      ctx.fillStyle = `rgba(${palette.star.join(",")}, 0.96)`;
      ctx.shadowColor = palette.accent;
      ctx.shadowBlur = 9 + node.pulse * 16;
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (node.pulse > 0.08) {
        ctx.fillStyle = `rgba(${palette.star.join(",")}, ${node.pulse * 0.6})`;
        for (let ray = 0; ray < 4; ray += 1) {
          ctx.rotate(Math.PI / 2);
          ctx.fillRect(size + 3, -0.35, 8 + node.pulse * 11, 0.7);
        }
      }

      if (nodes.length <= 10 || node.pulse > 0.2) {
        ctx.fillStyle = `rgba(226, 237, 232, ${0.22 + node.pulse * 0.35})`;
        ctx.font = '7px "SFMono-Regular", monospace';
        ctx.letterSpacing = "1px";
        ctx.fillText(String(index + 1).padStart(2, "0"), 11, -10);
      }
      ctx.restore();
    });
  }

  function drawRipples() {
    for (let i = ripples.length - 1; i >= 0; i -= 1) {
      const ripple = ripples[i];
      ripple.life -= 0.018;
      ripple.radius += ripple.speed;
      if (ripple.life <= 0) {
        ripples.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, ripple.radius, 0, TAU);
      ctx.strokeStyle = `rgba(${moods[mood].rgb}, ${ripple.life * 0.22})`;
      ctx.lineWidth = Math.max(0.5, ripple.life * 1.2);
      ctx.stroke();
    }
  }

  function drawMotes() {
    for (let i = motes.length - 1; i >= 0; i -= 1) {
      const mote = motes[i];
      mote.life -= 0.022;
      mote.x += mote.vx;
      mote.y += mote.vy;
      mote.vx *= 0.985;
      mote.vy *= 0.985;
      if (mote.life <= 0) {
        motes.splice(i, 1);
        continue;
      }
      ctx.fillStyle = `rgba(${moods[mood].star.join(",")}, ${mote.life * 0.7})`;
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, mote.size * mote.life, 0, TAU);
      ctx.fill();
    }
  }

  function spawnComet() {
    const fromRight = Math.random() > 0.35;
    comets.push({
      x: fromRight ? width + 50 : Math.random() * width * 0.7,
      y: 40 + Math.random() * height * 0.42,
      vx: -5 - Math.random() * 3.5,
      vy: 2 + Math.random() * 1.8,
      life: 1,
      length: 50 + Math.random() * 80,
    });
  }

  function drawComets() {
    for (let i = comets.length - 1; i >= 0; i -= 1) {
      const comet = comets[i];
      comet.x += comet.vx;
      comet.y += comet.vy;
      comet.life -= 0.009;
      if (comet.life <= 0 || comet.y > height + 30 || comet.x < -comet.length) {
        comets.splice(i, 1);
        continue;
      }
      const magnitude = Math.hypot(comet.vx, comet.vy);
      const tailX = comet.x - (comet.vx / magnitude) * comet.length;
      const tailY = comet.y - (comet.vy / magnitude) * comet.length;
      const gradient = ctx.createLinearGradient(comet.x, comet.y, tailX, tailY);
      gradient.addColorStop(0, `rgba(${moods[mood].star.join(",")}, ${comet.life * 0.75})`);
      gradient.addColorStop(1, `rgba(${moods[mood].star.join(",")}, 0)`);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(comet.x, comet.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
    }
  }

  function drawPointer() {
    if (!pointer.active || pointer.x < 0) return;
    pointer.x += (pointer.tx - pointer.x) * 0.2;
    pointer.y += (pointer.ty - pointer.y) * 0.2;
    const radius = pointer.down ? 12 : 17;
    ctx.save();
    ctx.translate(pointer.x, pointer.y);
    ctx.strokeStyle = `rgba(${moods[mood].rgb}, 0.3)`;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = `rgba(${moods[mood].rgb}, 0.68)`;
    ctx.beginPath();
    ctx.arc(0, 0, 1.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function normalizeAngle(angle) {
    return ((angle % TAU) + TAU) % TAU;
  }

  function hasPassed(start, end, target) {
    start = normalizeAngle(start);
    end = normalizeAngle(end);
    target = normalizeAngle(target);
    return end >= start ? target > start && target <= end : target > start || target <= end;
  }

  function updateScanner(delta) {
    if (!isPlaying) return;
    const secondsPerLoop = (60 / bpm) * 8;
    previousAngle = scanAngle;
    scanAngle += (TAU / secondsPerLoop) * delta;

    if (scanAngle >= TAU) {
      scanAngle -= TAU;
      previousAngle -= TAU;
      completedLoops += 1;
      loopNumber.textContent = String((completedLoops % 99) + 1).padStart(2, "0");
    }

    const o = origin();
    nodes.forEach((node) => {
      const angle = Math.atan2(node.y - o.y, node.x - o.x);
      if (hasPassed(previousAngle, scanAngle, angle)) triggerNode(node);
    });
  }

  function triggerNode(node) {
    node.pulse = 1;
    visualEnergy = Math.min(1, visualEnergy + 0.38);
    ripples.push({ x: node.x, y: node.y, radius: 5, life: 0.82, speed: 1.5 });
    burst(node.x, node.y, 5);
    const pan = (node.x / width) * 2 - 1;
    audio.note(noteFrequency(node), node.energy, pan);
  }

  function noteFrequency(node) {
    const config = moods[mood];
    const bounds = playableBounds();
    const normalizedY = 1 - clamp((node.y - bounds.top) / Math.max(1, bounds.bottom - bounds.top), 0, 1);
    const totalSteps = config.scale.length * 3;
    const step = Math.min(totalSteps - 1, Math.floor(normalizedY * totalSteps));
    const octave = Math.floor(step / config.scale.length);
    const semitone = config.scale[step % config.scale.length] + octave * 12;
    return config.root * Math.pow(2, semitone / 12);
  }

  function animate(time) {
    const delta = Math.min(0.05, (time - lastFrame) / 1000);
    lastFrame = time;
    visualEnergy *= 0.965;
    if (time - lastCometAt > 6500 + Math.random() * 7500) {
      spawnComet();
      lastCometAt = time;
    }

    updateScanner(delta);
    drawBackground(time);
    drawComets();
    drawConnections();
    drawScanner(time);
    drawRipples();
    drawNodes(time);
    drawMotes();
    drawPointer();
    updateMeter(time);
    requestAnimationFrame(animate);
  }

  function addNode(x, y, options = {}) {
    if (nodes.length >= MAX_NODES) {
      const removed = nodes.shift();
      ripples.push({ x: removed.x, y: removed.y, radius: 6, life: 0.45, speed: 2.1 });
      showToast("最早的信标已漂向宇宙深处");
    }
    const bounds = playableBounds();
    x = clamp(x, bounds.left, bounds.right);
    y = clamp(y, bounds.top, bounds.bottom);
    const node = {
      x,
      y,
      energy: options.energy ?? 0.35 + Math.random() * 0.65,
      phase: options.phase ?? Math.random() * TAU,
      pulse: options.silent ? 0 : 0.8,
      born: options.restored ? 1 : 0,
    };
    nodes.push(node);
    if (!options.silent) {
      ripples.push({ x, y, radius: 4, life: 1, speed: 1.8 });
      burst(x, y, 8);
      audio.note(noteFrequency(node), node.energy * 0.72, (x / width) * 2 - 1);
    }
    updateReadout();
    queueSave();
    return node;
  }

  function burst(x, y, amount) {
    for (let i = 0; i < amount; i += 1) {
      const angle = Math.random() * TAU;
      const speed = 0.3 + Math.random() * 1.25;
      motes.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.5,
        size: 0.7 + Math.random() * 1.3,
      });
    }
  }

  async function togglePlayback(force) {
    const shouldPlay = typeof force === "boolean" ? force : !isPlaying;
    if (shouldPlay) {
      const ready = await audio.ensure();
      if (!ready) {
        showToast("这个浏览器暂不支持星际音频");
        return;
      }
    }
    isPlaying = shouldPlay;
    playButton.classList.toggle("is-playing", isPlaying);
    playButton.setAttribute("aria-pressed", String(isPlaying));
    playButton.setAttribute("aria-label", isPlaying ? "暂停播放" : "开始播放");
    announcer.textContent = isPlaying ? "星际扫描已开始" : "星际扫描已暂停";
    if (isPlaying && nodes.length === 0) showToast("在夜空中点几下，旋律就会出现");
  }

  async function handleCanvasPointer(event) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    await audio.ensure();
    addNode(event.clientX, event.clientY);
    dismissHint();
    if (!isPlaying) togglePlayback(true);
  }

  function remix() {
    nodes = [];
    ripples = [];
    const bounds = playableBounds();
    const amount = 7 + Math.floor(Math.random() * 6);
    const o = origin();

    for (let i = 0; i < amount; i += 1) {
      const angle = (i / amount) * TAU + (Math.random() - 0.5) * 0.45;
      const maxRadiusX = Math.min(o.x - bounds.left, bounds.right - o.x);
      const maxRadiusY = Math.min(o.y - bounds.top, bounds.bottom - o.y);
      const radiusX = Math.max(45, maxRadiusX * (0.34 + Math.random() * 0.58));
      const radiusY = Math.max(35, maxRadiusY * (0.32 + Math.random() * 0.62));
      addNode(o.x + Math.cos(angle) * radiusX, o.y + Math.sin(angle) * radiusY, { silent: true });
    }
    nodes.forEach((node, index) => {
      window.setTimeout(() => {
        node.pulse = 0.85;
        ripples.push({ x: node.x, y: node.y, radius: 4, life: 0.7, speed: 1.7 });
        burst(node.x, node.y, 5);
      }, index * 55);
    });
    updateReadout();
    queueSave();
    dismissHint();
    showToast("发现了一片新的星群");
    if (!isPlaying) togglePlayback(true);
  }

  function clearAll() {
    if (!nodes.length) {
      showToast("夜空已经很安静了");
      return;
    }
    nodes.forEach((node, index) => {
      window.setTimeout(() => {
        ripples.push({ x: node.x, y: node.y, radius: 3, life: 0.4, speed: 2.4 });
      }, index * 22);
    });
    nodes = [];
    completedLoops = 0;
    loopNumber.textContent = "01";
    updateReadout();
    queueSave();
    showToast("频道已归于寂静");
  }

  function setMood(nextMood, { silent = false } = {}) {
    if (!moods[nextMood]) return;
    mood = nextMood;
    const palette = moods[mood];
    root.style.setProperty("--accent", palette.accent);
    root.style.setProperty("--accent-rgb", palette.rgb);
    root.style.setProperty("--sky-top", palette.top);
    root.style.setProperty("--sky-bottom", palette.bottom);
    document.querySelector('meta[name="theme-color"]').setAttribute("content", palette.top);
    [...moodButtons.querySelectorAll(".mood")].forEach((button) => {
      const active = button.dataset.mood === mood;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    backgroundGradient = ctx.createLinearGradient(0, 0, width, height);
    backgroundGradient.addColorStop(0, palette.top);
    backgroundGradient.addColorStop(1, palette.bottom);
    nodes.forEach((node) => { node.pulse = 0.45; });
    updateReadout();
    queueSave();
    if (!silent) {
      audio.ensure().then(() => audio.chime(palette.root * 4));
      showToast(`${nextMood === "dusk" ? "暮色" : nextMood === "abyss" ? "深海" : "晨光"}频道接入成功`);
    }
  }

  function updateReadout() {
    nodeCount.textContent = String(nodes.length);
    constellationName.textContent = constellationTitle();
    const baseSignal = nodes.length ? 18 + (nodes.length / MAX_NODES) * 72 : 12;
    signalOutput.textContent = `${Math.round(baseSignal)}%`;
  }

  function constellationTitle() {
    if (!nodes.length) return "无名微光";
    let hash = mood.length * 37 + nodes.length * 101;
    nodes.forEach((node, index) => {
      hash = (hash + Math.round(node.x * 3 + node.y * 7) * (index + 1)) % 100003;
    });
    const palette = moods[mood];
    const first = palette.prefixes[hash % palette.prefixes.length];
    const second = palette.suffixes[Math.floor(hash / 7) % palette.suffixes.length];
    return `${first}${second}`;
  }

  function updateMeter(time) {
    const base = nodes.length ? 2 + (nodes.length / MAX_NODES) * 7 : 1;
    const movement = isPlaying ? Math.sin(time * 0.004) * 1.1 + Math.sin(time * 0.009) * 0.5 : 0;
    const active = Math.round(clamp(base + movement + visualEnergy * 4, 1, meterBars.length));
    meterBars.forEach((bar, index) => {
      bar.style.setProperty("--level", String((index * 7 + 3) % 11));
      bar.classList.toggle("is-lit", index < active);
    });
  }

  function updateTempo() {
    bpm = Number(tempoRange.value);
    tempoOutput.textContent = `${bpm} BPM`;
    const progress = ((bpm - Number(tempoRange.min)) / (Number(tempoRange.max) - Number(tempoRange.min))) * 100;
    tempoRange.style.setProperty("--range-progress", `${progress}%`);
    queueSave();
  }

  function updateCoordinate(x, y) {
    const lat = 18 + (1 - y / height) * 38;
    const lon = 86 + (x / width) * 62;
    coordinate.textContent = `${toDms(lat)}N · ${toDms(lon)}E`;
  }

  function toDms(value) {
    const degree = Math.floor(value);
    const minute = Math.floor((value - degree) * 60);
    return `${degree}°${String(minute).padStart(2, "0")}′`;
  }

  function dismissHint() {
    hintCard.classList.add("is-hidden");
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2100);
  }

  function queueSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveState, 180);
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        mood,
        bpm,
        nodes: nodes.map((node) => ({
          x: node.x / width,
          y: node.y / height,
          energy: node.energy,
          phase: node.phase,
        })),
      }));
    } catch (_error) {
      // The experience still works when storage is unavailable.
    }
  }

  function restoreState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || !Array.isArray(saved.nodes)) return;
      if (moods[saved.mood]) setMood(saved.mood, { silent: true });
      if (Number.isFinite(saved.bpm)) {
        tempoRange.value = String(clamp(saved.bpm, 48, 128));
        updateTempo();
      }
      saved.nodes.slice(0, MAX_NODES).forEach((node) => {
        if (![node.x, node.y, node.energy, node.phase].every(Number.isFinite)) return;
        addNode(node.x * width, node.y * height, {
          energy: node.energy,
          phase: node.phase,
          restored: true,
          silent: true,
        });
      });
      if (nodes.length) dismissHint();
    } catch (_error) {
      // Ignore malformed or blocked local state.
    }
  }

  function updateClock() {
    const now = new Date();
    clock.textContent = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }

  function easeOutBack(value) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  canvas.addEventListener("pointerdown", handleCanvasPointer);
  canvas.addEventListener("pointermove", (event) => {
    pointer.active = true;
    pointer.tx = event.clientX;
    pointer.ty = event.clientY;
    if (pointer.x < 0) {
      pointer.x = pointer.tx;
      pointer.y = pointer.ty;
    }
    updateCoordinate(event.clientX, event.clientY);
  });
  canvas.addEventListener("pointerleave", () => { pointer.active = false; });
  canvas.addEventListener("pointerdown", () => { pointer.down = true; });
  window.addEventListener("pointerup", () => { pointer.down = false; });
  playButton.addEventListener("click", () => togglePlayback());
  remixButton.addEventListener("click", remix);
  clearButton.addEventListener("click", clearAll);
  hintClose.addEventListener("click", dismissHint);
  tempoRange.addEventListener("input", updateTempo);
  moodButtons.addEventListener("click", (event) => {
    const button = event.target.closest(".mood");
    if (button) setMood(button.dataset.mood);
  });
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (event) => {
    if (event.target instanceof Element && event.target.matches("input, button")) return;
    const isSpace = event.code === "Space" || event.key === " " || event.key === "Space";
    if (isSpace) {
      event.preventDefault();
      togglePlayback();
    } else if (event.key.toLowerCase() === "r") {
      remix();
    } else if (event.key.toLowerCase() === "c") {
      clearAll();
    } else if (["1", "2", "3"].includes(event.key)) {
      setMood(["dusk", "abyss", "dawn"][Number(event.key) - 1]);
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && audio?.context?.state === "running") {
      audio.context.suspend();
    } else if (!document.hidden && isPlaying && audio?.context?.state === "suspended") {
      audio.context.resume();
    }
  });

  audio = new AudioEngine();
  resize();
  updateTempo();
  setMood(mood, { silent: true });
  restoreState();
  updateReadout();
  updateClock();
  window.setInterval(updateClock, 15000);
  requestAnimationFrame(animate);

  // A tiny inspection surface for automated smoke tests and curious tinkerers.
  window.__ISLET_FM__ = {
    version: "1.0.0",
    getState: () => ({ mood, bpm, isPlaying, nodeCount: nodes.length, completedLoops }),
    remix,
    clear: clearAll,
    setMood,
  };
})();
