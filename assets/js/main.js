/* Pleom — sito: menu, comparse, cookie + Analytics, modulo contatti */
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  /* ---------- Header: filetto quando si scorre ---------- */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Menu mobile ---------- */
  var toggle = document.querySelector("[data-menu-toggle]");
  var menu = document.querySelector("[data-mobile-menu]");
  if (toggle && menu) {
    var setMenu = function (open) {
      menu.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Chiudi menu" : "Apri menu");
    };
    toggle.addEventListener("click", function () {
      setMenu(menu.hidden);
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { setMenu(false); });
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 860) setMenu(false);
    });
  }



  /* ---------- Comparse morbide ---------- */
  var reveals = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- Consenso cookie ---------- */
  var CONSENT_KEY = "pleom-cookie-consent";

  function getConsent() {
    try { return window.localStorage.getItem(CONSENT_KEY); } catch (err) { return null; }
  }
  function setConsent(value) {
    try { window.localStorage.setItem(CONSENT_KEY, value); } catch (err) { /* il banner riapparirà */ }
  }

  /* Google Analytics 4: caricato solo dopo il consenso. Prima di allora
     non viene richiesto nulla a Google; consent mode parte "denied". */
  var GA_ID = "G-EYBZFYE5ZJ";
  var gaLoaded = false;
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
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
    gtag("config", GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
  }

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
    if (!getConsent()) banner.hidden = false;
    var acceptBtn = banner.querySelector("[data-cookie-accept]");
    var rejectBtn = banner.querySelector("[data-cookie-reject]");
    if (acceptBtn) acceptBtn.addEventListener("click", function () {
      setConsent("accepted");
      banner.hidden = true;
      startAnalytics();
    });
    if (rejectBtn) rejectBtn.addEventListener("click", function () {
      var wasAccepted = getConsent() === "accepted";
      setConsent("rejected");
      banner.hidden = true;
      if (wasAccepted) stopAnalytics();
    });
    document.querySelectorAll("[data-cookie-settings]").forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        banner.hidden = false;
      });
    });
  }

  /* ---------- Modulo contatti ---------- */
  // Invia a data-endpoint (es. Formspree/Web3Forms) se impostato;
  // altrimenti apre l'app di posta con la richiesta già compilata.
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
      say("Si apre il vostro programma di posta per inviare la richiesta.");
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
          say("Richiesta ricevuta. Vi risponderemo a breve.");
        })
        .catch(function () {
          say("Invio non riuscito: si apre il programma di posta.", true);
          openMail(data);
        })
        .then(function () {
          form.classList.remove("is-sending");
        });
    });
  });
})();
