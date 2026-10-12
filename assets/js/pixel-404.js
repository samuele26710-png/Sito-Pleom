/* ============================================================
   Pleom — 404: "404" drawn on the LED pixel grid of the heroes.
   Static until the pointer runs through the digits: then the
   pixels are carried by a small velocity field (fluid-like) and
   spring back to their place within a few seconds.
   ============================================================ */

(function () {
  "use strict";

  var stage = document.querySelector("[data-pixel-404]");
  if (!stage) return;
  var canvas = stage.querySelector("canvas");
  var ctx = canvas.getContext("2d");
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var COLOR = "240, 240, 240";
  var PX = 6;            // LED pixel size, same as the hero grids
  var LEVELS = 12;
  var MAX_ALPHA = 0.92;
  var FIELD = 3;         // velocity field cell, in LED pixels

  // 5x7 glyphs
  var GLYPHS = {
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "0": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"]
  };
  var TEXT = "404";
  var GAP = 1;           // space between digits, in glyph dots

  var cols = 0, rows = 0;
  var bright = null, target = null;
  var fcols = 0, frows = 0, fu = null, fv = null, fu2 = null, fv2 = null;
  var parts = [];        // {hx, hy, x, y, vx, vy}
  var running = false;
  var lastTime = 0;
  var pointer = { x: 0, y: 0, vx: 0, vy: 0, active: false, lastT: 0 };

  function layout() {
    var w = stage.clientWidth;
    var h = stage.clientHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cols = Math.ceil(w / PX);
    rows = Math.ceil(h / PX);
    canvas.width = Math.floor(cols * PX * dpr);
    canvas.height = Math.floor(rows * PX * dpr);
    canvas.style.width = cols * PX + "px";
    canvas.style.height = rows * PX + "px";
    canvas.style.setProperty("--px", PX + "px");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    bright = new Float32Array(cols * rows);
    target = new Float32Array(cols * rows);

    fcols = Math.ceil(cols / FIELD) + 1;
    frows = Math.ceil(rows / FIELD) + 1;
    fu = new Float32Array(fcols * frows);
    fv = new Float32Array(fcols * frows);
    fu2 = new Float32Array(fcols * frows);
    fv2 = new Float32Array(fcols * frows);

    // glyph scale: the number spans up to ~60% of the width (~90% on phones),
    // never more than ~40% of the height
    var glyphCols = TEXT.length * 5 + (TEXT.length - 1) * GAP;
    var share = w < 700 ? 0.92 : 0.6;
    var S = Math.max(2, Math.floor(Math.min((cols * share) / glyphCols, (rows * 0.42) / 7)));
    var textW = glyphCols * S;
    var textH = 7 * S;
    var ox = Math.round((cols - textW) / 2);
    var oy = Math.round((rows - textH) / 2);

    parts = [];
    for (var c = 0; c < TEXT.length; c++) {
      var g = GLYPHS[TEXT[c]];
      var gx0 = ox + c * (5 + GAP) * S;
      for (var gy = 0; gy < 7; gy++) {
        for (var gx = 0; gx < 5; gx++) {
          if (g[gy][gx] !== "1") continue;
          // each glyph dot is a solid S x S block of 6px LED pixels: the
          // digits are filled shapes on the same grid as the hero sprites
          for (var sy = 0; sy < S; sy++) {
            for (var sx = 0; sx < S; sx++) {
              var hx = gx0 + gx * S + sx;
              var hy = oy + gy * S + sy;
              parts.push({ hx: hx, hy: hy, x: hx, y: hy, vx: 0, vy: 0 });
            }
          }
        }
      }
    }

    // caption sits under the number
    stage.style.setProperty("--nf-bottom", (oy + textH) * PX + "px");
    stage.style.setProperty("--nf-top", oy * PX + "px");

    stamp();
    for (var i = 0; i < bright.length; i++) bright[i] = target[i];
    draw();
  }

  function stamp() {
    target.fill(0);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var gx = Math.round(p.x);
      var gy = Math.round(p.y);
      if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
      target[gy * cols + gx] = 1;
    }
  }

  function lit(x, y) {
    return x >= 0 && y >= 0 && x < cols && y < rows && bright[y * cols + x] >= 0.03;
  }

  function draw() {
    ctx.clearRect(0, 0, cols * PX, rows * PX);
    var buckets = [];
    for (var l = 0; l <= LEVELS; l++) buckets.push([]);
    for (var i = 0; i < bright.length; i++) {
      var b = bright[i];
      if (b < 0.03) continue;
      buckets[Math.min(LEVELS, Math.round(b * LEVELS))].push(i);
    }
    for (var level = 1; level <= LEVELS; level++) {
      var list = buckets[level];
      if (!list.length) continue;
      ctx.fillStyle = "rgba(" + COLOR + "," + ((level / LEVELS) * MAX_ALPHA).toFixed(3) + ")";
      ctx.beginPath();
      for (var j = 0; j < list.length; j++) {
        var idx = list[j];
        var gx = idx % cols;
        var gy = (idx - gx) / cols;
        var up = lit(gx, gy - 1);
        var down = lit(gx, gy + 1);
        var left = lit(gx - 1, gy);
        var right = lit(gx + 1, gy);
        var rad = PX * 0.45;
        var tl = !up && !left ? rad : 0;
        var tr = !up && !right ? rad : 0;
        var br = !down && !right ? rad : 0;
        var bl = !down && !left ? rad : 0;
        if (ctx.roundRect && (tl || tr || br || bl)) ctx.roundRect(gx * PX, gy * PX, PX, PX, [tl, tr, br, bl]);
        else ctx.rect(gx * PX, gy * PX, PX, PX);
      }
      ctx.fill();
    }
  }

  function fieldAt(arr, x, y) {
    var fx = Math.max(0, Math.min(fcols - 1.001, x / FIELD));
    var fy = Math.max(0, Math.min(frows - 1.001, y / FIELD));
    var x0 = Math.floor(fx), y0 = Math.floor(fy);
    var tx = fx - x0, ty = fy - y0;
    var i = y0 * fcols + x0;
    return (arr[i] * (1 - tx) + arr[i + 1] * tx) * (1 - ty) + (arr[i + fcols] * (1 - tx) + arr[i + fcols + 1] * tx) * ty;
  }

  // returns the remaining "energy" so the loop can stop when all is still
  function step(dt) {
    var energy = 0;

    // 1. the pointer stirs the field where it passes
    if (pointer.active && (pointer.vx || pointer.vy)) {
      var R = 7; // field cells
      var pcx = pointer.x / FIELD, pcy = pointer.y / FIELD;
      for (var y = Math.max(0, Math.floor(pcy - R)); y <= Math.min(frows - 1, Math.ceil(pcy + R)); y++) {
        for (var x = Math.max(0, Math.floor(pcx - R)); x <= Math.min(fcols - 1, Math.ceil(pcx + R)); x++) {
          var dx = x - pcx, dy = y - pcy;
          var d2 = dx * dx + dy * dy;
          if (d2 > R * R) continue;
          var w = Math.exp(-d2 / (R * R * 0.18));
          var k = y * fcols + x;
          fu[k] += pointer.vx * w * 0.9;
          fv[k] += pointer.vy * w * 0.9;
        }
      }
    }
    pointer.vx *= Math.exp(-dt * 10);
    pointer.vy *= Math.exp(-dt * 10);

    // 2. field: diffuse (spreads into swirls around the wake) and decay
    var decay = Math.exp(-dt * 1.6);
    for (var fy = 0; fy < frows; fy++) {
      for (var fx = 0; fx < fcols; fx++) {
        var i = fy * fcols + fx;
        var l = fx > 0 ? i - 1 : i, r = fx < fcols - 1 ? i + 1 : i;
        var u = fy > 0 ? i - fcols : i, dn = fy < frows - 1 ? i + fcols : i;
        fu2[i] = (fu[i] * 0.5 + (fu[l] + fu[r] + fu[u] + fu[dn]) * 0.125) * decay;
        fv2[i] = (fv[i] * 0.5 + (fv[l] + fv[r] + fv[u] + fv[dn]) * 0.125) * decay;
        energy += Math.abs(fu2[i]) + Math.abs(fv2[i]);
      }
    }
    var t = fu; fu = fu2; fu2 = t;
    t = fv; fv = fv2; fv2 = t;

    // 3. pixels: dragged by the field, pulled home by a soft damped spring
    var K = 4.2, C = 3.4, DRAG = 5;
    for (var p = 0; p < parts.length; p++) {
      var q = parts[p];
      var su = fieldAt(fu, q.x, q.y);
      var sv = fieldAt(fv, q.x, q.y);
      q.vx += ((su - q.vx) * DRAG * Math.min(1, Math.abs(su) / 4) - K * (q.x - q.hx) - C * q.vx) * dt;
      q.vy += ((sv - q.vy) * DRAG * Math.min(1, Math.abs(sv) / 4) - K * (q.y - q.hy) - C * q.vy) * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      var off = Math.abs(q.x - q.hx) + Math.abs(q.y - q.hy);
      if (off < 0.02 && Math.abs(q.vx) + Math.abs(q.vy) < 0.02) {
        q.x = q.hx; q.y = q.hy; q.vx = 0; q.vy = 0;
      } else {
        energy += off + Math.abs(q.vx) + Math.abs(q.vy);
      }
    }

    stamp();
    var up = 1 - Math.exp(-dt * 24);
    var down = 1 - Math.exp(-dt * 6);
    for (var b = 0; b < bright.length; b++) {
      var tg = target[b], br = bright[b];
      if (tg === br) continue;
      var nb = br + (tg - br) * (tg > br ? up : down);
      bright[b] = Math.abs(nb - tg) < 0.01 ? tg : nb;
      energy += Math.abs(bright[b] - tg);
    }
    return energy;
  }

  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    var energy = step(dt);
    draw();
    if (energy < 0.05 && Math.abs(pointer.vx) + Math.abs(pointer.vy) < 0.5) {
      running = false; // everything is back in place: stay static
      return;
    }
    requestAnimationFrame(frame);
  }

  function wake() {
    if (running || reducedMotion) return;
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(frame);
  }

  function onPointerMove(e) {
    var rect = canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left) / PX;
    var y = (e.clientY - rect.top) / PX;
    var now = performance.now();
    if (pointer.active && now > pointer.lastT) {
      var dt = (now - pointer.lastT) / 1000;
      pointer.vx = Math.max(-160, Math.min(160, (x - pointer.x) / dt));
      pointer.vy = Math.max(-160, Math.min(160, (y - pointer.y) / dt));
    }
    pointer.x = x;
    pointer.y = y;
    pointer.lastT = now;
    pointer.active = true;
    wake();
  }

  function onPointerLeave() {
    pointer.active = false;
  }

  layout();
  var lastW = window.innerWidth;
  window.addEventListener("resize", function () {
    // iOS fires resize when the toolbars move: only re-layout on real changes
    if (window.innerWidth === lastW && Math.abs(stage.clientHeight / PX - rows) < 2) return;
    lastW = window.innerWidth;
    layout();
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

  if (!reducedMotion) {
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerdown", onPointerMove);
    stage.addEventListener("pointerleave", onPointerLeave);
    stage.addEventListener("pointerup", function (e) {
      if (e.pointerType !== "mouse") onPointerLeave();
    });
  }
})();
