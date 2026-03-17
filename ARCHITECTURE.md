# Architecture technique — Café des Lettres

## Stack

| Couche | Technologie | Rôle |
|---|---|---|
| Front-end | HTML5 / CSS3 / JS vanilla | Site statique, rendu côté client |
| API & BDD | PocketBase (Go) | REST API, auth admin, stockage JSON |
| Reverse proxy | Nginx (Alpine) | Sert les fichiers statiques + proxy `/api/` et `/_/` vers PocketBase |
| Orchestration | Docker Compose | Déploiement sur Ubuntu Server |

---

## Schéma de déploiement

```
Internet / LAN
      │
      ▼
┌─────────────┐
│    Nginx    │  :80  (+ :443 à ajouter via Certbot)
│  cafe_nginx │
└──────┬──────┘
       │
       │  /           → fichiers statiques  ./site/
       │  /api/*      → proxy_pass  http://pocketbase:8090/api/
       │  /_/*        → proxy_pass  http://pocketbase:8090/_/
       │
       ▼
┌─────────────────┐
│   PocketBase    │  :8090  (réseau interne uniquement, non exposé)
│ cafe_pocketbase │
└─────────────────┘
       │
       ▼
  ./pb_data/           ← volume monté sur l'hôte (persistant)
```

**Réseau Docker** : `cafe_net` (bridge isolé). PocketBase n'est **jamais** accessible directement depuis l'extérieur — uniquement via Nginx.

---

## Flux de données — site public

```
Navigateur
  ├── GET /                    → Nginx → site/index.html (statique)
  ├── GET /css/style.css       → Nginx → site/css/style.css
  ├── GET /js/main.js          → Nginx → site/js/main.js
  └── GET /api/collections/site_config/records?perPage=1
                               → Nginx (proxy) → PocketBase
                               ← { items: [{ prices: {...}, hours: {...} }] }
                               → main.js injecte les valeurs dans le DOM
```

**Fallback gracieux** : si PocketBase ne répond pas, `loadDynamicData()` catch l'erreur silencieusement. Les valeurs codées en dur dans le HTML s'affichent à la place.

---

## Flux de données — administration

```
Admin ouvre admin.html (accès local ou URL protégée)
  └── POST /api/admins/auth-with-password   → PocketBase
      ← { token, admin }
      → SDK stocke le token en mémoire

  └── GET  /api/collections/site_config/records?page=1&perPage=1
      ← enregistrement existant (ou collection vide)

  └── [Modification] PATCH /api/collections/site_config/records/:id
      (ou POST si collection vide → création du premier enregistrement)
      → données mises à jour en base
```

---

## Fichiers clés et leur rôle

### `site/js/main.js`
Fichier JavaScript unique partagé par toutes les pages publiques. Responsabilités :
- Injection du HTML de la navbar et du footer (partagés entre pages)
- Activation du lien courant dans la nav
- Comportement scroll de la navbar (transparent → foncé)
- Menu mobile (ouverture/fermeture)
- Animations IntersectionObserver (`.reveal`)
- Filtres de la page menu
- Gestion du formulaire de contact (simulation côté client — pas d'envoi réel)
- `loadDynamicData()` → appel REST vers PocketBase pour charger les prix et horaires

**Variable clé :**
```javascript
const PB_URL = 'http://192.168.1.50'; // ⚠️ À corriger → '' (URL relative)
```

### `site/css/style.css`
Feuille de style unique. Organisation :
1. Variables CSS (`:root`) — palette, typographie, transitions
2. Reset & base
3. Navbar / footer
4. Utilitaires (boutons, titres, dividers)
5. Sections par page (hero, intro, features, menu, about, contact)
6. Animations (`.reveal`)
7. Media queries (≤ 900px puis ≤ 600px)

### `site/admin.html`
Page autonome (sans dépendance à `main.js` ni `style.css`). Intègre :
- PocketBase JS SDK (CDN jsDelivr)
- Authentification admin PocketBase
- Formulaire d'édition des prix (groupés par catégorie)
- Formulaire d'édition des horaires (par jour)
- Sauvegarde via PATCH ou POST sur la collection `site_config`

> ⚠️ **Ce fichier est actuellement dans `site/` et donc accessible publiquement.**  
> Voir `LACUNES.md` #1 pour la procédure de correction.

### `nginx/conf.d/cafedeslettres.conf`
Configuration Nginx :
- `try_files` pour le routing statique
- `proxy_pass` vers `http://pocketbase:8090` pour `/api/` et `/_/`

> ⚠️ Headers de sécurité et rate limiting absents. Voir `LACUNES.md`.

---

## Collection PocketBase : `site_config`

Création via l'interface admin `/_/` après premier démarrage.

| Champ | Type PocketBase | Description |
|---|---|---|
| `prices` | JSON | `{ "orient-espresso": "1,60 €", … }` |
| `hours` | JSON | `{ "lundi": "08h30 – 18h00", … }` |

**Règles d'accès recommandées :**

| Opération | Règle |
|---|---|
| List / View | *(vide)* — accès public non authentifié |
| Create / Update / Delete | `@request.auth.isAdmin = true` |

---

## Volumes Docker

| Volume | Chemin hôte | Chemin conteneur | Mode |
|---|---|---|---|
| Données PocketBase | `./pb_data` | `/pb/pb_data` | Lecture/écriture |
| Config Nginx | `./nginx/conf.d/cafedeslettres.conf` | `/etc/nginx/conf.d/default.conf` | Lecture seule |
| Fichiers site | `./site` | `/var/www/cafedeslettres` | Lecture seule |
| Logs Nginx | `./logs/nginx` | `/var/log/nginx` | Lecture/écriture |
