# Guide complet — PocketBase + Docker + Ubuntu Server
## Café des Lettres — Déploiement auto-hébergé

---

## Architecture Docker

```
Internet (80/443)
       │
       ▼
┌──────────────────────────────────────────────┐
│               Ubuntu Server                  │
│                                              │
│  ┌─────────────────────────────────────────┐ │
│  │           Docker Compose                │ │
│  │                                         │ │
│  │  ┌──────────────┐   réseau cafe_net     │ │
│  │  │    Nginx     │◄──────────────────►   │ │
│  │  │  (port 80/443│   ┌─────────────────┐ │ │
│  │  │   exposés)   │──►│  PocketBase     │ │ │
│  │  └──────────────┘   │  :8090 (interne)│ │ │
│  │        │            └────────┬────────┘ │ │
│  │        │                    │           │ │
│  │   /var/www/          ./pb_data/         │ │
│  │  cafedeslettres       data.db           │ │
│  │   (site statique)   (volume hôte)       │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

**Principe clé** : PocketBase n'est jamais exposé directement sur l'hôte.
Seul Nginx est accessible depuis internet. PocketBase vit dans le réseau
Docker interne `cafe_net`. Nginx fait le proxy `/api/` → `pocketbase:8090`.

---

## Structure des fichiers sur le serveur

```
/opt/cafedeslettres/              ← dossier racine du projet
├── docker-compose.yml
├── nginx/
│   └── conf.d/
│       └── cafedeslettres.conf
├── site/                         ← vos fichiers HTML/CSS/JS/images
│   ├── index.html
│   ├── menu.html
│   ├── about.html
│   ├── contact.html
│   ├── admin.html
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── main.js
│   └── images/
│       └── *.jpg
├── pb_data/                      ← données PocketBase (créé auto au 1er run)
│   └── data.db                   ← TOUTE la base de données (1 fichier)
└── logs/
    └── nginx/
```

---

## ÉTAPE 1 — Préparer Ubuntu Server

```bash
# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installer Docker (méthode officielle)
curl -fsSL https://get.docker.com | sudo bash

# Ajouter votre utilisateur au groupe docker (évite sudo à chaque commande)
sudo usermod -aG docker $USER

# Appliquer le changement de groupe SANS se déconnecter
newgrp docker

# Vérifier l'installation
docker --version
docker compose version

# Installer Certbot sur l'hôte (pour les certificats SSL)
sudo apt install -y certbot ufw

# Pare-feu
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

> ⚠️ **Ne pas exposer le port 8090 dans UFW.** PocketBase est interne à Docker.

---

## ÉTAPE 2 — Créer la structure du projet

```bash
# Créer le dossier racine
sudo mkdir -p /opt/cafedeslettres
sudo chown $USER:$USER /opt/cafedeslettres
cd /opt/cafedeslettres

# Créer l'arborescence
mkdir -p nginx/conf.d site/css site/js site/images logs/nginx pb_data

# Vérifier
tree -L 3 .
```

---

## ÉTAPE 3 — Déposer les fichiers de configuration

Transférer les fichiers depuis votre machine locale :

```bash
# Depuis votre machine locale (pas le serveur)

# Les fichiers de config Docker
scp docker-compose.yml            user@IP_SERVEUR:/opt/cafedeslettres/
scp nginx/conf.d/cafedeslettres.conf  user@IP_SERVEUR:/opt/cafedeslettres/nginx/conf.d/

# Les fichiers du site
scp -r ./votre-projet/*  user@IP_SERVEUR:/opt/cafedeslettres/site/
```

---

## ÉTAPE 4 — Obtenir les certificats SSL AVANT de lancer Docker

Certbot doit tourner sur l'hôte Ubuntu pour valider votre domaine.
Docker n'est pas encore lancé à cette étape.

```bash
# Certbot standalone (utilise temporairement le port 80)
sudo certbot certonly --standalone \
  -d cafedeslettres.fr \
  -d www.cafedeslettres.fr \
  --email votre@email.fr \
  --agree-tos \
  --non-interactive

# Vérifier que les certificats existent
sudo ls /etc/letsencrypt/live/cafedeslettres.fr/
# fullchain.pem  privkey.pem  chain.pem  cert.pem
```

> 💡 Le volume `/etc/letsencrypt:/etc/letsencrypt:ro` dans docker-compose.yml
> monte ces certificats dans le container Nginx en lecture seule.

### Renouvellement automatique via cron

```bash
sudo crontab -e
# Ajouter (renouvellement le 1er de chaque mois à 3h00) :
0 3 1 * * certbot renew --quiet --pre-hook "docker compose -f /opt/cafedeslettres/docker-compose.yml stop nginx" --post-hook "docker compose -f /opt/cafedeslettres/docker-compose.yml start nginx"
```

---

## ÉTAPE 5 — Premier démarrage des containers

```bash
cd /opt/cafedeslettres

# Télécharger les images et démarrer en arrière-plan
docker compose up -d

# Vérifier que les deux containers tournent
docker compose ps

# Attendu :
# NAME              STATUS          PORTS
# cafe_nginx        Up (healthy)    0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
# cafe_pocketbase   Up (healthy)

# Logs en temps réel
docker compose logs -f

# Logs d'un service spécifique
docker compose logs -f pocketbase
docker compose logs -f nginx
```

---

## ÉTAPE 6 — Créer le compte administrateur PocketBase

L'interface admin est accessible sur `https://cafedeslettres.fr/_/`.

La **première visite** vous demande de créer un compte admin.
Faites-le **immédiatement** après le premier démarrage.

1. Ouvrir `https://cafedeslettres.fr/_/` dans votre navigateur
2. Remplir email + mot de passe fort
3. Valider → vous êtes connecté à l'interface admin PocketBase

> ⚠️ Si vous ne créez pas le compte admin immédiatement après le premier
> démarrage, n'importe qui visitant `/_/` pourrait le créer.
> Faites-le dans les 5 minutes suivant le lancement.

---

## ÉTAPE 7 — Créer la collection `site_config`

Dans l'interface admin (`/_/`) :

### Créer la collection

1. Cliquer **"New collection"**
2. Nom : `site_config` | Type : **Base collection**
3. Ajouter les champs :
   - **"New field"** → type **JSON** → nom : `prices`
   - **"New field"** → type **JSON** → nom : `hours`
4. Onglet **"API Rules"** — configurer :
   ```
   List/View  : laisser vide  (lecture publique — visiteurs du site)
   Create     : @request.auth.id != ""  (écriture admin seulement)
   Update     : @request.auth.id != ""
   Delete     : laisser vide  (personne)
   ```
5. Cliquer **"Create"**

### Créer le premier enregistrement

Dans la collection `site_config` → **"New record"** :

**Champ `prices`** (JSON) — coller :
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

**Champ `hours`** (JSON) — coller :
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

## ÉTAPE 8 — Configurer `PB_URL` dans vos fichiers

Dans **`site/js/main.js`** :
```js
const PB_URL = 'https://cafedeslettres.fr';
```

Dans **`site/admin.html`** :
```js
const PB_URL = 'https://cafedeslettres.fr';
```

> 💡 Avec cette config Nginx, PocketBase est proxifié sur `/api/` du domaine
> principal. Pas besoin d'un sous-domaine séparé.
> `main.js` fait fetch vers `https://cafedeslettres.fr/api/collections/...`
> Nginx intercepte `/api/` et proxifie vers `pocketbase:8090`.

Redéployer les fichiers du site après modification :
```bash
# Depuis votre machine locale
scp site/js/main.js   user@IP:/opt/cafedeslettres/site/js/
scp site/admin.html   user@IP:/opt/cafedeslettres/site/
# Pas besoin de redémarrer Docker — Nginx sert les fichiers directement
```

---

## ÉTAPE 9 — Ajouter les attributs `data-*` dans le HTML

### Dans `menu.html` — chaque prix :

```html
<!-- AVANT -->
<div class="menu-item-price">1,60 €</div>

<!-- APRÈS -->
<div class="menu-item-price" data-price-key="orient-espresso">1,60 €</div>
```

| Clé                     | Article                          |
|-------------------------|----------------------------------|
| orient-espresso         | Orient Espresso                  |
| noisette                | Noisette                         |
| cafe-allonge            | Café Allongé                     |
| orient-espresso-ar      | Orient Espresso A/R              |
| cappuccino              | Cappuccino de la Dolce Vita      |
| cafe-au-lait            | Café au lait                     |
| chocolat-chaud          | Chocolat chaud d'hiver           |
| eau                     | Bouteille d'eau                  |
| canette-pulco           | Canette Pulco                    |
| capri-sun               | Capri Sun                        |
| jus-fruit               | Jus de fruit                     |
| sirop                   | Sirop du Temps qui dure          |
| cafe-frappe             | Café frappé                      |
| ginger-beer             | Jus de Panacée Gingembre         |
| lassi-nature            | Lassi Nature de Shakti           |
| lassi-mangue            | Lassi Mangue de Mooglie          |
| milk-shake              | Magic Potter Shakes              |
| the-tante               | Le thé de ma Tante               |
| the-menthe              | Thé à la menthe de Shéhérazade   |
| the-detox               | Thé Detox Kusmi Tea              |
| ice-tea                 | Ice Tea de Croc Blanc            |
| chai                    | Delhi Chaï de Shankar            |
| matcha                  | Matcha Latte de Kintaro          |
| navette-thon            | Navette au thon                  |
| navette-saumon          | Navette au saumon                |
| chausson-frita          | Chausson Frita                   |
| croque-vegetarien       | Croque-rond végétarien           |
| croque-monsieur         | Croque-Monsieur à la dinde       |
| bun-bolly               | The Bun Bolly                    |
| brooklyn-bun            | Brooklyn Follies Bun             |
| fusion-bowl             | Fusion Bowls des Pokémons        |
| beignet-nature          | Mini-Beignets Nature             |
| beignet-fruits-rouges   | Mini-Beignets Fruits rouges      |
| madeleine-nature        | Madeleine de Marcel — Nature     |
| madeleine-caramel       | Madeleine de Marcel — Caramel    |
| bonbons                 | Bonbons qui durent               |
| chocolaterie            | Paquet de la chocolaterie        |
| gateau-tigre            | Gâteau Tigré au chocolat         |
| dattes                  | Dattes Medjool ×2                |
| financier               | Financier Vanille miel           |
| muffin                  | Muffin                           |
| tartelette-citron       | Tartelette Citron meringuée      |
| tartelette-chocolat     | Tartelette chocolat ganache      |
| suppl-chantilly         | Supplément Chantilly             |
| suppl-vegetal           | Lait végétal / sirop             |

### Dans `contact.html` — horaires :

```html
<!-- AVANT -->
<span class="horaire-jour">Lundi</span>
<span>08h30 – 18h00</span>

<!-- APRÈS -->
<span class="horaire-jour">Lundi</span>
<span data-hour-key="lundi">08h30 – 18h00</span>
```

Répéter pour : `mardi`, `mercredi`, `jeudi`, `vendredi`, `samedi`, `dimanche`.

---

## Commandes Docker au quotidien

```bash
cd /opt/cafedeslettres

# ── Gestion des containers ──────────────────────────────
docker compose ps                    # État des services
docker compose up -d                 # Démarrer (ou redémarrer après modif config)
docker compose down                  # Arrêter et supprimer les containers
docker compose restart nginx         # Redémarrer uniquement Nginx
docker compose restart pocketbase    # Redémarrer uniquement PocketBase

# ── Logs ────────────────────────────────────────────────
docker compose logs -f               # Tous les logs en direct
docker compose logs -f pocketbase    # Logs PocketBase seulement
docker compose logs -f nginx         # Logs Nginx seulement
docker compose logs --tail=50 nginx  # 50 dernières lignes Nginx

# ── Mise à jour PocketBase ──────────────────────────────
# 1. Sauvegarder d'abord (voir ci-dessous)
# 2. Télécharger la nouvelle image
docker compose pull pocketbase
# 3. Relancer avec la nouvelle image (zero-downtime si healthcheck ok)
docker compose up -d pocketbase
# 4. Vérifier
docker compose logs -f pocketbase

# ── Debug ────────────────────────────────────────────────
# Ouvrir un shell dans un container
docker compose exec pocketbase sh
docker compose exec nginx sh

# Vérifier que PocketBase répond (depuis l'intérieur de Nginx)
docker compose exec nginx wget -qO- http://pocketbase:8090/api/health

# Inspecter le réseau Docker
docker network inspect cafedeslettres_cafe_net
```

---

## Sauvegarde des données

Toute la base PocketBase tient en **un seul fichier** sur l'hôte :

```
/opt/cafedeslettres/pb_data/data.db
```

Le container peut être détruit, recréé, mis à jour — ce fichier persiste.

### Sauvegarde manuelle

```bash
cp /opt/cafedeslettres/pb_data/data.db \
   ~/backups/data_$(date +%Y%m%d_%H%M).db
```

### Sauvegarde automatique quotidienne

```bash
mkdir -p ~/backups/cafedeslettres

crontab -e
# Ajouter (chaque jour à 3h00, garde 30 jours) :
0 3 * * * cp /opt/cafedeslettres/pb_data/data.db ~/backups/cafedeslettres/data_$(date +\%Y\%m\%d).db && find ~/backups/cafedeslettres/ -name "*.db" -mtime +30 -delete
```

### Restaurer une sauvegarde

```bash
# Arrêter PocketBase le temps de la restauration
docker compose stop pocketbase

# Restaurer
cp ~/backups/cafedeslettres/data_20250310.db \
   /opt/cafedeslettres/pb_data/data.db

# Redémarrer
docker compose start pocketbase
docker compose logs -f pocketbase
```

---

## Déployer une mise à jour du site

Les fichiers dans `./site/` sont montés en lecture seule dans Nginx.
Il suffit de les remplacer — **pas besoin de redémarrer Docker**.

```bash
# Depuis votre machine locale — synchronisation complète
rsync -avz --delete \
  ./votre-projet/ \
  user@IP_SERVEUR:/opt/cafedeslettres/site/

# Ou fichier par fichier
scp menu.html user@IP:/opt/cafedeslettres/site/
```

---

## Dépannage fréquent

### Le site ne répond pas
```bash
docker compose ps          # Vérifier que les containers sont "Up (healthy)"
docker compose logs nginx  # Chercher une erreur de config
sudo ufw status            # Vérifier que 80 et 443 sont autorisés
```

### PocketBase inaccessible depuis Nginx
```bash
# Tester la connectivité interne
docker compose exec nginx wget -qO- http://pocketbase:8090/api/health
# Si ça échoue : PocketBase n'est pas dans le même réseau Docker
docker network inspect cafedeslettres_cafe_net
```

### Erreur SSL "certificat introuvable"
```bash
# Vérifier que Certbot a bien généré les fichiers
sudo ls -la /etc/letsencrypt/live/cafedeslettres.fr/
# Si le dossier n'existe pas, relancer Certbot (étape 4)
```

### Modifier la config Nginx
```bash
nano /opt/cafedeslettres/nginx/conf.d/cafedeslettres.conf
# Tester la syntaxe depuis le container
docker compose exec nginx nginx -t
# Recharger sans coupure
docker compose exec nginx nginx -s reload
```

### Voir les données PocketBase directement
```bash
# SQLite est embarqué dans le container PocketBase
docker compose exec pocketbase sh
# Dans le shell du container :
sqlite3 /pb/pb_data/data.db
sqlite> .tables
sqlite> SELECT json_extract(prices, '$.orient-espresso') FROM site_config;
sqlite> .quit
```
