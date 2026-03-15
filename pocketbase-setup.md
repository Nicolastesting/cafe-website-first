# Guide complet — PocketBase + Auto-hébergement Ubuntu
## Café des Lettres — Module Admin Light

---

## Pourquoi PocketBase ?

| Critère             | PocketBase ✅         | Firebase           | Supabase            |
|---------------------|----------------------|--------------------|---------------------|
| Hébergement         | Votre serveur Ubuntu | Google Cloud       | Supabase Cloud      |
| Dépendance cloud    | ❌ Aucune            | ✅ Google          | ✅ Supabase         |
| Coût                | 0 € (votre machine)  | Tier gratuit limité| Tier gratuit limité |
| Installation        | 1 binaire Go (~30 MB)| SDK + config       | SDK + config        |
| Interface admin     | ✅ Incluse (/_/)     | Console Firebase   | Dashboard Supabase  |
| Auth intégrée       | ✅ Oui               | ✅ Oui             | ✅ Oui              |
| REST API            | ✅ Auto-générée      | ✅ Oui             | ✅ Oui              |
| Base de données     | SQLite (1 fichier)   | Realtime DB (JSON) | PostgreSQL          |
| Sauvegarde          | Copier 1 fichier     | Export Firebase    | pg_dump             |

**Verdict** : Pour un site vitrine auto-hébergé, PocketBase est imbattable.
Un seul binaire, zéro dépendance, données locales, sauvegarde triviale.

---

## Vue d'ensemble de l'architecture

```
Internet
    │
    ▼
[ Box / IP fixe ou DynDNS ]
    │
    ▼
[ Ubuntu Server ]
    ├── Nginx (port 80/443) ── reverse proxy
    │       ├── /             → site statique (HTML/CSS/JS)
    │       └── /api/...      → PocketBase :8090
    │
    └── PocketBase (port 8090, interne uniquement)
            └── pb_data/
                    └── data.db  ← toutes vos données (1 fichier SQLite)
```

---

## ÉTAPE 1 — Préparer le serveur Ubuntu

```bash
# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installer les outils nécessaires
sudo apt install -y nginx certbot python3-certbot-nginx unzip curl ufw
```

### Configurer le pare-feu (UFW)

```bash
sudo ufw allow OpenSSH        # SSH — INDISPENSABLE, ne pas oublier !
sudo ufw allow 'Nginx Full'   # HTTP (80) + HTTPS (443)
sudo ufw enable
sudo ufw status               # Vérifier que SSH et Nginx sont autorisés
```

> ⚠️ **Important** : N'ouvrez PAS le port 8090 dans UFW. PocketBase
> ne doit jamais être accessible directement depuis internet.
> Nginx fait le proxy — c'est lui qui est exposé.

---

## ÉTAPE 2 — Installer PocketBase

```bash
# Créer un utilisateur dédié (bonne pratique sécurité)
sudo useradd -r -s /bin/false -d /opt/pocketbase pocketbase
sudo mkdir -p /opt/pocketbase
sudo chown pocketbase:pocketbase /opt/pocketbase

# Télécharger PocketBase (vérifier la dernière version sur github.com/pocketbase/pocketbase)
cd /tmp
curl -LO https://github.com/pocketbase/pocketbase/releases/download/v0.22.20/pocketbase_0.22.20_linux_amd64.zip
unzip pocketbase_0.22.20_linux_amd64.zip -d pocketbase_bin

# Installer le binaire
sudo mv pocketbase_bin/pocketbase /opt/pocketbase/pocketbase
sudo chmod +x /opt/pocketbase/pocketbase
sudo chown pocketbase:pocketbase /opt/pocketbase/pocketbase

# Vérifier
/opt/pocketbase/pocketbase --version
```

> 💡 Vérifiez toujours la dernière version sur :
> https://github.com/pocketbase/pocketbase/releases

---

## ÉTAPE 3 — Créer le service systemd

Le service systemd garantit que PocketBase :
- démarre automatiquement au boot du serveur
- redémarre en cas de crash
- tourne en arrière-plan sans terminal ouvert

```bash
sudo nano /etc/systemd/system/pocketbase.service
```

Coller ce contenu :

```ini
[Unit]
Description=PocketBase — Café des Lettres
Documentation=https://pocketbase.io/docs/
After=network.target

[Service]
Type=simple
User=pocketbase
Group=pocketbase
WorkingDirectory=/opt/pocketbase
ExecStart=/opt/pocketbase/pocketbase serve \
    --http="127.0.0.1:8090" \
    --dir="/opt/pocketbase/pb_data"

# Sécurité : restreindre les capacités du processus
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/pocketbase/pb_data
PrivateTmp=true

Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
# Activer et démarrer le service
sudo systemctl daemon-reload
sudo systemctl enable pocketbase
sudo systemctl start pocketbase

# Vérifier qu'il tourne
sudo systemctl status pocketbase

# Voir les logs en direct
sudo journalctl -u pocketbase -f
```

---

## ÉTAPE 4 — Créer le compte administrateur PocketBase

PocketBase expose une interface admin à `/_/`.
La **première visite** crée le compte admin. À faire immédiatement.

```bash
# Test local depuis le serveur (PocketBase écoute sur 127.0.0.1)
curl http://127.0.0.1:8090/api/health
# Doit retourner : {"code":200,"message":"API is healthy.","data":{}}
```

Pour accéder à `/_/` depuis votre navigateur **avant** de configurer Nginx,
ouvrez temporairement un tunnel SSH depuis votre machine locale :

```bash
# Sur VOTRE machine (pas le serveur)
ssh -L 8090:127.0.0.1:8090 user@IP_DU_SERVEUR
```

Puis ouvrez http://localhost:8090/_/ dans votre navigateur.
Créez le compte admin (email + mot de passe fort).

> ⚠️ Cette étape est à faire UNE SEULE FOIS juste après l'installation.
> Si vous ne le faites pas, n'importe qui pourrait créer le premier admin.

---

## ÉTAPE 5 — Créer la collection `site_config`

Dans l'interface admin `/_/` :

1. Cliquer sur **"New collection"**
2. Nom : `site_config`
3. Type : **Base collection** (pas Auth)
4. Ajouter les champs :
   - Cliquer "New field" → type **JSON** → nom : `prices`
   - Cliquer "New field" → type **JSON** → nom : `hours`
5. **Configurer les règles d'accès** (onglet "API Rules") :
   - List rule  : laisser vide → `""` (public)
   - View rule  : laisser vide → `""` (public)
   - Create rule : `@request.auth.id != ""` (admin seulement via SDK)
   - Update rule : `@request.auth.id != ""` (admin seulement via SDK)
   - Delete rule : laisser vide (personne ne peut supprimer via API)

   > **Note** : En pratique, les admins PocketBase contournent toujours
   > les règles API. Ces règles s'appliquent aux utilisateurs normaux.
   > Mettre `@request.auth.id != ""` bloque les requêtes non authentifiées.

6. Cliquer **"Create"**

### Créer le premier enregistrement

Dans la collection `site_config`, cliquer **"New record"** et remplir :

**prices** (champ JSON) :
```json
{
  "orient-espresso": "1,60 €",
  "noisette": "1,70 €",
  "cafe-allonge": "2,00 €",
  "orient-espresso-ar": "2,80 €",
  "cappuccino": "3,50 €",
  "cafe-au-lait": "3,50 €",
  "chocolat-chaud": "4,00 €",
  "eau": "1,20 €",
  "canette-pulco": "1,50 €",
  "capri-sun": "2,00 €",
  "jus-fruit": "3,00 €",
  "sirop": "3,00 €",
  "cafe-frappe": "4,00 €",
  "ginger-beer": "4,00 €",
  "lassi-nature": "5,00 €",
  "lassi-mangue": "5,50 €",
  "milk-shake": "5,50 €",
  "the-tante": "2,50 €",
  "the-menthe": "3,00 €",
  "the-detox": "3,50 €",
  "ice-tea": "4,00 €",
  "chai": "5,00 €",
  "matcha": "5,50 €",
  "navette-thon": "3,10 €",
  "navette-saumon": "3,50 €",
  "chausson-frita": "4,20 €",
  "croque-vegetarien": "4,60 €",
  "croque-monsieur": "4,90 €",
  "bun-bolly": "6,00 €",
  "brooklyn-bun": "6,50 €",
  "fusion-bowl": "10,00 €",
  "beignet-nature": "1,00 €",
  "beignet-fruits-rouges": "1,30 €",
  "madeleine-nature": "1,10 €",
  "madeleine-caramel": "1,30 €",
  "bonbons": "1,80 €",
  "chocolaterie": "2,00 €",
  "gateau-tigre": "2,30 €",
  "dattes": "2,50 €",
  "financier": "2,80 €",
  "muffin": "3,50 €",
  "tartelette-citron": "4,00 €",
  "tartelette-chocolat": "4,00 €",
  "suppl-chantilly": "0,50 €",
  "suppl-vegetal": "1,00 €"
}
```

**hours** (champ JSON) :
```json
{
  "lundi": "08h30 – 18h00",
  "mardi": "08h30 – 18h00",
  "mercredi": "08h30 – 18h00",
  "jeudi": "08h30 – 18h00",
  "vendredi": "08h30 – 19h00",
  "samedi": "09h30 – 19h00",
  "dimanche": "Fermé"
}
```

---

## ÉTAPE 6 — Configurer Nginx

### Option A : Domaine principal + sous-domaine API

```
cafedeslettres.fr        → site statique
api.cafedeslettres.fr    → PocketBase
```

```bash
sudo nano /etc/nginx/sites-available/cafedeslettres
```

```nginx
# ── Site statique ─────────────────────────────────────────
server {
    listen 80;
    server_name cafedeslettres.fr www.cafedeslettres.fr;

    root /var/www/cafedeslettres;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # Cache agressif sur les assets statiques
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|pdf)$ {
        expires 7d;
        add_header Cache-Control "public, no-transform";
    }
}

# ── API PocketBase ─────────────────────────────────────────
server {
    listen 80;
    server_name api.cafedeslettres.fr;

    location / {
        proxy_pass         http://127.0.0.1:8090;
        proxy_http_version 1.1;

        # Headers nécessaires pour PocketBase
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Support WebSocket (pour l'interface admin /_/)
        proxy_set_header  Upgrade    $http_upgrade;
        proxy_set_header  Connection "upgrade";

        # Timeouts
        proxy_read_timeout  360s;
        proxy_send_timeout  360s;
    }
}
```

```bash
# Activer la config
sudo ln -s /etc/nginx/sites-available/cafedeslettres /etc/nginx/sites-enabled/
sudo nginx -t          # Vérifier la syntaxe
sudo systemctl reload nginx
```

### Option B : Tout sur un seul domaine (path /api)

Si vous n'avez qu'un seul domaine, PocketBase peut être accessible
sur `/pb/` pendant que le site est sur `/` :

```nginx
server {
    listen 80;
    server_name cafedeslettres.fr www.cafedeslettres.fr;

    root /var/www/cafedeslettres;
    index index.html;

    # PocketBase sur le chemin /pb/
    location /pb/ {
        rewrite ^/pb/(.*) /$1 break;
        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host            $host;
        proxy_set_header X-Real-IP       $remote_addr;
        proxy_set_header Upgrade         $http_upgrade;
        proxy_set_header Connection      "upgrade";
    }

    location / {
        try_files $uri $uri/ =404;
    }
}
```

Dans ce cas, `PB_URL` dans main.js et admin.html sera :
`https://cafedeslettres.fr/pb`

---

## ÉTAPE 7 — SSL avec Let's Encrypt (HTTPS)

```bash
# Obtenir les certificats (remplacez par vos domaines)
sudo certbot --nginx \
  -d cafedeslettres.fr \
  -d www.cafedeslettres.fr \
  -d api.cafedeslettres.fr

# Certbot modifie automatiquement la config Nginx pour HTTPS
# Vérifier le renouvellement automatique
sudo systemctl status certbot.timer
sudo certbot renew --dry-run   # Test
```

---

## ÉTAPE 8 — Déployer les fichiers du site

```bash
# Créer le dossier du site
sudo mkdir -p /var/www/cafedeslettres
sudo chown -R www-data:www-data /var/www/cafedeslettres

# Transférer les fichiers depuis votre machine locale
# (depuis votre machine, pas le serveur)
scp -r ./votre-projet/* user@IP_SERVEUR:/var/www/cafedeslettres/

# Structure attendue sur le serveur :
# /var/www/cafedeslettres/
#   ├── index.html
#   ├── menu.html
#   ├── about.html
#   ├── contact.html
#   ├── admin.html       ← protégez cet accès (voir sécurité)
#   ├── css/
#   │   └── style.css
#   ├── js/
#   │   └── main.js
#   └── images/
#       └── *.jpg
```

---

## ÉTAPE 9 — Ajouter les attributs `data-*` dans menu.html et contact.html

C'est l'étape qui relie le HTML aux données dynamiques.
Le JavaScript de `main.js` cherche ces attributs pour remplacer le contenu.

### Dans `menu.html` — chaque prix :

```html
<!-- AVANT -->
<div class="menu-item-price">1,60 €</div>

<!-- APRÈS — ajouter data-price-key avec la clé correspondante -->
<div class="menu-item-price" data-price-key="orient-espresso">1,60 €</div>
```

#### Tableau complet des clés :

| Clé                     | Article                          | Prix HTML statique |
|-------------------------|----------------------------------|--------------------|
| orient-espresso         | Orient Espresso                  | 1,60 €             |
| noisette                | Noisette                         | 1,70 €             |
| cafe-allonge            | Café Allongé                     | 2,00 €             |
| orient-espresso-ar      | Orient Espresso A/R              | 2,80 €             |
| cappuccino              | Cappuccino de la Dolce Vita      | 3,50 €             |
| cafe-au-lait            | Café au lait                     | 3,50 €             |
| chocolat-chaud          | Chocolat chaud d'hiver           | 4,00 €             |
| eau                     | Bouteille d'eau                  | 1,20 €             |
| canette-pulco           | Canette Pulco                    | 1,50 €             |
| capri-sun               | Capri Sun                        | 2,00 €             |
| jus-fruit               | Jus de fruit                     | 3,00 €             |
| sirop                   | Sirop du Temps qui dure          | 3,00 €             |
| cafe-frappe             | Café frappé                      | 4,00 €             |
| ginger-beer             | Jus de Panacée Gingembre         | 4,00 €             |
| lassi-nature            | Lassi Nature de Shakti           | 5,00 €             |
| lassi-mangue            | Lassi Mangue de Mooglie          | 5,50 €             |
| milk-shake              | Magic Potter Shakes              | 5,50 €             |
| the-tante               | Le thé de ma Tante               | 2,50 €             |
| the-menthe              | Thé à la menthe de Shéhérazade   | 3,00 €             |
| the-detox               | Thé Detox Kusmi Tea              | 3,50 €             |
| ice-tea                 | Ice Tea de Croc Blanc            | 4,00 €             |
| chai                    | Delhi Chaï de Shankar            | 5,00 €             |
| matcha                  | Matcha Latte de Kintaro          | 5,50 €             |
| navette-thon            | Navette au thon                  | 3,10 €             |
| navette-saumon          | Navette au saumon                | 3,50 €             |
| chausson-frita          | Chausson Frita                   | 4,20 €             |
| croque-vegetarien       | Croque-rond végétarien           | 4,60 €             |
| croque-monsieur         | Croque-Monsieur à la dinde       | 4,90 €             |
| bun-bolly               | The Bun Bolly                    | 6,00 €             |
| brooklyn-bun            | Brooklyn Follies Bun             | 6,50 €             |
| fusion-bowl             | Fusion Bowls des Pokémons        | 10,00 €            |
| beignet-nature          | Mini-Beignets Nature             | 1,00 €             |
| beignet-fruits-rouges   | Mini-Beignets Fruits rouges      | 1,30 €             |
| madeleine-nature        | Madeleine de Marcel — Nature     | 1,10 €             |
| madeleine-caramel       | Madeleine de Marcel — Caramel    | 1,30 €             |
| bonbons                 | Bonbons qui durent               | 1,80 €             |
| chocolaterie            | Paquet de la chocolaterie        | 2,00 €             |
| gateau-tigre            | Gâteau Tigré au chocolat         | 2,30 €             |
| dattes                  | Dattes Medjool ×2                | 2,50 €             |
| financier               | Financier Vanille miel           | 2,80 €             |
| muffin                  | Muffin                           | 3,50 €             |
| tartelette-citron       | Tartelette Citron meringuée      | 4,00 €             |
| tartelette-chocolat     | Tartelette chocolat ganache      | 4,00 €             |
| suppl-chantilly         | Supplément Chantilly             | 0,50 €             |
| suppl-vegetal           | Lait végétal / sirop             | 1,00 €             |

### Dans `contact.html` — chaque horaire :

```html
<!-- AVANT -->
<span class="horaire-jour">Lundi</span>
<span>08h30 – 18h00</span>

<!-- APRÈS — ajouter data-hour-key sur le span des horaires (pas les jours) -->
<span class="horaire-jour">Lundi</span>
<span data-hour-key="lundi">08h30 – 18h00</span>
```

Faire de même pour : `mardi`, `mercredi`, `jeudi`, `vendredi`, `samedi`, `dimanche`.

---

## ÉTAPE 10 — Mettre à jour `PB_URL` dans les deux fichiers

Dans **main.js** (à la ligne 13) :
```js
const PB_URL = 'https://api.cafedeslettres.fr';
```

Dans **admin.html** (dans le bloc `<script>`) :
```js
const PB_URL = 'https://api.cafedeslettres.fr';
```

---

## Sécurité — admin.html

`admin.html` contient l'URL de PocketBase mais **pas de clé secrète**.
L'auth est gérée par PocketBase (email/mot de passe admin).

Recommandations :
- **Ne pas indexer admin.html** : ajouter dans Nginx `location = /admin.html { auth_basic "Accès restreint"; ... }`
  ou simplement lui donner un nom non-devinable (`gestion-cafe-private.html`).
- **Ou l'utiliser en local uniquement** : ouvrir le fichier directement
  en `file://` depuis votre machine. PocketBase reste accessible via HTTPS.
- **Ne pas le committer dans un repo public** Git (ou utiliser .gitignore).

---

## Sauvegarde des données

Toute la base de données PocketBase est dans **un seul fichier** :

```
/opt/pocketbase/pb_data/data.db
```

### Sauvegarde manuelle
```bash
sudo cp /opt/pocketbase/pb_data/data.db ~/backup_cafedeslettres_$(date +%Y%m%d).db
```

### Sauvegarde automatique quotidienne (cron)
```bash
sudo crontab -e
# Ajouter cette ligne (sauvegarde chaque jour à 3h du matin) :
0 3 * * * cp /opt/pocketbase/pb_data/data.db /opt/pocketbase/backups/data_$(date +\%Y\%m\%d).db && find /opt/pocketbase/backups/ -name "*.db" -mtime +30 -delete
```

```bash
sudo mkdir -p /opt/pocketbase/backups
sudo chown pocketbase:pocketbase /opt/pocketbase/backups
```

---

## Commandes utiles au quotidien

```bash
# Statut de PocketBase
sudo systemctl status pocketbase

# Redémarrer PocketBase (après mise à jour du binaire)
sudo systemctl restart pocketbase

# Logs en temps réel
sudo journalctl -u pocketbase -f --no-pager

# Mettre à jour PocketBase (même procédure que l'installation)
sudo systemctl stop pocketbase
sudo mv /opt/pocketbase/pocketbase /opt/pocketbase/pocketbase.bak
# ... télécharger le nouveau binaire ...
sudo systemctl start pocketbase

# Recharger Nginx après modification de config
sudo nginx -t && sudo systemctl reload nginx

# Vérifier les certificats SSL
sudo certbot certificates
```

---

## Flux complet — résumé visuel

```
                    ┌─────────────────────────────┐
                    │    Navigateur visiteur       │
                    │  menu.html, contact.html     │
                    │                              │
                    │  main.js                     │
                    │  fetch('/api/collections/    │
                    │   site_config/records')      │
                    └──────────────┬──────────────┘
                                   │ GET (public, pas de token)
                                   ▼
                    ┌─────────────────────────────┐
                    │         Nginx HTTPS          │
                    │    api.cafedeslettres.fr     │
                    └──────────────┬──────────────┘
                                   │ proxy_pass :8090
                                   ▼
                    ┌─────────────────────────────┐
                    │        PocketBase            │
                    │      127.0.0.1:8090          │
                    │                              │
                    │  collection: site_config     │
                    │  { prices: {...},            │
                    │    hours: {...} }             │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
               Lecture (public)           Écriture (admin)
                    │                             │
                    ▼                             ▼
           Tous les visiteurs          admin.html + SDK PocketBase
           voient les prix             (token admin en header)
           et horaires à jour          PATCH /api/collections/
                                        site_config/records/:id
```
