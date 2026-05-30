(function () {
  "use strict";

  const body = document.body;
  const starField = document.querySelector("[data-star-field]");
  const lanternField = document.querySelector("[data-lantern-field]");
  const thoranaBulbField = document.querySelector("[data-thorana-bulbs]");
  const foregroundBulbField = document.querySelector("[data-foreground-bulbs]");
  const bannerBulbField = document.querySelector("[data-banner-bulbs]");
  const pandolFrameWrapper = document.querySelector(".pandol-frame-wrapper");
  const pandolFrameImg = document.querySelector(".pandol-frame-img");
  const pandolLightCanvas = document.querySelector(".pandol-light-canvas");
  const lightsToggle = document.querySelector("[data-lights-toggle]");
  const songToggles = document.querySelectorAll("[data-song-toggle]");
  const donationOpenButtons = document.querySelectorAll("[data-donation-open]");
  const donationCloseButtons = document.querySelectorAll("[data-donation-close]");
  const donationModal = document.querySelector("[data-donation-modal]");
  const patternToggle = document.querySelector("[data-pattern-toggle]");
  const motionToggle = document.querySelector("[data-motion-toggle]");
  const bathiGeeAudio = new Audio("assets/song/song.mp3");
  bathiGeeAudio.preload = "auto";
  const songLabels = {
    idle: '<span lang="si">බොදු බැති ගී සවන් දෙන්න</span><span class="button-translation">Listen to Buddhist devotional songs</span>',
    playing: '<span lang="si">බොදු බැති ගී නවත්වන්න</span><span class="button-translation">Pause Buddhist devotional songs</span>'
  };
  const patterns = ["pattern-flow", "pattern-alternate", "pattern-glow"];
  const patternLabels = ["Five Colour Flow", "Sacred Alternating Lights", "Golden Serenity"];
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pandolLightSettings = {
    step: 1,
    minDistance: 2,
    maxLights: 5000
  };
  const LIGHT_VISIBILITY_BOOST = 2.16;
  const OFF_BULB_DARKNESS = 0.34;
  const DEBUG_LIGHTS = false;
  const flagColors = [
    { color: "#1E5AA8", glow: "rgba(30, 90, 168, 0.52)" },
    { color: "#F4C430", glow: "rgba(244, 196, 48, 0.56)" },
    { color: "#D62828", glow: "rgba(214, 40, 40, 0.4)" },
    { color: "#F7F7F2", glow: "rgba(247, 247, 242, 0.52)" },
    { color: "#F28C28", glow: "rgba(242, 140, 40, 0.5)" }
  ];
  let currentPattern = 0;
  let pandolLightCtx = null;
  let pandolLightPoints = [];
  let pandolLightAnimationId = null;
  let pandolLightStartTime = 0;

  const createElement = (className, styles) => {
    const element = document.createElement("span");
    element.className = className;
    Object.entries(styles).forEach(([property, value]) => {
      element.style.setProperty(property, value);
    });
    return element;
  };

  const randomBetween = (min, max) => Math.random() * (max - min) + min;

  // Generate slow ambient decoration without hard-coding dozens of HTML nodes.
  const buildStars = () => {
    if (!starField) return;

    const count = window.matchMedia("(max-width: 640px)").matches ? 46 : 82;
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < count; index += 1) {
      fragment.appendChild(
        createElement("star", {
          "--x": `${randomBetween(1, 99).toFixed(2)}%`,
          "--y": `${randomBetween(1, 72).toFixed(2)}%`,
          "--size": `${randomBetween(1.2, 3.2).toFixed(2)}px`,
          "--duration": `${randomBetween(3.8, 8.5).toFixed(2)}s`,
          "--delay": `${randomBetween(-8, 0).toFixed(2)}s`
        })
      );
    }

    starField.replaceChildren(fragment);
  };

  const buildLanterns = () => {
    if (!lanternField) return;

    const count = window.matchMedia("(max-width: 640px)").matches ? 8 : 16;
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < count; index += 1) {
      fragment.appendChild(
        createElement("lantern", {
          "--x": `${randomBetween(2, 96).toFixed(2)}%`,
          "--size": `${randomBetween(1.1, 2.2).toFixed(2)}rem`,
          "--duration": `${randomBetween(20, 34).toFixed(2)}s`,
          "--delay": `${randomBetween(-30, 0).toFixed(2)}s`,
          "--drift": `${randomBetween(-4, 4).toFixed(2)}rem`
        })
      );
    }

    lanternField.replaceChildren(fragment);
  };

  const placeBulb = (fragment, index, total, x, y) => {
    const flag = flagColors[index % flagColors.length];
    const bulb = createElement("bulb", {
      "--i": index,
      "--flag-step": index % flagColors.length,
      "--bulb-color": flag.color,
      "--bulb-glow": flag.glow,
      left: x,
      top: y
    });

    bulb.setAttribute("aria-hidden", "true");
    bulb.dataset.index = String(index);
    bulb.dataset.total = String(total);
    fragment.appendChild(bulb);
  };

  const addArcPoints = (points, cx, cy, rx, ry, startDeg, endDeg, count) => {
    for (let item = 0; item < count; item += 1) {
      const progress = count === 1 ? 0 : item / (count - 1);
      const angle = (startDeg + (endDeg - startDeg) * progress) * (Math.PI / 180);
      points.push({
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry
      });
    }
  };

  const addLinePoints = (points, x1, y1, x2, y2, count) => {
    for (let item = 0; item < count; item += 1) {
      const progress = count === 1 ? 0 : item / (count - 1);
      points.push({
        x: x1 + (x2 - x1) * progress,
        y: y1 + (y2 - y1) * progress
      });
    }
  };

  const addCircleLayers = (points, cx, cy, rx, ry, layerCount, rxStep, ryStep, pointCount, pointStep) => {
    for (let layer = 0; layer < layerCount; layer += 1) {
      addArcPoints(
        points,
        cx,
        cy,
        rx + rxStep * layer,
        ry + ryStep * layer,
        0,
        356,
        pointCount + pointStep * layer
      );
    }
  };

  const scalePoints = (points, cx, cy, scale) => {
    points.forEach((point) => {
      point.x = cx + (point.x - cx) * scale;
      point.y = cy + (point.y - cy) * scale;
    });
  };

  const buildPathBulbs = (container, points) => {
    if (!container) return;

    const fragment = document.createDocumentFragment();
    points.forEach((point, index) => {
      placeBulb(fragment, index, points.length, `${point.x.toFixed(2)}%`, `${point.y.toFixed(2)}%`);
    });
    container.replaceChildren(fragment);
  };

  const buildBulbs = () => {
    const isSmall = window.matchMedia("(max-width: 640px)").matches;
    const thoranaPoints = [];
    const foregroundPoints = [];
    const bannerPoints = [];

    if (!isSmall) {
      addCircleLayers(thoranaPoints, 50, 65, 7.7, 14.7, 10, 0.48, 0.92, 92, 8);
      addLinePoints(bannerPoints, 0.35, 0, 99.65, 0, 120);
      addLinePoints(bannerPoints, 99.65, 0.9, 99.65, 99.1, 17);
      addLinePoints(bannerPoints, 99.65, 100, 0.35, 100, 120);
      addLinePoints(bannerPoints, 0.35, 99.1, 0.35, 0.9, 17);
    } else {
      addCircleLayers(thoranaPoints, 50, 63, 6.6, 17, 10, 0.36, 0.92, 58, 5);
      addLinePoints(bannerPoints, 0.6, 0, 99.4, 0, 56);
      addLinePoints(bannerPoints, 99.4, 1.3, 99.4, 98.7, 12);
      addLinePoints(bannerPoints, 99.4, 100, 0.6, 100, 56);
      addLinePoints(bannerPoints, 0.6, 98.7, 0.6, 1.3, 12);
    }

    buildPathBulbs(thoranaBulbField, thoranaPoints);
    buildPathBulbs(foregroundBulbField, foregroundPoints);
    buildPathBulbs(bannerBulbField, bannerPoints);
  };

  function classifyPixelColor(r, g, b) {
    const brightness = (r + g + b) / 3;
    const saturation = Math.max(r, g, b) - Math.min(r, g, b);

    if (brightness < 70 && saturation < 40) return null;

    if (r > 235 && g > 235 && b > 220) {
      return { color: "rgba(255, 250, 220, 0.45)", type: "white" };
    }

    if (r > 210 && g > 150 && g < 230 && b < 110) {
      return { color: "rgba(255, 190, 60, 0.55)", type: "gold" };
    }

    if (r > 150 && g < 115 && b < 115) {
      return { color: "rgba(255, 45, 35, 0.65)", type: "red" };
    }

    if (b > 120 && r < 130 && g < 180) {
      return { color: "rgba(65, 135, 255, 0.65)", type: "blue" };
    }

    if (r > 170 && g > 70 && g < 165 && b < 90) {
      return { color: "rgba(255, 125, 25, 0.58)", type: "orange" };
    }

    return null;
  }

  function getTightLightRadius(r, g, b) {
    const brightness = (r + g + b) / 3;

    if (brightness > 235) return 2.05;
    if (brightness > 200) return 1.75;
    if (brightness > 160) return 1.52;

    return 1.3;
  }

  const withLightAlpha = (color, alpha) => color.replace(/,\s*[\d.]+\)$/, `, ${alpha})`);
  const getLightAlpha = (color) => {
    const alpha = color.match(/,\s*([\d.]+)\)$/);
    return alpha ? Number(alpha[1]) : 0.55;
  };

  function reduceLightPoints(points, minDistance, maxLights) {
    const accepted = [];
    const grid = new Map();
    const minDistanceSquared = minDistance * minDistance;
    const sortedPoints = [...points].sort((first, second) => first.sort - second.sort);

    const gridKey = (x, y) => `${x},${y}`;

    for (const point of sortedPoints) {
      const gridX = Math.floor(point.x / minDistance);
      const gridY = Math.floor(point.y / minDistance);
      let isTooClose = false;

      for (let yOffset = -1; yOffset <= 1 && !isTooClose; yOffset += 1) {
        for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
          const nearby = grid.get(gridKey(gridX + xOffset, gridY + yOffset));
          if (!nearby) continue;

          const xDistance = point.x - nearby.x;
          const yDistance = point.y - nearby.y;

          if (xDistance * xDistance + yDistance * yDistance < minDistanceSquared) {
            isTooClose = true;
            break;
          }
        }
      }

      if (isTooClose) continue;

      accepted.push(point);
      grid.set(gridKey(gridX, gridY), point);

      if (accepted.length >= maxLights) break;
    }

    return accepted;
  }

  function resizePandolCanvas() {
    if (!pandolLightCanvas) return;

    const rect = pandolLightCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dpr = window.devicePixelRatio || 1;
    pandolLightCanvas.width = Math.round(rect.width * dpr);
    pandolLightCanvas.height = Math.round(rect.height * dpr);

    if (!pandolLightCtx) {
      pandolLightCtx = pandolLightCanvas.getContext("2d");
    }

    if (pandolLightCtx) {
      pandolLightCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function extractLightPoints() {
    if (!pandolFrameImg || !pandolFrameImg.naturalWidth || !pandolFrameImg.naturalHeight) return [];

    const width = pandolFrameImg.naturalWidth;
    const height = pandolFrameImg.naturalHeight;
    const offscreen = document.createElement("canvas");
    const offscreenCtx = offscreen.getContext("2d", { willReadFrequently: true });
    const points = [];

    if (!offscreenCtx) return points;

    offscreen.width = width;
    offscreen.height = height;
    offscreenCtx.drawImage(pandolFrameImg, 0, 0, width, height);

    let pixels;

    try {
      pixels = offscreenCtx.getImageData(0, 0, width, height).data;
      pandolFrameWrapper?.classList.remove("light-fallback");
    } catch (error) {
      pandolFrameWrapper?.classList.add("light-fallback");
      return points;
    }

    for (let y = 0; y < height; y += pandolLightSettings.step) {
      for (let x = 0; x < width; x += pandolLightSettings.step) {
        const index = (y * width + x) * 4;
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        const a = pixels[index + 3];

        if (a < 140) continue;

        const brightness = (r + g + b) / 3;
        const saturation = Math.max(r, g, b) - Math.min(r, g, b);

        if (brightness < 125 && saturation < 80) continue;

        const light = classifyPixelColor(r, g, b);
        if (!light) continue;

        if ((light.type === "white" || light.type === "gold") && Math.random() < 0.55) continue;

        points.push({
          x,
          y,
          xRatio: x / width,
          yRatio: y / height,
          color: light.color,
          type: light.type,
          radius: getTightLightRadius(r, g, b),
          speed: 2.5 + Math.random() * 3.5,
          brightnessMultiplier: 1.2 + Math.random() * 0.8,
          phase: ((x * 0.021 + y * 0.037) % (Math.PI * 2)),
          sort: (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1
        });
      }
    }

    const lightPoints = reduceLightPoints(points, pandolLightSettings.minDistance, pandolLightSettings.maxLights);
    console.log("Pandol light points extracted:", lightPoints.length);

    if (lightPoints.length < 500) {
      console.warn("Pandol light point count is low; detection may still be too strict.");
    }

    if (DEBUG_LIGHTS) {
      console.log("Pandol light points:", lightPoints.length);
    }

    return lightPoints;
  }

  const getRenderedFrameRect = (width, height) => {
    if (!pandolFrameImg?.naturalWidth || !pandolFrameImg?.naturalHeight || !width || !height) {
      return { x: 0, y: 0, width, height };
    }

    const imageRatio = pandolFrameImg.naturalWidth / pandolFrameImg.naturalHeight;
    const canvasRatio = width / height;
    let renderedWidth = width;
    let renderedHeight = height;

    if (canvasRatio > imageRatio) {
      renderedHeight = height;
      renderedWidth = height * imageRatio;
    } else {
      renderedWidth = width;
      renderedHeight = width / imageRatio;
    }

    const objectPosition = window.getComputedStyle(pandolFrameImg).objectPosition;
    const x = (width - renderedWidth) / 2;
    let y = height - renderedHeight;

    if (objectPosition.includes("top") || objectPosition.includes("0%")) {
      y = 0;
    } else if (objectPosition.includes("center") || objectPosition.includes("50%")) {
      y = (height - renderedHeight) / 2;
    }

    return { x, y, width: renderedWidth, height: renderedHeight };
  };

  function drawGlowFrame(time) {
    if (!pandolLightCtx || !pandolLightCanvas || !pandolFrameImg || pandolLightPoints.length === 0) {
      pandolLightAnimationId = null;
      return;
    }

    const rect = pandolLightCanvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (!width || !height) {
      pandolLightAnimationId = null;
      return;
    }

    pandolLightCtx.clearRect(0, 0, width, height);

    if (body.classList.contains("lights-off")) {
      pandolLightAnimationId = null;
      return;
    }

    const frameRect = getRenderedFrameRect(width, height);
    const frameScale = Math.max(0.65, Math.min(1.2, frameRect.width / pandolFrameImg.naturalWidth));
    const brightnessBoost = currentPattern === 2 ? 1.12 : 1;
    const shouldAnimate = !reducedMotionQuery.matches && !body.classList.contains("animations-paused");
    const elapsed = shouldAnimate ? (time - pandolLightStartTime) / 1000 : 0;

    pandolLightCtx.globalCompositeOperation = "source-over";

    for (const point of pandolLightPoints) {
      const x = frameRect.x + point.xRatio * frameRect.width;
      const y = frameRect.y + point.yRatio * frameRect.height;
      const blink = shouldAnimate ? 0.65 + Math.sin(elapsed * point.speed + point.phase) * 0.22 : 0.76;
      const radius = (point.radius + (DEBUG_LIGHTS ? 2 : 0)) * frameScale * LIGHT_VISIBILITY_BOOST;
      const visibleRadius = radius * point.brightnessMultiplier;
      const offStrength = shouldAnimate ? Math.max(0, (0.78 - blink) / 0.35) : 0.18;

      if (offStrength <= 0.02) continue;

      const darkRadius = visibleRadius * 1.28;
      const darkGradient = pandolLightCtx.createRadialGradient(x, y, 0, x, y, darkRadius);

      darkGradient.addColorStop(0, `rgba(0, 0, 0, ${Math.min(OFF_BULB_DARKNESS, offStrength * OFF_BULB_DARKNESS)})`);
      darkGradient.addColorStop(0.68, `rgba(13, 8, 4, ${Math.min(0.22, offStrength * 0.22)})`);
      darkGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      pandolLightCtx.fillStyle = darkGradient;
      pandolLightCtx.beginPath();
      pandolLightCtx.arc(x, y, darkRadius, 0, Math.PI * 2);
      pandolLightCtx.fill();
    }

    pandolLightCtx.globalCompositeOperation = "lighter";

    for (const [index, point] of pandolLightPoints.entries()) {
      const x = frameRect.x + point.xRatio * frameRect.width;
      const y = frameRect.y + point.yRatio * frameRect.height;
      const blink = shouldAnimate ? 0.65 + Math.sin(elapsed * point.speed + point.phase) * 0.22 : 0.76;
      const radius = (point.radius + (DEBUG_LIGHTS ? 2 : 0)) * frameScale * blink * LIGHT_VISIBILITY_BOOST;
      const visibleRadius = radius * point.brightnessMultiplier;
      const outerRadius = visibleRadius * 1.45;
      const baseAlpha = getLightAlpha(point.color);
      const glowAlpha = Math.min(baseAlpha * (0.2 + blink * 0.28) * brightnessBoost, 0.38);
      const coreAlpha = Math.min(baseAlpha * (0.55 + blink * 0.35) * brightnessBoost, 0.62);
      const gradient = pandolLightCtx.createRadialGradient(x, y, 0, x, y, outerRadius);

      gradient.addColorStop(0, withLightAlpha(point.color, coreAlpha));
      gradient.addColorStop(0.48, withLightAlpha(point.color, glowAlpha));
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      pandolLightCtx.fillStyle = gradient;
      pandolLightCtx.beginPath();
      pandolLightCtx.arc(x, y, outerRadius, 0, Math.PI * 2);
      pandolLightCtx.fill();

      pandolLightCtx.fillStyle = withLightAlpha(point.color, coreAlpha);
      pandolLightCtx.beginPath();
      pandolLightCtx.arc(x, y, Math.max(0.6, visibleRadius * 0.38), 0, Math.PI * 2);
      pandolLightCtx.fill();

      if (DEBUG_LIGHTS && index % 18 === 0) {
        pandolLightCtx.fillStyle = "rgba(255, 255, 255, 0.28)";
        pandolLightCtx.beginPath();
        pandolLightCtx.arc(x, y, 1.1, 0, Math.PI * 2);
        pandolLightCtx.fill();
      }
    }

    pandolLightCtx.globalCompositeOperation = "source-over";

    if (shouldAnimate) {
      pandolLightAnimationId = requestAnimationFrame(drawGlowFrame);
    } else {
      pandolLightAnimationId = null;
    }
  }

  function startPandolLightAnimation() {
    if (!pandolLightCanvas || !pandolLightCtx || pandolLightPoints.length === 0 || body.classList.contains("lights-off")) return;

    if (!pandolLightStartTime) {
      pandolLightStartTime = performance.now();
    }

    if (reducedMotionQuery.matches || body.classList.contains("animations-paused")) {
      pausePandolLightAnimation();
      drawGlowFrame(performance.now());
      return;
    }

    if (!pandolLightAnimationId) {
      pandolLightAnimationId = requestAnimationFrame(drawGlowFrame);
    }
  }

  function pausePandolLightAnimation() {
    if (pandolLightAnimationId) {
      cancelAnimationFrame(pandolLightAnimationId);
      pandolLightAnimationId = null;
    }
  }

  function initPandolLights() {
    if (!pandolFrameWrapper || !pandolFrameImg || !pandolLightCanvas) return;

    pandolLightCtx = pandolLightCanvas.getContext("2d");
    if (!pandolLightCtx) return;

    const prepareLights = () => {
      resizePandolCanvas();
      pandolLightPoints = extractLightPoints();
      drawGlowFrame(performance.now());
      startPandolLightAnimation();
    };

    if (pandolFrameImg.complete && pandolFrameImg.naturalWidth > 0) {
      prepareLights();
    } else {
      pandolFrameImg.addEventListener("load", prepareLights, { once: true });
      pandolFrameImg.addEventListener("error", () => {
        pandolFrameWrapper.classList.add("light-fallback");
      }, { once: true });
    }

    if ("ResizeObserver" in window) {
      const resizeObserver = new ResizeObserver(() => {
        resizePandolCanvas();
        if (reducedMotionQuery.matches || body.classList.contains("animations-paused")) {
          drawGlowFrame(performance.now());
        }
      });

      resizeObserver.observe(pandolFrameWrapper);
    }

    reducedMotionQuery.addEventListener?.("change", () => {
      if (reducedMotionQuery.matches) {
        pausePandolLightAnimation();
        drawGlowFrame(performance.now());
      } else {
        startPandolLightAnimation();
      }
    });
  }

  // If the future image files exist they replace the CSS artwork; otherwise the fallback stays visible.
  const setupImageFallbacks = () => {
    document.querySelectorAll("[data-panel]").forEach((panel) => {
      const image = panel.querySelector(".story-image");
      if (!image) return;

      const markLoaded = () => {
        panel.classList.add("has-image");
      };

      const markMissing = () => {
        panel.classList.remove("has-image");
        image.setAttribute("aria-hidden", "true");
      };

      if (image.complete && image.naturalWidth > 0) {
        markLoaded();
      } else {
        image.addEventListener("load", markLoaded, { once: true });
        image.addEventListener("error", markMissing, { once: true });
      }
    });
  };

  const setPattern = (nextPattern) => {
    patterns.forEach((pattern) => body.classList.remove(pattern));
    currentPattern = nextPattern;
    body.classList.add(patterns[currentPattern]);

    if (patternToggle) {
      patternToggle.textContent = `Pattern: ${patternLabels[currentPattern]}`;
    }

    if (reducedMotionQuery.matches || body.classList.contains("animations-paused")) {
      drawGlowFrame(performance.now());
    }
  };

  const setupControls = () => {
    if (lightsToggle) {
      lightsToggle.addEventListener("click", () => {
        const lightsAreOff = body.classList.toggle("lights-off");
        pandolFrameWrapper?.classList.toggle("lights-off", lightsAreOff);
        lightsToggle.textContent = lightsAreOff ? "Lights Off" : "Lights On";
        lightsToggle.setAttribute("aria-pressed", String(!lightsAreOff));

        if (lightsAreOff) {
          pausePandolLightAnimation();
        } else {
          startPandolLightAnimation();
        }
      });
    }

    if (patternToggle) {
      patternToggle.addEventListener("click", () => {
        setPattern((currentPattern + 1) % patterns.length);
      });
    }

    if (songToggles.length > 0) {
      const setSongState = (isPlaying) => {
        songToggles.forEach((songToggle) => {
          songToggle.innerHTML = isPlaying ? songLabels.playing : songLabels.idle;
          songToggle.setAttribute("aria-pressed", String(isPlaying));
        });
      };

      songToggles.forEach((songToggle) => {
        songToggle.addEventListener("click", (event) => {
          event.preventDefault();

          if (bathiGeeAudio.paused) {
            bathiGeeAudio.play().then(() => setSongState(true)).catch(() => {
              setSongState(false);
            });
          } else {
            bathiGeeAudio.pause();
            setSongState(false);
          }
        });
      });

      bathiGeeAudio.addEventListener("ended", () => {
        setSongState(false);
      });
    }

    if (donationModal && donationOpenButtons.length > 0) {
      const openDonationModal = () => {
        donationModal.hidden = false;
        body.style.overflow = "hidden";
      };

      const closeDonationModal = () => {
        donationModal.hidden = true;
        body.style.overflow = "";
      };

      donationOpenButtons.forEach((button) => {
        button.addEventListener("click", openDonationModal);
      });

      donationCloseButtons.forEach((button) => {
        button.addEventListener("click", closeDonationModal);
      });

      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !donationModal.hidden) {
          closeDonationModal();
        }
      });
    }

    if (motionToggle) {
      motionToggle.addEventListener("click", () => {
        const isPaused = body.classList.toggle("animations-paused");
        motionToggle.textContent = isPaused ? "Resume Animation" : "Pause Animation";
        motionToggle.setAttribute("aria-pressed", String(isPaused));

        if (isPaused) {
          pausePandolLightAnimation();
          drawGlowFrame(performance.now());
        } else {
          startPandolLightAnimation();
        }
      });
    }
  };

  const debounce = (callback, delay) => {
    let timer;
    return () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(callback, delay);
    };
  };

  const rebuildResponsiveEffects = debounce(() => {
    buildStars();
    buildLanterns();
    buildBulbs();
    resizePandolCanvas();
    if (reducedMotionQuery.matches || body.classList.contains("animations-paused")) {
      drawGlowFrame(performance.now());
    }
  }, 250);

  buildStars();
  buildLanterns();
  buildBulbs();
  setupImageFallbacks();
  setupControls();
  setPattern(1);
  initPandolLights();

  window.addEventListener("resize", rebuildResponsiveEffects);
})();
