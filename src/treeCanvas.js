import { OILS, OIL_MAP } from './constants.js';

export class PassiveTreeCanvas {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cb = callbacks;

    this.tree = null;
    this.nodeMap = new Map();
    this.notableMap = new Map();

    // Pre-indexed geometry buckets for fast viewport-culled batched rendering
    this.smallNodes = [];
    this.startNodes = [];
    this.keystoneNodes = [];
    this.jewelNodes = [];
    this.notableNodes = [];
    this.resolvedEdges = [];

    // Sprite sheets & Oil icon caches (loaded cleanly in browser)
    this.sheets = {};
    this.oilImages = new Map();

    // View camera in world coordinates -> screen = (world - cam) * scale + center
    this.camX = 0;
    this.camY = 0;
    this.scale = 0.055;
    this.minScale = 0.025;
    this.maxScale = 0.45;

    this.state = {
      poolIds: new Set(),
      targetIds: new Set(),
      rolledIds: new Set(),
      rolledNotables: [],
    };

    this.hoveredItem = null;
    this.isDragging = false;
    this.dragMoved = false;
    this.lastMouse = { x: 0, y: 0 };

    this._raf = 0;
    this._bindEvents();
  }

  setTreeData(tree) {
    this.tree = tree;
    this.nodeMap.clear();
    this.notableMap.clear();

    this.smallNodes = [];
    this.startNodes = [];
    this.keystoneNodes = [];
    this.jewelNodes = [];
    this.notableNodes = [];
    this.resolvedEdges = [];

    for (const n of tree.nodes || []) {
      this.nodeMap.set(n.id, n);
      if (n.kind === 'notable') {
        this.notableNodes.push(n);
      } else if (n.kind === 'small') {
        this.smallNodes.push(n);
      } else if (n.kind === 'start') {
        this.startNodes.push(n);
      } else if (n.kind === 'keystone') {
        this.keystoneNodes.push(n);
      } else if (n.kind === 'jewel' || n.kind === 'outerJewel') {
        this.jewelNodes.push(n);
      }
    }
    for (const nb of tree.notables || []) {
      this.notableMap.set(nb.id, nb);
    }

    const groupCenters = tree.groupCenters || {};
    for (const [aId, bId, isCurved] of tree.edges || []) {
      const a = this.nodeMap.get(aId);
      const b = this.nodeMap.get(bId);
      if (!a || !b) continue;

      if (isCurved === 1) {
        const gc = groupCenters[a.group];
        const r = gc?.radii?.[a.orbit];
        if (gc && r > 0) {
          const angA = Math.atan2(a.y - gc.y, a.x - gc.x);
          const angB = Math.atan2(b.y - gc.y, b.x - gc.x);
          let d = angB - angA;
          if (d > Math.PI) d -= 2 * Math.PI;
          if (d < -Math.PI) d += 2 * Math.PI;
          const margin = r * 0.25;
          this.resolvedEdges.push({
            ax: a.x,
            ay: a.y,
            bx: b.x,
            by: b.y,
            minX: Math.min(a.x, b.x) - margin,
            maxX: Math.max(a.x, b.x) + margin,
            minY: Math.min(a.y, b.y) - margin,
            maxY: Math.max(a.y, b.y) + margin,
            curved: true,
            gx: gc.x,
            gy: gc.y,
            r,
            angA,
            angEnd: angA + d,
            ccw: d < 0,
          });
          continue;
        }
      }

      this.resolvedEdges.push({
        ax: a.x,
        ay: a.y,
        bx: b.x,
        by: b.y,
        minX: Math.min(a.x, b.x),
        maxX: Math.max(a.x, b.x),
        minY: Math.min(a.y, b.y),
        maxY: Math.max(a.y, b.y),
        curved: false,
      });
    }

    this._loadVisualAssets(tree);
    this.fitTree();
    this.requestRender();
  }

  _loadVisualAssets(tree) {
    const sheets = tree?.sprites?.sheets;
    if (sheets) {
      for (const [key, src] of Object.entries(sheets)) {
        if (this.sheets[key]) continue;
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => this.requestRender();
        img.src = src;
        this.sheets[key] = img;
      }
    }

    for (const oil of OILS) {
      if (this.oilImages.has(oil.id)) continue;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => this.requestRender();
      img.src = `./assets/oils/${oil.id}.png`;
      this.oilImages.set(oil.id, img);
    }
  }

  _isImgReady(img) {
    return Boolean(img && img.complete && img.naturalWidth > 0);
  }

  setState(nextState) {
    this.state = { ...this.state, ...nextState };
    this.requestRender();
  }

  fitTree() {
    const b = this.tree?.meta?.bounds;
    if (!b) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(320, rect.width || window.innerWidth);
    const h = Math.max(320, rect.height || window.innerHeight);
    const spanX = b.maxX - b.minX + 3200;
    const spanY = b.maxY - b.minY + 3200;
    this.scale = Math.max(this.minScale, Math.min(w / spanX, h / spanY));
    this.camX = (b.minX + b.maxX) / 2;
    this.camY = (b.minY + b.maxY) / 2;
    this.requestRender();
  }

  focusPoint(wx, wy, targetScale = 0.14) {
    if (!Number.isFinite(wx) || !Number.isFinite(wy)) return;
    this.camX = wx;
    this.camY = wy;
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, targetScale));
    this.requestRender();
  }

  worldToScreen(wx, wy) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (wx - this.camX) * this.scale + rect.width / 2,
      y: (wy - this.camY) * this.scale + rect.height / 2,
    };
  }

  screenToWorld(sx, sy) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (sx - rect.width / 2) / this.scale + this.camX,
      y: (sy - rect.height / 2) / this.scale + this.camY,
    };
  }

  _hitTest(sx, sy) {
    const { x: wx, y: wy } = this.screenToWorld(sx, sy);
    const hitPad = 14 / this.scale;

    let bestNotable = null;
    let bestDist = Infinity;
    for (const nb of this.tree?.notables || []) {
      if (!Number.isFinite(nb.x) || !Number.isFinite(nb.y)) continue;
      const d = Math.hypot(wx - nb.x, wy - nb.y);
      const r = 64 + hitPad;
      if (d <= r && d < bestDist) {
        bestDist = d;
        bestNotable = nb;
      }
    }
    if (bestNotable) {
      return { type: 'notable', item: bestNotable };
    }

    return null;
  }

  _bindEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.isDragging = true;
      this.dragMoved = false;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (this.isDragging) {
        const dx = e.clientX - this.lastMouse.x;
        const dy = e.clientY - this.lastMouse.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          this.dragMoved = true;
        }
        this.camX -= dx / this.scale;
        this.camY -= dy / this.scale;
        this.lastMouse = { x: e.clientX, y: e.clientY };
        this.requestRender();
        this.cb.onHover?.(null, e.clientX, e.clientY);
        return;
      }

      if (sx >= 0 && sy >= 0 && sx <= rect.width && sy <= rect.height) {
        const hit = this._hitTest(sx, sy);
        this.hoveredItem = hit;
        this.canvas.style.cursor = hit ? 'pointer' : 'grab';
        this.cb.onHover?.(hit, e.clientX, e.clientY);
      } else {
        this.cb.onHover?.(null, e.clientX, e.clientY);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.canvas.style.cursor = this.hoveredItem ? 'pointer' : 'grab';
      if (this.dragMoved) return;

      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      if (sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) return;

      const hit = this._hitTest(sx, sy);
      if (hit?.type === 'notable') {
        this.cb.onToggleTarget?.(hit.item.id);
      }
    });

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const before = this.screenToWorld(sx, sy);
        const factor = e.deltaY < 0 ? 1.14 : 1 / 1.14;
        this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * factor));
        const after = this.screenToWorld(sx, sy);
        this.camX += before.x - after.x;
        this.camY += before.y - after.y;
        this.requestRender();
      },
      { passive: false }
    );

    const ro = new ResizeObserver(() => this._resize());
    ro.observe(this.canvas);
    this._resize();
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.requestRender();
    }
  }

  requestRender() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this.render();
    });
  }

  render() {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background radial obsidian gradient
    const bgGrad = ctx.createRadialGradient(cw * 0.5, ch * 0.5, 40, cw * 0.5, ch * 0.5, Math.max(cw, ch) * 0.72);
    bgGrad.addColorStop(0, '#0e131b');
    bgGrad.addColorStop(1, '#06080c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cw, ch);

    if (!this.tree) {
      ctx.restore();
      return;
    }

    const halfW = cw / (2 * this.scale);
    const halfH = ch / (2 * this.scale);
    const pad = 320 / this.scale + 220;
    const bounds = {
      minX: this.camX - halfW - pad,
      maxX: this.camX + halfW + pad,
      minY: this.camY - halfH - pad,
      maxY: this.camY + halfH + pad,
    };

    ctx.translate(cw / 2, ch / 2);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-this.camX, -this.camY);

    this._drawEdges(ctx, bounds);
    this._drawTreeNodes(ctx, bounds);

    ctx.restore();
  }

  _drawEdges(ctx, bounds) {
    ctx.lineWidth = Math.max(11, 1.5 / this.scale);
    ctx.strokeStyle = 'rgba(130, 145, 170, 0.34)';
    ctx.beginPath();

    for (const e of this.resolvedEdges) {
      if (e.maxX < bounds.minX || e.minX > bounds.maxX || e.maxY < bounds.minY || e.minY > bounds.maxY) {
        continue;
      }
      ctx.moveTo(e.ax, e.ay);
      if (e.curved) {
        ctx.arc(e.gx, e.gy, e.r, e.angA, e.angEnd, e.ccw);
      } else {
        ctx.lineTo(e.bx, e.by);
      }
    }
    ctx.stroke();
  }

  _drawBatchedCircles(ctx, nodes, bounds, radius, fillStyle, strokeStyle, lineWidth) {
    if (!nodes || nodes.length === 0) return;
    ctx.fillStyle = fillStyle;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    for (const n of nodes) {
      if (n.x < bounds.minX || n.x > bounds.maxX || n.y < bounds.minY || n.y > bounds.maxY) continue;
      ctx.moveTo(n.x + radius, n.y);
      ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
  }

  _drawClippedSprite(ctx, img, coord, cx, cy, zoom, clipRatio = 0.48) {
    const dw = coord.w / zoom;
    const dh = coord.h / zoom;
    const r = Math.min(dw, dh) * clipRatio;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, coord.x, coord.y, coord.w, coord.h, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.restore();
  }

  _drawFrameSprite(ctx, frameImg, frameCoord, cx, cy, zoom) {
    const fw = frameCoord.w / zoom;
    const fh = frameCoord.h / zoom;
    ctx.drawImage(frameImg, frameCoord.x, frameCoord.y, frameCoord.w, frameCoord.h, cx - fw / 2, cy - fh / 2, fw, fh);
  }

  _drawTreeNodes(ctx, bounds) {
    const { poolIds, targetIds, rolledIds, rolledNotables } = this.state;
    const zoomShowLabels = this.scale >= 0.095;
    const rolledSlotById = new Map();
    (rolledNotables || []).forEach((item, idx) => {
      if (item && !rolledSlotById.has(item.id)) {
        rolledSlotById.set(item.id, idx + 1);
      }
    });

    // Fast batched vector passes for non-notable structural nodes (zero icon sprites / clip overhead)
    this._drawBatchedCircles(ctx, this.smallNodes, bounds, 15, '#1e2736', 'rgba(148, 163, 184, 0.35)', 4);
    this._drawBatchedCircles(ctx, this.startNodes, bounds, 34, '#121822', 'rgba(148, 163, 184, 0.42)', 7);
    this._drawBatchedCircles(ctx, this.keystoneNodes, bounds, 32, '#141923', 'rgba(185, 141, 75, 0.35)', 6);

    if (this.jewelNodes.length > 0) {
      ctx.fillStyle = '#141821';
      ctx.strokeStyle = 'rgba(195, 160, 95, 0.48)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (const n of this.jewelNodes) {
        if (n.x < bounds.minX || n.x > bounds.maxX || n.y < bounds.minY || n.y > bounds.maxY) continue;
        ctx.rect(n.x - 22, n.y - 22, 44, 44);
      }
      ctx.fill();
      ctx.stroke();
    }

    const sp = this.tree.sprites;
    const spZoom = sp?.zoom || 0.2972;
    const activeImg = this.sheets.active;
    const inactiveImg = this.sheets.inactive;
    const frameImg = this.sheets.frame;
    const activeReady = this._isImgReady(activeImg);
    const inactiveReady = this._isImgReady(inactiveImg);
    const frameReady = this._isImgReady(frameImg);
    const frameCoords = sp?.frame || {};

    for (const n of this.notableNodes) {
      if (n.x < bounds.minX || n.x > bounds.maxX || n.y < bounds.minY || n.y > bounds.maxY) continue;

      // Notable node
      const inPool = poolIds.has(n.id);
      const isTarget = targetIds.has(n.id);
      const rolledSlot = rolledSlotById.get(n.id) || 0;
      const isRolled = rolledSlot > 0 || rolledIds.has(n.id);
      const isJackpot = isTarget && isRolled;
      const isHovered = this.hoveredItem?.type === 'notable' && this.hoveredItem.item.id === n.id;
      const isHiddenAnoint = Boolean(n.isBlighted);
      const highlighted = inPool || isTarget || isRolled || isHovered;

      const iconCoord = highlighted
        ? sp?.notableActive?.[n.icon] ||
          sp?.keystoneActive?.[n.icon] ||
          sp?.notableInactive?.[n.icon] ||
          sp?.keystoneInactive?.[n.icon]
        : sp?.notableInactive?.[n.icon] || sp?.keystoneInactive?.[n.icon];
      const iconSheet = highlighted && activeReady ? activeImg : inactiveImg;
      const iconSheetReady = highlighted ? activeReady || inactiveReady : inactiveReady;

      let notableFrame;
      if (isHiddenAnoint && n.isKeystone) {
        notableFrame = highlighted
          ? frameCoords.KeystoneFrameAllocated
          : frameCoords.KeystoneFrameUnallocated;
      } else if (isHiddenAnoint) {
        notableFrame = highlighted
          ? frameCoords.BlightedNotableFrameAllocated
          : frameCoords.BlightedNotableFrameUnallocated;
      } else {
        notableFrame = highlighted
          ? frameCoords.NotableFrameAllocated
          : frameCoords.NotableFrameUnallocated;
      }

      const ringR = 78;

      if (isTarget || isRolled || isHovered || isHiddenAnoint) {
        ctx.fillStyle = isJackpot
          ? 'rgba(74, 222, 128, 0.30)'
          : isRolled
            ? 'rgba(34, 211, 238, 0.28)'
            : isTarget
              ? inPool
                ? 'rgba(251, 191, 36, 0.25)'
                : 'rgba(244, 63, 94, 0.24)'
              : isHovered
                ? 'rgba(34, 211, 238, 0.18)'
                : 'rgba(168, 85, 247, 0.24)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, ringR + 36, 0, Math.PI * 2);
        ctx.fill();
      }

      if (iconSheetReady && frameReady && iconCoord && notableFrame) {
        this._drawClippedSprite(ctx, iconSheet, iconCoord, n.x, n.y, spZoom, 0.47);
        this._drawFrameSprite(ctx, frameImg, notableFrame, n.x, n.y, spZoom);
      } else {
        ctx.fillStyle = highlighted ? '#1e293b' : '#151922';
        ctx.strokeStyle = 'rgba(138, 120, 90, 0.42)';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 44, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Highlight status ring around the PoE frame
      if (inPool && !isTarget && !isRolled) {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(n.x, n.y, ringR, 0, Math.PI * 2);
        ctx.stroke();
      } else if (isHiddenAnoint && !inPool && !isTarget && !isRolled) {
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.65)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(n.x, n.y, ringR, 0, Math.PI * 2);
        ctx.stroke();
      } else if (isTarget && !isRolled) {
        ctx.strokeStyle = inPool ? '#fbbf24' : '#f43f5e';
        ctx.lineWidth = 13;
        ctx.beginPath();
        ctx.arc(n.x, n.y, ringR + 4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (isRolled) {
        ctx.strokeStyle = isJackpot ? '#4ade80' : '#22d3ee';
        ctx.lineWidth = 13;
        ctx.beginPath();
        ctx.arc(n.x, n.y, ringR + 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = isJackpot ? '#fbbf24' : '#67e8f9';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(n.x, n.y, ringR + 20, 0, Math.PI * 2);
        ctx.stroke();

        if (rolledSlot > 0) {
          const badgeR = Math.max(30, Math.min(84, 10.5 / this.scale));
          const bx = n.x + (ringR + 10) * 0.85;
          const by = n.y - (ringR + 10) * 0.85;
          ctx.fillStyle = isJackpot ? '#14532d' : '#082f49';
          ctx.strokeStyle = isJackpot ? '#fbbf24' : '#22d3ee';
          ctx.lineWidth = Math.max(5, badgeR * 0.16);
          ctx.beginPath();
          ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.font = `700 ${Math.round(badgeR * 1.25)}px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#f8fafc';
          ctx.fillText(String(rolledSlot), bx, by + 2);
        }
      }

      // Oil icons below target / rolled / zoomed-in pool or hidden notables
      if ((isTarget || isRolled || ((inPool || isHiddenAnoint) && zoomShowLabels)) && n.recipe) {
        const oilY = n.y + ringR + 30;
        for (let idx = 0; idx < 3; idx++) {
          const oilId = n.recipe[idx];
          const oilImg = this.oilImages.get(oilId);
          const ox = n.x + (idx - 1) * 44;
          if (this._isImgReady(oilImg)) {
            ctx.drawImage(oilImg, ox - 20, oilY - 20, 40, 40);
          } else {
            const oil = OIL_MAP.get(oilId);
            ctx.fillStyle = oil?.color || '#fff';
            ctx.beginPath();
            ctx.arc(ox, oilY, 12, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      if (isTarget || isRolled || isHovered || ((inPool || isHiddenAnoint) && zoomShowLabels)) {
        ctx.font = `600 ${Math.max(56, Math.round(11.5 / this.scale))}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(6, 8, 12, 0.9)';
        ctx.fillText(n.name, n.x + 2, n.y - ringR - 22);
        ctx.fillStyle = isJackpot
          ? '#86efac'
          : isRolled
            ? '#67e8f9'
            : isTarget
              ? '#fde68a'
              : inPool
                ? '#d1fae5'
                : '#e9d5ff';
        ctx.fillText(n.name, n.x, n.y - ringR - 24);
      }
    }
  }
}
