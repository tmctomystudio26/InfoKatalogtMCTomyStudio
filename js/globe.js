/**
 * Interactive 3D Orthographic Canvas Globe
 * Supports touch/pointer drag rotation, clicking target countries directly on the globe,
 * smooth spin-to-location animation, day/night terminator, and Indonesia-to-target arc.
 */

import { WORLD_LANDMASSES } from './globe-data.js';
import {
  WORLD_LOCATIONS,
  findNearestLocationOnGlobe,
  normalizeLongitude,
  projectOrthographic,
} from './tools-logic.js';

export function createInteractiveGlobe(canvas, {
  initialTargetId = 'jp',
  onSelectLocation = () => {},
  onHoverLocation = () => {},
} = {}) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  let centerLat = 5;
  let centerLon = 112;
  let targetId = initialTargetId;
  let hoveredId = null;
  let autoRotate = false;
  let isDragging = false;
  let pointerMovedPx = 0;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let animTarget = null;
  let rafId = null;
  let destroyed = false;

  const indonesiaLoc = WORLD_LOCATIONS.find((l) => l.id === 'id-wib') || WORLD_LOCATIONS[0];

  function getMetrics() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(260, rect.width || canvas.clientWidth || 340);
    const height = Math.max(260, rect.height || canvas.clientHeight || 340);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.43;
    return { width, height, dpr, cx, cy, radius };
  }

  function isDarkTheme() {
    return document.documentElement.getAttribute('data-theme') !== 'light';
  }

  function drawGreatCircleArc(lat1, lon1, lat2, lon2, cx, cy, radius) {
    const steps = 36;
    const toRad = Math.PI / 180;
    const p1 = lat1 * toRad;
    const l1 = lon1 * toRad;
    const p2 = lat2 * toRad;
    const l2 = lon2 * toRad;

    const x1 = Math.cos(p1) * Math.cos(l1);
    const y1 = Math.cos(p1) * Math.sin(l1);
    const z1 = Math.sin(p1);
    const x2 = Math.cos(p2) * Math.cos(l2);
    const y2 = Math.cos(p2) * Math.sin(l2);
    const z2 = Math.sin(p2);

    const dot = Math.max(-1, Math.min(1, x1 * x2 + y1 * y2 + z1 * z2));
    const omega = Math.acos(dot);
    if (omega < 0.01) return;

    ctx.save();
    ctx.beginPath();
    let penDown = false;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const sinO = Math.sin(omega);
      const a = Math.sin((1 - t) * omega) / sinO;
      const b = Math.sin(t * omega) / sinO;
      const x = a * x1 + b * x2;
      const y = a * y1 + b * y2;
      const z = a * z1 + b * z2;
      const lat = Math.atan2(z, Math.hypot(x, y)) * (180 / Math.PI);
      const lon = Math.atan2(y, x) * (180 / Math.PI);
      const proj = projectOrthographic(lat, lon, centerLat, centerLon, radius, cx, cy);
      if (proj.visible) {
        if (!penDown) {
          ctx.moveTo(proj.x, proj.y);
          penDown = true;
        } else {
          ctx.lineTo(proj.x, proj.y);
        }
      } else {
        penDown = false;
      }
    }
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.restore();
  }

  function render() {
    if (destroyed) return;
    const { width, height, dpr, cx, cy, radius } = getMetrics();
    const dark = isDarkTheme();

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Subtle outer atmosphere halo
    const haloGrad = ctx.createRadialGradient(cx, cy, radius * 0.85, cx, cy, radius * 1.14);
    haloGrad.addColorStop(0, dark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(37, 99, 235, 0.16)');
    haloGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.14, 0, Math.PI * 2);
    ctx.fill();

    // Ocean Sphere
    const oceanGrad = ctx.createRadialGradient(
      cx - radius * 0.3,
      cy - radius * 0.3,
      radius * 0.12,
      cx,
      cy,
      radius
    );
    if (dark) {
      oceanGrad.addColorStop(0, '#16355b');
      oceanGrad.addColorStop(0.55, '#0c203d');
      oceanGrad.addColorStop(1, '#071225');
    } else {
      oceanGrad.addColorStop(0, '#38bdf8');
      oceanGrad.addColorStop(0.55, '#0284c7');
      oceanGrad.addColorStop(1, '#0f3c68');
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = oceanGrad;
    ctx.fill();
    ctx.clip();

    // Graticule meridians and parallels
    ctx.strokeStyle = dark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(255, 255, 255, 0.24)';
    ctx.lineWidth = 0.8;

    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let started = false;
      for (let lon = -180; lon <= 180; lon += 6) {
        const p = projectOrthographic(lat, lon, centerLat, centerLon, radius, cx, cy);
        if (p.visible) {
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else {
            ctx.lineTo(p.x, p.y);
          }
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }

    for (let lon = -180; lon < 180; lon += 30) {
      ctx.beginPath();
      let started = false;
      for (let lat = -84; lat <= 84; lat += 6) {
        const p = projectOrthographic(lat, lon, centerLat, centerLon, radius, cx, cy);
        if (p.visible) {
          if (!started) {
            ctx.moveTo(p.x, p.y);
            started = true;
          } else {
            ctx.lineTo(p.x, p.y);
          }
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }

    // World Landmasses (Clipped cleanly to visible hemisphere with horizon projection)
    ctx.fillStyle = dark ? '#1f4b43' : '#d1fae5';
    ctx.strokeStyle = dark ? '#34d399' : '#059669';
    ctx.lineWidth = 1.1;

    for (const ring of WORLD_LANDMASSES) {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < ring.length; i += 1) {
        const [lon, lat] = ring[i];
        const p = projectOrthographic(lat, lon, centerLat, centerLon, radius, cx, cy);
        // Clamp back-hemisphere vertices onto horizon rim so continents never invert
        let drawX = p.x;
        let drawY = p.y;
        if (!p.visible) {
          const dx = p.x - cx;
          const dy = p.y - cy;
          const len = Math.hypot(dx, dy) || 1;
          drawX = cx + (dx / len) * radius;
          drawY = cy + (dy / len) * radius;
        }
        if (!started) {
          ctx.moveTo(drawX, drawY);
          started = true;
        } else {
          ctx.lineTo(drawX, drawY);
        }
      }
      ctx.closePath();
      // Only fill polygons that have at least one visible vertex on front hemisphere
      const hasVisible = ring.some(
        ([lon, lat]) => projectOrthographic(lat, lon, centerLat, centerLon, radius, cx, cy).visible
      );
      if (hasVisible) {
        ctx.fill();
        ctx.stroke();
      }
    }

    // Connection Arc between Indonesia (WIB) and Target Country
    const selectedLoc = WORLD_LOCATIONS.find((l) => l.id === targetId);
    if (selectedLoc && selectedLoc.id !== indonesiaLoc.id) {
      drawGreatCircleArc(
        indonesiaLoc.lat,
        indonesiaLoc.lon,
        selectedLoc.lat,
        selectedLoc.lon,
        cx,
        cy,
        radius
      );
    }

    ctx.restore(); // end sphere clip

    // Sphere Rim Border
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = dark ? 'rgba(56, 189, 248, 0.45)' : 'rgba(14, 165, 233, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw Target Country Markers (drawn outside clip so labels stay readable)
    const visibleMarkers = [];
    for (const loc of WORLD_LOCATIONS) {
      const p = projectOrthographic(loc.lat, loc.lon, centerLat, centerLon, radius, cx, cy);
      if (!p.visible || p.z < 0.08) continue;
      visibleMarkers.push({ loc, p });
    }

    // Sort back-to-front so selected marker sits on top
    visibleMarkers.sort((a, b) => a.p.z - b.p.z);

    for (const { loc, p } of visibleMarkers) {
      const isSelected = loc.id === targetId;
      const isHovered = loc.id === hoveredId;
      const isId = loc.id.startsWith('id-');

      const pinRadius = isSelected ? 6.5 : isHovered ? 5.5 : isId ? 4.5 : 3.6;

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(245, 158, 11, 0.28)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, pinRadius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected
        ? '#f59e0b'
        : isId
        ? '#38bdf8'
        : isHovered
        ? '#ffffff'
        : '#a5f3fc';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#090d16';
      ctx.stroke();

      // Label for selected, hovered, or high-visibility central pins
      if (isSelected || isHovered || (p.z > 0.72 && (loc.id === 'id-wib' || loc.id === 'gb' || loc.id === 'us-ny' || loc.id === 'jp' || loc.id === 'sa' || loc.id === 'au-syd'))) {
        const label = isSelected ? `${loc.country}` : loc.city;
        ctx.font = isSelected
          ? '700 12px "Plus Jakarta Sans", sans-serif'
          : '600 10.5px "Plus Jakarta Sans", sans-serif';
        const textW = ctx.measureText(label).width;
        const padX = 6;
        const boxW = textW + padX * 2;
        const boxH = 20;
        const boxX = Math.max(4, Math.min(width - boxW - 4, p.x - boxW / 2));
        const boxY = p.y - pinRadius - boxH - 5;

        ctx.fillStyle = isSelected
          ? 'rgba(245, 158, 11, 0.95)'
          : dark
          ? 'rgba(9, 13, 22, 0.86)'
          : 'rgba(255, 255, 255, 0.92)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 6);
        ctx.fill();

        ctx.fillStyle = isSelected ? '#090d16' : dark ? '#f8fafc' : '#0f172a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, boxX + boxW / 2, boxY + boxH / 2 + 0.5);
      }
    }

    ctx.restore();
    canvas.dataset.centerLon = String(Math.round(centerLon));
    canvas.dataset.centerLat = String(Math.round(centerLat));
    canvas.dataset.targetId = targetId;
  }

  function stepAnimation() {
    if (destroyed) return;
    let needsMore = false;

    if (animTarget) {
      const dLat = animTarget.lat - centerLat;
      let dLon = normalizeLongitude(animTarget.lon - centerLon);
      if (Math.abs(dLat) < 0.3 && Math.abs(dLon) < 0.3) {
        centerLat = animTarget.lat;
        centerLon = normalizeLongitude(animTarget.lon);
        animTarget = null;
      } else {
        centerLat += dLat * 0.16;
        centerLon = normalizeLongitude(centerLon + dLon * 0.16);
        needsMore = true;
      }
    } else if (autoRotate && !isDragging) {
      centerLon = normalizeLongitude(centerLon + 0.25);
      needsMore = true;
    }

    render();
    if (needsMore) {
      rafId = requestAnimationFrame(stepAnimation);
    } else {
      rafId = null;
    }
  }

  function ensureAnimLoop() {
    if (!rafId) {
      rafId = requestAnimationFrame(stepAnimation);
    }
  }

  function getCanvasCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      px: clientX - rect.left,
      py: clientY - rect.top,
    };
  }

  const onPointerDown = (e) => {
    isDragging = true;
    pointerMovedPx = 0;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    animTarget = null;
    canvas.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const { px, py } = getCanvasCoords(e.clientX, e.clientY);
    const { cx, cy, radius } = getMetrics();

    if (isDragging) {
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY;
      pointerMovedPx += Math.hypot(dx, dy);
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;

      centerLon = normalizeLongitude(centerLon - dx * 0.42);
      centerLat = Math.max(-72, Math.min(72, centerLat + dy * 0.38));
      render();
      return;
    }

    const hit = findNearestLocationOnGlobe(
      px,
      py,
      WORLD_LOCATIONS,
      centerLat,
      centerLon,
      radius,
      cx,
      cy,
      24
    );
    const nextHover = hit?.location?.id || null;
    canvas.style.cursor = nextHover ? 'pointer' : 'grab';
    if (nextHover !== hoveredId) {
      hoveredId = nextHover;
      onHoverLocation(hit?.location || null);
      render();
    }
  };

  const onPointerUp = (e) => {
    if (!isDragging) return;
    isDragging = false;
    canvas.releasePointerCapture?.(e.pointerId);

    // Click / tap if pointer barely moved
    if (pointerMovedPx < 7) {
      const { px, py } = getCanvasCoords(e.clientX, e.clientY);
      const { cx, cy, radius } = getMetrics();
      const hit = findNearestLocationOnGlobe(
        px,
        py,
        WORLD_LOCATIONS,
        centerLat,
        centerLon,
        radius,
        cx,
        cy,
        30
      );
      if (hit?.location) {
        targetId = hit.location.id;
        animTarget = { lat: Math.max(-60, Math.min(60, hit.location.lat)), lon: hit.location.lon };
        onSelectLocation(hit.location);
        ensureAnimLoop();
      }
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('resize', render);

  // Initial render centered cleanly between Indonesia & target
  const initialLoc = WORLD_LOCATIONS.find((l) => l.id === initialTargetId);
  if (initialLoc) {
    centerLat = Math.max(-55, Math.min(55, initialLoc.lat));
    centerLon = initialLoc.lon;
  }
  render();

  return {
    setTarget(id, { animate = true } = {}) {
      const loc = WORLD_LOCATIONS.find((l) => l.id === id);
      if (!loc) return;
      targetId = loc.id;
      if (animate) {
        animTarget = { lat: Math.max(-60, Math.min(60, loc.lat)), lon: loc.lon };
        ensureAnimLoop();
      } else {
        centerLat = Math.max(-60, Math.min(60, loc.lat));
        centerLon = loc.lon;
        render();
      }
    },
    toggleAutoRotate(nextState) {
      autoRotate = typeof nextState === 'boolean' ? nextState : !autoRotate;
      if (autoRotate) ensureAnimLoop();
      return autoRotate;
    },
    resetToIndonesia() {
      this.setTarget('id-wib', { animate: true });
      onSelectLocation(indonesiaLoc);
    },
    redraw() {
      render();
    },
    destroy() {
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', render);
    },
  };
}
