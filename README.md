# Café des Lettres — Documentation

> Site vitrine du Café des Lettres, Montpellier.  
> Stack : **HTML/CSS/JS statique** + **PocketBase** (API & base de données) + **Nginx** (reverse proxy) + **Docker Compose**.

---

## Table des matières

| Fichier | Contenu |
|---|---|
| `README.md` | Ce fichier — vue d'ensemble, structure du projet |
| `ARCHITECTURE.md` | Stack technique, flux de données, schéma de déploiement |
| `LACUNES.md` | Lacunes identifiées, bugs, points d'amélioration |
| `DEPLOYMENT.md` | Guide complet de déploiement sur Ubuntu Server + Docker |

---

## Pages du site

| Fichier | URL | Description |
|---|---|---|
| `site/index.html` | `/` | Page d'accueil, hero, intro, points forts |
| `site/menu.html` | `/menu.html` | Carte complète avec filtres par catégorie |
| `site/about.html` | `/about.html` | Histoire, concept, galerie photos |
| `site/contact.html` | `/contact.html` | Infos pratiques, horaires, formulaire |
| `site/admin.html` | ⚠️ à déplacer | Interface d'administration — ne doit pas rester dans `site/` |

---

## Structure actuelle sur le serveur

```
/opt/cafedeslettres/
├── docker-compose.yml
├── docker-setup.md
├── pocketbase-setup.md
├── logs/
│   └── nginx/
│       ├── access.log
│       └── error.log
├── nginx/
│   └── conf.d/
│       └── cafedeslettres.conf
├── pb_data/                      ← données PocketBase (volume Docker)
└── site/
    ├── index.html
    ├── menu.html
    ├── about.html
    ├── contact.html
    ├── admin.html                ← ⚠️ doit être retiré du dossier public
    ├── css/
    │   └── style.css
    ├── js/
    │   └── main.js               ← ⚠️ IP hardcodée à corriger
    └── images/
        ├── accueil.jpg
        ├── cafe.jpg
        ├── cafe_2.jpg
        ├── cafe_des_lettres.jpg
        ├── poke_bowl.jpg
        └── poke_bawl.jpg         ← doublon (faute de frappe, à supprimer)
```

---

## Données dynamiques (PocketBase)

Le site lit une collection `site_config` dans PocketBase :

```json
{
  "prices": { "orient-espresso": "1,60 €", "cappuccino": "3,50 €" },
  "hours":  { "lundi": "08h30 – 18h00", "dimanche": "Fermé" }
}
```

- **Lecture** : publique, sans authentification (règle PocketBase à configurer).
- **Écriture** : réservée à l'admin PocketBase (token admin injecté par le SDK dans `admin.html`).
- Si PocketBase est inaccessible, le HTML statique s'affiche avec les valeurs par défaut.

---

## Flux de mise à jour des prix / horaires

```
Admin ouvre admin.html
  → Connexion PocketBase (admin)
    → Lecture collection site_config
      → Modification des champs
        → PATCH /api/collections/site_config/records/:id
          → Site public rechargé → fetch /api/collections/site_config/records
            → Injection des nouvelles valeurs dans le DOM
```
