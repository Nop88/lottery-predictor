class LotteryPredictor {
    constructor(historicalData) {
        this.historicalData = historicalData; // format: [[n1, n2, n3...], [n1, n2, n3...], ...]
        this.maxNumber = this.findMaxNumber();
        this.statistics = this.initializeStatistics();
        this.analyze();
    }

    findMaxNumber() {
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
        const stats = {};
        for (let i = 1; i <= this.maxNumber; i++) {
            stats[i] = {
                occurrences: 0,
                lastAppearance: null,
                afterDrawFrequency: {},
                drawPositions: [0, 0, 0, 0, 0],
            };
        }
        return stats;
    }

    analyze() {
        const totalDraws = this.historicalData.length;
        for (let drawIndex = 0; drawIndex < totalDraws; drawIndex++) {
            const draw = this.historicalData[drawIndex];
            for (let positionIndex = 0; positionIndex < draw.length; positionIndex++) {
                const number = draw[positionIndex];
                this.statistics[number].occurrences++;
                this.statistics[number].lastAppearance = drawIndex;
                if (positionIndex < 5) {
                    this.statistics[number].drawPositions[positionIndex]++;
                }
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
        const totalDraws = this.historicalData.length;
        if (this.statistics[number].lastAppearance === null) {
            return 100;
        }
        const drawsSinceLastAppearance = totalDraws - this.statistics[number].lastAppearance - 1;
        const expectedFrequency = totalDraws / this.maxNumber;
        return (drawsSinceLastAppearance / expectedFrequency) * 100;
    }

    calculateAffinityScore(number, lastDraw) {
        if (!lastDraw || lastDraw.length === 0) {
            return 50;
        }
        let affinityScore = 0;
        let totalAffinities = 0;
        for (const prevNumber of lastDraw) {
            const afterFrequency = this.statistics[prevNumber].afterDrawFrequency[number];
            if (afterFrequency) {
                const normalizedFrequency = afterFrequency / this.historicalData.length * 100;
                affinityScore += normalizedFrequency;
                totalAffinities++;
            }
        }
        return totalAffinities > 0 ? affinityScore / totalAffinities : 50;
    }

    calculateFrequencyScore(number) {
        const frequency = this.statistics[number].occurrences / this.historicalData.length * 100;
        const idealFrequency = 100 / this.maxNumber;
        return 100 - Math.abs(frequency - idealFrequency) * 3;
    }

    calculatePositionalScore(number) {
        const totalAppearances = this.statistics[number].occurrences;
        if (totalAppearances === 0) return 50;
        const maxPositionCount = Math.max(...this.statistics[number].drawPositions);
        const positionPreference = maxPositionCount / totalAppearances * 100;
        return positionPreference;
    }

predict(numbersToPredict, lastDraw = null) {
        // Calculer les scores bruts pour chaque facteur
        const overdueRaw = {};
        const affinityRaw = {};
        const frequencyRaw = {};
        const positionalRaw = {};

        for (let number = 1; number <= this.maxNumber; number++) {
            overdueRaw[number] = this.calculateOverdueScore(number);
            affinityRaw[number] = this.calculateAffinityScore(number, lastDraw);
            frequencyRaw[number] = this.calculateFrequencyScore(number);
            positionalRaw[number] = this.calculatePositionalScore(number);
        }

        // Normaliser chaque facteur sur une échelle 0-100.
        // Sans ça, un facteur à forte variance (le retard) écrase les autres
        // même s'il ne pèse "que" 35% dans la formule finale.
        const normalize = (raw) => {
            const values = Object.values(raw);
            const min = Math.min(...values);
            const max = Math.max(...values);
            const range = max - min;
            const normalized = {};
            for (const key in raw) {
                normalized[key] = range === 0 ? 50 : ((raw[key] - min) / range) * 100;
            }
            return normalized;
        };

        const overdueNorm = normalize(overdueRaw);
        const affinityNorm = normalize(affinityRaw);
        const frequencyNorm = normalize(frequencyRaw);
        const positionalNorm = normalize(positionalRaw);

        // Combiner les scores normalisés avec les pondérations
        const scores = {};
        for (let number = 1; number <= this.maxNumber; number++) {
            scores[number] =
                overdueNorm[number] * 0.35 +
                affinityNorm[number] * 0.25 +
                frequencyNorm[number] * 0.25 +
                positionalNorm[number] * 0.15;
        }

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

// Parse un CSV "brut" saisi par l'utilisateur en séparant numéros et étoiles
// en s'appuyant sur les en-têtes 'Numéro X' / 'Etoile X' du fichier statistics.csv
function parseLotteryCSV(csvText) {
    const results = Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
    });

    const mainData = [];
    const starsData = [];

    results.data.forEach(row => {
        const numbers = [
            row['Numéro 1'], row['Numéro 2'], row['Numéro 3'],
            row['Numéro 4'], row['Numéro 5']
        ].filter(num => num !== undefined && num !== null && !isNaN(num));

        const stars = [
            row['Etoile 1'], row['Etoile 2']
        ].filter(star => star !== undefined && star !== null && !isNaN(star));

        if (numbers.length > 0) {
            mainData.push(numbers);
        }
        if (stars.length > 0) {
            starsData.push(stars);
        }
    });

    return { mainData, starsData };
}

function initializeApp() {
    const app = {
        historicalData: [],       // numéros principaux
        starsHistoricalData: [],  // étoiles
        predictor: null,
        starsPredictor: null,

        init: async function () {
            await this.loadHistoricalData();

            if (this.historicalData.length > 0) {
                this.predictor = new LotteryPredictor(this.historicalData);
            }
            if (this.starsHistoricalData.length > 0) {
                this.starsPredictor = new LotteryPredictor(this.starsHistoricalData);
            }

            this.displayPredictions();
            this.displayStatistics('all');

            document.getElementById('predict-button').addEventListener('click', () => {
                this.displayPredictions();
            });

            document.getElementById('add-draw-button').addEventListener('click', () => {
                this.addNewDraw();
            });

            const csvFileInput = document.getElementById('csv-file-input');
            if (csvFileInput) {
                csvFileInput.addEventListener('change', (event) => {
                    this.handleCSVUpload(event);
                });
            }

            const loadCSVButton = document.getElementById('load-csv-button');
            if (loadCSVButton) {
                loadCSVButton.addEventListener('click', () => {
                    document.getElementById('csv-file-input').click();
                });
            }

            const statsFilter = document.getElementById('stats-filter');
            if (statsFilter) {
                statsFilter.addEventListener('change', (event) => {
                    this.displayStatistics(event.target.value);
                });
            }
        },

        handleCSVUpload: function (event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const csvContent = e.target.result;
                const { mainData, starsData } = parseLotteryCSV(csvContent);

                if (mainData.length > 0) {
                    const appendData = confirm("Ajouter à l'historique existant ? Annuler pour remplacer complètement.");
                    if (appendData) {
                        this.historicalData = this.historicalData.concat(mainData);
                        this.starsHistoricalData = this.starsHistoricalData.concat(starsData);
                    } else {
                        this.historicalData = mainData;
                        this.starsHistoricalData = starsData;
                    }

                    this.saveHistoricalData();

                    this.predictor = new LotteryPredictor(this.historicalData);
                    if (this.starsHistoricalData.length > 0) {
                        this.starsPredictor = new LotteryPredictor(this.starsHistoricalData);
                    }

                    this.displayPredictions();
                    this.displayStatistics(document.getElementById('stats-filter').value);

                    alert(`${mainData.length} tirages chargés avec succès.`);
                } else {
                    alert("Aucune donnée valide n'a été trouvée dans le fichier CSV. Vérifiez que les colonnes s'appellent bien 'Numéro 1'...'Numéro 5' et 'Etoile 1', 'Etoile 2'.");
                }
            };
            reader.readAsText(file);
        },

        loadCSVData: async function () {
            try {
                const response = await fetch('./statistics.csv');
                const csvText = await response.text();
                return parseLotteryCSV(csvText);
            } catch (error) {
                console.error('Erreur de chargement CSV:', error);
                return { mainData: [], starsData: [] };
            }
        },

        loadHistoricalData: async function () {
            const { mainData, starsData } = await this.loadCSVData();
            if (mainData.length > 0) {
                this.historicalData = mainData;
                this.starsHistoricalData = starsData;
                console.log('Données CSV chargées:', mainData.length, 'tirages');
            } else {
                const savedData = localStorage.getItem('lotteryData');
                const savedStars = localStorage.getItem('lotteryStarsData');
                if (savedData) {
                    this.historicalData = JSON.parse(savedData);
                }
                if (savedStars) {
                    this.starsHistoricalData = JSON.parse(savedStars);
                }
            }
        },

        saveHistoricalData: function () {
            localStorage.setItem('lotteryData', JSON.stringify(this.historicalData));
            localStorage.setItem('lotteryStarsData', JSON.stringify(this.starsHistoricalData));
        },

        displayPredictions: function () {
            if (!this.predictor && this.historicalData.length > 0) {
                this.predictor = new LotteryPredictor(this.historicalData);
            }
            if (!this.starsPredictor && this.starsHistoricalData.length > 0) {
                this.starsPredictor = new LotteryPredictor(this.starsHistoricalData);
            }

            const resultsContainer = document.getElementById('predictions-results');

            if (!this.predictor) {
                resultsContainer.innerHTML =
                    '<p>Aucune donnée historique disponible. Veuillez charger un fichier CSV ou ajouter des tirages manuellement.</p>';
                return;
            }

            const lastMainDraw = this.historicalData.length > 0 ?
                this.historicalData[this.historicalData.length - 1] : null;
            const lastStarsDraw = this.starsHistoricalData.length > 0 ?
                this.starsHistoricalData[this.starsHistoricalData.length - 1] : null;

            const numMain = Math.min(parseInt(document.getElementById('num-predictions').value) || 5, this.predictor.maxNumber);
            const mainResult = this.predictor.predict(numMain, lastMainDraw);

            resultsContainer.innerHTML = `
                <div class="prediction-item">
                    <h3>Tirage suggéré — Numéros</h3>
                    <p style="font-size: 1.3em; font-weight: bold;">${mainResult.predictions.join(' - ')}</p>
                </div>
            `;

            if (this.starsPredictor) {
                const starsResult = this.starsPredictor.predict(2, lastStarsDraw);
                resultsContainer.innerHTML += `
                    <div class="prediction-item">
                        <h3>Tirage suggéré — Étoiles</h3>
                        <p style="font-size: 1.3em; font-weight: bold;">${starsResult.predictions.join(' - ')}</p>
                    </div>
                `;
            } else {
                resultsContainer.innerHTML += `
                    <div class="prediction-item">
                        <p><em>Pas assez de données d'étoiles pour faire une suggestion.</em></p>
                    </div>
                `;
            }

            resultsContainer.innerHTML += '<h3 style="margin-top: 20px;">Détail des scores (numéros)</h3>';
            for (const predictionData of mainResult.scores) {
                const numberStats = this.predictor.getNumberStats(predictionData.number);
                resultsContainer.innerHTML += `
                    <div class="prediction-item">
                        <h3>Numéro ${predictionData.number}</h3>
                        <p>Score total: ${predictionData.score}</p>
                        <p>Fréquence d'apparition: ${numberStats.frequency}</p>
                        <p>Non tiré depuis: ${numberStats.drawsSinceLastAppearance} tirages</p>
                        <p>Score retard: ${numberStats.overdueScore}</p>
                    </div>
                `;
            }

            resultsContainer.innerHTML += `
                <div class="stats-summary">
                    <h3>Statistiques</h3>
                    <p>Nombre total de tirages analysés: ${this.historicalData.length}</p>
                </div>
            `;
        },

        displayStatistics: function (filter) {
            const tbody = document.getElementById('stats-body');
            if (!tbody) return;
            tbody.innerHTML = '';

            if (!this.predictor) {
                if (this.historicalData.length > 0) {
                    this.predictor = new LotteryPredictor(this.historicalData);
                } else {
                    tbody.innerHTML = '<tr><td colspan="4">Aucune donnée disponible.</td></tr>';
                    return;
                }
            }

            const allStats = [];
            for (let n = 1; n <= this.predictor.maxNumber; n++) {
                const s = this.predictor.getNumberStats(n);
                if (s && s.occurrences > 0) {
                    allStats.push(s);
                }
            }

            let rows = allStats;

            if (filter === 'hot') {
                rows = [...allStats]
                    .sort((a, b) => b.occurrences - a.occurrences)
                    .slice(0, 10);
            } else if (filter === 'cold') {
                rows = [...allStats]
                    .sort((a, b) => a.occurrences - b.occurrences)
                    .slice(0, 10);
            } else if (filter === 'overdue') {
                rows = [...allStats]
                    .sort((a, b) => parseFloat(b.overdueScore) - parseFloat(a.overdueScore))
                    .slice(0, 10);
            } else {
                rows = [...allStats].sort((a, b) => a.number - b.number);
            }

            rows.forEach(s => {
                const tr = document.createElement('tr');
                let cssClass = '';
                if (filter === 'hot') cssClass = 'hot-numbers';
                if (filter === 'cold') cssClass = 'cold-numbers';
                tr.innerHTML = `
                    <td class="${cssClass}">${s.number}</td>
                    <td>${s.frequency}</td>
                    <td>${s.drawsSinceLastAppearance}</td>
                    <td>${s.overdueScore}</td>
                `;
                tbody.appendChild(tr);
            });
        },

        addNewDraw: function () {
            const drawInput = document.getElementById('new-draw-input').value;
            const numbers = drawInput.split(',')
                .map(n => parseInt(n.trim()))
                .filter(n => !isNaN(n));

            if (numbers.length < 3) {
                alert('Veuillez entrer au moins 3 numéros valides séparés par des virgules');
                return;
            }

            // Si 7 valeurs saisies, on suppose 5 numéros + 2 étoiles (format EuroMillions)
            let mainNumbers = numbers;
            let stars = [];
            if (numbers.length === 7) {
                mainNumbers = numbers.slice(0, 5);
                stars = numbers.slice(5);
            }

            this.historicalData.push(mainNumbers);
            if (stars.length > 0) {
                this.starsHistoricalData.push(stars);
            }
            this.saveHistoricalData();

            this.predictor = new LotteryPredictor(this.historicalData);
            if (this.starsHistoricalData.length > 0) {
                this.starsPredictor = new LotteryPredictor(this.starsHistoricalData);
            }

            this.displayPredictions();
            this.displayStatistics(document.getElementById('stats-filter').value);

            document.getElementById('new-draw-input').value = '';
        }
    };

    app.init();
}

document.addEventListener('DOMContentLoaded', initializeApp);
