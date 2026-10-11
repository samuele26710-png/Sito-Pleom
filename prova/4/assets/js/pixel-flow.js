/* ============================================================
   Pleom — Pixel flow hero background (vision page)
   Pixel-art magnifying glasses drift right to left on a pixel
   grid; pixels light up and fade like a real LED matrix and the
   cursor pushes the glasses around.
   ============================================================ */

(function () {
  "use strict";

  Array.prototype.forEach.call(document.querySelectorAll("[data-pixel-flow]"), initPixelFlow);

  function initPixelFlow(canvas) {
    var hero = canvas.parentElement;
    var ctx = canvas.getContext("2d");
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var KIND = canvas.getAttribute("data-pixel-flow") || "magnifier";
    var COLOR = canvas.getAttribute("data-pixel-color") || "240, 240, 240";
    var LEVELS = 12;
    var MAX_ALPHA = 0.28;
    var FRAME_MS = 1000 / 30;
    var SIZES = KIND === "wrench" ? [13, 19, 25, 33, 43] : KIND === "leaf" ? [13, 17, 23, 31, 41] : KIND === "products" ? [18, 24, 32, 42, 54] : KIND === "walkie" ? [18, 24, 32, 42, 54] : [9, 13, 17, 23, 31];

    var PX = 6;
    var cols = 0;
    var rows = 0;
    var bright = null;
    var target = null;
    var sprites = [];
    var shapes = {};
    var spawnTimer = 0;
    var running = false;
    var lastTime = 0;
    var pointer = { x: 0, y: 0, vx: 0, vy: 0, active: false, lastT: 0 };

    function finishShape(cells, D) {
      var minX = Infinity;
      var minY = Infinity;
      cells.forEach(function (p) {
        if (p[0] < minX) minX = p[0];
        if (p[1] < minY) minY = p[1];
      });
      var maxX = 0;
      var maxY = 0;
      var shifted = cells.map(function (p) {
        var x = p[0] - minX;
        var y = p[1] - minY;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        return [x, y];
      });
      return { cells: shifted, w: maxX + 1, h: maxY + 1, D: D };
    }

    function makeWrench(L, mirror) {
      var hw = Math.max(1, Math.round(L / 14));
      var R = Math.max(3, Math.round(L * 0.19));
      var r2 = Math.max(2, Math.round(R * 0.78));
      var u0 = -L / 2 + R;
      var u1 = L / 2 - r2;
      var span = Math.ceil(L * 0.72 + R * 2) + 4;
      var cells = [];
      var rt = Math.SQRT1_2;

      for (var y = -span; y <= span; y++) {
        for (var x = -span; x <= span; x++) {
          var u = mirror ? (x - y) * rt : (x + y) * rt;
          var v = mirror ? (x + y) * rt : (x - y) * rt;
          var on = false;

          if (Math.abs(v) <= hw && u > u0 && u < u1) on = true;

          var dh = Math.sqrt((u - u0) * (u - u0) + v * v);
          if (dh <= R) {
            on = true;
            if (u < u0 + R * 0.15 && Math.abs(v) < R * 0.42) on = false;
          }

          var dt = Math.sqrt((u - u1) * (u - u1) + v * v);
          if (dt <= r2) on = !(dt < r2 * 0.48);

          if (on) cells.push([x, y]);
        }
      }

      return finishShape(cells, L);
    }

    function makeLeaf(L, mirror) {
      var hw = Math.max(3, L * 0.27);
      var stem = Math.round(L * 0.16) + 2;
      var span = Math.ceil(L * 0.72 + hw) + stem + 4;
      var rt = Math.SQRT1_2;
      var cells = [];

      for (var y = -span; y <= span; y++) {
        for (var x = -span; x <= span; x++) {
          var u = mirror ? (x - y) * rt : (x + y) * rt;
          var v = mirror ? (x + y) * rt : (x - y) * rt;
          var t = (2 * u) / L;
          var on = false;

          if (Math.abs(t) <= 1) {
            var w = hw * (1 - t * t);
            if (Math.abs(v) <= w) on = true;
            if (on && L >= 13 && Math.abs(v) < 0.55 && t > -0.78 && t < 0.78) on = false;
            if (on && L >= 23) {
              var step = L / 6;
              var k = Math.round((u + L / 2 - step * 0.6) / step);
              var uk = -L / 2 + step * 0.6 + k * step;
              if (k >= 0 && k <= 4 && u > uk && Math.abs(v) < w * 0.85 && Math.abs(Math.abs(v) - (u - uk) * 0.9) < 0.5) on = false;
            }
          }

          if (u > L / 2 - 1 && u <= L / 2 + stem && Math.abs(v) < 0.9) on = true;

          if (on) cells.push([x, y]);
        }
      }

      return finishShape(cells, L);
    }

    var PRODUCT_TYPES = 5;

    function makeProduct(S, type) {
      var H = S;
      var cells = [];
      var seen = {};
      var cut = {};

      function put(x, y) {
        var key = x + "," + y;
        if (!seen[key]) {
          seen[key] = true;
          cells.push([x, y]);
        }
      }

      function fillRows(hwOf) {
        for (var y = 0; y < H; y++) {
          var hw = hwOf(y / H, y);
          if (hw <= 0) continue;
          var r = Math.max(0, Math.round(hw - 0.5));
          for (var x = -r; x <= r; x++) put(x, y);
        }
      }

      if (type === 0) {
        var maxR = S * 0.3;
        var neck = Math.max(1.5, S * 0.1);
        fillRows(function (t) {
          var w = 0;
          if (t < 0.5) w = neck;
          if (t < 0.07) w = neck * 1.55;
          var e = (t - 0.7) / 0.3;
          if (t > 0.36 && Math.abs(e) <= 1) w = Math.max(w, maxR * Math.sqrt(1 - e * e));
          return w;
        });
        if (S >= 32) {
          for (var k = 0; k < 4; k++) {
            for (var d = 0; d < S * 0.34; d++) {
              cut[Math.round(-S * 0.15 + k * 4 + d * 0.5) + "," + Math.round(S * 0.52 + d)] = true;
            }
          }
        }
      } else if (type === 1) {
        var baseR = S * 0.13;
        fillRows(function (t) {
          if (t < 0.03) return baseR * 1.35;
          if (t > 0.97) return baseR * 0.8;
          return baseR * (1 + 0.55 * Math.sin(Math.PI * Math.min(1, t * 1.05)));
        });
        if (S >= 32) {
          for (var q = 0; q < 6; q++) {
            cut[Math.round(-baseR * 0.4 + q * 2) + "," + Math.round(S * 0.3 + q * 4)] = true;
          }
        }
      } else if (type === 2) {
        var stemW = S >= 40 ? 1.5 : 0.8;
        fillRows(function (t) {
          if (t < 0.38) return S * 0.16 + (S * 0.18) * (t / 0.38);
          if (t < 0.88) return stemW;
          var e = (t - 0.88) / 0.12;
          return S * 0.22 * Math.sqrt(Math.max(0, 1 - (1 - e) * (1 - e) * 0.15));
        });
      } else if (type === 3) {
        H = Math.round(S * 0.34);
        var W = S * 0.62;
        fillRows(function (t, y) {
          if (y < 1) return W + 1;
          var e = y / H;
          return W * Math.sqrt(Math.max(0, 1 - e * e));
        });
        var ih = Math.max(3, Math.round(S * 0.09));
        var iy0 = -ih;
        var rx = Math.round(-W * 0.38);
        for (var ry = 0; ry < ih; ry++) {
          for (var rxx = 0; rxx < 3; rxx++) {
            if (ry === 0 || ry === ih - 1 || rxx === 0 || rxx === 2) put(rx + rxx, iy0 + ry);
          }
        }
        var bar = Math.max(4, Math.round(S * 0.16));
        var bx = rx + 3;
        for (var bi = 0; bi < bar; bi++) put(bx + bi, iy0 + ih - 2);
        put(bx + bar - 1, iy0 + ih - 1);
        put(bx + bar - 3, iy0 + ih - 1);
        var cx2 = Math.round(W * 0.3);
        for (var ci = 0; ci < 2; ci++) {
          put(cx2 + ci, iy0 + ih - 2);
          put(cx2 + ci, iy0 + ih - 1);
        }
      } else {
        var halfW = S * 0.13;
        fillRows(function (t) {
          if (t < 0.2) {
            var f = t / 0.2;
            return halfW * 0.55 * Math.sin(Math.PI * Math.min(1, f * 0.95 + 0.05));
          }
          if (t < 0.24) return 0;
          if (t > 0.88) return halfW * 1.7;
          return halfW;
        });
      }

      var filtered = cells.filter(function (c) {
        return !cut[c[0] + "," + c[1]];
      });
      return finishShape(filtered, S);
    }

    function makeWalkie(S) {
      var hw = Math.max(3, Math.round(S * 0.18));
      var ant = Math.max(3, Math.round(S * 0.2));
      var big = S >= 32;
      var cells = [];
      var cut = {};
      var y;
      var x;

      for (y = 0; y < ant; y++) {
        cells.push([hw - 1, y]);
        if (big) cells.push([hw - 2, y]);
      }
      cells.push([-hw + 1, ant - 2]);
      cells.push([-hw + 2, ant - 2]);
      cells.push([-hw + 1, ant - 1]);
      cells.push([-hw + 2, ant - 1]);

      for (y = ant; y < S; y++) {
        for (x = -hw; x <= hw; x++) cells.push([x, y]);
      }

      var bh = S - ant;
      var ptt0 = ant + Math.round(bh * 0.22);
      var ptt1 = ptt0 + Math.max(3, Math.round(bh * 0.24));
      for (y = ptt0; y < ptt1; y++) {
        cells.push([-hw - 1, y]);
        if (big) cells.push([-hw - 2, y]);
      }

      var slits = S >= 24 ? 3 : 2;
      for (var r = 0; r < slits; r++) {
        for (x = -hw + 2; x <= hw - 2; x++) cut[x + "," + (ant + 2 + r * 2)] = true;
      }

      if (bh >= 18) {
        var sy = ant + 2 + slits * 2 + 1;
        var sh = Math.max(2, Math.round(bh * 0.2));
        for (y = sy; y < sy + sh; y++) {
          for (x = -hw + 2; x <= hw - 2; x++) cut[x + "," + y] = true;
        }
      }

      var filtered = cells.filter(function (c) {
        return !cut[c[0] + "," + c[1]];
      });
      return finishShape(filtered, S);
    }

    function makeShape(D, variant) {
      if (KIND === "walkie") return makeWalkie(D);
      if (KIND === "products") return makeProduct(D, variant);
      if (KIND === "wrench") return makeWrench(D, variant === 1);
      if (KIND === "leaf") return makeLeaf(D, variant === 1);
      var r = D / 2;
      var c = r - 0.5;
      var t = Math.max(1, Math.round(D / 8));
      var seen = {};
      var cells = [];

      function add(x, y) {
        var key = x + "," + y;
        if (!seen[key]) {
          seen[key] = true;
          cells.push([x, y]);
        }
      }

      for (var y = 0; y < D; y++) {
        for (var x = 0; x < D; x++) {
          var d = Math.sqrt((x - c) * (x - c) + (y - c) * (y - c));
          if (d <= r && d > r - t) add(x, y);
        }
      }

      var start = c + r * 0.7071;
      var neck = Math.round(D * 0.08) + 1;
      var len = neck + Math.round(D * 0.3) + 2;
      for (var i = 0; i <= len; i++) {
        var thick = i > neck ? t + 2 : t;
        var px = Math.round(start) + i;
        var py = Math.round(start) + i;
        for (var k = 0; k < thick; k++) add(px + k, py);
        for (var m = 1; m < thick; m++) add(px, py + m);
      }

      if (D >= 13) {
        var rr = r - t - 1.6;
        if (rr > 1) {
          for (var a = 195; a <= 255; a += 9) {
            var rad = (a * Math.PI) / 180;
            add(Math.round(c + rr * Math.cos(rad)), Math.round(c + rr * Math.sin(rad)));
          }
        }
      }

      return finishShape(cells, D);
    }

    function getShape(D, variant) {
      var key = D + "-" + variant;
      if (!shapes[key]) shapes[key] = makeShape(D, variant);
      return shapes[key];
    }

    function pickSize() {
      var usable = SIZES.filter(function (s) {
        return s * 2.2 < cols;
      });
      var list = usable.length ? usable : [SIZES[0]];
      var weights = [];
      var total = 0;
      list.forEach(function (s, i) {
        var w = list.length - i + 0.6;
        weights.push(w);
        total += w;
      });
      var roll = Math.random() * total;
      for (var i = 0; i < list.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return list[i];
      }
      return list[0];
    }

    function spawn(x) {
      var shape = getShape(pickSize(), KIND === "products" ? Math.floor(Math.random() * PRODUCT_TYPES) : Math.random() < 0.5 ? 0 : 1);
      var base = -(14 - shape.D * 0.2 + Math.random() * 3);
      sprites.push({
        shape: shape,
        x: x !== undefined ? x : cols + 2,
        y: Math.random() * (rows - shape.h * 0.6) - shape.h * 0.2,
        vx: base,
        vy: 0,
        base: base,
        level: 0.55 + Math.random() * 0.45,
        mass: 0.6 + shape.D / 20
      });
    }

    function resize() {
      var rect = hero.getBoundingClientRect();
      var w = Math.max(1, Math.floor(rect.width));
      var h = Math.max(1, Math.floor(rect.height));
      var dpr = Math.min(window.devicePixelRatio || 1, 2);

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

      if (!sprites.length) {
        var count = Math.max(3, Math.round(cols / 36));
        for (var i = 0; i < count; i++) spawn(Math.random() * cols);
      }

      if (reducedMotion) renderStatic();
    }

    function stamp(time) {
      target.fill(0);
      for (var s = 0; s < sprites.length; s++) {
        var sp = sprites[s];
        var ox = Math.floor(sp.x);
        var oy = Math.floor(sp.y);
        var cells = sp.shape.cells;
        for (var i = 0; i < cells.length; i++) {
          var gx = ox + cells[i][0];
          var gy = oy + cells[i][1];
          if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
          if (!reducedMotion && Math.random() < 0.008) continue;
          var idx = gy * cols + gx;
          if (target[idx] < sp.level) target[idx] = sp.level;
        }
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

    function renderStatic() {
      stamp(0);
      for (var i = 0; i < bright.length; i++) bright[i] = target[i];
      draw();
    }

    function step(dt) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawn();
        spawnTimer = (1.3 + Math.random() * 2.2) * (240 / cols);
      }

      var radius = 20;
      for (var s = sprites.length - 1; s >= 0; s--) {
        var sp = sprites[s];

        if (pointer.active) {
          var cx = sp.x + sp.shape.w / 2;
          var cy = sp.y + sp.shape.h / 2;
          var dx = cx - pointer.x;
          var dy = cy - pointer.y;
          var reach = radius + sp.shape.D * 0.35;
          var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
          if (d < reach) {
            var falloff = 1 - d / reach;
            var force = (falloff * falloff * 120) / sp.mass;
            sp.vx += (dx / d) * force * dt + pointer.vx * falloff * 0.05 * dt * 60 / sp.mass;
            sp.vy += (dy / d) * force * dt + pointer.vy * falloff * 0.05 * dt * 60 / sp.mass;
          }
        }

        var relax = 1 - Math.exp(-dt * 1.4);
        sp.vx += (sp.base - sp.vx) * relax;
        sp.vy += (0 - sp.vy) * relax;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;

        if (
          sp.x + sp.shape.w < -2 ||
          sp.x > cols + 40 ||
          sp.y > rows + sp.shape.h ||
          sp.y + sp.shape.h < -sp.shape.h
        ) {
          sprites.splice(s, 1);
        }
      }

      pointer.vx *= Math.exp(-dt * 6);
      pointer.vy *= Math.exp(-dt * 6);

      stamp();

      var up = 1 - Math.exp(-dt * 20);
      var down = 1 - Math.exp(-dt * 5);
      for (var i = 0; i < bright.length; i++) {
        var t = target[i];
        var b = bright[i];
        if (t === 0 && b === 0) continue;
        bright[i] = b + (t - b) * (t > b ? up : down);
      }
    }

    function frame(now) {
      if (!running) return;
      requestAnimationFrame(frame);
      // Cap the simulation and redraw at ~30fps; step() is time-based, so
      // speeds stay the same.
      if (now - lastTime < FRAME_MS - 2) return;
      var dt = Math.min(0.05, (now - lastTime) / 1000 || 0.033);
      lastTime = now;
      step(dt);
      draw();
    }

    function start() {
      if (running || reducedMotion) return;
      running = true;
      lastTime = performance.now();
      requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
    }

    function onPointerMove(e) {
      var rect = canvas.getBoundingClientRect();
      var x = (e.clientX - rect.left) / PX;
      var y = (e.clientY - rect.top) / PX;
      var now = performance.now();
      if (pointer.active && now > pointer.lastT) {
        var dt = (now - pointer.lastT) / 1000;
        pointer.vx = Math.max(-80, Math.min(80, (x - pointer.x) / dt));
        pointer.vy = Math.max(-80, Math.min(80, (y - pointer.y) / dt));
      }
      pointer.x = x;
      pointer.y = y;
      pointer.lastT = now;
      pointer.active = true;
    }

    function onPointerLeave() {
      pointer.active = false;
    }

    resize();
    window.addEventListener("resize", resize);

    if (!reducedMotion) {
      hero.addEventListener("pointermove", onPointerMove);
      hero.addEventListener("pointerleave", onPointerLeave);

      if ("IntersectionObserver" in window) {
        new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) start();
              else stop();
            });
          },
          { threshold: 0 }
        ).observe(hero);
      } else {
        start();
      }
    }
  }
})();
