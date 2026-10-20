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

    // Iconic design objects, drawn in a unit box (height 1, x centred on 0)
    // and sampled on the pixel grid: S = height in cells. Details cut out of
    // the silhouette only appear on the larger sprites.
    var PRODUCT_TYPES = 10;

    function makeProduct(S, type) {
      var big = S >= 30;
      var hair = 0.55 / S; // thinnest line that still lights a cell

      function seg(px, py, ax, ay, bx, by, r) {
        var dx = bx - ax;
        var dy = by - ay;
        var t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
        t = Math.max(0, Math.min(1, t));
        var ex = px - ax - t * dx;
        var ey = py - ay - t * dy;
        var rr = Math.max(r, hair);
        return ex * ex + ey * ey <= rr * rr;
      }
      function path(px, py, pts, r) {
        for (var i = 0; i < pts.length - 1; i++) {
          if (seg(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r)) return true;
        }
        return false;
      }
      function ell(px, py, cx, cy, rx, ry) {
        var a = (px - cx) / rx;
        var b = (py - cy) / ry;
        return a * a + b * b <= 1;
      }
      function rect(px, py, x0, y0, x1, y1) {
        return px >= x0 && px <= x1 && py >= y0 && py <= y1;
      }
      // trapezoid between two rows, given the half widths at each
      function trap(px, py, y0, w0, y1, w1, dx) {
        if (py < y0 || py > y1) return false;
        var t = (py - y0) / (y1 - y0);
        var c = dx || 0;
        return Math.abs(px - c) <= w0 + (w1 - w0) * t;
      }
      function arc(cx, cy, r, a0, a1, n) {
        var pts = [];
        for (var i = 0; i <= n; i++) {
          var a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
          pts.push([cx + r * Math.cos(a), cy - r * Math.sin(a)]);
        }
        return pts;
      }
      var line = 0.022; // thin tubes and rods

      var shapes = [
        // 0 · Juicy Salif (Starck): drop-shaped body on three long legs
        function (x, y) {
          var body = ell(x, y, 0, 0.2, 0.2, 0.2) || trap(x, y, 0.2, 0.2, 0.56, 0.0);
          return body ||
            path(x, y, [[-0.16, 0.3], [-0.26, 0.66], [-0.32, 1]], line) ||
            path(x, y, [[0.16, 0.3], [0.26, 0.66], [0.32, 1]], line) ||
            seg(x, y, 0.0, 0.5, 0.04, 1, line);
        },
        // 1 · Arco lamp (Castiglioni): marble block, steel arc, dome shade
        function (x, y) {
          var base = rect(x, y, -0.5, 0.8, -0.24, 1);
          if (base && big && ell(x, y, -0.37, 0.87, 0.035, 0.035)) return false;
          return base ||
            path(x, y, arc(0.12, 0.62, 0.52, 205, 18, 28), line) ||
            (ell(x, y, 0.62, 0.52, 0.15, 0.13) && y <= 0.52);
        },
        // 2 · Panton chair: one S-shaped cantilever piece
        function (x, y) {
          return path(x, y, [
            [-0.22, 0.0], [-0.19, 0.2], [-0.16, 0.37], [-0.12, 0.44], [-0.04, 0.47], [0.22, 0.47],
            [0.23, 0.52], [0.18, 0.6], [0.1, 0.72], [0.04, 0.84], [0.03, 0.93], [0.08, 0.97], [0.32, 0.97]
          ], 0.04);
        },
        // 3 · Tulip chair (Saarinen): shell on a single pedestal
        function (x, y) {
          var cup = ell(x, y, 0, 0.1, 0.3, 0.4) && y >= 0.1;
          var back = ell(x, y, 0, 0.12, 0.3, 0.1) && y < 0.1;
          return cup || back || trap(x, y, 0.45, 0.035, 0.93, 0.07) || ell(x, y, 0, 0.95, 0.24, 0.05);
        },
        // 4 · Anglepoise-style desk lamp: balanced arms, cone shade
        function (x, y) {
          return ell(x, y, 0, 0.96, 0.2, 0.05) ||
            seg(x, y, 0, 0.94, -0.18, 0.5, line) ||
            seg(x, y, -0.18, 0.5, 0.2, 0.18, line) ||
            ell(x, y, -0.18, 0.5, 0.035, 0.035) ||
            (function () {
              // shade: cone pointing down-right from the end of the arm
              var ux = x - 0.2;
              var uy = y - 0.18;
              var c = Math.cos(-0.9);
              var s = Math.sin(-0.9);
              var a = ux * c - uy * s;
              var b = ux * s + uy * c;
              return a >= -0.02 && a <= 0.22 && Math.abs(b) <= 0.03 + a * 0.55;
            })();
        },
        // 5 · Kettle 9093 (Graves): cone body, arched handle, bird on the spout
        function (x, y) {
          return trap(x, y, 0.36, 0.13, 0.88, 0.28) || rect(x, y, -0.29, 0.88, 0.29, 0.94) ||
            ell(x, y, 0, 0.32, 0.035, 0.035) ||
            path(x, y, arc(0, 0.38, 0.2, 180, 0, 14), line * 1.4) ||
            seg(x, y, 0.2, 0.7, 0.42, 0.5, 0.03) ||
            ell(x, y, 0.44, 0.47, 0.05, 0.025);
        },
        // 6 · Moka pot (Bialetti): two faceted chambers, spout, side handle
        function (x, y) {
          var pot = trap(x, y, 0.12, 0.18, 0.5, 0.1) || trap(x, y, 0.5, 0.12, 0.95, 0.21) ||
            rect(x, y, -0.06, 0.04, 0.06, 0.1) || trap(x, y, 0.08, 0.12, 0.13, 0.19) ||
            trap(x, y, 0.1, 0.02, 0.2, 0.0, 0.22) || seg(x, y, 0.17, 0.16, 0.27, 0.1, 0.025);
          if (pot && big && y > 0.5 - 0.5 / S && y < 0.5 + 0.6 / S) return false;
          return pot || path(x, y, [[-0.16, 0.18], [-0.3, 0.2], [-0.27, 0.44], [-0.12, 0.42]], 0.03);
        },
        // 7 · Savoy vase (Aalto): wavy outline seen from above
        function (x, y) {
          var dx = x;
          var dy = y - 0.5;
          var a = Math.atan2(dy, dx);
          var d = Math.sqrt(dx * dx + dy * dy);
          var r = 0.36 + 0.06 * Math.sin(5 * a) + 0.035 * Math.sin(3 * a + 1.2);
          return d <= r + 0.035 && d >= r - 0.035;
        },
        // 8 · Atollo lamp (Magistretti): cylinder, cone, hemispherical shade
        function (x, y) {
          return (ell(x, y, 0, 0.36, 0.3, 0.27) && y <= 0.36) ||
            trap(x, y, 0.4, 0.0, 0.6, 0.14) ||
            rect(x, y, -0.14, 0.6, 0.14, 1);
        },
        // 9 · Componibili (Kartell): stacked round modules with finger holes
        function (x, y) {
          var r = 0.27;
          var inside = rect(x, y, -r, 0.06, r, 1) || ell(x, y, 0, 0.06, r, 0.04);
          if (!inside) return false;
          if (S >= 24) {
            if ((y > 0.37 && y < 0.37 + 1 / S) || (y > 0.68 && y < 0.68 + 1 / S)) return false;
            if (ell(x, y, 0.16, 0.22, 0.045, 0.045) || ell(x, y, 0.16, 0.53, 0.045, 0.045) || ell(x, y, 0.16, 0.84, 0.045, 0.045)) return false;
          }
          return true;
        }
      ];

      var test = shapes[type % shapes.length];
      var cells = [];
      for (var gy = 0; gy < S; gy++) {
        for (var gx = -S; gx <= S; gx++) {
          if (test(gx / S, (gy + 0.5) / S)) cells.push([gx, gy]);
        }
      }
      return finishShape(cells, S);
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

      // the canvas matches the hero exactly (the last partial cell is cut
      // off): a canvas wider than the screen makes Android Chrome zoom out
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
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
