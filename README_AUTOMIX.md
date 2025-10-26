# 🎵 Auto-Mix DJ - Documentation Complète

## Vue d'ensemble

Le système Auto-Mix DJ transforme n'importe quelle playlist en un véritable DJ set professionnel avec des transitions automatiques, fluides et musicalement cohérentes. Ce système est **entièrement gratuit, sans publicité et accessible à tous les utilisateurs**.

## 🎯 Objectifs

- **Lecture continue immersive** : Aucune pause entre les morceaux
- **Transitions intelligentes** : Synchronisation BPM, matching harmonique, alignement sur les temps
- **Naturel et professionnel** : Comme si un DJ humain mixait la playlist
- **Gratuit et accessible** : Aucune limite, aucun paywall

## 🎚️ Modes de Mix

### 1. 🎚️ Fluide (Défaut)
**Idéal pour** : Chill, Pop, Acoustique

**Caractéristiques** :
- Transitions douces de 8 secondes
- Crossfade progressif et subtil
- EQ sweep doux (hautes fréquences)
- Filtres low-pass légers
- Tempo matching conservateur (±4%)

**Usage** : Parfait pour une ambiance détendue où les transitions doivent être presque imperceptibles.

---

### 2. 💥 Club
**Idéal pour** : Electro, House, Techno, Dance

**Caractéristiques** :
- Transitions rapides de 4 secondes
- Sync BPM précis
- EQ sweep dynamique (basses montantes)
- Filtres agressifs
- Effets echo-out sur les outros
- Tempo matching standard (±6%)

**Usage** : Pour une ambiance club/dancefloor avec des transitions rythmiques marquées.

---

### 3. 🎶 Radio
**Idéal pour** : Mix générique, Découverte, Variété

**Caractéristiques** :
- Transitions naturelles de 6 secondes
- Pas d'effets artificiels
- Crossfade simple et propre
- Tempo matching minimal (±2%)
- Volume normalisé

**Usage** : Enchaînement simple et naturel, comme sur une vraie station de radio.

---

### 4. ⚡ Énergie
**Idéal pour** : Fêtes, Workout, Motivation

**Caractéristiques** :
- Transitions ultra-rapides de 2 secondes
- Coupes franches possibles
- BPM sync dynamique
- Tempo matching agressif (±8%)
- Maintien de l'énergie élevée

**Usage** : Pour garder l'énergie haute avec des transitions dynamiques et percutantes.

## 🔧 Fonctionnalités Techniques

### Analyse Audio Automatique

Le système analyse automatiquement chaque morceau pour extraire :

1. **Tempo (BPM)** : Détection via analyse de peaks et FFT
2. **Tonalité (Clé)** : Analyse harmonique avec notation Camelot Wheel
3. **Structure** :
   - Intro (premiers 20%)
   - Outro (derniers 20%)
   - Drops (hausses soudaines d'énergie)
   - Breaks (chutes d'énergie)
4. **Énergie** : Niveau RMS moyen (0-1)
5. **Beatgrid** : Timestamps précis de chaque beat

### Transitions Intelligentes

#### 1. **Sélection du Point de Transition**
- **Mix-out** : Privilégie l'outro ou un break proche de la fin
- **Mix-in** : Privilégie l'intro ou un point avec basse énergie

#### 2. **Score de Compatibilité** (0-100%)
Calculé selon :
- **BPM** (40%) : Différence de tempo < 6% = bon score
- **Clé** (30%) : Compatibilité harmonique (Camelot Wheel)
- **Énergie** (30%) : Transition douce vs brutale

#### 3. **Tempo Matching**
- Time-stretch automatique (sans changement de pitch)
- Plage sûre : ±6% (ajustable selon le mode)
- Maximum : ±10%

#### 4. **Effets de Transition**

**Crossfade** :
- Volume progressif sur la durée configurée
- Courbe exponentielle pour naturel

**EQ Sweep** :
- Coupe progressive des hautes fréquences (track sortant)
- Montée progressive des basses (track entrant)

**Filtre Low-pass** :
- Sweep de 20 kHz à 200 Hz
- Transition douce des fréquences

**Echo Out** (mode Club) :
- Ajout d'un echo sur la fin de la track sortante
- Effet spatial professionnel

### Normalisation du Volume

- **Cible** : -14 LUFS (Loudness Units relative to Full Scale)
- **Méthode** : Gain automatique via Web Audio API
- **Résultat** : Volume perçu constant entre tous les morceaux

## 💻 Architecture Technique

### Fichiers Principaux

```
src/
├── utils/
│   └── audioAnalysis.ts          # Analyse BPM, clé, structure
├── hooks/
│   └── useAutoMix.ts              # Hook principal Auto-Mix
├── components/
│   ├── AutoMixSettings.tsx        # Interface de configuration
│   ├── AutoMixVisualizer.tsx      # Visualisation waveforms
│   └── AutoMixInfo.tsx            # Information utilisateur
└── pages/
    └── PlaylistDetail.tsx         # Intégration dans playlist
```

### Technologies Utilisées

- **Web Audio API** : Traitement audio en temps réel
- **AnalyserNode** : Détection de beats et analyse spectrale
- **GainNode** : Normalisation du volume
- **BiquadFilterNode** : Filtres EQ et low-pass
- **Canvas API** : Visualisation des waveforms

## 🎮 Guide d'Utilisation

### Pour l'Utilisateur

1. **Ouvrir une playlist** avec au moins 2 chansons
2. **Cliquer sur "Auto-Mix DJ"** dans les contrôles
3. **Activer le système** avec le switch
4. **Choisir un mode de mix** selon l'ambiance souhaitée
5. **Cliquer sur "Analyser la Playlist"**
6. **Lancer la lecture** - Le système gère automatiquement les transitions

### Personnalisation Avancée

Dans les paramètres Auto-Mix :
- **Durée de transition** : 2-12 secondes
- **Max tempo stretch** : 0-10%
- **Target loudness** : -8 à -20 LUFS
- **Effets** : EQ sweep, filtres, echo (on/off)

## 📊 Performance

- **Temps d'analyse** : ~2-3 secondes par morceau
- **Cache intelligent** : Les analyses sont mises en cache
- **Préchargement** : Le prochain morceau est préchargé pendant la lecture
- **Latence** : Aucune interruption entre les morceaux (gapless)

## 🆓 Modèle Économique

### Totalement Gratuit

- ✅ Aucun compte premium requis
- ✅ Pas de limite d'utilisation
- ✅ Aucune publicité
- ✅ Toutes les fonctionnalités accessibles

### Pourquoi c'est gratuit ?

Le système utilise uniquement des technologies web natives (Web Audio API) qui s'exécutent **côté client** dans le navigateur de l'utilisateur. Aucun serveur externe, aucun coût d'API, aucune infrastructure cloud.

## 🔮 Futures Améliorations

- [ ] AI-powered transition suggestions
- [ ] Analyse de danceability via ML
- [ ] Détection automatique de genre
- [ ] Visualisation 3D des transitions
- [ ] Export du mix en fichier audio
- [ ] Partage de mixes avec la communauté
- [ ] Playlists auto-générées par mood

## 🎓 Références Techniques

### Camelot Wheel (Harmonic Mixing)
- Système de notation des clés musicales pour transitions harmoniques
- Transitions compatibles : clés adjacentes ou relatives
- Exemple : 8A (Am) → 8B (C), 9A (Em), ou 7A (Dm)

### BPM Matching
- Détection via autocorrélation et peak picking
- Plage typique : 60-200 BPM
- Doublement/division automatique pour genres edge

### LUFS (Loudness Units relative to Full Scale)
- Standard professionnel de mesure du volume perçu
- -14 LUFS = standard streaming (Spotify, Apple Music)
- Plus précis que la simple mesure RMS

## 🐛 Troubleshooting

### L'analyse échoue
- Vérifier que les fichiers audio sont accessibles
- Certains formats peuvent nécessiter un décodage spécial

### Transitions pas synchronisées
- Vérifier que l'analyse BPM a correctement détecté le tempo
- Augmenter la durée de transition

### Volume inconsistant
- Ajuster le target LUFS dans les paramètres
- Certains morceaux très compressés peuvent nécessiter un ajustement manuel

## 📝 Notes de Développement

### Cache Management
- Les analyses sont stockées en mémoire (Map)
- Pas de persistence (localStorage trop lourd)
- Clear automatique au changement de playlist

### Browser Compatibility
- Chrome/Edge : ✅ Complet
- Firefox : ✅ Complet
- Safari : ⚠️ Web Audio API limitée
- Mobile : ✅ Fonctionnel mais moins précis

---

**Version** : 1.0.0  
**Date** : Janvier 2025  
**Auteur** : Music Streaming Platform Team  
**License** : MIT
