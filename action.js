/* =========================================================
   Tshepiso. — Portfolio interactions
========================================================= */

(function () {

    /* Shared: respect the visitor's "reduce motion" OS setting */

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');


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


        /* -------- Helpers -------- */

        function getCardsPerPage() {

            const w = window.innerWidth;

            if (w <= 650) return 1;

            if (w <= 900) return 2;

            return 3;

        }


        /* All measurements use getBoundingClientRect() so they are
           fractional-pixel exact and unaffected by the track's own
           translateX (both edges move together). */

        function getStep() {

            if (cards.length < 2) {

                return cards[0].getBoundingClientRect().width;

            }

            /* Distance between the left edges of two adjacent cards
               = card width + gap, whatever the CSS says. */

            return cards[1].getBoundingClientRect().left
                 - cards[0].getBoundingClientRect().left;

        }


        function getViewportWidth() {

            /* Visible width = carousel box minus its horizontal padding */

            const style = getComputedStyle(carousel);

            return carousel.getBoundingClientRect().width
                 - parseFloat(style.paddingLeft)
                 - parseFloat(style.paddingRight);

        }


        function getMaxTranslate() {

            const first = cards[0].getBoundingClientRect();

            const last = cards[cards.length - 1].getBoundingClientRect();

            const contentWidth = last.right - first.left;

            return Math.max(0, contentWidth - getViewportWidth());

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

            const step = getStep();

            const perPage = getCardsPerPage();

            const maxTranslate = getMaxTranslate();


            /* Clamp so the final page ends flush with the right edge */

            let target = currentPage * perPage * step;

            if (target > maxTranslate) target = maxTranslate;


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

            if (reduceMotion.matches || totalPages < 2) return;

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
       Boot
    --------------------------------------------------- */

    function boot() {

        initMobileNav();

        initTechMarquee();

        initServiceCards();

        initProjectsCarousel();

    }


    if (document.readyState === 'loading') {

        document.addEventListener('DOMContentLoaded', boot);

    } else {

        boot();

    }

})();