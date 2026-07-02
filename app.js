// Shared site behaviour: mobile nav toggle + scroll fade-ins
(function () {
  var toggle = document.getElementById('nav-toggle');
  var mobileMenu = document.getElementById('mobile-menu');
  if (toggle && mobileMenu) {
    toggle.addEventListener('click', function () { mobileMenu.classList.toggle('open'); });
    mobileMenu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { mobileMenu.classList.remove('open'); });
    });
  }

  var els = document.querySelectorAll('.fade-up');
  function revealAll() { els.forEach(function (el) { el.classList.add('visible'); }); }

  // If we've deep-linked to a section (e.g. Submit CV -> #cv-form) or the browser
  // can't observe, show everything immediately so nothing ever sits blank.
  if (window.location.hash || !('IntersectionObserver' in window) || !els.length) {
    revealAll();
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { observer.observe(el); });
    // Safety net: never leave content hidden if the observer misses anything.
    setTimeout(revealAll, 1200);
  }
})();
