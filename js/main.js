/* =========================================================
   H2PRO Landing — Interactions & Motion (GSAP-driven)
   ========================================================= */

(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(hover: none)').matches;
  const hasGSAP = !!(window.gsap && window.ScrollTrigger);

  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

  /* -------------------------------------------------------
     1. Lenis smooth scroll + ScrollTrigger sync
     ------------------------------------------------------- */
  let lenis;
  if (window.Lenis && !reduceMotion) {
    lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      smoothTouch: false,
      touchMultiplier: 1.6,
      wheelMultiplier: 1.0,
    });

    if (hasGSAP) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }

    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const id = a.getAttribute('href').slice(1);
        if (!id) return;
        const target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -40, duration: 1.5 });
      });
    });
  }

  /* -------------------------------------------------------
     2. Custom cursor (GSAP quickTo + visibility pause)
     ------------------------------------------------------- */
  if (!isTouch && hasGSAP) {
    const cursor = document.querySelector('.cursor');
    if (cursor) {
      gsap.set(cursor, {
        xPercent: -50, yPercent: -50,
        x: window.innerWidth / 2, y: window.innerHeight / 2
      });
      const xTo = gsap.quickTo(cursor, 'x', { duration: 0.4, ease: 'power3' });
      const yTo = gsap.quickTo(cursor, 'y', { duration: 0.4, ease: 'power3' });
      let active = !document.hidden;

      window.addEventListener('mousemove', (e) => {
        if (!active) return;
        xTo(e.clientX);
        yTo(e.clientY);
      }, { passive: true });

      document.addEventListener('visibilitychange', () => { active = !document.hidden; });

      const hovers = 'a, button, [data-tilt], .flavor-tab, .card, .persona, .chip';
      document.querySelectorAll(hovers).forEach(el => {
        el.addEventListener('pointerenter', () => cursor.classList.add('is-hover'));
        el.addEventListener('pointerleave', () => cursor.classList.remove('is-hover'));
      });
    }
  }

  /* -------------------------------------------------------
     3. Nav scroll state + burger
     ------------------------------------------------------- */
  const navShell = document.getElementById('nav');
  if (navShell) {
    const onScroll = () => navShell.classList.toggle('is-scrolled', window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  const burger = document.querySelector('.nav__burger');
  const mobileMenu = document.querySelector('.mobile-menu');
  function setMenu(open) {
    if (!burger || !mobileMenu) return;
    burger.classList.toggle('is-open', open);
    mobileMenu.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    mobileMenu.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.style.overflow = open ? 'hidden' : '';
    if (lenis) { open ? lenis.stop() : lenis.start(); }
  }
  if (burger) burger.addEventListener('click', () => setMenu(!burger.classList.contains('is-open')));
  if (mobileMenu) mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));

  /* -------------------------------------------------------
     4. Split text into words for [data-split-text]
     ------------------------------------------------------- */
  document.querySelectorAll('[data-split-text]').forEach(root => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.trim()) textNodes.push(node);
    }
    textNodes.forEach(tn => {
      const frag = document.createDocumentFragment();
      tn.nodeValue.split(/(\s+)/).forEach(tok => {
        if (!tok) return;
        if (/^\s+$/.test(tok)) {
          frag.appendChild(document.createTextNode(tok));
        } else {
          const w = document.createElement('span');
          w.className = 'word';
          const inner = document.createElement('span');
          inner.textContent = tok;
          w.appendChild(inner);
          frag.appendChild(w);
        }
      });
      tn.parentNode.replaceChild(frag, tn);
    });
  });

  /* -------------------------------------------------------
     5. Reveals — IntersectionObserver + CSS transitions
     (driving these via CSS classes is more reliable than fighting
      GSAP/CSS transform stacks on the same elements)
     ------------------------------------------------------- */
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        // Stagger words inside split-text
        if (entry.target.matches('[data-split-text]')) {
          entry.target.querySelectorAll('.word > span').forEach((w, i) => {
            w.style.transitionDelay = (i * 50) + 'ms';
          });
        }
        io.unobserve(entry.target);
      });
    }, { rootMargin: '-8% 0px -8% 0px', threshold: 0.05 });

    document.querySelectorAll('[data-reveal], [data-reveal-line], [data-split-text]').forEach((el) => {
      const parent = el.parentElement;
      const sibIdx = parent ? Array.from(parent.children).indexOf(el) : 0;
      el.style.setProperty('--reveal-delay', (sibIdx * 80) + 'ms');
      io.observe(el);
    });

    // Hero display lines stagger
    document.querySelectorAll('.display [data-reveal-line]').forEach((line, i) => {
      line.style.setProperty('--reveal-delay', (200 + i * 120) + 'ms');
    });
  } else {
    document.querySelectorAll('[data-reveal], [data-reveal-line], [data-split-text]')
      .forEach(el => el.classList.add('is-visible'));
  }

  /* -------------------------------------------------------
     6. Tilt on hero stage (GSAP quickTo)
     ------------------------------------------------------- */
  if (!isTouch && !reduceMotion && hasGSAP) {
    document.querySelectorAll('[data-tilt]').forEach(el => {
      const bottle = el.querySelector('.stage__bottle');
      const halo = el.querySelector('.stage__halo');
      if (!bottle && !halo) return;

      const rotY = bottle && gsap.quickTo(bottle, 'rotationY', { duration: 0.6, ease: 'power3' });
      const rotX = bottle && gsap.quickTo(bottle, 'rotationX', { duration: 0.6, ease: 'power3' });
      const haloX = halo && gsap.quickTo(halo, 'x', { duration: 0.7, ease: 'power3' });
      const haloY = halo && gsap.quickTo(halo, 'y', { duration: 0.7, ease: 'power3' });

      let rect = el.getBoundingClientRect();
      el.addEventListener('pointerenter', () => { rect = el.getBoundingClientRect(); });

      el.addEventListener('pointermove', (e) => {
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        if (rotY) rotY(-8 + x * 14);
        if (rotX) rotX(2 - y * 10);
        if (haloX) haloX(x * 30);
        if (haloY) haloY(y * 30);
      });

      el.addEventListener('pointerleave', () => {
        if (rotY) rotY(-8);
        if (rotX) rotX(2);
        if (haloX) haloX(0);
        if (haloY) haloY(0);
      });
    });
  }

  /* -------------------------------------------------------
     7. Floating chips parallax (GSAP quickTo)
     ------------------------------------------------------- */
  if (!isTouch && !reduceMotion && hasGSAP) {
    const chips = document.querySelectorAll('.chip');
    const stage = document.querySelector('.hero__stage');
    if (chips.length && stage) {
      const tweens = Array.from(chips).map((chip, i) => ({
        x: gsap.quickTo(chip, 'x', { duration: 0.7, ease: 'power3' }),
        y: gsap.quickTo(chip, 'y', { duration: 0.7, ease: 'power3' }),
        intensity: 18 + i * 6
      }));
      let rect = stage.getBoundingClientRect();
      stage.addEventListener('pointerenter', () => { rect = stage.getBoundingClientRect(); });
      stage.addEventListener('pointermove', (e) => {
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        tweens.forEach(t => { t.x(x * t.intensity); t.y(y * t.intensity); });
      });
      stage.addEventListener('pointerleave', () => {
        tweens.forEach(t => { t.x(0); t.y(0); });
      });
    }
  }

  /* -------------------------------------------------------
     8. Flavor switcher
     ------------------------------------------------------- */
  const flavorsSection = document.querySelector('.flavors');
  const flavorTabs = document.querySelectorAll('.flavor-tab');
  const flavorPanels = document.querySelectorAll('.flavor');

  function setFlavor(name) {
    if (!flavorsSection) return;
    flavorsSection.classList.remove('is-blueberry', 'is-limonada');
    flavorsSection.classList.add('is-' + name);
    flavorTabs.forEach(t => {
      const active = t.dataset.flavor === name;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    flavorPanels.forEach(p => {
      p.classList.toggle('is-active', p.dataset.panel === name);
      const v = p.querySelector('.flavor__visual');
      if (v) v.classList.remove('is-playing');
    });
  }

  // Auto-play the 360° rotation on the active flavor for ~5s. Used so users
  // (especially on touch devices) discover the rotation without needing the
  // hover hint. Triggered on tab clicks and on first view of the section.
  let autoplayTimer = null;
  function autoplayActiveFlavor() {
    if (reduceMotion) return;
    clearTimeout(autoplayTimer);
    const active = Array.from(flavorPanels).find(p => p.classList.contains('is-active'));
    if (!active) return;
    const visual = active.querySelector('.flavor__visual');
    const video = visual && visual.querySelector('.flavor__video');
    if (!visual || !video) return;
    visual.classList.add('is-playing');
    video.play().catch(() => {});
    autoplayTimer = setTimeout(() => {
      visual.classList.remove('is-playing');
      video.pause();
      autoplayTimer = null;
    }, 5000);
  }

  flavorTabs.forEach(t => t.addEventListener('click', () => {
    setFlavor(t.dataset.flavor);
    autoplayActiveFlavor();
  }));
  setFlavor('blueberry');

  if (flavorsSection && !reduceMotion && 'IntersectionObserver' in window) {
    let firstView = true;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting && firstView) {
          firstView = false;
          autoplayActiveFlavor();
          io.disconnect();
        }
      });
    }, { threshold: 0.4 });
    io.observe(flavorsSection);
  }

  flavorPanels.forEach(panel => {
    const visual = panel.querySelector('.flavor__visual');
    if (!visual) return;
    const video = visual.querySelector('.flavor__video');
    const start = () => {
      clearTimeout(autoplayTimer);
      visual.classList.add('is-playing');
      if (video) video.play().catch(() => {});
    };
    const stop = () => {
      clearTimeout(autoplayTimer);
      visual.classList.remove('is-playing');
      if (video) video.pause();
    };
    if (!isTouch) {
      visual.addEventListener('pointerenter', start);
      visual.addEventListener('pointerleave', stop);
    }
    visual.addEventListener('click', () => {
      if (visual.classList.contains('is-playing')) stop(); else start();
    });
  });

  /* -------------------------------------------------------
     9. Magnetic buttons (GSAP quickTo)
     ------------------------------------------------------- */
  if (!isTouch && !reduceMotion && hasGSAP) {
    document.querySelectorAll('.btn').forEach(btn => {
      const xTo = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3' });
      const yTo = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3' });
      let rect;
      btn.addEventListener('pointerenter', () => { rect = btn.getBoundingClientRect(); });
      btn.addEventListener('pointermove', (e) => {
        if (!rect) return;
        xTo((e.clientX - rect.left - rect.width / 2) * 0.25);
        yTo((e.clientY - rect.top - rect.height / 2) * 0.30);
      });
      btn.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  /* -------------------------------------------------------
     10. Hero parallax + footer big logo (existing)
     ------------------------------------------------------- */
  if (!reduceMotion && hasGSAP) {
    gsap.to('.orb--1', { yPercent: -30, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 } });
    gsap.to('.orb--2', { yPercent: 20, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 } });
    gsap.to('.orb--3', { yPercent: -10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 } });
    gsap.to('.hero__stage', { y: -60, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 } });

    gsap.fromTo('.footer__big', { yPercent: 8, scale: 0.96 }, {
      yPercent: -4, scale: 1, ease: 'none',
      scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: 1 }
    });
  }

  /* -------------------------------------------------------
     11. Section reveals — CSS class + IntersectionObserver
     (GSAP-independent: if GSAP fails to load, this still runs.
      If IO is unavailable, elements never get .is-pending and
      stay visible. Triple safety: timeout fallback below.)
     ------------------------------------------------------- */
  if ('IntersectionObserver' in window && !reduceMotion) {
    const groups = [
      { sel: '.bento .card',  stagger: 100 },
      { sel: '.persona',      stagger: 120 },
      { sel: '.flavor__visual', stagger: 0 },
      { sel: '.cta__shell',   stagger: 0 }
    ];

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const stagger = parseInt(entry.target.dataset.revealStagger, 10) || 0;
        const idx = parseInt(entry.target.dataset.revealIdx, 10) || 0;
        if (stagger && idx) {
          setTimeout(() => entry.target.classList.add('is-revealed'), stagger * idx);
        } else {
          entry.target.classList.add('is-revealed');
        }
        io.unobserve(entry.target);
      });
    }, { rootMargin: '-10% 0px -10% 0px', threshold: 0.05 });

    groups.forEach(group => {
      document.querySelectorAll(group.sel).forEach((el, i) => {
        el.classList.add('is-pending');
        el.dataset.revealStagger = String(group.stagger);
        el.dataset.revealIdx = String(i);
        io.observe(el);
      });
    });

    // Safety net: 8s after first paint, force-reveal anything that's
    // both pending AND already in viewport. Targets edge cases where IO
    // misfires; never reveals truly off-screen content prematurely.
    setTimeout(() => {
      document.querySelectorAll('.is-pending:not(.is-revealed)').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) {
          el.classList.add('is-revealed');
        }
      });
    }, 8000);
  }

  /* -------------------------------------------------------
     12. Marquee skew on scroll velocity
     ------------------------------------------------------- */
  if (!reduceMotion && hasGSAP) {
    const marqueeTrack = document.querySelector('.marquee__track');
    const marquee = document.querySelector('.marquee');
    if (marqueeTrack && marquee) {
      const skewTo = gsap.quickTo(marqueeTrack, 'skewX', { duration: 0.5, ease: 'power3' });
      ScrollTrigger.create({
        trigger: marquee,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          const skew = Math.max(-8, Math.min(8, self.getVelocity() / 400));
          skewTo(skew);
        },
        onLeave: () => skewTo(0),
        onLeaveBack: () => skewTo(0)
      });
    }
  }

  /* -------------------------------------------------------
     13. Year
     ------------------------------------------------------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* -------------------------------------------------------
     14. Recompute trigger positions once webfonts are ready
     ------------------------------------------------------- */
  if (hasGSAP && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh()).catch(() => {});
  }
})();
