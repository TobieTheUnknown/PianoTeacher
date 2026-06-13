/* ============================================================
   PIANO TEACHER — LANDING PAGE
   Reveal-on-scroll (reduced-motion safe) + nav active state.
   ============================================================ */
(function () {
  "use strict";

  var prefersReduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var reveals = Array.prototype.slice.call(
    document.querySelectorAll(".reveal")
  );

  // If reduced motion or no IntersectionObserver: show everything immediately.
  if (prefersReduced || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) {
      el.classList.add("is-visible");
    });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          // small stagger for siblings in the same container
          var el = entry.target;
          var delay = el.dataset.revealDelay || 0;
          if (delay) el.style.transitionDelay = delay + "ms";
          el.classList.add("is-visible");
          observer.unobserve(el);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );

  // Apply a gentle stagger to grouped cards (features + download cards).
  function stagger(selector) {
    var groups = document.querySelectorAll(selector);
    groups.forEach(function (group) {
      var kids = group.querySelectorAll(".reveal");
      kids.forEach(function (kid, i) {
        kid.dataset.revealDelay = String(i * 80);
      });
    });
  }
  stagger(".features");
  stagger(".download__cards");

  reveals.forEach(function (el) {
    observer.observe(el);
  });
})();
