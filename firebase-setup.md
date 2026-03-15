# Guide d'intégration Firebase — Café des Lettres

## Pourquoi Firebase ?

| Critère | Firebase (choix) | Supabase | JSONBin |
|---|---|---|---|
| Serveur à gérer | ❌ Non | ❌ Non | ❌ Non |
| Auth intégrée | ✅ Oui | ✅ Oui | ❌ Non |
| REST API publique | ✅ Oui | ✅ Oui | ✅ Oui |
| Tier gratuit | 1 GB / 10 GB transfer | 500 MB | 10k req/mois |
| Maturité | ✅ Google | ✅ Bonne | Limitée |

→ **Firebase Realtime Database** est le bon choix : pas de serveur, auth email/password native, appel REST sans SDK côté public.

---

## Étape 1 — Créer le projet Firebase

1. Aller sur https://console.firebase.google.com
2. "Créer un projet" → nom : `cafe-des-lettres`
3. Désactiver Google Analytics (pas utile ici)
4. Dans le menu latéral → **Build → Realtime Database**
5. "Créer une base de données" → choisir région **europe-west1** (Frankfurt)
6. Démarrer en mode **test** (on sécurisera ensuite)

---

## Étape 2 — Configurer les règles de sécurité

Dans Firebase Console → Realtime Database → **Règles**, coller :

```json
{
  "rules": {
    "config": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

→ **Lecture publique** (le site peut fetcher les prix/horaires sans auth)
→ **Écriture** uniquement pour un utilisateur connecté (l'admin)

---

## Étape 3 — Créer le compte administrateur

1. Firebase Console → **Build → Authentication**
2. "Commencer" → onglet **Sign-in method** → activer **Email/Password**
3. Onglet **Users** → "Ajouter un utilisateur"
4. Email : `admin@cafedeslettres.fr` (ou votre choix)
5. Mot de passe : choisir un mot de passe fort
6. **⚠️ Ne créez qu'un seul compte.** Personne d'autre ne doit pouvoir s'inscrire.

---

## Étape 4 — Récupérer la configuration Firebase

1. Firebase Console → ⚙️ Paramètres → **Vos applications**
2. "Ajouter une application Web" (icône `</>`)
3. Copier l'objet `firebaseConfig` affiché

Dans **admin.html**, remplacer le bloc :
```js
const firebaseConfig = {
  apiKey:            "VOTRE_API_KEY",
  authDomain:        "VOTRE_PROJECT_ID.firebaseapp.com",
  databaseURL:       "https://VOTRE_PROJECT_ID-default-rtdb.europe-west1.firebasedatabase.app",
  // ...
};
```
par les vraies valeurs.

---

## Étape 5 — Configurer main.js

Dans **main.js**, remplacer :
```js
const FIREBASE_DB_URL = 'VOTRE_FIREBASE_DATABASE_URL';
```
par votre URL de base de données (visible dans Firebase Console → Realtime Database) :
```js
const FIREBASE_DB_URL = 'https://cafe-des-lettres-default-rtdb.europe-west1.firebasedatabase.app';
```

---

## Étape 6 — Ajouter les attributs data dans menu.html

Pour que le JavaScript puisse cibler et mettre à jour les prix, ajoutez
l'attribut `data-price-key` à chaque `.menu-item-price` dans menu.html.

### Exemple (avant → après) :
```html
<!-- AVANT -->
<div class="menu-item-price">1,60 €</div>

<!-- APRÈS -->
<div class="menu-item-price" data-price-key="orient-espresso">1,60 €</div>
```

### Correspondance complète des clés :

#### Café & Boissons chaudes
```
orient-espresso    → Orient Espresso (1,60 €)
noisette           → Noisette (1,70 €)
cafe-allonge       → Café Allongé (2,00 €)
orient-espresso-ar → Orient Espresso A/R (2,80 €)
cappuccino         → Cappuccino de la Dolce Vita (3,50 €)
cafe-au-lait       → Café au lait (3,50 €)
chocolat-chaud     → Chocolat chaud d'hiver (4,00 €)
```

#### Boissons fraîches
```
eau          → Bouteille d'eau (1,20 €)
canette-pulco → Canette Pulco (1,50 €)
capri-sun    → Capri Sun (2,00 €)
jus-fruit    → Jus de fruit (3,00 €)
sirop        → Sirop du Temps qui dure (3,00 €)
cafe-frappe  → Café frappé (4,00 €)
ginger-beer  → Jus de Panacée Gingembre (4,00 €)
lassi-nature → Lassi Nature de Shakti (5,00 €)
lassi-mangue → Lassi Mangue de Mooglie (5,50 €)
milk-shake   → Magic Potter Shakes (5,50 €)
```

#### Thés & Infusions
```
the-tante  → Le thé de ma Tante (2,50 €)
the-menthe → Thé à la menthe de Shéhérazade (3,00 €)
the-detox  → Thé Detox Kusmi Tea (3,50 €)
ice-tea    → Ice Tea de Croc Blanc (4,00 €)
chai       → Delhi Chaï de Shankar (5,00 €)
matcha     → Matcha Latte de Kintaro (5,50 €)
```

#### Salé
```
navette-thon      → Navette au thon (3,10 €)
navette-saumon    → Navette au saumon (3,50 €)
chausson-frita    → Chausson Frita (4,20 €)
croque-vegetarien → Croque-rond végétarien (4,60 €)
croque-monsieur   → Croque-Monsieur à la dinde (4,90 €)
bun-bolly         → The Bun Bolly (6,00 €)
brooklyn-bun      → Brooklyn Follies Bun (6,50 €)
fusion-bowl       → Fusion Bowls des Pokémons (10,00 €)
```

#### Gourmandises
```
beignet-nature        → Mini-Beignets Minions Nature (1,00 €)
beignet-fruits-rouges → Mini-Beignets Minions Fruits rouges (1,30 €)
madeleine-nature      → Madeleine de Marcel Nature (1,10 €)
madeleine-caramel     → Madeleine de Marcel Caramel (1,30 €)
bonbons               → Bonbons qui durent (1,80 €)
chocolaterie          → Paquet de la chocolaterie (2,00 €)
gateau-tigre          → Gâteau Tigré au chocolat (2,30 €)
dattes                → Dattes Medjool ×2 (2,50 €)
financier             → Financier Vanille miel (2,80 €)
muffin                → Muffin (3,50 €)
tartelette-citron     → Tartelette Citron meringuée (4,00 €)
tartelette-chocolat   → Tartelette chocolat ganache (4,00 €)
suppl-chantilly       → Supplément Chantilly (0,50 €)
suppl-vegetal         → Lait végétal / sirop (1,00 €)
```

---

## Étape 7 — Ajouter les attributs data dans contact.html

Dans la section `.horaires-grid` de contact.html, ajoutez `data-hour-key`
sur les `<span>` contenant les horaires (pas les jours) :

```html
<!-- AVANT -->
<span class="horaire-jour">Lundi</span>
<span>08h30 – 18h00</span>

<!-- APRÈS -->
<span class="horaire-jour">Lundi</span>
<span data-hour-key="lundi">08h30 – 18h00</span>
```

Faire de même pour : mardi, mercredi, jeudi, vendredi, samedi, dimanche.

---

## Étape 8 — Premier lancement

1. Ouvrir `admin.html` dans votre navigateur
2. Se connecter avec l'email/mot de passe créé à l'étape 3
3. Les prix et horaires actuels s'affichent (valeurs par défaut)
4. Modifier un prix → cliquer "Enregistrer les modifications"
5. Recharger menu.html → le nouveau prix s'affiche ✅

---

## Structure des données dans Firebase

```
config/
  prices/
    orient-espresso: "1,60 €"
    noisette: "1,70 €"
    ...
  hours/
    lundi: "08h30 – 18h00"
    ...
```

---

## Sécurité — rappels importants

- **Ne pas commiter** admin.html avec les vraies clés Firebase dans un repo public Git.
  Utilisez un `.gitignore` ou des variables d'environnement.
- La clé `apiKey` Firebase est publique par conception (pas un secret),
  mais les **règles de sécurité** (étape 2) protègent l'écriture.
- Pour plus de sécurité, vous pouvez restreindre l'accès à admin.html
  par referer ou via une URL secrète (sécurité par obscurité simple).
- Évitez de partager l'URL de admin.html publiquement.
