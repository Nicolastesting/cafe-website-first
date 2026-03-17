# Guide de déploiement — Café des Lettres

> Serveur : Ubuntu Server 22.04/24.04 — `/opt/cafedeslettres/`  
> La structure Docker est déjà en place. Ce guide couvre les étapes restantes
> depuis l'état actuel jusqu'à un site pleinement fonctionnel.

---

## État actuel

| Étape | État |
|---|---|
| Ubuntu Server installé | ✅ |
| Docker + Docker Compose installés | ✅ |
| Structure de dossiers créée | ✅ |
| Fichiers site copiés dans `site/` | ✅ |
| Images renommées (sans accents) | ✅ |
| Config Nginx en place | ✅ |
| Conteneurs Docker démarrés | ❓ À vérifier |
| IP hardcodée corrigée dans `main.js` | ❌ |
| IP hardcodée corrigée dans `admin.html` | ❌ |
| `admin.html` retiré du dossier public | ❌ |
| Collection `site_config` créée dans PocketBase | ❌ |
| Données initiales (prix & horaires) chargées | ❌ |
| Headers de sécurité Nginx | ❌ |

---

## Étape 1 — Vérifier l'état des conteneurs

```bash
cd /opt/cafedeslettres
docker compose ps
```

Résultat attendu :
```
NAME               IMAGE                                STATUS
cafe_pocketbase    ghcr.io/muchobien/pocketbase:latest  Up (healthy)
cafe_nginx         nginx:alpine                          Up (healthy)
```

Si les conteneurs ne sont pas démarrés :
```bash
docker compose up -d
docker compose logs -f   # Suivre les logs jusqu'à ce que les deux soient healthy
```

Si les conteneurs sont démarrés mais pas healthy :
```bash
docker compose logs pocketbase
docker compose logs nginx
```

---

## Étape 2 — Corriger l'IP hardcodée dans `main.js`

```bash
# Vérifier la valeur actuelle
grep "PB_URL" /opt/cafedeslettres/site/js/main.js

# Corriger
sed -i "s|const PB_URL = 'http://192.168.1.50';|const PB_URL = '';|" \
  /opt/cafedeslettres/site/js/main.js

# Confirmer
grep "PB_URL" /opt/cafedeslettres/site/js/main.js
# Attendu : const PB_URL = '';
```

> Avec `PB_URL = ''`, les appels deviennent `/api/collections/…` — Nginx les proxie vers PocketBase automatiquement. Aucun redémarrage nécessaire.

---

## Étape 3 — Sécuriser `admin.html`

### Option A — Bloquer dans Nginx (rapide)

Modifier `nginx/conf.d/cafedeslettres.conf` pour interdire l'accès au fichier :

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

server {
    listen 80;
    server_name _;

    root /var/www/cafedeslettres;
    index index.html;

    # Headers de sécurité
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Bloquer l'accès public à admin.html
    location = /admin.html {
        deny all;
        return 404;
    }

    location / {
        try_files $uri $uri/ =404;
    }

    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://pocketbase:8090/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /_/ {
        # Restreindre aux IP du LAN
        allow 192.168.1.0/24;
        deny all;
        proxy_pass http://pocketbase:8090/_/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Puis recharger Nginx :
```bash
docker compose exec nginx nginx -t          # Vérifier la syntaxe
docker compose exec nginx nginx -s reload   # Recharger sans coupure
```

### Option B — Déplacer `admin.html` hors de `site/` (propre)

```bash
mkdir -p /opt/cafedeslettres/admin
mv /opt/cafedeslettres/site/admin.html /opt/cafedeslettres/admin/admin.html

# Corriger aussi l'IP dans admin.html maintenant qu'il est déplacé
sed -i "s|const PB_URL = 'http://192.168.1.50';|const PB_URL = 'http://192.168.1.50';|" \
  /opt/cafedeslettres/admin/admin.html
# (garder l'IP LAN explicite ici car admin.html est ouvert en local depuis le serveur)
```

> `admin.html` sera utilisé en ouvrant directement `http://192.168.1.50` depuis le LAN, ou en SSHant sur le serveur et ouvrant `file:///opt/cafedeslettres/admin/admin.html`.

---

## Étape 4 — Configurer PocketBase

### Accéder à l'interface admin

Depuis un navigateur sur le LAN :
```
http://192.168.1.50/_/
```

Créer le compte administrateur (email + mot de passe fort). **Ce compte donne un accès complet à toute la base de données — utiliser un mot de passe robuste.**

### Créer la collection `site_config`

1. **Collections → New collection**
2. Nom : `site_config`
3. Type : **Base collection**
4. Ajouter le champ **`prices`** → type **JSON**
5. Ajouter le champ **`hours`** → type **JSON**
6. **API Rules** (onglet dédié) :
   - List rules : *(laisser vide)* → public
   - View rules : *(laisser vide)* → public
   - Create rules : `@request.auth.isAdmin = true`
   - Update rules : `@request.auth.isAdmin = true`
   - Delete rules : `@request.auth.isAdmin = true`
7. **Sauvegarder**

### Créer l'enregistrement initial

Dans la collection `site_config` → **New record**.

**Champ `prices`** (copier-coller ce JSON) :
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

**Champ `hours`** :
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

## Étape 5 — Vérifier le site complet

```bash
# Le site s'affiche
curl -I http://localhost/
# Attendu : HTTP/1.1 200 OK

# Les données PocketBase se chargent
curl -s "http://localhost/api/collections/site_config/records?perPage=1" | python3 -m json.tool
# Attendu : { "items": [ { "prices": {...}, "hours": {...} } ] }

# admin.html est bien bloqué (si option A choisie)
curl -I http://localhost/admin.html
# Attendu : HTTP/1.1 404 Not Found
```

Ouvrir `http://192.168.1.50` dans un navigateur et vérifier :
- Les prix s'affichent correctement sur `/menu.html`
- Les horaires s'affichent sur `/contact.html`
- L'image d'accueil se charge sur `/`

---

## Étape 6 — Corriger le doublon d'image poke bowl

```bash
# Vérifier quels fichiers référencent l'ancienne orthographe
grep -r "poke_bawl" /opt/cafedeslettres/site/

# Remplacer dans le CSS et les HTML
sed -i 's/poke_bawl/poke_bowl/g' /opt/cafedeslettres/site/css/style.css
sed -i 's/poke_bawl/poke_bowl/g' /opt/cafedeslettres/site/menu.html
# Adapter selon les résultats du grep

# Supprimer le doublon
rm /opt/cafedeslettres/site/images/poke_bawl.jpg
```

---

## Commandes de maintenance courantes

```bash
# État des conteneurs
docker compose ps

# Logs en temps réel
docker compose logs -f

# Logs d'un service
docker compose logs -f nginx
docker compose logs -f pocketbase

# Recharger la config Nginx sans coupure
docker compose exec nginx nginx -s reload

# Redémarrer un service
docker compose restart nginx

# Mettre à jour les images Docker
docker compose pull
docker compose up -d

# Arrêter sans supprimer les données
docker compose stop

# Arrêter et supprimer les conteneurs (pb_data reste intact)
docker compose down
```

---

## Sauvegarde des données PocketBase

```bash
# Sauvegarde manuelle
sudo cp -r /opt/cafedeslettres/pb_data /opt/cafedeslettres/pb_data.backup.$(date +%Y%m%d)

# Sauvegarde automatique quotidienne (cron, 3h du matin)
sudo crontab -e
# Ajouter :
0 3 * * * cp -r /opt/cafedeslettres/pb_data /opt/backups/pb_data.$(date +\%Y\%m\%d) 2>&1 | logger -t cafedeslettres-backup
```

Via l'interface PocketBase : `/_/ → Settings → Backups`

---

## (Optionnel) Activer HTTPS avec Certbot

> Nécessite un nom de domaine public pointant vers le serveur.

```bash
# Installer Certbot
sudo apt install -y certbot

# Mode standalone (arrêter Nginx d'abord)
docker compose stop nginx
sudo certbot certonly --standalone -d votre-domaine.fr

# Les certificats sont dans /etc/letsencrypt/live/votre-domaine.fr/
# Monter le dossier dans le conteneur Nginx et adapter cafedeslettres.conf
# pour écouter sur 443 avec ssl_certificate et ssl_certificate_key

docker compose start nginx
```

---

## Résolution des problèmes courants

| Problème | Diagnostic | Solution |
|---|---|---|
| Site inaccessible | `docker compose ps` | Vérifier que `cafe_nginx` est `Up (healthy)` |
| Prix non mis à jour sur le site | `curl http://localhost/api/collections/site_config/records?perPage=1` | PocketBase démarré ? Collection créée avec règles lecture publique ? |
| 502 Bad Gateway | `docker compose logs nginx` | PocketBase pas encore healthy — attendre 10-30 s ou vérifier `docker compose logs pocketbase` |
| `admin.html` refuse la connexion | Vérifier l'URL dans `admin.html` et que PocketBase est accessible | Tester `curl http://localhost/_/api/health` |
| Image manquante | `ls site/images/` | Vérifier les noms de fichiers et les références dans CSS/HTML |
