/* ============================================================
   Pleom — Nav + reveal
   ============================================================ */

(function () {
  "use strict";

  /* ---------- Shared: pinned-section mobile bypass ---------- */
  /* Below this width the CSS drops position:sticky in favor of normal
     flow (see the max-width:760px rules for each *-track/*-pin), so the
     pin/fade JS below must stop overriding opacity/transform or content
     gets stuck at whatever partial fade value the last scroll produced. */

  /* Stable viewport height: on iOS window.innerHeight changes while the
     browser toolbars show/hide, but the pinned sections are sized in lvh.
     A hidden probe sized 100lvh keeps JS and CSS on the same number.
     Read only on resize: reading it during scroll would force a layout
     every frame (lag on iPhone). */
  var vhProbe = document.createElement("div");
  vhProbe.style.cssText = "position:fixed;left:0;top:0;width:0;height:100vh;height:100lvh;visibility:hidden;pointer-events:none";
  document.body.appendChild(vhProbe);
  var cachedVH = vhProbe.offsetHeight || window.innerHeight;
  var cachedVW = window.innerWidth;

  /* Visible height with the browser toolbars shown (svh): pinned content is
     centred in, and must fit, this area, otherwise on iPhone its bottom ends
     up under Safari's toolbar. Equal to the full height on desktop. */
  var svhProbe = document.createElement("div");
  svhProbe.style.cssText = "position:fixed;left:0;top:0;width:0;height:100vh;height:100svh;visibility:hidden;pointer-events:none";
  document.body.appendChild(svhProbe);
  var cachedSVH = svhProbe.offsetHeight || window.innerHeight;
  function visH() {
    return cachedSVH;
  }

  /* iOS fires "resize" every time the toolbars show/hide while scrolling.
     Nothing we measure depends on that (sections are sized in lvh), so the
     re-measure callbacks only run when the width or the lvh really change. */
  var layoutResizeFns = [];
  function onLayoutResize(fn) {
    layoutResizeFns.push(fn);
  }
  window.addEventListener("resize", function () {
    var vh = vhProbe.offsetHeight || window.innerHeight;
    var svh = svhProbe.offsetHeight || window.innerHeight;
    var vw = window.innerWidth;
    if (vh === cachedVH && vw === cachedVW && svh === cachedSVH) return;
    cachedVH = vh;
    cachedSVH = svh;
    cachedVW = vw;
    for (var i = 0; i < layoutResizeFns.length; i++) layoutResizeFns[i]();
  });
  function viewH() {
    return cachedVH;
  }

  /* Write an inline style / custom property only when it changes: during
     scroll most values are already settled, and each write costs a style
     recalculation of the element's subtree. */
  function put(el, prop, value) {
    var cache = el.__pleomStyle || (el.__pleomStyle = {});
    if (cache[prop] === value) return;
    cache[prop] = value;
    if (prop.charAt(0) === "-") el.style.setProperty(prop, value);
    else el.style[prop] = value;
  }

  // Scroll-linked movements are done in CSS (animation-timeline) when the
  // browser supports it: see "Scroll-driven animations" in style.css.
  var scrollDriven = !!(window.CSS && CSS.supports && CSS.supports("animation-timeline: view()")) &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Phones: pinned content stays this far above the bottom of the screen.
  // Safari (iOS 26+) turns its floating toolbar into a solid block when a
  // sticky box comes close to the bottom edge.
  var phoneMQ = window.matchMedia("(max-width: 760px)");
  function bottomReserve() {
    return phoneMQ.matches ? 100 : 0;
  }

  // Content taller than the visible area can't be pinned (its bottom would
  // never be reachable): that section scrolls normally (.is-tall in CSS).
  function fitsPinned(track, contentHeight) {
    // 12px gap under the navbar (stickFloor) + a few px of slack
    var tall = contentHeight > visH() - bottomReserve() - navBottom - 16;
    track.classList.toggle("is-tall", tall);
    return !tall;
  }

  function isPinnedSectionMobile() {
    return false;
  }

  /* ---------- Mobile nav ---------- */

  var toggle = document.querySelector(".nav-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      document.body.classList.toggle("menu-open");
    });
    document.querySelectorAll(".mobile-menu a").forEach(function (a) {
      a.addEventListener("click", function () {
        document.body.classList.remove("menu-open");
      });
    });
  }

  /* ---------- Project slider ---------- */

  document.querySelectorAll("[data-project-track]").forEach(function (track) {
    var wrap = track.closest(".project-slider");
    var prevBtn = wrap.querySelector("[data-project-prev]");
    var nextBtn = wrap.querySelector("[data-project-next]");
    var slide = track.querySelector(".project-slide");

    function step() {
      var gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || 20);
      var width = slide ? slide.getBoundingClientRect().width : 240;
      return width + gap;
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        track.scrollBy({ left: -step(), behavior: "smooth" });
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        track.scrollBy({ left: step(), behavior: "smooth" });
      });
    }
  });

  /* ---------- Scroll indicator ---------- */

  var scrollIndicator = document.querySelector("[data-scroll-indicator]");
  if (scrollIndicator) {
    var toggleScrollIndicator = function () {
      scrollIndicator.classList.toggle("is-hidden", window.scrollY > 60);
    };
    toggleScrollIndicator();
    window.addEventListener("scroll", toggleScrollIndicator, { passive: true });
  }

  /* ---------- Newsletter form ---------- */

  document.querySelectorAll("[data-newsletter-form]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = form.querySelector("input[type=email]");
      var email = input ? input.value : "";
      var note = document.createElement("p");
      note.className = "newsletter-note";
      note.textContent = "Grazie! Ti scriveremo a " + email + " con le prossime novità.";
      form.replaceWith(note);
    });
  });

  /* ---------- Cookie consent ---------- */

  var CONSENT_KEY = "pleom-cookie-consent";

  function getConsent() {
    try {
      return window.localStorage.getItem(CONSENT_KEY);
    } catch (err) {
      return null;
    }
  }

  function setConsent(value) {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch (err) {
      /* localStorage unavailable (private mode, etc.) — banner will just reappear next visit */
    }
    document.dispatchEvent(new CustomEvent("pleom:consent", { detail: { value: value } }));
  }

  var banner = document.querySelector("[data-cookie-banner]");
  if (banner) {
    if (!getConsent()) {
      banner.hidden = false;
    }
    var acceptBtn = banner.querySelector("[data-cookie-accept]");
    var rejectBtn = banner.querySelector("[data-cookie-reject]");
    if (acceptBtn) {
      acceptBtn.addEventListener("click", function () {
        setConsent("accepted");
        banner.hidden = true;
      });
    }
    if (rejectBtn) {
      rejectBtn.addEventListener("click", function () {
        setConsent("rejected");
        banner.hidden = true;
      });
    }
  }

  /* ---------- Shared: nav bottom for scrollytelling centering ---------- */

  var navBottom = 0;
  var centerRaise = 60;

  // Lowest top offset that keeps the content's text (after its own top padding)
  // clear of the fixed navbar when the window is too short to centre it.
  function stickFloor(el) {
    var pad = parseFloat(getComputedStyle(el).paddingTop) || 0;
    return Math.max(0, navBottom + 12 - pad);
  }

  function measureNavBottom() {
    var nav = document.querySelector(".nav-wrap");
    navBottom = nav ? nav.getBoundingClientRect().bottom : 0;
  }

  measureNavBottom();
  onLayoutResize(measureNavBottom);

  /* ---------- Scrollytelling (vantaggi + confronto) ---------- */

  var scrollyTrack = document.querySelector("[data-scrolly-track]");
  if (scrollyTrack && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var scrollyContent = scrollyTrack.querySelector(".scrolly-content");
    var scrollyStats = scrollyTrack.querySelector("[data-scrolly-stats]");
    var scrollyHighlights = Array.prototype.slice.call(scrollyTrack.querySelectorAll("[data-highlight]"));
    var scrollyContentHeight = 0;
    var scrollyTrackTop = 0;
    var scrollyTrackHeight = 0;
    var scrollyStatsSpace = 0;
    var scrollyStick = 0;
    var scrollyDelta = 0;
    var scrollyOff = 0;
    var scrollyTicking = false;
    var scrollyLast = { fade: null, opacity: null, hl: [] };
    var scrollyTall = false;

    function measureScrollyContent() {
      scrollyContentHeight = scrollyContent.offsetHeight;
      scrollyTrackTop = scrollyTrack.getBoundingClientRect().top + window.pageYOffset;
      scrollyTrackHeight = scrollyTrack.offsetHeight;
      scrollyStatsSpace = scrollyStats.offsetHeight + parseFloat(getComputedStyle(scrollyStats).marginTop);
      // + 24: the stat cards start 24px lower
      scrollyTall = !fitsPinned(scrollyTrack, scrollyContent.offsetHeight + 24);
      scrollyContentHeight = scrollyContent.offsetHeight;
      scrollyTrackHeight = scrollyTrack.offsetHeight;
      scrollyStatsSpace = scrollyStats.offsetHeight + parseFloat(getComputedStyle(scrollyStats).marginTop);
      var available = visH() - bottomReserve() - navBottom;
      var headerT = navBottom + (available - (scrollyContentHeight - scrollyStatsSpace)) / 2 - centerRaise;
      var combinedT = navBottom + (available - scrollyContentHeight) / 2 - centerRaise;
      var floorS = stickFloor(scrollyContent);
      // the stat cards start 24px lower and invisible but still there: keep
      // the whole block above the bottom reserve from the first frame
      var lowest = visH() - bottomReserve() - scrollyContentHeight - 24;
      scrollyStick = Math.max(floorS, Math.max(combinedT, Math.min(headerT, lowest)));
      scrollyDelta = Math.max(floorS, combinedT) - scrollyStick;
      scrollyContent.style.setProperty("--stick", scrollyStick + "px");
      scrollyContent.style.setProperty("--scrolly-delta", scrollyDelta + "px");
      scrollyOff = 0;
      scrollyLast = { fade: null, opacity: null, hl: [] };
    }

    function updateScrolly() {
      scrollyTicking = false;
      if (isPinnedSectionMobile()) {
        scrollyContent.style.transform = "";
        scrollyContent.style.opacity = "";
        scrollyStats.style.opacity = "";
        scrollyStats.style.transform = "";
        scrollyStats.style.removeProperty("--grow");
        scrollyHighlights.forEach(function (el) { el.style.removeProperty("--hl"); });
        return;
      }
      if (scrollyTall) {
        put(scrollyContent, "opacity", "1");
        scrollyHighlights.forEach(function (el) { put(el, "--hl", "100%"); });
        if (!scrollDriven) {
          put(scrollyContent, "transform", "none");
          put(scrollyStats, "opacity", "1");
          put(scrollyStats, "transform", "none");
          put(scrollyStats, "--grow", "1");
        }
        return;
      }
      var rect = { top: scrollyTrackTop - window.pageYOffset };
      var scrollRange = scrollyTrackHeight - viewH();
      if (scrollRange <= 0) return;

      var offKey = rect.top >= viewH() ? 1 : rect.top + scrollyTrackHeight <= 0 ? -1 : 0;
      if (offKey !== 0 && offKey === scrollyOff) return;
      scrollyOff = offKey;

      var progress = -rect.top / scrollRange;
      progress = Math.max(0, Math.min(1, progress));
      var animProgress = Math.max(0, Math.min(1, -rect.top / viewH()));

      var panelTop;
      if (rect.top > 0) {
        panelTop = rect.top;
      } else if (rect.top >= -scrollRange) {
        panelTop = 0;
      } else {
        panelTop = rect.top + scrollRange;
      }

      var fadeStart = 0.3;
      var fadeEnd = 0.6;
      var fadeProgress = (animProgress - fadeStart) / (fadeEnd - fadeStart);
      fadeProgress = Math.max(0, Math.min(1, fadeProgress));

      var naturalTop = panelTop;
      // only touch the DOM when a value actually changes: every write
      // invalidates style for the whole table (lag on iPhone)
      var opacity = pinnedFade(naturalTop, scrollyStick, progress, scrollRange);
      if (!scrollDriven && fadeProgress !== scrollyLast.fade) {
        scrollyLast.fade = fadeProgress;
        scrollyContent.style.transform = "translate3d(0," + scrollyDelta * fadeProgress + "px,0)";
        scrollyStats.style.opacity = fadeProgress;
        scrollyStats.style.setProperty("--grow", fadeProgress);
        scrollyStats.style.transform = "translate3d(0," + (24 - 24 * fadeProgress) + "px,0)";
      }
      if (opacity !== scrollyLast.opacity) {
        scrollyLast.opacity = opacity;
        scrollyContent.style.opacity = opacity;
      }

      scrollyHighlights.forEach(function (el, i) {
        var start = 0.1 + i * 0.1;
        var p = Math.max(0, Math.min(1, (animProgress - start) / 0.2));
        if (p !== scrollyLast.hl[i]) {
          scrollyLast.hl[i] = p;
          el.style.setProperty("--hl", p * 100 + "%");
        }
      });
    }

    function onScrollyScroll() {
      if (!scrollyTicking) {
        scrollyTicking = true;
        requestAnimationFrame(updateScrolly);
      }
    }

    window.addEventListener("scroll", onScrollyScroll, { passive: true });
    onLayoutResize(function () {
      measureScrollyContent();
      onScrollyScroll();
    });
    measureScrollyContent();
    updateScrolly();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        measureScrollyContent();
        onScrollyScroll();
      });
    }
  }

  /* ---------- Problema/Soluzione (scrollytelling) ---------- */

  var problemTrack = document.querySelector("[data-problem-track]");
  if (problemTrack && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var problemContent = problemTrack.querySelector(".problem-content");
    var problemContentHeight = 0;
    var problemIconOrder = Array.prototype.slice.call(problemTrack.querySelectorAll("[data-problem-icon]"));
    var problemIconStage = problemIconOrder.length ? problemIconOrder[0].parentNode : null;
    var problemIconsWereVisible = false;
    var problemHighlight = problemTrack.querySelector("[data-highlight]");
    var problemParallax = Array.prototype.slice.call(problemTrack.querySelectorAll("[data-parallax]"));
    var problemParallaxHeights = [];
    var problemStick = 0;
    var problemTrackTop = 0;
    var problemTrackHeight = 0;
    var problemOff = 0;
    var problemTicking = false;
    var problemIconCols = 1;
    var problemTall = false;

    function measureProblemContent() {
      problemContentHeight = problemContent.offsetHeight;
      // icons reveal column by column: on mobile the grid has 2 rows and both
      // rows appear together, left to right
      problemIconCols = problemIconStage
        ? getComputedStyle(problemIconStage).gridTemplateColumns.split(" ").length
        : 1;
      problemTall = !fitsPinned(problemTrack, problemContentHeight);
      problemStick = Math.max(stickFloor(problemContent), navBottom + (visH() - bottomReserve() - navBottom - problemContentHeight) / 2 - centerRaise);
      problemContent.style.setProperty("--stick", problemStick + "px");
      problemParallaxHeights = problemParallax.map(function (el) {
        return el.offsetHeight;
      });
      problemTrackTop = problemTrack.getBoundingClientRect().top + window.pageYOffset;
      problemTrackHeight = problemTrack.offsetHeight;
      problemOff = 0;
    }

    function shuffleProblemIcons() {
      for (var i = problemIconOrder.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = problemIconOrder[i];
        problemIconOrder[i] = problemIconOrder[j];
        problemIconOrder[j] = tmp;
      }
      for (var k = 0; k < problemIconOrder.length; k++) {
        problemIconStage.appendChild(problemIconOrder[k]);
      }
    }

    function updateProblem() {
      problemTicking = false;
      if (isPinnedSectionMobile()) {
        problemContent.style.opacity = "";
        if (problemHighlight) problemHighlight.style.removeProperty("--hl");
        for (var m = 0; m < problemIconOrder.length; m++) {
          problemIconOrder[m].style.opacity = "";
          problemIconOrder[m].style.transform = "";
        }
        return;
      }
      if (problemTall) {
        put(problemContent, "opacity", "1");
        if (problemHighlight) put(problemHighlight, "--hl", "100%");
        for (var t = 0; t < problemIconOrder.length; t++) {
          put(problemIconOrder[t], "opacity", "1");
          put(problemIconOrder[t], "transform", "none");
        }
        return;
      }
      var rect = { top: problemTrackTop - window.pageYOffset };
      var scrollRange = problemTrackHeight - viewH();
      if (scrollRange <= 0) return;

      var offKey = rect.top >= viewH() ? 1 : rect.top + problemTrackHeight <= 0 ? -1 : 0;
      if (offKey !== 0 && offKey === problemOff) return;
      problemOff = offKey;

      var progress = -rect.top / scrollRange;
      progress = Math.max(0, Math.min(1, progress));

      var panelTop;
      if (rect.top > 0) {
        panelTop = rect.top;
      } else if (rect.top >= -scrollRange) {
        panelTop = 0;
      } else {
        panelTop = rect.top + scrollRange;
      }

      var naturalTop = panelTop;
      put(problemContent, "opacity", String(pinnedFade(naturalTop, problemStick, progress, scrollRange)));

      // Parallax images rise from below the panel to above it, each over its own
      // slice of the scroll, and fade out as they reach the top of the viewport.
      var vpH = viewH();
      for (var q = 0; q < problemParallax.length; q++) {
        var img = problemParallax[q];
        var h = problemParallaxHeights[q];
        var from = parseFloat(img.getAttribute("data-start"));
        var to = parseFloat(img.getAttribute("data-end"));
        var t = Math.max(0, Math.min(1, (progress - from) / (to - from)));
        var y = vpH - t * (vpH + h);
        var alpha = Math.max(0, Math.min(1, (y + h) / (vpH * 0.45)));
        put(img, "transform", "translate3d(0," + y + "px,0)");
        put(img, "opacity", String(alpha));
      }

      if (problemHighlight) {
        var hlProgress = Math.max(0, Math.min(1, (progress - 0.4) / 0.3));
        put(problemHighlight, "--hl", hlProgress * 100 + "%");
      }

      var cycleStart = 0.05;
      var cycleEnd = 0.35;
      var stepCount = Math.min(problemIconOrder.length, problemIconCols);
      var cycleProgress = (progress - cycleStart) / (cycleEnd - cycleStart);
      cycleProgress = Math.max(0, Math.min(1, cycleProgress));
      var revealPosition = cycleProgress * stepCount;

      if (revealPosition <= 0) {
        if (problemIconsWereVisible) {
          shuffleProblemIcons();
          problemIconsWereVisible = false;
        }
      } else {
        problemIconsWereVisible = true;
      }

      for (var i = 0; i < problemIconOrder.length; i++) {
        var iconProgress = Math.max(0, Math.min(1, revealPosition - (i % stepCount)));
        put(problemIconOrder[i], "opacity", String(iconProgress));
        put(problemIconOrder[i], "transform", "translate3d(0," + (8 - 8 * iconProgress) + "px,0)");
      }
    }

    function onProblemScroll() {
      if (!problemTicking) {
        problemTicking = true;
        requestAnimationFrame(updateProblem);
      }
    }

    window.addEventListener("scroll", onProblemScroll, { passive: true });
    onLayoutResize(function () {
      measureProblemContent();
      onProblemScroll();
    });
    shuffleProblemIcons();
    measureProblemContent();
    updateProblem();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        measureProblemContent();
        onProblemScroll();
      });
    }
  }

  /* ---------- Tecnologie / Progetti (scrollytelling) ---------- */

  // Opacity shared by every pinned section: same fade-in (panel entering) and
  // same fade-out (last 40vh of the pinned range), whatever the track height.
  function pinnedFade(panelTop, stick, progress, scrollRange, noFadeOut) {
    var vh = viewH();
    var fadeIn = 1 - Math.max(0, Math.min(1, (panelTop - stick) / (vh - stick)));
    var fadeOutDistance = vh * 0.4;
    // On phones the visible area (toolbars shown) is shorter than the lvh the
    // track is sized in: the next section shows up that much earlier, so the
    // fade-out has to end that much earlier too.
    var hidden = Math.max(0, vh - window.innerHeight);
    var fadeOut = (progress * scrollRange - (scrollRange - hidden - fadeOutDistance)) / fadeOutDistance;
    return noFadeOut ? fadeIn : fadeIn * (1 - Math.max(0, Math.min(1, fadeOut)));
  }

  function setupPinnedSection(trackSelector, contentSelector, onProgress, fadeOutStartAt) {
    var track = document.querySelector(trackSelector);
    if (!track || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;

    var content = track.querySelector(contentSelector);
    var contentHeight = 0;
    var trackTop = 0;
    var trackHeight = 0;
    var offState = 0;
    var ticking = false;

    var stick = 0;
    var tall = false;

    function measure() {
      contentHeight = content.offsetHeight;
      trackTop = track.getBoundingClientRect().top + window.pageYOffset;
      trackHeight = track.offsetHeight;
      tall = !fitsPinned(track, contentHeight);
      trackHeight = track.offsetHeight;
      stick = Math.max(stickFloor(content), navBottom + (visH() - bottomReserve() - navBottom - contentHeight) / 2 - centerRaise);
      content.style.setProperty("--stick", stick + "px");
      if (fadeOutStartAt >= 1) {
        content.style.setProperty("--hold-gap", Math.max(0, viewH() - stick - contentHeight) + "px");
      }
      offState = 0;
    }

    function update() {
      ticking = false;
      if (isPinnedSectionMobile()) {
        content.style.opacity = "";
        return;
      }
      if (tall) {
        put(content, "opacity", "1");
        if (onProgress) onProgress(0);
        return;
      }
      var rect = { top: trackTop - window.pageYOffset };
      var scrollRange = trackHeight - viewH();
      if (scrollRange <= 0) return;

      var offKey = rect.top >= viewH() ? 1 : rect.top + trackHeight <= 0 ? -1 : 0;
      if (offKey !== 0 && offKey === offState) return;
      offState = offKey;

      var progress = -rect.top / scrollRange;
      progress = Math.max(0, Math.min(1, progress));

      var panelTop;
      if (rect.top > 0) {
        panelTop = rect.top;
      } else if (rect.top >= -scrollRange) {
        panelTop = 0;
      } else {
        panelTop = rect.top + scrollRange;
      }

      var naturalTop = panelTop;
      put(content, "opacity", String(pinnedFade(naturalTop, stick, progress, scrollRange, fadeOutStartAt >= 1)));

      if (onProgress) onProgress(progress);
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onLayoutResize(function () {
      measure();
      onScroll();
    });
    window.addEventListener("load", function () {
      measure();
      onScroll();
    });
    measure();
    update();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        measure();
        onScroll();
      });
    }

    return {
      refresh: function () {
        measure();
        update();
      }
    };
  }

  var techStrip = document.querySelector(".tech-strip");
  var techMax = null;
  onLayoutResize(function () { techMax = null; });
  window.addEventListener("load", function () { techMax = null; });
  setupPinnedSection("[data-tech-track]", ".tech-content", techStrip ? function (progress) {
    if (techMax === null) {
      var inset = parseFloat(getComputedStyle(techStrip).paddingLeft);
      var lastCard = techStrip.querySelector(".tech-card:last-of-type");
      // offsetLeft ignores transforms, so this stays right while the strip is moved
      techMax = Math.max(0, lastCard.offsetLeft + lastCard.offsetWidth - (techStrip.clientWidth - inset));
    }
    // transform instead of scrollLeft: moved by the compositor, no relayout
    var x = techMax * Math.min(1, progress / 0.6);
    if (scrollDriven) put(techStrip, "--tech-max", techMax + "px");
    else put(techStrip, "--tech-x", -x + "px");
    if (techStrip.markCurrent) techStrip.markCurrent(x);
  } : null);
  setupPinnedSection("[data-projects-track]", ".projects-content");
  setupPinnedSection("[data-cta-track]", ".cta-content", null, 1);

  /* ---------- Mobile: highlight the card on screen (no hover on touch) ---------- */

  document.querySelectorAll(".project-track, .tech-strip").forEach(function (strip) {
    var cards = strip.querySelectorAll(".project-slide, .tech-card");
    if (!cards.length) return;
    var isTech = strip.classList.contains("tech-strip");
    var mobile = window.matchMedia("(max-width: 760px)");
    var offsets = [];
    var current = null;
    var ticking = false;

    function measure() {
      offsets = [];
      for (var i = 0; i < cards.length; i++) offsets.push(cards[i].offsetLeft - cards[0].offsetLeft);
    }

    // x = how far the strip has moved; the current card is the one whose
    // left edge is closest to the start (offsets cached, no layout reads)
    function markCurrent(x) {
      var next = null;
      if (mobile.matches) {
        var best = Infinity;
        for (var i = 0; i < offsets.length; i++) {
          var d = Math.abs(offsets[i] - x);
          if (d < best) { best = d; next = cards[i]; }
        }
      }
      if (next !== current) {
        if (current) current.classList.remove("is-current");
        if (next) next.classList.add("is-current");
        current = next;
      }
    }

    measure();
    onLayoutResize(function () { measure(); markCurrent(isTech ? 0 : strip.scrollLeft); });
    window.addEventListener("load", measure);

    // tech strips are moved by the page scroll (markCurrent called from the
    // pinned section); swiped strips (projects, or tech when its section is
    // too tall to pin) report through their own scroll
    strip.markCurrent = markCurrent;
    strip.addEventListener("scroll", function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(function () { ticking = false; markCurrent(strip.scrollLeft); });
      }
    }, { passive: true });
    markCurrent(0);
  });

  /* ---------- Mobile: swipe carousels without a scroll container ---------- */
  // A horizontally scrollable element inside a pinned (sticky) block makes
  // Safari (iOS 26+) paint its toolbar as a solid block (tested on iPhone).
  // On phones the project carousels are therefore not scrollable: the track
  // follows the finger with a transform and snaps to the nearest card.

  document.querySelectorAll("[data-project-track]").forEach(function (track) {
    var cards = track.querySelectorAll(".project-slide");
    if (cards.length < 2) return;
    var mobile = window.matchMedia("(max-width: 760px)");
    var stops = [];
    var x = 0;
    var drag = null;

    function measure() {
      stops = [];
      if (!mobile.matches) {
        track.style.transform = "";
        x = 0;
        return;
      }
      var pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      var first = cards[0].offsetLeft;
      var last = cards[cards.length - 1];
      var max = Math.max(0, pad + (last.offsetLeft - first) + last.offsetWidth + pad - window.innerWidth);
      for (var i = 0; i < cards.length; i++) stops.push(Math.min(max, cards[i].offsetLeft - first));
      x = Math.min(x, max);
      apply(false);
    }

    function apply(animate) {
      track.classList.toggle("is-dragging", !animate);
      track.style.transform = "translate3d(" + -x + "px,0,0)";
      if (track.markCurrent) track.markCurrent(x);
    }

    function nearest(target) {
      var best = 0;
      for (var i = 1; i < stops.length; i++) {
        if (Math.abs(stops[i] - target) < Math.abs(stops[best] - target)) best = i;
      }
      return best;
    }

    track.addEventListener("pointerdown", function (e) {
      if (!mobile.matches || !stops.length) return;
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x0: x, lock: null, lx: e.clientX, lt: e.timeStamp, v: 0 };
    });

    track.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.sx;
      var dy = e.clientY - drag.sy;
      if (drag.lock === null) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        drag.lock = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (drag.lock === "x" && track.setPointerCapture) track.setPointerCapture(e.pointerId);
      }
      if (drag.lock !== "x") return;
      var dt = Math.max(1, e.timeStamp - drag.lt);
      drag.v = (e.clientX - drag.lx) / dt;     // px per ms, + = finger to the right
      drag.lx = e.clientX;
      drag.lt = e.timeStamp;
      var max = stops[stops.length - 1];
      var nx = drag.x0 - dx;
      // rubber band past the first / last card
      if (nx < 0) nx = nx / 3;
      if (nx > max) nx = max + (nx - max) / 3;
      x = nx;
      apply(false);
    });

    function release(e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      var d = drag;
      drag = null;
      if (d.lock !== "x") return;
      var start = nearest(d.x0);
      var i = nearest(x - d.v * 180);           // a flick carries on a bit
      if (i === start && Math.abs(x - d.x0) > 40) i = start + (x > d.x0 ? 1 : -1);
      i = Math.max(0, Math.min(stops.length - 1, i));
      x = stops[i];
      apply(true);
    }

    track.addEventListener("pointerup", release);
    track.addEventListener("pointercancel", release);

    measure();
    onLayoutResize(measure);
    window.addEventListener("load", measure);
  });

  /* ---------- Client logos (fade in / fade out) ---------- */

  document.querySelectorAll("[data-client-logos]").forEach(function (box) {
    var logos = box.querySelectorAll(".client-logo");
    if (logos.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var current = 0;
    setInterval(function () {
      if (document.hidden) return;
      logos[current].classList.remove("is-active");
      current = (current + 1) % logos.length;
      logos[current].classList.add("is-active");
    }, 2600);
  });

  /* ---------- Inquiry form ---------- */

  // Sends to data-endpoint (e.g. a Formspree/Web3Forms URL) when it is set;
  // otherwise opens the visitor's mail client with the request prefilled.
  document.querySelectorAll("[data-inquiry-form]").forEach(function (form) {
    var status = form.querySelector(".form-status");
    var mailto = form.getAttribute("data-mailto");

    function say(text, isError) {
      status.textContent = text;
      status.classList.toggle("is-error", !!isError);
    }

    function openMail(data) {
      var body = [
        "Nome: " + data.nome,
        "Email: " + data.email,
        "Azienda: " + (data.azienda || "-"),
        "Tipo di richiesta: " + data.tipo,
        "",
        data.messaggio
      ].join("\n");
      window.location.href =
        "mailto:" + mailto +
        "?subject=" + encodeURIComponent("Richiesta dal sito - " + data.tipo) +
        "&body=" + encodeURIComponent(body);
      say("Si apre la tua app di posta: premi invio per mandarci la richiesta.");
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var fd = new FormData(form);
      if (fd.get("_gotcha")) return;
      var data = {
        nome: fd.get("nome"),
        email: fd.get("email"),
        azienda: fd.get("azienda"),
        tipo: fd.get("tipo"),
        messaggio: fd.get("messaggio")
      };

      var endpoint = form.getAttribute("data-endpoint");
      if (!endpoint) {
        openMail(data);
        return;
      }

      form.classList.add("is-sending");
      say("Invio in corso…");
      fetch(endpoint, { method: "POST", body: fd, headers: { Accept: "application/json" } })
        .then(function (res) {
          if (!res.ok) throw new Error("bad response");
          form.reset();
          say("Grazie! Abbiamo ricevuto la tua richiesta e ti risponderemo a breve.");
        })
        .catch(function () {
          say("Invio non riuscito. Ti apriamo la mail per mandarcela direttamente.", true);
          openMail(data);
        })
        .then(function () {
          form.classList.remove("is-sending");
        });
    });
  });

  /* ---------- Track colour = panel colour ---------- */
  // On phones the pinned box stops short of the screen bottom (see "Pinned
  // sections vs Safari's toolbar" in style.css): the track shows below it,
  // so it gets the same background as its panel.
  [
    [".problem-track", ".problem-panel"],
    [".scrolly-track", ".scrolly-panel"],
    [".tech-track", ".tech-panel"],
    [".projects-track", ".projects-panel"],
    [".cta-track", ".cta-panel"]
  ].forEach(function (pair) {
    document.querySelectorAll(pair[0]).forEach(function (track) {
      var panel = track.querySelector(pair[1]);
      if (panel) track.style.backgroundColor = getComputedStyle(panel).backgroundColor;
    });
  });

  /* ---------- Second measuring pass ---------- */
  // A section switching to .is-tall changes the height of the page below it:
  // measure everything again once all sections are set up, and after load.
  function remeasureAll() {
    for (var i = 0; i < layoutResizeFns.length; i++) layoutResizeFns[i]();
    window.dispatchEvent(new Event("scroll"));
  }
  remeasureAll();
  window.addEventListener("load", remeasureAll);

  /* ---------- Reveal on scroll ---------- */

  var revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    revealEls.forEach(function (el) {
      io.observe(el);
    });
  }
})();
