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
  var PX = 6;            // LED pixel size: set in layout() like the hero grids
  var LEVELS = 12;
  var MAX_ALPHA = 0.92;
  var FIELD = 3;         // velocity field cell, in LED pixels

  var TEXT = "404";

  var cols = 0, rows = 0;
  var bright = null, target = null;
  var fcols = 0, frows = 0, fu = null, fv = null, fu2 = null, fv2 = null;
  var parts = [];        // {hx, hy, x, y, vx, vy}
  var running = false;
  var lastTime = 0;
  var pointer = { x: 0, y: 0, vx: 0, vy: 0, active: false, lastT: 0 };
  var numBox = { x0: 0, y0: 0, x1: 0, y1: 0 };   // the number, in LED cells
  var shake = { x: 0, y: 0, e: 0 };              // pending impulse from the device

  function layout() {
    var w = stage.clientWidth;
    var h = stage.clientHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    // same pixel size as the hero grids (pixel-flow.js): 5px on phones,
    // up to 8px on large screens
    PX = Math.max(5, Math.min(8, Math.round(w / 220)));
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

    // The digits are built geometrically on the LED grid (one 6px cell =
    // one pixel), like the hero sprites: straight strokes stay on the grid,
    // the diagonal of the 4 and the curve of the 0 step one pixel at a time,
    // and the 0 is mirror-symmetric by construction.
    // Size: up to ~60% of the width (~80% on phones), ~38% of the height.
    var share = w < 700 ? 0.82 : 0.6;
    var screenH = Math.min(window.innerHeight, h);
    var H = Math.floor(Math.min((screenH / PX) * 0.38, (cols * share) / 2.46));
    H = Math.max(12, H);
    var T = Math.max(2, Math.round(H * 0.17));      // stroke
    var W4 = Math.round(H * 0.78);
    var W0 = Math.round(H * 0.66);
    var GAPC = Math.max(2, Math.round(H * 0.12));
    var textW = W4 * 2 + W0 + GAPC * 2;
    var textH = H;

    // centre number + caption between the navbar and the bottom of the screen
    var nav = document.querySelector(".navbar");
    var navBottom = nav ? nav.getBoundingClientRect().bottom : 0;
    var caption = stage.querySelector(".nf-caption");
    var captionH = caption ? caption.offsetHeight + 28 : 0;
    var groupTop = navBottom + (screenH - navBottom - (textH * PX + captionH)) / 2;
    var ox = Math.round((cols - textW) / 2);
    var oy = Math.max(Math.ceil(navBottom / PX) + 2, Math.round(groupTop / PX));

    parts = [];
    function on(x, y) {
      parts.push({ hx: x, hy: y, x: x, y: y, vx: 0, vy: 0 });
    }
    function four(x0) {
      var sx = W4 - T - Math.round(W4 * 0.08);       // stem, near the right
      var barY = Math.round(H * 0.64);                // crossbar
      var dT = Math.round(T * 1.2);                   // diagonal, measured across x
      for (var y = 0; y < H; y++) {
        for (var x = 0; x < W4; x++) {
          var stem = x >= sx && x < sx + T;
          var bar = y >= barY && y < barY + T;
          var diag = false;
          if (y < barY + T) {
            var xl = Math.round(sx * (1 - Math.min(1, (y + 0.5) / barY)));
            diag = x >= xl && x < xl + dT && x < sx + T;
          }
          if (stem || bar || diag) on(x0 + x, oy + y);
        }
      }
    }
    function zero(x0) {
      // squircle ring: flatter sides than an ellipse, reads as a typeset 0
      var P = 2.6;
      var a = W0 / 2, b = H / 2;
      var ai = a - T, bi = b - T * 0.9;
      for (var y = 0; y < H; y++) {
        for (var x = 0; x < W0; x++) {
          var dx = Math.abs(x + 0.5 - a), dy = Math.abs(y + 0.5 - b);
          var outer = Math.pow(dx / a, P) + Math.pow(dy / b, P) <= 1;
          var inner = Math.pow(dx / ai, P) + Math.pow(dy / bi, P) < 1;
          if (outer && !inner) on(x0 + x, oy + y);
        }
      }
    }
    numBox = { x0: ox, y0: oy, x1: ox + textW, y1: oy + textH };
    four(ox);
    zero(ox + W4 + GAPC);
    four(ox + W4 + GAPC + W0 + GAPC);

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
    // a shake pushes the whole number: every field cell over it gets the
    // impulse, turned by a fixed per-cell angle so it breaks into swirls
    if (shake.x || shake.y || shake.e) {
      var bx0 = Math.max(0, Math.floor((numBox.x0 - 4) / FIELD)), bx1 = Math.min(fcols - 1, Math.ceil((numBox.x1 + 4) / FIELD));
      var by0 = Math.max(0, Math.floor((numBox.y0 - 4) / FIELD)), by1 = Math.min(frows - 1, Math.ceil((numBox.y1 + 4) / FIELD));
      for (var sy = by0; sy <= by1; sy++) {
        for (var sx = bx0; sx <= bx1; sx++) {
          var n = Math.sin(sx * 12.9898 + sy * 78.233) * 43758.5453;
          n = n - Math.floor(n);
          var ang = (n - 0.5) * 1.6;
          var gain = 0.6 + n * 0.8;
          var ci = Math.cos(ang), si = Math.sin(ang);
          var kk = sy * fcols + sx;
          // directional push + a scatter that only depends on how hard the
          // phone was shaken (back-and-forth shakes would cancel out)
          var sa = n * 6.2832;
          fu[kk] += (shake.x * ci - shake.y * si) * gain + Math.cos(sa) * shake.e;
          fv[kk] += (shake.x * si + shake.y * ci) * gain + Math.sin(sa) * shake.e;
        }
      }
      shake.x = 0;
      shake.y = 0;
      shake.e = 0;
    }

    pointer.vx *= Math.exp(-dt * 10);
    pointer.vy *= Math.exp(-dt * 10);

    // 2. field: diffuse (spreads into swirls around the wake) and decay
    var decay = Math.exp(-dt * 3.2);
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
    var K = 16.8, C = 6.8, DRAG = 5;
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
    var down = 1 - Math.exp(-dt * 12);
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
  // the caption height (used to centre the group) depends on the web font
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

  /* ---------- Shake (phones) ---------- */
  // On touch screens the pixels are moved by shaking the phone instead of
  // the finger. iOS asks for permission to read the motion sensors, and only
  // after a tap: the hint under the button doubles as that tap target.
  var coarse = window.matchMedia("(pointer: coarse)").matches;
  var hint = stage.querySelector("[data-shake-hint]");
  var last = null;

  function onMotion(e) {
    var a = e.acceleration;
    var ax, ay;
    if (a && a.x != null) {
      ax = a.x; ay = a.y;
    } else if (e.accelerationIncludingGravity) {
      // no gravity-free reading: use the change since the last sample
      var g = e.accelerationIncludingGravity;
      if (!last) { last = { x: g.x, y: g.y }; return; }
      ax = g.x - last.x; ay = g.y - last.y;
      last = { x: g.x, y: g.y };
    } else {
      return;
    }
    // device axes -> screen axes (y points down on screen)
    var angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    var r = (angle * Math.PI) / 180;
    var sxA = ax * Math.cos(r) + ay * Math.sin(r);
    var syA = -(-ax * Math.sin(r) + ay * Math.cos(r));
    var mag = Math.sqrt(sxA * sxA + syA * syA);
    if (mag < 2.2) return;
    // inertia: the pixels lag behind the phone, so they move the other way
    var k = Math.min(mag, 25) * 4.5 / mag;
    shake.x -= sxA * k;
    shake.y -= syA * k;
    shake.e += Math.min(mag, 25) * 1.2;
    wake();
  }

  function listenMotion() {
    window.addEventListener("devicemotion", onMotion);
    if (hint) {
      hint.textContent = "Scuoti il telefono";
      hint.disabled = true;
    }
  }

  if (!reducedMotion && coarse && "DeviceMotionEvent" in window) {
    if (hint) hint.hidden = false;
    if (typeof DeviceMotionEvent.requestPermission === "function") {
      if (hint) {
        hint.textContent = "Tocca qui e scuoti il telefono";
        hint.addEventListener("click", function () {
          DeviceMotionEvent.requestPermission().then(function (state) {
            if (state === "granted") listenMotion();
            else hint.hidden = true;
          }, function () { hint.hidden = true; });
        });
      }
    } else {
      listenMotion();
    }
  }

  if (!reducedMotion && !coarse) {
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerdown", onPointerMove);
    stage.addEventListener("pointerleave", onPointerLeave);
    stage.addEventListener("pointerup", function (e) {
      if (e.pointerType !== "mouse") onPointerLeave();
    });
  }
})();
