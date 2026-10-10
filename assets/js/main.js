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
     A hidden probe sized 100lvh keeps JS and CSS on the same number. */
  var vhProbe = document.createElement("div");
  vhProbe.style.cssText = "position:fixed;left:0;top:0;width:0;height:100vh;height:100lvh;visibility:hidden;pointer-events:none";
  document.body.appendChild(vhProbe);
  function viewH() {
    return vhProbe.offsetHeight || window.innerHeight;
  }

  /* Browser chrome colour (status bar / toolbar) follows the section
     under each edge of the screen. Older Safari reads theme-color; Safari 26
     ignores it and samples fixed elements touching the edges, so two thin
     full-width fixed strips carry the colour of what is underneath. */
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  if (!themeMeta) {
    themeMeta = document.createElement("meta");
    themeMeta.name = "theme-color";
    document.head.appendChild(themeMeta);
  }
  function makeEdge(side) {
    var el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:fixed;left:0;right:0;" + side + ":0;height:2px;z-index:2147483646;pointer-events:none";
    document.body.appendChild(el);
    return el;
  }
  var edgeTop = makeEdge("top");
  var edgeBottom = makeEdge("bottom");
  var lastTop = "";
  var lastBottom = "";
  var themeTicking = false;
  // First non-transparent background under (1, y), skipping fixed layers
  // (navbar, cookie banner, the edge strips) so we read the section itself.
  function isInFixed(el) {
    for (var n = el; n && n !== document.body; n = n.parentElement) {
      if (getComputedStyle(n).position === "fixed") return true;
    }
    return false;
  }
  function colorAt(y) {
    var stack = document.elementsFromPoint ? document.elementsFromPoint(1, y) : [document.elementFromPoint(1, y)];
    var el = null;
    for (var i = 0; i < stack.length; i++) {
      if (stack[i] && !isInFixed(stack[i])) { el = stack[i]; break; }
    }
    while (el) {
      var c = getComputedStyle(el).backgroundColor;
      if (c && c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c)) return c;
      el = el.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  }
  function updateThemeColor() {
    themeTicking = false;
    var top = colorAt(3);
    var bottom = colorAt(window.innerHeight - 3);
    if (top !== lastTop) {
      lastTop = top;
      themeMeta.setAttribute("content", top);
      edgeTop.style.backgroundColor = top;
      document.documentElement.style.backgroundColor = top;
    }
    if (bottom !== lastBottom) {
      lastBottom = bottom;
      edgeBottom.style.backgroundColor = bottom;
    }
  }
  function onThemeScroll() {
    if (!themeTicking) { themeTicking = true; requestAnimationFrame(updateThemeColor); }
  }
  window.addEventListener("scroll", onThemeScroll, { passive: true });
  window.addEventListener("resize", onThemeScroll);
  updateThemeColor();

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
  window.addEventListener("resize", measureNavBottom);

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

    function measureScrollyContent() {
      scrollyContentHeight = scrollyContent.offsetHeight;
      scrollyTrackTop = scrollyTrack.getBoundingClientRect().top + window.pageYOffset;
      scrollyTrackHeight = scrollyTrack.offsetHeight;
      scrollyStatsSpace = scrollyStats.offsetHeight + parseFloat(getComputedStyle(scrollyStats).marginTop);
      var available = viewH() - navBottom;
      var headerT = navBottom + (available - (scrollyContentHeight - scrollyStatsSpace)) / 2 - centerRaise;
      var combinedT = navBottom + (available - scrollyContentHeight) / 2 - centerRaise;
      var floorS = stickFloor(scrollyContent);
      scrollyStick = Math.max(floorS, headerT);
      scrollyDelta = Math.max(floorS, combinedT) - scrollyStick;
      scrollyContent.style.setProperty("--stick", scrollyStick + "px");
      scrollyOff = 0;
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
      scrollyContent.style.transform = "translate3d(0," + scrollyDelta * fadeProgress + "px,0)";

      scrollyContent.style.opacity = pinnedFade(naturalTop, scrollyStick, progress, scrollRange);

      scrollyStats.style.opacity = fadeProgress;
      scrollyStats.style.setProperty("--grow", fadeProgress);
      scrollyStats.style.transform = "translate3d(0," + (24 - 24 * fadeProgress) + "px,0)";

      scrollyHighlights.forEach(function (el, i) {
        var start = 0.1 + i * 0.1;
        var p = Math.max(0, Math.min(1, (animProgress - start) / 0.2));
        el.style.setProperty("--hl", p * 100 + "%");
      });
    }

    function onScrollyScroll() {
      if (!scrollyTicking) {
        scrollyTicking = true;
        requestAnimationFrame(updateScrolly);
      }
    }

    window.addEventListener("scroll", onScrollyScroll, { passive: true });
    window.addEventListener("resize", function () {
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

    function measureProblemContent() {
      problemContentHeight = problemContent.offsetHeight;
      problemStick = Math.max(stickFloor(problemContent), navBottom + (viewH() - navBottom - problemContentHeight) / 2 - centerRaise);
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
      problemContent.style.opacity = pinnedFade(naturalTop, problemStick, progress, scrollRange);

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
        img.style.transform = "translate3d(0," + y + "px,0)";
        img.style.opacity = alpha;
      }

      if (problemHighlight) {
        var hlProgress = Math.max(0, Math.min(1, (progress - 0.4) / 0.3));
        problemHighlight.style.setProperty("--hl", hlProgress * 100 + "%");
      }

      var cycleStart = 0.05;
      var cycleEnd = 0.35;
      var stepCount = problemIconOrder.length;
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

      for (var i = 0; i < stepCount; i++) {
        var iconProgress = Math.max(0, Math.min(1, revealPosition - i));
        problemIconOrder[i].style.opacity = iconProgress;
        problemIconOrder[i].style.transform = "translate3d(0," + (8 - 8 * iconProgress) + "px,0)";
      }
    }

    function onProblemScroll() {
      if (!problemTicking) {
        problemTicking = true;
        requestAnimationFrame(updateProblem);
      }
    }

    window.addEventListener("scroll", onProblemScroll, { passive: true });
    window.addEventListener("resize", function () {
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

    function measure() {
      contentHeight = content.offsetHeight;
      trackTop = track.getBoundingClientRect().top + window.pageYOffset;
      trackHeight = track.offsetHeight;
      stick = Math.max(stickFloor(content), navBottom + (viewH() - navBottom - contentHeight) / 2 - centerRaise);
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
      content.style.opacity = pinnedFade(naturalTop, stick, progress, scrollRange, fadeOutStartAt >= 1);

      if (onProgress) onProgress(progress);
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () {
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
  window.addEventListener("resize", function () { techMax = null; });
  window.addEventListener("load", function () { techMax = null; });
  setupPinnedSection("[data-tech-track]", ".tech-content", techStrip ? function (progress) {
    if (techMax === null) {
      var inset = parseFloat(getComputedStyle(techStrip).paddingLeft);
      var lastCard = techStrip.querySelector(".tech-card:last-of-type");
      techMax = Math.min(
        lastCard.offsetLeft + lastCard.offsetWidth - (techStrip.clientWidth - inset),
        techStrip.scrollWidth - techStrip.clientWidth
      );
    }
    techStrip.scrollLeft = techMax * Math.min(1, progress / 0.6);
  } : null);
  setupPinnedSection("[data-projects-track]", ".projects-content");
  setupPinnedSection("[data-cta-track]", ".cta-content", null, 1);

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
