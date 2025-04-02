class LotteryPredictor {
  constructor(historicalData) {
    this.historicalData = historicalData; // format: [[n1, n2, n3...], [n1, n2, n3...], ...]
    this.maxNumber = this.findMaxNumber();
    this.statistics = this.initializeStatistics();
    this.analyze();
  }

  // Le reste de la classe LotteryPredictor reste inchangé...
  findMaxNumber() {
    // Trouver le numéro maximum dans l'historique pour déterminer la plage
    let max = 0;
    for (const draw of this.historicalData) {
      for (const number of draw) {
        if (number > max) {
          max = number;
        }
      }
    }
    return max;
  }

  initializeStatistics() {
    // Initialiser les statistiques pour chaque numéro
    const stats = {};
    for (let i = 1; i <= this.maxNumber; i++) {
      stats[i] = {
        occurrences: 0,
        lastAppearance: null,
        afterDrawFrequency: {}, // Fréquence d'apparition après d'autres numéros
        drawPositions: [0, 0, 0, 0, 0], // Positions dans le tirage (pour 5 numéros)
      };
    }
    return stats;
  }

  analyze() {
    // Analyser toutes les données historiques
    const totalDraws = this.historicalData.length;

    // Calculer les occurrences et les dernières apparitions
    for (let drawIndex = 0; drawIndex < totalDraws; drawIndex++) {
      const draw = this.historicalData[drawIndex];

      // Mettre à jour les statistiques pour chaque numéro dans ce tirage
      for (let positionIndex = 0; positionIndex < draw.length; positionIndex++) {
        const number = draw[positionIndex];
        
        // Incrémenter le nombre d'occurrences
        this.statistics[number].occurrences++;
        
        // Enregistrer la dernière apparition
        this.statistics[number].lastAppearance = drawIndex;
        
        // Incrémenter la position dans le tirage
        if (positionIndex < 5) {
          this.statistics[number].drawPositions[positionIndex]++;
        }
        
        // Mettre à jour la fréquence d'apparition après d'autres numéros
        if (drawIndex > 0) {
          const previousDraw = this.historicalData[drawIndex - 1];
          for (const prevNumber of previousDraw) {
            if (!this.statistics[prevNumber].afterDrawFrequency[number]) {
              this.statistics[prevNumber].afterDrawFrequency[number] = 0;
            }
            this.statistics[prevNumber].afterDrawFrequency[number]++;
          }
        }
      }
    }
  }

  calculateOverdueScore(number) {
    // Calculer un score pour les numéros qui n'ont pas été tirés depuis longtemps
    const totalDraws = this.historicalData.length;
    
    if (this.statistics[number].lastAppearance === null) {
      // Si le numéro n'est jamais apparu, lui donner un score élevé
      return 100;
    }
    
    const drawsSinceLastAppearance = totalDraws - this.statistics[number].lastAppearance - 1;
    const expectedFrequency = totalDraws / this.maxNumber;
    
    // Plus le nombre de tirages depuis la dernière apparition est élevé par rapport 
    // à la fréquence attendue, plus le score est élevé
    return (drawsSinceLastAppearance / expectedFrequency) * 100;
  }

  calculateAffinityScore(number, lastDraw) {
    // Calculer un score d'affinité basé sur la fréquence d'apparition après les numéros du dernier tirage
    if (!lastDraw || lastDraw.length === 0) {
      return 50; // Score neutre si pas de tirage précédent
    }
    
    let affinityScore = 0;
    let totalAffinities = 0;
    
    for (const prevNumber of lastDraw) {
      const afterFrequency = this.statistics[prevNumber].afterDrawFrequency[number];
      if (afterFrequency) {
        // Normaliser la fréquence par rapport au nombre total de tirages
        const normalizedFrequency = afterFrequency / this.historicalData.length * 100;
        affinityScore += normalizedFrequency;
        totalAffinities++;
      }
    }
    
    // Retourner la moyenne ou un score neutre s'il n'y a pas d'affinités
    return totalAffinities > 0 ? affinityScore / totalAffinities : 50;
  }

  calculateFrequencyScore(number) {
    // Calculer un score basé sur la fréquence d'apparition globale
    const frequency = this.statistics[number].occurrences / this.historicalData.length * 100;
    
    // La fréquence idéale serait 100/maxNumber
    const idealFrequency = 100 / this.maxNumber;
    
    // Donner un score élevé aux numéros qui sont proches de leur fréquence idéale
    // (hypothèse que les numéros tendent vers leur fréquence idéale à long terme)
    return 100 - Math.abs(frequency - idealFrequency) * 3;
  }

  calculatePositionalScore(number) {
    // Calculer un score basé sur les positions préférées d'un numéro
    const totalAppearances = this.statistics[number].occurrences;
    if (totalAppearances === 0) return 50;
    
    // Trouver la position la plus fréquente pour ce numéro
    const maxPositionCount = Math.max(...this.statistics[number].drawPositions);
    const preferredPosition = this.statistics[number].drawPositions.indexOf(maxPositionCount);
    
    // Calculer le pourcentage d'apparitions dans la position préférée
    const positionPreference = maxPositionCount / totalAppearances * 100;
    
    // Si le numéro apparaît souvent dans une position spécifique, augmenter son score
    return positionPreference;
  }

  predict(numbersToPredict, lastDraw = null) {
    // Calculer les scores pour chaque numéro
    const scores = {};
    
    for (let number = 1; number <= this.maxNumber; number++) {
      // Combiner différents facteurs avec des pondérations
      const overdueScore = this.calculateOverdueScore(number) * 0.35; // 35% de poids
      const affinityScore = this.calculateAffinityScore(number, lastDraw) * 0.25; // 25% de poids
      const frequencyScore = this.calculateFrequencyScore(number) * 0.25; // 25% de poids
      const positionalScore = this.calculatePositionalScore(number) * 0.15; // 15% de poids
      
      // Score final
      scores[number] = overdueScore + affinityScore + frequencyScore + positionalScore;
    }
    
    // Trier les numéros par score et prendre les N meilleurs
    const sortedNumbers = Object.keys(scores)
      .map(number => parseInt(number))
      .sort((a, b) => scores[b] - scores[a]);
    
    return {
      predictions: sortedNumbers.slice(0, numbersToPredict),
      scores: sortedNumbers.slice(0, numbersToPredict).map(n => ({
        number: n,
        score: scores[n].toFixed(2)
      }))
    };
  }

  // Méthode pour obtenir des statistiques détaillées sur un numéro spécifique
  getNumberStats(number) {
    if (number < 1 || number > this.maxNumber) {
      return null;
    }
    
    const stats = this.statistics[number];
    const totalDraws = this.historicalData.length;
    
    return {
      number,
      occurrences: stats.occurrences,
      frequency: (stats.occurrences / totalDraws * 100).toFixed(2) + '%',
      drawsSinceLastAppearance: stats.lastAppearance === null ? 
        'Jamais apparu' : totalDraws - stats.lastAppearance - 1,
      overdueScore: this.calculateOverdueScore(number).toFixed(2),
      frequencyScore: this.calculateFrequencyScore(number).toFixed(2),
      positionalScore: this.calculatePositionalScore(number).toFixed(2)
    };
  }
}

// Fonction pour analyser le CSV et extraire les données
function parseCSV(csvText) {
  // Diviser par lignes
  const lines = csvText.split('\n');
  // Ignorer la première ligne si c'est un en-tête
  const startIndex = lines[0].includes('date') || lines[0].includes('numéros') ? 1 : 0;
  
  const drawData = [];
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Ignorer les lignes vides
    
    // Diviser la ligne en colonnes
    const columns = line.split(',').map(col => col.trim());
    
    // Extraire les numéros du tirage (adapter selon le format de votre CSV)
    // Cette partie doit être ajustée selon la structure de votre CSV
    const numbers = [];
    
    // Supposons que les colonnes contenant les numéros commencent à l'index 1 
    // (si la première colonne est une date ou un identifiant)
    for (let j = 1; j < columns.length; j++) {
      const num = parseInt(columns[j]);
      if (!isNaN(num)) {
        numbers.push(num);
      }
    }
    
    if (numbers.length > 0) {
      drawData.push(numbers);
    }
  }
  
  return drawData;
}

// Exemple d'utilisation sur téléphone mobile
function initializeApp() {
  // Interface utilisateur
  const app = {
    // Données historiques à remplacer par vos propres données
    historicalData: [],
    
    // Initialisation
    init: function() {
      // Charger les données historiques (à implémenter selon votre stockage)
      this.loadHistoricalData();
      
      // Initialiser le prédicteur si des données sont déjà présentes
      if (this.historicalData.length > 0) {
        this.predictor = new LotteryPredictor(this.historicalData);
        this.displayPredictions();
      }
      
      // Configurer les gestionnaires d'événements
      document.getElementById('predict-button').addEventListener('click', () => {
        this.displayPredictions();
      });
      
      document.getElementById('add-draw-button').addEventListener('click', () => {
        this.addNewDraw();
      });
      
      // Ajouter un gestionnaire pour le chargement de fichier CSV
      const csvFileInput = document.getElementById('csv-file-input');
      if (csvFileInput) {
        csvFileInput.addEventListener('change', (event) => {
          this.handleCSVUpload(event);
        });
      }
      
      // Ajouter un gestionnaire pour le bouton de chargement CSV
      const loadCSVButton = document.getElementById('load-csv-button');
      if (loadCSVButton) {
        loadCSVButton.addEventListener('click', () => {
          document.getElementById('csv-file-input').click();
        });
      }
    },
    
    // Gérer le téléchargement du fichier CSV
    handleCSVUpload: function(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const csvContent = e.target.result;
        const parsedData = parseCSV(csvContent);
        
        if (parsedData.length > 0) {
          // Remplacer ou ajouter aux données existantes
          const appendData = confirm("Ajouter à l'historique existant ? Annuler pour remplacer complètement.");
          
          if (appendData) {
            this.historicalData = this.historicalData.concat(parsedData);
          } else {
            this.historicalData = parsedData;
          }
          
          this.saveHistoricalData();
          
          // Réinitialiser le prédicteur avec les nouvelles données
          this.predictor = new LotteryPredictor(this.historicalData);
          this.displayPredictions();
          
          alert(`${parsedData.length} tirages chargés avec succès.`);
        } else {
          alert("Aucune donnée valide n'a été trouvée dans le fichier CSV.");
        }
      };
      
      reader.readAsText(file);
    },
    
    // Charger les données historiques depuis le stockage local
    loadHistoricalData: function() {
      const savedData = localStorage.getItem('lotteryData');
      if (savedData) {
        this.historicalData = JSON.parse(savedData);
      }
    },
    
    // Sauvegarder les données historiques
    saveHistoricalData: function() {
      localStorage.setItem('lotteryData', JSON.stringify(this.historicalData));
    },
    
    // Afficher les prédictions
    displayPredictions: function() {
      // S'assurer que le prédicteur est initialisé
      if (!this.predictor && this.historicalData.length > 0) {
        this.predictor = new LotteryPredictor(this.historicalData);
      }
      
      if (!this.predictor) {
        document.getElementById('predictions-results').innerHTML = 
          '<p>Aucune donnée historique disponible. Veuillez charger un fichier CSV ou ajouter des tirages manuellement.</p>';
        return;
      }
      
      // Obtenir le dernier tirage pour l'affinité
      const lastDraw = this.historicalData.length > 0 ? 
        this.historicalData[this.historicalData.length - 1] : null;
      
      // Nombre de prédictions à faire
      const numPredictions = parseInt(document.getElementById('num-predictions').value) || 10;
      
      // Obtenir les prédictions
      const result = this.predictor.predict(numPredictions, lastDraw);
      
      // Afficher les résultats
      const resultsContainer = document.getElementById('predictions-results');
      resultsContainer.innerHTML = '';
      
      for (const predictionData of result.scores) {
        const numberStats = this.predictor.getNumberStats(predictionData.number);
        
        const predictionElement = document.createElement('div');
        predictionElement.className = 'prediction-item';
        predictionElement.innerHTML = `
          <h3>Numéro ${predictionData.number}</h3>
          <p>Score total: ${predictionData.score}</p>
          <p>Fréquence d'apparition: ${numberStats.frequency}</p>
          <p>Non tiré depuis: ${numberStats.drawsSinceLastAppearance} tirages</p>
          <p>Score retard: ${numberStats.overdueScore}</p>
        `;
        
        resultsContainer.appendChild(predictionElement);
      }
      
      // Afficher des statistiques générales
      resultsContainer.innerHTML += `
        <div class="stats-summary">
          <h3>Statistiques</h3>
          <p>Nombre total de tirages analysés: ${this.historicalData.length}</p>
        </div>
      `;
    },
    
    // Ajouter un nouveau tirage
    addNewDraw: function() {
      const drawInput = document.getElementById('new-draw-input').value;
      const numbers = drawInput.split(',')
        .map(n => parseInt(n.trim()))
        .filter(n => !isNaN(n));
      
      if (numbers.length < 3) {
        alert('Veuillez entrer au moins 3 numéros valides séparés par des virgules');
        return;
      }
      
      this.historicalData.push(numbers);
      this.saveHistoricalData();
      
      // Réinitialiser le prédicteur avec les nouvelles données
      this.predictor = new LotteryPredictor(this.historicalData);
      
      // Mettre à jour l'affichage
      this.displayPredictions();
      
      // Effacer l'entrée
      document.getElementById('new-draw-input').value = '';
    }
  };
  
  // Initialiser l'application
  app.init();
}

// Démarrer l'application lorsque le DOM est chargé
document.addEventListener('DOMContentLoaded', initializeApp);
