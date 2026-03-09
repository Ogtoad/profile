/* ════════════════════════════════════════════
   Script — Scroll-spy, Reveal, Mobile Menu,
   Deep-Dive Toggle, Particles.js
   ════════════════════════════════════════════ */

(function () {
    'use strict';

    const nav = document.getElementById('main-nav');
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const navItems = document.querySelectorAll('.nav-item');
    const mobileItems = document.querySelectorAll('.mobile-nav-item');
    const sections = document.querySelectorAll('.section');
    const reveals = document.querySelectorAll('.reveal');

    /* ── Scroll-Spy (Intersection Observer) ── */

    const spyObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    setActiveNav(id);
                }
            });
        },
        {
            rootMargin: '-35% 0px -60% 0px',
            threshold: 0,
        }
    );

    sections.forEach((sec) => spyObserver.observe(sec));

    function setActiveNav(activeId) {
        navItems.forEach((item) => {
            item.classList.toggle('active', item.dataset.section === activeId);
        });
        mobileItems.forEach((item) => {
            item.classList.toggle('active', item.dataset.section === activeId);
        });
    }

    /* ── Nav shadow on scroll ── */

    window.addEventListener('scroll', () => {
        nav.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });

    /* ── Smooth scroll on nav click ── */

    function handleNavClick(e) {
        e.preventDefault();
        const target = document.querySelector(e.currentTarget.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
        closeMobile();
    }

    navItems.forEach((item) => item.addEventListener('click', handleNavClick));
    mobileItems.forEach((item) => item.addEventListener('click', handleNavClick));

    /* ── Mobile Menu ── */

    function closeMobile() {
        hamburgerBtn.classList.remove('open');
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
    }

    hamburgerBtn.addEventListener('click', () => {
        const isOpen = hamburgerBtn.classList.toggle('open');
        mobileMenu.classList.toggle('open', isOpen);
        document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    /* ── Scroll-Reveal ── */

    const revealObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        },
        {
            rootMargin: '0px 0px -60px 0px',
            threshold: 0.1,
        }
    );

    reveals.forEach((el) => revealObserver.observe(el));

    /* ── Auto-reveal hero elements on load ── */

    window.addEventListener('load', () => {
        document.querySelectorAll('#home .reveal').forEach((el, i) => {
            setTimeout(() => el.classList.add('visible'), 200 + i * 140);
        });
    });

    /* ── Deep-Dive Toggle ── */

    document.querySelectorAll('.deep-toggle').forEach((btn) => {
        btn.addEventListener('click', () => {
            const deep = btn.nextElementSibling;
            const isOpen = deep.classList.toggle('open');
            btn.setAttribute('aria-expanded', isOpen);
        });
    });

    /* ── Particles.js ── */

    if (typeof particlesJS !== 'undefined') {
        particlesJS.load('particles-js', 'particlesjs-config.json');
    }
})();
