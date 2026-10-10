/* ============================================================
   Pleom — Dot grid background effect (archived, not in active use)

   To re-enable:
   1. Add <canvas id="dot-grid"></canvas> as the first child of <body>.
   2. Add the #dot-grid rule from dot-grid.css to style.css.
   3. Include this script (or paste this IIFE back into main.js).
   ============================================================ */

(function () {
  "use strict";

  var canvas = document.getElementById("dot-grid");
  if (canvas && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var ctx = canvas.getContext("2d");

    var SPACING = 34;
    var BASE_R = 1.4;
    var MAX_R = 4.4;
    var RADIUS = 140; // influence radius around each trail point
    var LERP_IN = 0.26; // how fast a dot swells as the trail passes over it
    var LERP_OUT = 0.045; // how slowly a dot deflates back down
    var TRAIL_DECAY = 0.945; // per-frame life decay of a trail point
    var TRAIL_MIN_DIST = 10; // px moved before a new trail point is dropped
    var TRAIL_MAX = 22;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var width = 0;
    var height = 0;
    var cols = 0;
    var rows = 0;
    var radii = []; // current animated radius per dot
    var target = []; // target radius per dot

    var pointer = { x: -9999, y: -9999, active: false };
    var trail = []; // {x, y, life} — recent pointer positions, fading out
    var looping = false;
    var lastBounds = null; // {minCol,maxCol,minRow,maxRow} touched by the previous frame
    var padX = 0;
    var padY = 0;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.ceil(width / SPACING) + 1;
      rows = Math.ceil(height / SPACING) + 1;
      padX = (width - (cols - 1) * SPACING) / 2;
      padY = (height - (rows - 1) * SPACING) / 2;
      var total = cols * rows;
      radii = new Float32Array(total).fill(BASE_R);
      target = new Float32Array(total).fill(BASE_R);
      lastBounds = null;
      trail.length = 0;
      drawStatic();
    }

    function drawStatic() {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#bfbfbf";
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          ctx.beginPath();
          ctx.arc(padX + c * SPACING, padY + r * SPACING, BASE_R, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function boundsAt(px, py) {
      return {
        minCol: Math.max(0, Math.floor((px - RADIUS - padX) / SPACING)),
        maxCol: Math.min(cols - 1, Math.ceil((px + RADIUS - padX) / SPACING)),
        minRow: Math.max(0, Math.floor((py - RADIUS - padY) / SPACING)),
        maxRow: Math.min(rows - 1, Math.ceil((py + RADIUS - padY) / SPACING))
      };
    }

    function trailBounds() {
      var b = null;
      for (var k = 0; k < trail.length; k++) {
        b = unionBounds(b, boundsAt(trail[k].x, trail[k].y));
      }
      return b;
    }

    function unionBounds(a, b) {
      if (!a) return b;
      if (!b) return a;
      return {
        minCol: Math.min(a.minCol, b.minCol),
        maxCol: Math.max(a.maxCol, b.maxCol),
        minRow: Math.min(a.minRow, b.minRow),
        maxRow: Math.max(a.maxRow, b.maxRow)
      };
    }

    function ensureLoop() {
      if (!looping) {
        looping = true;
        requestAnimationFrame(frame);
      }
    }

    function onPointerMove(e) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;

      var lastPoint = trail[trail.length - 1];
      if (!lastPoint || Math.hypot(pointer.x - lastPoint.x, pointer.y - lastPoint.y) >= TRAIL_MIN_DIST) {
        trail.push({ x: pointer.x, y: pointer.y, life: 1 });
        if (trail.length > TRAIL_MAX) trail.shift();
      }

      ensureLoop();
    }

    function onPointerLeave() {
      pointer.active = false;
      ensureLoop();
    }

    function frame() {
      // age the trail and drop points that have faded out
      for (var k = trail.length - 1; k >= 0; k--) {
        trail[k].life *= TRAIL_DECAY;
        if (trail[k].life < 0.03) trail.splice(k, 1);
      }

      var pointBounds = trailBounds();
      var regionBounds = pointBounds || lastBounds;
      if (!regionBounds) {
        looping = false;
        return;
      }

      var clearBounds = unionBounds(lastBounds, regionBounds);
      var margin = MAX_R + 2;
      var rectX = padX + clearBounds.minCol * SPACING - margin;
      var rectY = padY + clearBounds.minRow * SPACING - margin;
      var rectW = (clearBounds.maxCol - clearBounds.minCol) * SPACING + margin * 2;
      var rectH = (clearBounds.maxRow - clearBounds.minRow) * SPACING + margin * 2;
      ctx.clearRect(rectX, rectY, rectW, rectH);
      ctx.fillStyle = "#bfbfbf";

      var anyMoving = false;

      for (var r = clearBounds.minRow; r <= clearBounds.maxRow; r++) {
        for (var c = clearBounds.minCol; c <= clearBounds.maxCol; c++) {
          var i = r * cols + c;
          var x = padX + c * SPACING;
          var y = padY + r * SPACING;

          var best = BASE_R;
          for (var k2 = 0; k2 < trail.length; k2++) {
            var p = trail[k2];
            var dx = x - p.x;
            var dy = y - p.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < RADIUS) {
              var t = 1 - dist / RADIUS;
              var candidate = BASE_R + (MAX_R - BASE_R) * t * t * p.life;
              if (candidate > best) best = candidate;
            }
          }
          target[i] = best;

          var cur = radii[i];
          var diff = target[i] - cur;
          if (Math.abs(diff) > 0.01) {
            cur += diff * (diff > 0 ? LERP_IN : LERP_OUT);
            radii[i] = cur;
            anyMoving = true;
          } else {
            cur = target[i];
            radii[i] = cur;
          }

          if (cur > 0.05) {
            ctx.beginPath();
            ctx.arc(x, y, cur, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      lastBounds = regionBounds;

      if (trail.length || anyMoving) {
        requestAnimationFrame(frame);
      } else {
        lastBounds = null;
        looping = false;
      }
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onPointerMove, { passive: true });
    window.addEventListener("mouseleave", onPointerLeave);
    window.addEventListener("touchmove", function (e) {
      if (e.touches && e.touches[0]) {
        onPointerMove(e.touches[0]);
      }
    }, { passive: true });
    window.addEventListener("touchend", onPointerLeave);
  }
})();
