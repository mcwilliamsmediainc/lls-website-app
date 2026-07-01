(function () {
  'use strict';
  var toggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('navmain');
  if (!toggle || !nav) return;

  var isMobile = function () { return window.matchMedia('(max-width:940px)').matches; };
  var subs = nav.querySelectorAll('.has-sub');

  // Collapse every dropdown and sync its trigger's aria state.
  var closeAllDropdowns = function () {
    subs.forEach(function (sub) {
      sub.classList.remove('open');
      var t = sub.querySelector('.navtrigger');
      if (t) t.setAttribute('aria-expanded', 'false');
    });
  };

  toggle.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) closeAllDropdowns();
  });

  // Dropdown triggers: on mobile, tap toggles the submenu instead of navigating.
  nav.querySelectorAll('.has-sub > .navtrigger').forEach(function (trigger) {
    trigger.addEventListener('click', function (e) {
      if (!isMobile()) return;
      e.preventDefault();
      var parent = trigger.parentNode;
      var willOpen = !parent.classList.contains('open');
      // Keep only one submenu open at a time.
      closeAllDropdowns();
      if (willOpen) {
        parent.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Tapping a real navigation link closes the mobile menu (dropdown triggers excluded).
  nav.querySelectorAll('a:not(.navtrigger)').forEach(function (a) {
    a.addEventListener('click', function () {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      closeAllDropdowns();
    });
  });

  // Close any open dropdown (and the mobile menu) when clicking outside the nav.
  document.addEventListener('click', function (e) {
    if (nav.contains(e.target) || toggle.contains(e.target)) return;
    closeAllDropdowns();
    if (isMobile()) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
})();
