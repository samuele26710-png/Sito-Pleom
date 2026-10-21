/* ============================================================
   Pleom — navigation, pinned sections, carousels, forms, consent
   ============================================================ */

(function () {
  "use strict";

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

  // Top of a pinned block of height h: centred between the navbar and the
  // bottom of the visible area, raised only as much as needed to keep the
  // bottom reserve free.
  // Bottom of what the visitor actually sees. On iOS 26+ Safari's toolbar
  // floats over the page (~100px, measured on an iPhone screenshot) and the
  // page continues under it: the visible part ends above the toolbar. Where
  // the toolbar doesn't overlap (svh already shorter), svh is the bottom.
  // centring: between the navbar and the top of Safari's address pill,
  // ~81px above the bottom of the page on iOS 26 (measured on a screenshot)
  // Measured on iPhone screenshots: the address pill's top edge is 81px above
  // the bottom of the page with the toolbar expanded and ~46px with it
  // collapsed (the usual state while scrolling the pinned sections). iOS
  // reports a "small viewport" (svh) shorter than both, so svh can't be used:
  // content centred on it sat ~28px too high. Centred on the collapsed pill:
  // that's what is on screen while the pinned sections are being scrolled.
  var PILL_TOP = 46;
  function visibleBottom() {
    return phoneMQ.matches ? viewH() - PILL_TOP : visH();
  }

  // Top of a pinned block so that what is visible in it (its content box,
  // without the empty top padding) sits halfway between the navbar and the
  // bottom of the screen.
  function centreFor(el, h) {
    var pad = parseFloat(getComputedStyle(el).paddingTop) || 0;
    return centredTop(h - pad) - pad;
  }

  function centredTop(h) {
    // truly centred between the navbar and the bottom of the visible area
    var centred = navBottom + (visibleBottom() - navBottom - h) / 2;
    // ...but never closer than bottomReserve() to the bottom edge (Safari's
    // toolbar turns solid when a sticky box gets there)
    var floorBottom = phoneMQ.matches ? viewH() - bottomReserve() : visibleBottom();
    return Math.min(centred, visibleBottom() - h, floorBottom - h);
  }

  // Content taller than the visible area can't be pinned (its bottom would
  // never be reachable): that section scrolls normally (.is-tall in CSS).
  function fitsPinned(track, contentHeight) {
    // 12px gap under the navbar (stickFloor) + a few px of slack
    var lowest = phoneMQ.matches ? Math.min(visibleBottom(), viewH() - bottomReserve()) : visibleBottom();
    var tall = contentHeight > lowest - navBottom - 16;
    track.classList.toggle("is-tall", tall);
    return !tall;
  }

  /* Phones: the content block is sticky only while it actually sits pinned
     (see "Pinned sections vs Safari's toolbar" in style.css). Entering from
     the bottom and leaving at the top it is a plain block: a sticky box near
     either edge of the screen is what makes Safari paint its bars solid.
     The switch happens where both positions coincide (start) or once the
     block has faded out (end), so nothing jumps on screen. */
  // layout position (offsetTop ignores transforms, so the CSS pin below and
  // the scroll-driven movements don't skew the measure)
  function docTop(el) {
    var y = 0;
    for (; el; el = el.offsetParent) y += el.offsetTop;
    return y;
  }
  function naturalOffset(content, track) {
    content.classList.remove("is-stuck");
    return docTop(content) - docTop(track);
  }
  function setStuck(content, trackTopOnScreen, offset, stick, progress, hold) {
    if (cssPin()) {
      content.classList.remove("is-stuck");
      calibratePin(content, trackTopOnScreen);
      return;
    }
    var stuck = !phoneMQ.matches || (trackTopOnScreen + offset <= stick + 0.5 && (hold || progress < 1));
    content.classList.toggle("is-stuck", stuck);
  }

  /* Phones with scroll-driven animations: no sticky at all. The block stays
     in the flow and a CSS animation tied to the track's view timeline moves
     it down exactly as much as the page scrolls while it is pinned (.sd-pin
     in style.css). The browser applies it in the same pass as the scroll, so
     a fast flick can't carry the block past its place before the JS catches
     up (the sticky switch above always lands a frame late). Values are in px
     from "contain 0" (track top at the top of the screen). */
  function cssPin() {
    return scrollDriven && phoneMQ.matches;
  }
  // Offset between the browser's view timelines and the page (Safari iOS 26+
  // counts from the real top of the screen, under the status bar): an
  // invisible probe, taller than the screen at the top of the document, with
  // a child whose translate equals its timeline position. 0 elsewhere.
  var pinProbe = null;
  var pinProbeReady = false;
  function pinTimelineOffset() {
    if (!pinProbe) {
      if (!scrollDriven) return 0;
      var box = document.createElement("div");
      box.setAttribute("aria-hidden", "true");
      box.style.cssText = "position:absolute;top:0;left:0;width:1px;height:calc(100vh + 100px);height:calc(100lvh + 100px);visibility:hidden;pointer-events:none;view-timeline-name:--pin-probe;view-timeline-axis:block";
      pinProbe = document.createElement("div");
      pinProbe.className = "pin-probe";
      box.appendChild(pinProbe);
      document.body.appendChild(box);
      // its timeline only resolves on a rendered frame: measure again then
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          pinProbeReady = true;
          remeasureAll();
        });
      });
    }
    if (!pinProbeReady) return 0;
    var t = parseFloat((getComputedStyle(pinProbe).translate || "").split(" ")[1]);
    if (isNaN(t)) return 0;
    var k = t - window.pageYOffset;
    return Math.abs(k) < 1 ? 0 : k;
  }

  function applyCssPin(content, track, offset, stick, height, hold, tall) {
    var on = cssPin() && !tall;
    content.classList.toggle("sd-pin", on);
    if (!on) {
      content.__pinKey = null;
      return;
    }
    var trackH = track.offsetHeight;
    var mb = parseFloat(getComputedStyle(content).marginBottom) || 0;
    // pinned from where the block reaches its place...
    var start = offset - stick;
    // ...until the end of the pinned range (or the bottom of the track)
    var bottom = trackH - mb - stick - height;
    var end = hold ? bottom : Math.min(trackH - viewH(), bottom);
    if (end < start) end = start;
    var k = pinTimelineOffset();
    start += k;
    end += k;
    content.__pin = { start: start, end: end, stick: stick, k: k, done: false };
    setPinRange(content, start, end);
  }

  // A running animation doesn't pick up new values of the custom properties
  // in its animation-range: restart it whenever the range changes.
  function setPinRange(content, start, end) {
    var key = start + "/" + end;
    if (content.__pinKey === key) return;
    content.__pinKey = key;
    content.style.setProperty("--pin-start", start + "px");
    content.style.setProperty("--pin-end", end + "px");
    content.style.setProperty("--pin-len", end - start + "px");
    content.classList.remove("sd-pin");
    void content.offsetWidth;
    content.classList.add("sd-pin");
  }

  // Safari (iOS 26+) draws the page under the status bar and starts its view
  // timelines from the real top of the screen, so the CSS pin can hold the
  // block a few dozen px off. The first time a section is pinned, compare
  // where the block actually is with where it should be and shift the range
  // by the difference (no-op where the browser already matches).
  function calibratePin(content, trackTopOnScreen) {
    var d = content.__pin;
    if (!d || d.done) return;
    var x = -trackTopOnScreen + d.k;
    if (x < d.start + 30 || x > d.end - 30) return;
    d.done = true;
    // the pin animates `translate` only (the table's own slide uses
    // `transform`): compare the applied value with the expected one
    var parts = getComputedStyle(content).translate.split(" ");
    var actual = parseFloat(parts[1] || 0) || 0;
    var k = actual - (x - d.start);
    if (Math.abs(k) < 1) return;
    d.start += k;
    d.end += k;
    setPinRange(content, d.start, d.end);
  }

  /* Highlight that sweeps line by line: when the phrase wraps, each line gets
     its own highlight (.hl) and they fill one after the other. The element
     keeps data-highlight; its lines are rebuilt whenever the width changes. */
  function splitHighlightLines(el) {
    var text = el.getAttribute("data-text") || el.textContent;
    el.classList.remove("hl-lines");
    el.textContent = text;
    // measure where the words wrap
    var words = text.split(" ");
    el.innerHTML = words.map(function (w) { return "<span>" + w + "</span>"; }).join(" ");
    var spans = el.querySelectorAll("span");
    var lines = [];
    var lastTop = null;
    for (var i = 0; i < spans.length; i++) {
      var t = spans[i].offsetTop;
      if (lastTop === null || Math.abs(t - lastTop) > 4) { lines.push([]); lastTop = t; }
      lines[lines.length - 1].push(words[i]);
    }
    if (lines.length < 2 || !phoneMQ.matches) {
      // one line (or desktop): keep the original single highlight
      el.textContent = text;
      el.lines = null;
      return;
    }
    el.classList.add("hl-lines");
    el.innerHTML = lines.map(function (l) {
      var t = l.join(" ");
      return '<span class="hl hl-line" data-text="' + t.replace(/"/g, "&quot;") + '">' + t + "</span>";
    }).join("");
    el.lines = Array.prototype.slice.call(el.querySelectorAll(".hl-line"));
  }

  function setHighlight(el, p) {
    if (!el.lines) {
      put(el, "--hl", p * 100 + "%");
      return;
    }
    var n = el.lines.length;
    for (var i = 0; i < n; i++) {
      var lp = Math.max(0, Math.min(1, p * n - i));
      put(el.lines[i], "--hl", lp * 100 + "%");
    }
  }

  /* ---------- Mobile nav ---------- */

  var toggle = document.querySelector(".nav-toggle");
  var mobileMenu = document.querySelector(".mobile-menu");
  // Phones: the menu panel sits behind the navbar at the navbar's height and
  // grows to its content height when open (CSS animates "height"), so its
  // shadow travels with the bottom edge.
  function setMenu(open) {
    document.body.classList.toggle("menu-open", open);
    if (mobileMenu) mobileMenu.style.height = open ? mobileMenu.scrollHeight + "px" : "";
  }
  if (toggle) {
    toggle.addEventListener("click", function () {
      setMenu(!document.body.classList.contains("menu-open"));
    });
    document.querySelectorAll(".mobile-menu a").forEach(function (a) {
      a.addEventListener("click", function () {
        setMenu(false);
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

  /* Google Analytics 4: loaded only after the visitor accepts the cookies
     (banner below). Until then nothing is requested from Google; consent
     mode starts "denied" and no advertising features are used. */
  var GA_ID = "G-EYBZFYE5ZJ";
  var gaLoaded = false;
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied"
  });

  function startAnalytics() {
    gtag("consent", "update", { analytics_storage: "granted" });
    if (gaLoaded) return;
    gaLoaded = true;
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(script);
    gtag("js", new Date());
    gtag("config", GA_ID, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
  }

  // consent withdrawn: stop and remove the Analytics cookies (_ga, _ga_*)
  function stopAnalytics() {
    gtag("consent", "update", { analytics_storage: "denied" });
    var host = location.hostname.replace(/^www\./, "");
    document.cookie.split(";").forEach(function (c) {
      var name = c.split("=")[0].trim();
      if (name.indexOf("_ga") !== 0) return;
      ["", "; domain=" + host, "; domain=." + host].forEach(function (d) {
        document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + d;
      });
    });
  }

  if (getConsent() === "accepted") startAnalytics();

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
        startAnalytics();
      });
    }
    if (rejectBtn) {
      rejectBtn.addEventListener("click", function () {
        var wasAccepted = getConsent() === "accepted";
        setConsent("rejected");
        banner.hidden = true;
        if (wasAccepted) stopAnalytics();
      });
    }
    // "Preferenze cookie" in the footer: show the choice again
    document.querySelectorAll("[data-cookie-settings]").forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        banner.hidden = false;
      });
    });
  }

  /* ---------- Shared: nav bottom for scrollytelling centering ---------- */

  var navBottom = 0;

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
    var scrollyOffset = 0;

    function measureScrollyContent() {
      scrollyContentHeight = scrollyContent.offsetHeight;
      scrollyTrackTop = scrollyTrack.getBoundingClientRect().top + window.pageYOffset;
      scrollyOffset = naturalOffset(scrollyContent, scrollyTrack);
      scrollyTrackHeight = scrollyTrack.offsetHeight;
      scrollyStatsSpace = scrollyStats.offsetHeight + parseFloat(getComputedStyle(scrollyStats).marginTop);
      // + 24: the stat cards start 24px lower
      scrollyTall = !fitsPinned(scrollyTrack, scrollyContent.offsetHeight + 24);
      scrollyContentHeight = scrollyContent.offsetHeight;
      scrollyTrackHeight = scrollyTrack.offsetHeight;
      scrollyStatsSpace = scrollyStats.offsetHeight + parseFloat(getComputedStyle(scrollyStats).marginTop);
      var headerT = centreFor(scrollyContent, scrollyContentHeight - scrollyStatsSpace);
      var combinedT = centreFor(scrollyContent, scrollyContentHeight);
      var floorS = stickFloor(scrollyContent);
      // the stat cards start 24px lower and invisible but still there: keep
      // the whole block above the bottom reserve from the first frame
      var lowest = (phoneMQ.matches ? Math.min(visibleBottom(), viewH() - bottomReserve()) : visibleBottom()) - scrollyContentHeight - 24;
      scrollyStick = Math.max(floorS, Math.max(combinedT, Math.min(headerT, lowest)));
      scrollyDelta = Math.max(floorS, combinedT) - scrollyStick;
      scrollyContent.style.setProperty("--stick", scrollyStick + "px");
      scrollyContent.style.setProperty("--scrolly-delta", scrollyDelta + "px");
      applyCssPin(scrollyContent, scrollyTrack, scrollyOffset, scrollyStick, scrollyContentHeight, false, scrollyTall);
      scrollyOff = 0;
      scrollyLast = { fade: null, opacity: null, hl: [] };
    }

    function updateScrolly() {
      scrollyTicking = false;
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
      setStuck(scrollyContent, rect.top, scrollyOffset, scrollyStick, progress, false);
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
    var problemStick = 0;
    var problemTrackTop = 0;
    var problemTrackHeight = 0;
    var problemOff = 0;
    var problemTicking = false;
    var problemIconCols = 1;
    var problemTall = false;
    var problemOffset = 0;

    function measureProblemContent() {
      if (problemHighlight) splitHighlightLines(problemHighlight);
      problemContentHeight = problemContent.offsetHeight;
      // icons reveal column by column: on mobile the grid has 2 rows and both
      // rows appear together, left to right
      problemIconCols = problemIconStage
        ? getComputedStyle(problemIconStage).gridTemplateColumns.split(" ").length
        : 1;
      problemTall = !fitsPinned(problemTrack, problemContentHeight);
      problemStick = Math.max(stickFloor(problemContent), centreFor(problemContent, problemContentHeight));
      problemContent.style.setProperty("--stick", problemStick + "px");
      problemTrackTop = problemTrack.getBoundingClientRect().top + window.pageYOffset;
      problemOffset = naturalOffset(problemContent, problemTrack);
      problemTrackHeight = problemTrack.offsetHeight;
      applyCssPin(problemContent, problemTrack, problemOffset, problemStick, problemContentHeight, false, problemTall);
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
      if (problemTall) {
        put(problemContent, "opacity", "1");
        if (problemHighlight) setHighlight(problemHighlight, 1);
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
      setStuck(problemContent, rect.top, problemOffset, problemStick, progress, false);

      if (problemHighlight) {
        var hlProgress = Math.max(0, Math.min(1, (progress - 0.4) / 0.3));
        setHighlight(problemHighlight, hlProgress);
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
    var offset = 0;

    function measure() {
      contentHeight = content.offsetHeight;
      trackTop = track.getBoundingClientRect().top + window.pageYOffset;
      trackHeight = track.offsetHeight;
      tall = !fitsPinned(track, contentHeight);
      offset = naturalOffset(content, track);
      trackHeight = track.offsetHeight;
      stick = Math.max(stickFloor(content), centreFor(content, contentHeight));
      content.style.setProperty("--stick", stick + "px");
      if (fadeOutStartAt >= 1) {
        content.style.setProperty("--hold-gap", Math.max(0, viewH() - stick - contentHeight) + "px");
      }
      applyCssPin(content, track, offset, stick, contentHeight, fadeOutStartAt >= 1, tall);
      offState = 0;
    }

    function update() {
      ticking = false;
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
      setStuck(content, rect.top, offset, stick, progress, fadeOutStartAt >= 1);

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
  /* ---------- Sostenibilità: impact cards (appear one by one, flip) ---------- */

  var impactCards = Array.prototype.slice.call(document.querySelectorAll("[data-impact-card]"));
  if (impactCards.length) {
    var impactTrack = impactCards[0].closest("[data-tech-track]");
    var impactTicking = false;
    var reduceImpact = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // pinned: each card shows up after its own slice of the pinned scroll;
    // section scrolling normally (.is-tall): each card as it comes on screen
    var updateImpact = function () {
      impactTicking = false;
      var vh = viewH();
      if (reduceImpact) {
        impactCards.forEach(function (c) { c.classList.add("is-in"); });
        return;
      }
      if (impactTrack.classList.contains("is-tall")) {
        impactCards.forEach(function (c) {
          c.classList.toggle("is-in", c.getBoundingClientRect().top < vh * 0.92);
        });
        return;
      }
      var r = impactTrack.getBoundingClientRect();
      var range = Math.max(1, impactTrack.offsetHeight - vh);
      var progress = -r.top / range;
      impactCards.forEach(function (c, i) {
        c.classList.toggle("is-in", progress > 0.04 + i * 0.1);
      });
    };
    var onImpactScroll = function () {
      if (!impactTicking) {
        impactTicking = true;
        requestAnimationFrame(updateImpact);
      }
    };
    window.addEventListener("scroll", onImpactScroll, { passive: true });
    onLayoutResize(onImpactScroll);
    updateImpact();

    impactCards.forEach(function (card) {
      card.addEventListener("click", function () {
        var flipped = card.classList.toggle("is-flipped");
        card.setAttribute("aria-pressed", flipped ? "true" : "false");
      });
    });
  }

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
      var slider = track.closest(".project-slider");
      if (slider) slider.classList.add("is-swiped");
    }

    track.addEventListener("pointerup", release);
    track.addEventListener("pointercancel", release);

    measure();
    onLayoutResize(measure);
    window.addEventListener("load", measure);
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
})();
