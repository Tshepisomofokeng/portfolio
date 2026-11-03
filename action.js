/* =========================================================
   Tshepiso. — Portfolio interactions
========================================================= */

(function () {

    /* Tells the <head> safety net that this file loaded, so the
       reveal animations can safely stay switched on */

    window.__motionReady = true;


    /* Shared: respect the visitor's "reduce motion" OS setting */

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const animOn = () => document.documentElement.classList.contains('anim');


    /* ---------------------------------------------------
       Mobile navigation
       - Toggle button swaps its label (Open / Close)
       - Closes on link tap, Escape, outside tap, or when the
         viewport grows past the hamburger breakpoint
    --------------------------------------------------- */

    function initMobileNav() {

        const NAV_BREAKPOINT = 768; /* keep in sync with the CSS */

        const toggle = document.querySelector('.menu-toggle');
        const nav = document.querySelector('.nav');

        if (!toggle || !nav) return;


        function setOpen(open) {

            nav.classList.toggle('open', open);

            toggle.setAttribute('aria-expanded', String(open));

            toggle.setAttribute(
                'aria-label',
                open ? 'Close navigation' : 'Open navigation'
            );

        }


        toggle.addEventListener('click', () => {

            setOpen(!nav.classList.contains('open'));

        });


        nav.querySelectorAll('a').forEach(link => {

            link.addEventListener('click', () => setOpen(false));

        });


        document.addEventListener('keydown', e => {

            if (e.key === 'Escape' && nav.classList.contains('open')) {

                setOpen(false);

                toggle.focus();

            }

        });


        document.addEventListener('click', e => {

            if (!nav.classList.contains('open')) return;

            if (nav.contains(e.target) || toggle.contains(e.target)) return;

            setOpen(false);

        });


        window.addEventListener('resize', () => {

            if (window.innerWidth > NAV_BREAKPOINT) setOpen(false);

        });

    }


    /* ---------------------------------------------------
       Infinite tech marquee
       - The track holds two identical groups and slides by exactly
         one group (-50%), so the loop is seamless...
       - ...but only if one group is at least as wide as the screen.
         With a short icon list (12) a wide monitor would show a gap,
         so the icon set is repeated inside the group until it fills
         the viewport. Repeats are hidden from screen readers.
       - Speed is constant (px per second) whatever the group width.
    --------------------------------------------------- */

    function initTechMarquee() {

        const SPEED = 40; /* pixels per second */

        document.querySelectorAll('.marquee-track').forEach(track => {

            const group = track.querySelector('.marquee-group');

            if (!group) return;


            const originals = Array.from(group.children);

            const clone = group.cloneNode(true);

            clone.setAttribute('aria-hidden', 'true');

            track.appendChild(clone);


            function fill() {

                /* Reset to the original set, then repeat until wide enough */

                group.querySelectorAll('[data-repeat]').forEach(n => n.remove());


                let guard = 0;

                while (
                    group.getBoundingClientRect().width < window.innerWidth &&
                    guard++ < 12
                ) {

                    originals.forEach(item => {

                        const copy = item.cloneNode(true);

                        copy.setAttribute('aria-hidden', 'true');

                        copy.setAttribute('data-repeat', '');

                        group.appendChild(copy);

                    });

                }


                /* Second group mirrors the first one exactly */

                clone.replaceChildren(
                    ...Array.from(group.children).map(n => n.cloneNode(true))
                );


                const width = group.getBoundingClientRect().width;

                track.style.animationDuration =
                    Math.max(10, Math.round(width / SPEED)) + 's';

            }


            fill();

            track.classList.add('is-ready');


            /* An off-screen marquee has no reason to keep animating */

            if ('IntersectionObserver' in window) {

                new IntersectionObserver(([entry]) => {

                    track.classList.toggle('is-paused', !entry.isIntersecting);

                }).observe(track.parentElement);

            }


            let resizeTimer;

            window.addEventListener('resize', () => {

                clearTimeout(resizeTimer);

                resizeTimer = setTimeout(fill, 200);

            });

        });

    }


    /* ---------------------------------------------------
       Dynamic featured service card
       - Desktop / tablet: whichever card is hovered becomes the
         rotated, teal, elevated card
       - Phones (≤ 650px): there is no hover, so the card sitting in
         the middle of the screen is the featured one. As you scroll,
         it animates out when it leaves the middle and the next card
         animates in as it arrives — up or down.
    --------------------------------------------------- */

    function initServiceCards() {

        const cards = Array.from(document.querySelectorAll('.service-card'));

        if (!cards.length) return;


        const phoneQuery = window.matchMedia('(max-width: 650px)');

        let observer = null;


        function setFeatured(card) {

            cards.forEach(c => c.classList.toggle('featured', c === card));

        }


        /* -------- Hover / tap (desktop + tablet) -------- */

        cards.forEach(card => {

            card.addEventListener('mouseenter', () => {

                if (phoneQuery.matches) return;

                setFeatured(card);

            });


            card.addEventListener('touchstart', () => {

                if (phoneQuery.matches) return;

                setFeatured(card);

            }, { passive: true });

        });


        /* -------- Scroll mode (phones) --------
           The observer's root is shrunk to a 1px line through the
           vertical centre of the viewport (-50% top and bottom), so a
           card "intersects" exactly while it is crossing mid-screen.
           Gaps between cards mean that for a moment nothing is
           featured, which is what gives the out-then-in rhythm. */

        function startScrollMode() {

            if (observer || !('IntersectionObserver' in window)) return;


            /* Start from a clean slate; the observer decides from here */

            setFeatured(null);


            observer = new IntersectionObserver(entries => {

                /* Leaving first, then arriving, so the outgoing card
                   is released before the incoming one is claimed */

                entries.forEach(entry => {

                    if (!entry.isIntersecting) {

                        entry.target.classList.remove('featured');

                    }

                });


                entries.forEach(entry => {

                    if (entry.isIntersecting) setFeatured(entry.target);

                });

            }, {

                rootMargin: '-50% 0px -50% 0px',

                threshold: 0

            });


            cards.forEach(card => observer.observe(card));

        }


        function stopScrollMode() {

            if (!observer) return;

            observer.disconnect();

            observer = null;


            /* Back to the default: first card featured until hovered */

            setFeatured(cards[0]);

        }


        function syncMode() {

            if (phoneQuery.matches) {

                startScrollMode();

            } else {

                stopScrollMode();

            }

        }


        if (phoneQuery.addEventListener) {

            phoneQuery.addEventListener('change', syncMode);

        } else if (phoneQuery.addListener) {

            phoneQuery.addListener(syncMode); /* old Safari */

        }


        syncMode();

    }


    /* ---------------------------------------------------
       Projects carousel
       - Translating track
       - Auto-play (pauses on mouse hover / touch / focus,
         and never runs when the visitor prefers reduced motion)
       - Swipe on touch devices (horizontal swipes only)
       - Dots generated dynamically based on cards-per-view
       - Exact end-stop: the last page lines the last card up
         with the right edge, so nothing is ever clipped
    --------------------------------------------------- */

    function initProjectsCarousel() {

        const track = document.getElementById('projectTrack');

        if (!track) return;

        const carousel = track.parentElement;

        const dotsContainer = document.getElementById('projectDots');

        if (!carousel || !dotsContainer) return;


        const cards = Array.from(track.querySelectorAll('.project-card'));

        if (!cards.length) return;


        const AUTOPLAY_DELAY = 5000;

        const SWIPE_THRESHOLD = 40;


        let currentPage = 0;

        let totalPages = 1;

        let autoPlayTimer = null;

        let touchStartX = 0;

        let touchStartY = 0;

        let touchDeltaX = 0;

        let touchDeltaY = 0;

        let isDragging = false;

        let inView = true;


        /* -------- Helpers -------- */

        function getCardsPerPage() {

            const w = window.innerWidth;

            if (w <= 650) return 1;

            if (w <= 900) return 2;

            return 3;

        }


        /* Positions come from the track's own layout width plus the
           CSS gap, NOT from the cards' on-screen rectangles. The cards
           zoom in when revealed (an animated `scale`), which would make
           a rect-based measurement come out too small mid-animation.
           This mirrors the CSS: each card is
           (track width - gaps) / cards-per-view wide. */

        function getMetrics() {

            const perPage = getCardsPerPage();

            const viewport = track.getBoundingClientRect().width;

            const gap = parseFloat(getComputedStyle(track).columnGap) || 0;

            const cardWidth = (viewport - gap * (perPage - 1)) / perPage;

            const content = cards.length * cardWidth + (cards.length - 1) * gap;

            return {
                perPage,
                step: cardWidth + gap,
                max: Math.max(0, content - viewport)
            };

        }


        /* -------- Dots -------- */

        function buildDots() {

            const perPage = getCardsPerPage();

            totalPages = Math.max(1, Math.ceil(cards.length / perPage));


            if (currentPage >= totalPages) currentPage = totalPages - 1;

            if (currentPage < 0) currentPage = 0;


            dotsContainer.innerHTML = '';

            dotsContainer.hidden = totalPages < 2;


            for (let i = 0; i < totalPages; i++) {

                const btn = document.createElement('button');

                btn.type = 'button';

                btn.setAttribute('role', 'tab');

                btn.setAttribute('aria-label', 'Go to slide ' + (i + 1));

                btn.setAttribute(
                    'aria-selected',
                    i === currentPage ? 'true' : 'false'
                );

                if (i === currentPage) btn.classList.add('active');


                btn.addEventListener('click', () => {

                    goToPage(i);

                    restartAutoPlay();

                });


                dotsContainer.appendChild(btn);

            }

        }


        function updateDots() {

            const dots = dotsContainer.querySelectorAll('button');

            dots.forEach((dot, i) => {

                const isActive = i === currentPage;

                dot.classList.toggle('active', isActive);

                dot.setAttribute(
                    'aria-selected',
                    isActive ? 'true' : 'false'
                );

            });

        }


        /* -------- Movement -------- */

        function applyTransform() {

            const m = getMetrics();


            /* Clamp so the final page ends flush with the right edge */

            let target = currentPage * m.perPage * m.step;

            if (target > m.max) target = m.max;


            track.style.transform = 'translateX(' + (-target) + 'px)';

        }


        function goToPage(page) {

            if (page < 0) page = totalPages - 1;

            if (page >= totalPages) page = 0;

            currentPage = page;

            applyTransform();

            updateDots();

        }


        function nextPage() {

            goToPage(currentPage + 1);

        }


        /* -------- Autoplay -------- */

        function startAutoPlay() {

            stopAutoPlay();

            /* Visitors who ask for reduced motion get a manual carousel */

            if (reduceMotion.matches || totalPages < 2 || !inView) return;

            autoPlayTimer = setInterval(nextPage, AUTOPLAY_DELAY);

        }


        function stopAutoPlay() {

            if (autoPlayTimer) {

                clearInterval(autoPlayTimer);

                autoPlayTimer = null;

            }

        }


        function restartAutoPlay() {

            stopAutoPlay();

            startAutoPlay();

        }


        /* Setting can change while the page is open */

        function onMotionPreferenceChange() {

            if (reduceMotion.matches) {

                stopAutoPlay();

            } else {

                startAutoPlay();

            }

        }

        if (reduceMotion.addEventListener) {

            reduceMotion.addEventListener('change', onMotionPreferenceChange);

        } else if (reduceMotion.addListener) {

            reduceMotion.addListener(onMotionPreferenceChange); /* old Safari */

        }


        /* -------- Only run while the carousel is on screen -------- */

        if ('IntersectionObserver' in window) {

            new IntersectionObserver(([entry]) => {

                inView = entry.isIntersecting;

                if (inView) {

                    startAutoPlay();

                } else {

                    stopAutoPlay();

                }

            }, { threshold: 0.2 }).observe(carousel);

        }


        /* -------- Pause on hover / focus --------
           Pointer events + pointerType so that the emulated "mouse"
           events a phone fires after a tap can't leave autoplay stuck. */

        carousel.addEventListener('pointerenter', e => {

            if (e.pointerType === 'mouse') stopAutoPlay();

        });

        carousel.addEventListener('pointerleave', e => {

            if (e.pointerType === 'mouse') startAutoPlay();

        });

        carousel.addEventListener('focusin', stopAutoPlay);

        carousel.addEventListener('focusout', startAutoPlay);


        /* Don't burn timers while the tab is in the background */

        document.addEventListener('visibilitychange', () => {

            if (document.hidden) {

                stopAutoPlay();

            } else {

                startAutoPlay();

            }

        });


        /* -------- Swipe (touch) -------- */

        carousel.addEventListener('touchstart', e => {

            touchStartX = e.touches[0].clientX;

            touchStartY = e.touches[0].clientY;

            touchDeltaX = 0;

            touchDeltaY = 0;

            isDragging = true;

            stopAutoPlay();

        }, { passive: true });


        carousel.addEventListener('touchmove', e => {

            if (!isDragging) return;

            touchDeltaX = e.touches[0].clientX - touchStartX;

            touchDeltaY = e.touches[0].clientY - touchStartY;

        }, { passive: true });


        carousel.addEventListener('touchend', () => {

            if (!isDragging) return;

            isDragging = false;


            /* Only treat mostly-horizontal gestures as swipes, so
               scrolling the page past the carousel never flips slides */

            const isHorizontal =
                Math.abs(touchDeltaX) > Math.abs(touchDeltaY);

            if (isHorizontal && touchDeltaX < -SWIPE_THRESHOLD) {

                nextPage();

            } else if (isHorizontal && touchDeltaX > SWIPE_THRESHOLD) {

                goToPage(currentPage - 1);

            }


            restartAutoPlay();

        }, { passive: true });


        carousel.addEventListener('touchcancel', () => {

            isDragging = false;

            restartAutoPlay();

        }, { passive: true });


        /* -------- Handle resize / rotation -------- */

        let resizeTimer;

        window.addEventListener('resize', () => {

            clearTimeout(resizeTimer);

            resizeTimer = setTimeout(() => {

                buildDots();

                applyTransform();

                restartAutoPlay();

            }, 150);

        });


        /* -------- Recalculate after images/fonts load -------- */

        window.addEventListener('load', () => {

            buildDots();

            applyTransform();

        });


        /* -------- Init -------- */

        buildDots();

        applyTransform();

        startAutoPlay();

    }


    /* ---------------------------------------------------
       Scroll reveal — animates IN and OUT, in both directions
       Anything with [data-reveal] animates in when it enters the
       screen and animates out when it leaves, every time:

         scrolling down  → it rises in from below, exits upward
         scrolling up    → it drops in from above, exits downward

       Types:  data-reveal            rise / drop (default)
               data-reveal="zoom"     scale + rise
               data-reveal="left"     slide in from the left
               data-reveal="right"    slide in from the right
               data-reveal="fade"     opacity only
       Optional: data-delay="200"     fixed delay (ms) for this element

       Elements arriving together are staggered in the order they
       appear. Built on the Web Animations API so a reversal mid-
       animation continues smoothly from wherever the element is.
       The hero (which plays once via CSS on load) joins in as soon as
       its load animation finishes, so scrolling back to the top
       replays it.
    --------------------------------------------------- */

    function initReveals() {

        const IN_MS = 900;

        const OUT_MS = 520;

        const STEP = 90;      /* ms between elements arriving together */

        const MAX_STEPS = 5;

        const EASE_IN = 'cubic-bezier(.22, .75, .25, 1)';

        const EASE_OUT = 'cubic-bezier(.45, 0, .55, 1)';


        const targets = Array.from(document.querySelectorAll('[data-reveal]'));

        const heroItems = Array.from(document.querySelectorAll('[data-hero]'));

        if (!targets.length && !heroItems.length) return;


        const canAnimate =
            animOn() &&
            'IntersectionObserver' in window &&
            typeof Element.prototype.animate === 'function';

        /* No motion (reduced motion / very old browser): just show it all */

        if (!canAnimate) {

            targets.forEach(el => el.classList.add('is-visible'));

            return;

        }


        /* Travel distances come from the CSS (smaller on phones) */

        const root = document.documentElement;

        let Y = 44;

        let X = 60;

        function readDistances() {

            const cs = getComputedStyle(root);

            Y = parseFloat(cs.getPropertyValue('--rv-y')) || 44;

            X = parseFloat(cs.getPropertyValue('--rv-x')) || 60;

        }

        readDistances();

        let distTimer;

        window.addEventListener('resize', () => {

            clearTimeout(distTimer);

            distTimer = setTimeout(readDistances, 200);

        });


        /* ---- keyframe shapes ----
           dir: +1 = arrives from below (scrolling down), -1 = from above */

        const SHOWN = { opacity: 1, translate: '0px 0px', scale: 1 };

        function hiddenFrame(type, dir) {

            switch (type) {

                case 'zoom':  return { opacity: 0, scale: 0.86, translate: '0px ' + (Y * 0.4 * dir) + 'px' };

                case 'fade':  return { opacity: 0 };

                case 'left':  return { opacity: 0, translate: (-X) + 'px 0px' };

                case 'right': return { opacity: 0, translate: X + 'px 0px' };

                case 'down':  return { opacity: 0, translate: '0px ' + (-Y * dir) + 'px' };

                default:      return { opacity: 0, translate: '0px ' + (Y * dir) + 'px' };

            }

        }

        /* out: +1 = leaves through the bottom, -1 = through the top */

        function exitFrame(type, out) {

            switch (type) {

                case 'zoom':  return { opacity: 0, scale: 0.92, translate: '0px ' + (Y * 0.3 * out) + 'px' };

                case 'fade':  return { opacity: 0 };

                case 'left':  return { opacity: 0, translate: (-X * 0.5) + 'px 0px' };

                case 'right': return { opacity: 0, translate: (X * 0.5) + 'px 0px' };

                case 'down':  return { opacity: 0, translate: '0px ' + (-Y * 0.6 * out) + 'px' };

                default:      return { opacity: 0, translate: '0px ' + (Y * 0.6 * out) + 'px' };

            }

        }


        /* Where the element is right now, so an interrupted animation
           can hand over without a jump */

        function snapshot(el) {

            const cs = getComputedStyle(el);

            return {
                opacity: cs.opacity,
                translate: cs.translate === 'none' ? '0px 0px' : cs.translate,
                scale: cs.scale === 'none' ? '1' : cs.scale
            };

        }


        const states = new WeakMap();   /* el -> { state, anim, type } */


        function enter(el, st, dir, delay) {

            const from = st.anim ? snapshot(el) : hiddenFrame(st.type, dir);

            if (st.anim) st.anim.cancel();

            /* .is-visible is the resting state (opacity 1); the animation
               only has to describe the journey there */

            el.classList.add('is-visible');

            const anim = el.animate([from, SHOWN], {
                duration: IN_MS,
                delay,
                easing: EASE_IN,
                fill: 'backwards'
            });

            st.anim = anim;

            st.state = 'in';

            anim.onfinish = () => {

                if (st.anim !== anim) return;

                anim.cancel();

                st.anim = null;

            };

        }


        function leave(el, st, out) {

            const from = st.anim ? snapshot(el) : SHOWN;

            if (st.anim) st.anim.cancel();

            const anim = el.animate([from, exitFrame(st.type, out)], {
                duration: OUT_MS,
                easing: EASE_OUT,
                fill: 'forwards'
            });

            st.anim = anim;

            st.state = 'out';

            anim.onfinish = () => {

                if (st.anim !== anim) return;

                /* Back to the hidden resting state, then drop the effect */

                el.classList.remove('is-visible');

                anim.cancel();

                st.anim = null;

            };

        }


        /* ---- observer: enter at ~20% visible, leave below ~10% ----
           (two different levels = hysteresis, so an element sitting right
           on the edge doesn't flicker in and out) */

        const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

        const observer = new IntersectionObserver(entries => {

            const vh = window.innerHeight;

            const arriving = [];

            entries.forEach(entry => {

                const el = entry.target;

                const st = states.get(el);

                const rect = entry.boundingClientRect;

                if (!st || !rect.height) return;


                /* tall elements only need a slice of the *screen* showing */

                const need = Math.min(0.2, (vh * 0.18) / rect.height);

                const ratio = entry.intersectionRatio;

                const aboveMiddle = rect.top + rect.height / 2 < vh / 2;


                if (st.state === 'out' && ratio >= need) {

                    arriving.push({ el, st, dir: aboveMiddle ? -1 : 1, top: rect.top });

                } else if (st.state === 'in' && ratio < need * 0.5) {

                    leave(el, st, aboveMiddle ? -1 : 1);

                }

            });


            /* Stagger: nearest the edge they came in through goes first */

            [
                arriving.filter(a => a.dir === 1).sort((p, q) => p.top - q.top),
                arriving.filter(a => a.dir === -1).sort((p, q) => q.top - p.top)
            ].forEach(group => {

                group.forEach((a, i) => {

                    const fixed = a.el.dataset.delay;

                    enter(
                        a.el,
                        a.st,
                        a.dir,
                        fixed ? parseInt(fixed, 10) : Math.min(i, MAX_STEPS) * STEP
                    );

                });

            });

        }, { threshold: THRESHOLDS });


        targets.forEach(el => {

            states.set(el, { state: 'out', anim: null, type: el.dataset.reveal || 'up' });

            observer.observe(el);

        });


        /* ---- hero: plays once from CSS on load, then joins the system ---- */

        heroItems.forEach(el => {

            let adopted = false;

            function adopt() {

                if (adopted) return;

                adopted = true;

                /* Elements that also parallax can only fade (their translate /
                   scale belong to the parallax loop) */

                const parallaxed = el.matches('[data-parallax], [data-zoom]');

                const type = parallaxed ? 'fade' : (el.dataset.hero || 'up');

                el.removeAttribute('data-hero');

                el.setAttribute('data-reveal', type);

                el.classList.add('is-visible');

                states.set(el, { state: 'in', anim: null, type });

                observer.observe(el);

            }

            el.addEventListener('animationend', e => {

                if (e.target === el) adopt();

            });

            setTimeout(adopt, 3500);   /* safety net */

        });

    }


    /* ---------------------------------------------------
       Parallax + scroll zoom
       [data-parallax="0.15"]  drift: the element moves at a
            different speed from the page (negative = faster)
       [data-zoom="0.08"]      scale: grows as the element
            passes through the middle of the screen

       One rAF loop, writes only (positions are measured once),
       only touches elements near the viewport, and uses the
       GPU-friendly `translate` / `scale` properties.
    --------------------------------------------------- */

    function initParallax() {

        if (reduceMotion.matches) return;

        const nodes = Array.from(document.querySelectorAll('[data-parallax], [data-zoom]'));

        if (!nodes.length || !('IntersectionObserver' in window)) return;


        const items = new Map();

        nodes.forEach(el => {

            items.set(el, {
                el,
                speed: parseFloat(el.dataset.parallax) || 0,
                zoom: parseFloat(el.dataset.zoom) || 0,
                ref: 0,
                live: false
            });

        });


        let vh = window.innerHeight;

        let factor = 1;

        let ticking = false;


        /* Scroll position at which the element rests exactly where the
           CSS put it (zero offset). For things below the fold that is when
           they are centred on screen; for things already visible at the
           top of the page it is scroll position 0 — so the hero layout is
           untouched on load and only starts to drift when you scroll. */

        /* Document-space centre of an element, ignoring transforms
           (offset* values are layout-only, so our own translate/scale
           never feeds back into the measurement) */

        function docCenter(el) {

            let y = 0;

            let node = el;

            while (node) {

                y += node.offsetTop;

                node = node.offsetParent;

            }

            return y + el.offsetHeight / 2;

        }


        function measure() {

            vh = window.innerHeight;

            factor = window.innerWidth <= 650 ? 0.6 : 1;   /* calmer on phones */

            items.forEach(item => {

                item.ref = Math.max(0, docCenter(item.el) - vh / 2);

            });

        }


        function render() {

            ticking = false;

            const y = window.scrollY;

            items.forEach(item => {

                if (!item.live) return;

                const d = y - item.ref;   /* + once we've scrolled past the rest point */

                if (item.speed) {

                    item.el.style.translate =
                        '0 ' + (d * item.speed * factor).toFixed(1) + 'px';

                }

                if (item.zoom) {

                    const p = Math.max(-1, Math.min(1, d / vh));

                    item.el.style.scale =
                        (1 + p * item.zoom * factor).toFixed(4);

                }

            });

        }


        function requestRender() {

            if (ticking) return;

            ticking = true;

            requestAnimationFrame(render);

        }


        /* Only elements near the viewport are updated */

        const observer = new IntersectionObserver(entries => {

            entries.forEach(entry => {

                const item = items.get(entry.target);

                item.live = entry.isIntersecting;

                entry.target.style.willChange =
                    entry.isIntersecting ? 'translate, scale' : '';

            });

            requestRender();

        }, { rootMargin: '25% 0px 25% 0px' });

        nodes.forEach(el => observer.observe(el));


        measure();

        window.addEventListener('scroll', requestRender, { passive: true });


        let resizeTimer;

        function remeasure() {

            clearTimeout(resizeTimer);

            resizeTimer = setTimeout(() => {

                measure();

                requestRender();

            }, 150);

        }

        window.addEventListener('resize', remeasure);

        window.addEventListener('load', remeasure);   /* images change the layout */

        if (document.fonts && document.fonts.ready) {

            document.fonts.ready.then(remeasure);

        }

    }


    /* ---------------------------------------------------
       Count-up numbers (the hero stats)
       "10+" counts 0 → 10 whenever it comes on screen, and resets
       when it leaves, so it replays with the rest of the reveals.
       The real value stays in the page until JS swaps it, and is
       restored exactly when the count finishes.
    --------------------------------------------------- */

    function initCountUp() {

        if (reduceMotion.matches || !animOn() || !('IntersectionObserver' in window)) return;

        const DURATION = 1400;

        const START_DELAY = 700;  /* lets the stats card finish zooming in */

        const nodes = Array.from(document.querySelectorAll('.stat strong'));


        const parsed = nodes.map(el => {

            const m = el.textContent.trim().match(/^(\d+)(\D*)$/);

            return m
                ? { el, final: el.textContent.trim(), to: parseInt(m[1], 10), suffix: m[2], on: false, token: 0 }
                : null;

        }).filter(Boolean);

        if (!parsed.length) return;


        parsed.forEach(p => { p.el.textContent = '0' + p.suffix; });


        function run(p) {

            const token = ++p.token;

            setTimeout(() => {

                if (token !== p.token) return;   /* left the screen meanwhile */

                const t0 = performance.now();

                (function tick(now) {

                    if (token !== p.token) return;

                    const t = Math.min(1, (now - t0) / DURATION);

                    const eased = 1 - Math.pow(1 - t, 3);   /* easeOutCubic */

                    p.el.textContent = Math.round(p.to * eased) + p.suffix;

                    if (t < 1) {

                        requestAnimationFrame(tick);

                    } else {

                        p.el.textContent = p.final;

                    }

                })(t0);

            }, START_DELAY);

        }


        const observer = new IntersectionObserver(entries => {

            entries.forEach(entry => {

                const p = parsed.find(x => x.el === entry.target);

                if (entry.intersectionRatio >= 0.6 && !p.on) {

                    p.on = true;

                    run(p);

                } else if (entry.intersectionRatio === 0 && p.on) {

                    p.on = false;

                    p.token++;

                    p.el.textContent = '0' + p.suffix;

                }

            });

        }, { threshold: [0, 0.6] });

        parsed.forEach(p => observer.observe(p.el));

    }


    /* ---------------------------------------------------
       Boot
    --------------------------------------------------- */

    function boot() {

        initMobileNav();

        initTechMarquee();

        initServiceCards();

        initProjectsCarousel();

        initReveals();

        initParallax();

        initCountUp();

    }


    if (document.readyState === 'loading') {

        document.addEventListener('DOMContentLoaded', boot);

    } else {

        boot();

    }

})();