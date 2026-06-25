(function () {
  'use strict';
  var toggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('primary-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  // On mobile, let a tap on a parent item expand its submenu instead of navigating.
  if (window.matchMedia('(max-width: 860px)').matches) {
    document.querySelectorAll('.primary-nav .has-sub > a').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var sub = link.parentNode.querySelector('.sub-menu');
        if (sub && sub.style.display !== 'flex') {
          e.preventDefault();
          sub.style.display = 'flex';
        }
      });
    });
  }
})();
