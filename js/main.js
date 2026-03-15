/* =========================================
   CAFÉ DES LETTRES — main.js (v2)
   Ajout : chargement dynamique prix/horaires
   via Firebase REST API (sans SDK)
   ========================================= */

/* ─────────────────────────────────────────
   CONFIGURATION FIREBASE
   Remplacez cette URL par celle de votre
   projet Firebase (voir firebase-setup.md)
───────────────────────────────────────── */
const FIREBASE_DB_URL = 'VOTRE_FIREBASE_DATABASE_URL';
// Exemple : 'https://cafe-des-lettres-default-rtdb.europe-west1.firebasedatabase.app'

/* --- Navbar HTML partagé --- */
const NAVBAR_HTML = `
<nav class="navbar" id="navbar">
  <a href="index.html" class="nav-logo">
    <span class="logo-main">Café des Lettres</span>
    <span class="logo-sub">Montpellier</span>
  </a>
  <ul class="nav-links">
    <li><a href="index.html">Accueil</a></li>
    <li><a href="menu.html">Menu</a></li>
    <li><a href="about.html">Le Lieu</a></li>
    <li><a href="contact.html">Contact</a></li>
  </ul>
  <button class="nav-toggle" id="navToggle" aria-label="Ouvrir le menu">
    <span></span><span></span><span></span>
  </button>
</nav>
<div class="nav-mobile" id="navMobile">
  <button class="nav-mobile-close" id="navClose" aria-label="Fermer">&#10005;</button>
  <a href="index.html">Accueil</a>
  <div class="nav-mobile-deco"></div>
  <a href="menu.html">Menu</a>
  <div class="nav-mobile-deco"></div>
  <a href="about.html">Le Lieu</a>
  <div class="nav-mobile-deco"></div>
  <a href="contact.html">Contact</a>
</div>
`;

/* --- Footer HTML partagé --- */
const FOOTER_HTML = `
<footer>
  <div class="footer-inner">
    <div class="footer-brand">
      <div class="brand-name">Cafe des Lettres</div>
      <div class="brand-tagline">Un lieu d'ouverture, de partage et de decouverte</div>
      <p>Au coeur de Montpellier, le Cafe des Lettres est un espace ou les saveurs voyagent, les idees se rencontrent et les traditions dialoguent.</p>
      <div class="footer-social">
        <a href="https://www.instagram.com/cafedeslettres_montpellier?igsh=aW03Z2tvd2kzcmxj" class="social-link" aria-label="Instagram">
          <svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
        </a>
        <a href="https://www.facebook.com/share/17Grah9FSA/" class="social-link" aria-label="Facebook">
          <svg viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        </a>
      </div>
    </div>
    <div class="footer-col">
      <h4>Navigation</h4>
      <ul>
        <li><a href="index.html">Accueil</a></li>
        <li><a href="menu.html">La Carte</a></li>
        <li><a href="about.html">Le Lieu</a></li>
        <li><a href="contact.html">Nous contacter</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4>Contact</h4>
      <div class="footer-contact-item">
        <svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
        <span><a href="tel:+33000000000">Tel. a renseigner</a></span>
      </div>
      <div class="footer-contact-item">
        <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
        <span><a href="mailto:contact@exemple.fr">Email a renseigner</a></span>
      </div>
      <div class="footer-contact-item">
        <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
        <span>Médiathèque Émile Zola, 34000 Montpellier, France</span>
      </div>
    </div>
    <div class="footer-col footer-col-map">
      <h4>Nous trouver</h4>
      <div class="footer-map-box">
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d23068.721276861623!2d3.817472!3d43.71906559999999!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x12b6ac269c6b91f5%3A0x4aacb231a59d8686!2zTcOpZGlhdGjDqHF1ZSDDiW1pbGUgWm9sYQ!5e0!3m2!1sfr!2sfr!4v1773001075966!5m2!1sfr!2sfr"
          width="100%"
          height="100%"
          style="border:0;display:block;"
          allowfullscreen=""
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          title="Café des Lettres — Médiathèque Émile Zola, Montpellier">
        </iframe>
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <span>&copy; 2025 Cafe des Lettres &mdash; Montpellier. Tous droits reserves.</span>
    <span>Aux Quatre Horizons</span>
  </div>
</footer>
`;

/* ─────────────────────────────────────────────────────────────
   CHARGEMENT DYNAMIQUE — Firebase REST API (sans SDK)
   
   Principe : on fait un simple fetch() sur le endpoint REST
   public de Firebase. Pas de bibliothèque supplémentaire.
   Les prix dans menu.html et les horaires dans contact.html
   sont ciblés via data-price-key / data-hour-key.
   
   Si Firebase n'est pas configuré, le contenu statique HTML
   s'affiche normalement (fallback gracieux).
─────────────────────────────────────────────────────────────── */
async function loadDynamicData() {
  // Pas encore configuré → on ne fait rien
  if (!FIREBASE_DB_URL || FIREBASE_DB_URL === 'VOTRE_FIREBASE_DATABASE_URL') return;

  try {
    const res = await fetch(`${FIREBASE_DB_URL}/config.json`, {
      cache: 'no-cache'
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!data) return;

    // ── Patch des prix ──────────────────────────────────────
    // Cible tous les éléments portant data-price-key dans la page
    if (data.prices) {
      document.querySelectorAll('[data-price-key]').forEach(el => {
        const val = data.prices[el.dataset.priceKey];
        if (val !== undefined) el.textContent = val;
      });
    }

    // ── Patch des horaires ──────────────────────────────────
    // Cible tous les éléments portant data-hour-key dans la page
    if (data.hours) {
      document.querySelectorAll('[data-hour-key]').forEach(el => {
        const val = data.hours[el.dataset.hourKey];
        if (val !== undefined) el.textContent = val;
      });
    }

  } catch (e) {
    // Réseau indisponible ou Firebase down → affichage statique
    console.warn('[CaféDesLettres] Firebase non disponible — données statiques utilisées.');
  }
}


/* --- Initialisation principale --- */
document.addEventListener('DOMContentLoaded', () => {

  // Injection navbar
  const navHolder = document.getElementById('navbar-placeholder');
  if (navHolder) navHolder.innerHTML = NAVBAR_HTML;

  // Injection footer
  const footHolder = document.getElementById('footer-placeholder');
  if (footHolder) footHolder.innerHTML = FOOTER_HTML;

  // Active link sur la page courante
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .nav-mobile a').forEach(a => {
    if (a.getAttribute('href') === page) a.classList.add('active');
  });

  // Effet scroll navbar
  const navbar = document.getElementById('navbar');
  if (navbar) {
    const scrollHandler = () => navbar.classList.toggle('scrolled', window.scrollY > 60);
    window.addEventListener('scroll', scrollHandler, { passive: true });
    scrollHandler();
  }

  // Menu mobile
  const toggle = document.getElementById('navToggle');
  const mobile = document.getElementById('navMobile');
  const close  = document.getElementById('navClose');
  if (toggle && mobile) toggle.addEventListener('click', () => { mobile.classList.add('open'); document.body.style.overflow = 'hidden'; });
  if (close  && mobile) close.addEventListener('click',  () => { mobile.classList.remove('open'); document.body.style.overflow = ''; });
  if (mobile) mobile.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { mobile.classList.remove('open'); document.body.style.overflow = ''; }));

  // Reveal au scroll
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
    }, { threshold: 0.1 });
    reveals.forEach(el => obs.observe(el));
  }

  // Filtres menu
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      document.querySelectorAll('.menu-category').forEach(cat => {
        cat.style.display = (filter === 'all' || cat.dataset.category === filter) ? '' : 'none';
      });
    });
  });

  // Formulaire contact
  const form    = document.getElementById('contactForm');
  const success = document.getElementById('formSuccess');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      btn.textContent = 'Envoi en cours...';
      btn.disabled = true;
      setTimeout(() => {
        form.reset();
        btn.textContent = 'Envoyer le message';
        btn.disabled = false;
        if (success) { success.style.display = 'block'; setTimeout(() => success.style.display = 'none', 5000); }
      }, 1200);
    });
  }

  // ── Chargement des données dynamiques Firebase ──────────
  loadDynamicData();

});
