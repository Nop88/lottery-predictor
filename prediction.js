
/* =========================================================
   PREDICTEUR EUROMILLIONS
   Méthodes : classique, bayésienne, hybride
   Backtest chronologique sans fuite de données
   ========================================================= */

class LotteryPredictor {
    constructor(historicalData, maxNumber = null) {
        this.historicalData = historicalData.map(draw =>
            [...new Set(draw)].sort((a, b) => a - b)
        );

        this.maxNumber = maxNumber ||
            Math.max(0, ...this.historicalData.flat());

        this.expectedDrawSize = this.historicalData.length
            ? this.historicalData.reduce((sum, draw) => sum + draw.length, 0)
                / this.historicalData.length
            : 1;

        this.statistics = this.initializeStatistics();
        this.analyze();
    }

    initializeStatistics() {
        const stats = {};

        for (let n = 1; n <= this.maxNumber; n++) {
            stats[n] = {
                occurrences: 0,
                lastAppearance: null,
                afterDrawFrequency: {},
                previousDrawCount: 0
            };
        }

        return stats;
    }

    analyze() {
        const totalDraws = this.historicalData.length;

        for (let i = 0; i < totalDraws; i++) {
            const draw = this.historicalData[i];

            for (const number of draw) {
                if (!this.statistics[number]) continue;

                this.statistics[number].occurrences++;
                this.statistics[number].lastAppearance = i;
            }

            // Relations entre un tirage et le tirage suivant
            if (i > 0) {
                const previousDraw = this.historicalData[i - 1];

                for (const previousNumber of previousDraw) {
                    if (!this.statistics[previousNumber]) continue;

                    this.statistics[previousNumber].previousDrawCount++;

                    for (const currentNumber of draw) {
                        const frequencies =
                            this.statistics[previousNumber].afterDrawFrequency;

                        frequencies[currentNumber] =
                            (frequencies[currentNumber] || 0) + 1;
                    }
                }
            }
        }
    }

    calculateOverdueScore(number) {
        const stats = this.statistics[number];
        const totalDraws = this.historicalData.length;

        if (!stats || stats.lastAppearance === null) return 100;

        const drawsSinceLast =
            totalDraws - stats.lastAppearance - 1;

        const expectedInterval =
            this.maxNumber / Math.max(this.expectedDrawSize, 1);

        return (drawsSinceLast / expectedInterval) * 100;
    }

    calculateAffinityScore(number, lastDraw) {
        if (!lastDraw || !lastDraw.length) return 0;

        let total = 0;
        let count = 0;

        for (const previousNumber of lastDraw) {
            const previousStats = this.statistics[previousNumber];
            if (!previousStats || previousStats.previousDrawCount === 0) continue;

            const occurrences =
                previousStats.afterDrawFrequency[number] || 0;

            const probability =
                occurrences / previousStats.previousDrawCount;

            total += probability;
            count++;
        }

        return count ? (total / count) * 100 : 0;
    }

    calculateFrequencyScore(number) {
        const totalDraws = this.historicalData.length;
        if (!totalDraws) return 0;

        const frequency =
            this.statistics[number].occurrences / totalDraws;

        const theoreticalFrequency =
            this.expectedDrawSize / this.maxNumber;

        // Écart relatif à la fréquence théorique
        return theoreticalFrequency > 0
            ? (frequency / theoreticalFrequency) * 100
            : 0;
    }

    calculateBayesianStats(number, priorStrength = 20) {
        const totalDraws = this.historicalData.length;
        const occurrences = this.statistics[number].occurrences;

        // Probabilité théorique d'apparition à chaque tirage
        const p = this.expectedDrawSize / this.maxNumber;

        // A priori Beta centré sur la probabilité théorique
        const alpha0 = p * priorStrength;
        const beta0 = (1 - p) * priorStrength;

        // Mise à jour de la loi Beta après observation des tirages
        const alpha = alpha0 + occurrences;
        const beta = beta0 + totalDraws - occurrences;

        const posteriorMean = alpha / (alpha + beta);

        return {
            occurrences,
            totalDraws,
            theoreticalProbability: p,
            posteriorMean,
            posteriorPercent: posteriorMean * 100,
            relativeDeviation: p > 0
                ? ((posteriorMean - p) / p) * 100
                : 0,
            alpha,
            beta
        };
    }

    normalizeScores(rawScores) {
        const values = Object.values(rawScores);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min;

        const normalized = {};

        for (const key in rawScores) {
            normalized[key] = range === 0
                ? 50
                : ((rawScores[key] - min) / range) * 100;
        }

        return normalized;
    }

    getClassicalScores(lastDraw = null) {
        const overdueRaw = {};
        const affinityRaw = {};
        const frequencyRaw = {};

        for (let n = 1; n <= this.maxNumber; n++) {
            overdueRaw[n] = this.calculateOverdueScore(n);
            affinityRaw[n] = this.calculateAffinityScore(n, lastDraw);
            frequencyRaw[n] = this.calculateFrequencyScore(n);
        }

        const overdue = this.normalizeScores(overdueRaw);
        const affinity = this.normalizeScores(affinityRaw);
        const frequency = this.normalizeScores(frequencyRaw);

        const scores = {};

        // Anciennes pondérations conservées et renormalisées
        // après suppression du critère de position.
        for (let n = 1; n <= this.maxNumber; n++) {
            scores[n] =
                overdue[n] * (35 / 85) +
                affinity[n] * (25 / 85) +
                frequency[n] * (25 / 85);
        }

        return scores;
    }

    getBayesianScores(priorStrength = 20) {
        const raw = {};

        for (let n = 1; n <= this.maxNumber; n++) {
            raw[n] = this.calculateBayesianStats(n, priorStrength)
                .posteriorMean;
        }

        return raw;
    }

    getHybridScores(lastDraw = null) {
        const classical = this.getClassicalScores(lastDraw);
        const bayesian = this.getBayesianScores();

        const classicalNormalized = this.normalizeScores(classical);
        const bayesianNormalized = this.normalizeScores(bayesian);

        const hybrid = {};

        for (let n = 1; n <= this.maxNumber; n++) {
            hybrid[n] =
                classicalNormalized[n] * 0.5 +
                bayesianNormalized[n] * 0.5;
        }

        return hybrid;
    }

    selectNumbers(scores, count, randomize = true) {
        const sorted = Object.keys(scores)
            .map(Number)
            .sort((a, b) => scores[b] - scores[a]);

        if (!randomize) {
            return sorted.slice(0, count).sort((a, b) => a - b);
        }

        // Tirage pondéré dans un bassin de candidats bien classés
        const poolSize = Math.min(
            sorted.length,
            Math.max(count, count * 4)
        );

        const pool = sorted.slice(0, poolSize).map(number => ({
            number,
            weight: Math.max(scores[number], 0.01)
        }));

        const selected = [];

        while (selected.length < count && pool.length > 0) {
            const totalWeight =
                pool.reduce((sum, item) => sum + item.weight, 0);

            let random = Math.random() * totalWeight;
            let chosenIndex = 0;

            for (let i = 0; i < pool.length; i++) {
                random -= pool[i].weight;
                if (random <= 0) {
                    chosenIndex = i;
                    break;
                }
            }

            selected.push(pool[chosenIndex].number);
            pool.splice(chosenIndex, 1);
        }

        return selected.sort((a, b) => a - b);
    }

    predictAll(count, lastDraw = null, randomize = true) {
        const classicalScores = this.getClassicalScores(lastDraw);
        const bayesianScores = this.getBayesianScores();
        const hybridScores = this.getHybridScores(lastDraw);

        return {
            classical: {
                predictions: this.selectNumbers(
                    classicalScores, count, randomize
                ),
                scores: classicalScores
            },
            bayesian: {
                predictions: this.selectNumbers(
                    bayesianScores, count, randomize
                ),
                scores: bayesianScores
            },
            hybrid: {
                predictions: this.selectNumbers(
                    hybridScores, count, randomize
                ),
                scores: hybridScores
            }
        };
    }

    // Compatibilité avec l'ancienne méthode predict()
    predict(count, lastDraw = null) {
        const result = this.predictAll(count, lastDraw, true).classical;

        return {
            predictions: result.predictions,
            scores: result.predictions.map(number => ({
                number,
                score: result.scores[number].toFixed(2)
            }))
        };
    }

    getNumberStats(number) {
        if (number < 1 || number > this.maxNumber) return null;

        const stats = this.statistics[number];
        const totalDraws = this.historicalData.length;

        if (!totalDraws) return null;

        return {
            number,
            occurrences: stats.occurrences,
            frequency:
                (stats.occurrences / totalDraws * 100).toFixed(2) + '%',
            drawsSinceLastAppearance: stats.lastAppearance === null
                ? 'Jamais apparu'
                : totalDraws - stats.lastAppearance - 1,
            overdueScore: this.calculateOverdueScore(number).toFixed(2),
            frequencyScore: this.calculateFrequencyScore(number).toFixed(2),
            bayesian: this.calculateBayesianStats(number)
        };
    }
}


/* =========================================================
   LECTURE DU CSV
   ========================================================= */

function parseLotteryCSV(csvText) {
    const results = Papa.parse(csvText.replace(/^\uFEFF/, ''), {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        delimiter: '\t',
        transformHeader: header => header.trim()
    });

    if (results.errors.length) {
        console.warn('Avertissements CSV :', results.errors);
    }

    const mainData = [];
    const starsData = [];

    // Le fichier source est du plus récent au plus ancien.
    // On inverse pour travailler du plus ancien au plus récent.
    results.data.slice().reverse().forEach(row => {
        const numbers = [
            row['Numéro 1'], row['Numéro 2'], row['Numéro 3'],
            row['Numéro 4'], row['Numéro 5']
        ].map(Number);

        const stars = [
            row['Etoile 1'], row['Etoile 2']
        ].map(Number);

        const validMain =
            numbers.length === 5 &&
            numbers.every(n => Number.isInteger(n) && n >= 1 && n <= 50) &&
            new Set(numbers).size === 5;

        const validStars =
            stars.length === 2 &&
            stars.every(n => Number.isInteger(n) && n >= 1 && n <= 12) &&
            new Set(stars).size === 2;

        if (validMain) mainData.push(numbers.sort((a, b) => a - b));
        if (validStars) starsData.push(stars.sort((a, b) => a - b));
    });

    return { mainData, starsData };
}


/* =========================================================
   BACKTEST CHRONOLOGIQUE
   ========================================================= */

function runBacktest(data, maxNumber, drawSize, windowSize = 100) {
    const minimumTraining = 30;

    if (data.length <= minimumTraining) {
        return null;
    }

    const startIndex = Math.max(
        minimumTraining,
        data.length - windowSize
    );

    const methods = ['classical', 'bayesian', 'hybrid'];

    const results = {
        sampleSize: data.length - startIndex,
        methods: {},
        randomMainExpected: drawSize === 5 ? 0.5 : null
    };

    methods.forEach(method => {
        results.methods[method] = {
            mainHits: 0,
            drawsWithOneOrMoreHits: 0,
            averageHits: 0
        };
    });

    for (let i = startIndex; i < data.length; i++) {
        // Exclusivement les tirages précédant le tirage testé
        const trainingData = data.slice(0, i);
        const actualDraw = data[i];

        const predictor = new LotteryPredictor(trainingData, maxNumber);
        const lastDraw = trainingData[trainingData.length - 1];

        const predictions = predictor.predictAll(
            drawSize, lastDraw, false
        );

        for (const method of methods) {
            const predicted = predictions[method].predictions;
            const hits = predicted.filter(n => actualDraw.includes(n)).length;

            results.methods[method].mainHits += hits;

            if (hits > 0) {
                results.methods[method].drawsWithOneOrMoreHits++;
            }
        }
    }

    for (const method of methods) {
        const item = results.methods[method];

        item.averageHits =
            item.mainHits / results.sampleSize;

        item.drawsWithOneOrMoreHits =
            item.drawsWithOneOrMoreHits / results.sampleSize * 100;
    }

    // Espérance mathématique du nombre de bons numéros
    results.randomExpected =
        drawSize * drawSize / maxNumber;

    return results;
}


/* =========================================================
   APPLICATION ET INTERFACE
   ========================================================= */

function initializeApp() {
    const app = {
        historicalData: [],
        starsHistoricalData: [],
        predictor: null,
        starsPredictor: null,

        init: async function () {
            await this.loadHistoricalData();

            this.rebuildPredictors();
            this.displayPredictions();
            this.displayStatistics('all');

            document.getElementById('predict-button')
                .addEventListener('click', () => this.displayPredictions());

            document.getElementById('add-draw-button')
                .addEventListener('click', () => this.addNewDraw());

            document.getElementById('load-csv-button')
                .addEventListener('click', () => {
                    document.getElementById('csv-file-input').click();
                });

            document.getElementById('csv-file-input')
                .addEventListener('change', event => this.handleCSVUpload(event));

            document.getElementById('stats-filter')
                .addEventListener('change', event => {
                    this.displayStatistics(event.target.value);
                });

            document.getElementById('backtest-button')
                .addEventListener('click', () => this.displayBacktest());
        },

        rebuildPredictors: function () {
            this.predictor = this.historicalData.length
                ? new LotteryPredictor(this.historicalData, 50)
                : null;

            this.starsPredictor = this.starsHistoricalData.length
                ? new LotteryPredictor(this.starsHistoricalData, 12)
                : null;
        },

        loadCSVData: async function () {
            try {
                const response = await fetch('./statistics.csv');

                if (!response.ok) {
                    throw new Error(`Erreur HTTP ${response.status}`);
                }

                return parseLotteryCSV(await response.text());
            } catch (error) {
                console.warn('CSV distant indisponible :', error);
                return { mainData: [], starsData: [] };
            }
        },

        loadHistoricalData: async function () {
            const { mainData, starsData } = await this.loadCSVData();

            if (mainData.length > 0) {
                this.historicalData = mainData;
                this.starsHistoricalData = starsData;
                console.log('Historique chargé :', mainData.length, 'tirages');
            } else {
                try {
                    this.historicalData = JSON.parse(
                        localStorage.getItem('lotteryData') || '[]'
                    );

                    this.starsHistoricalData = JSON.parse(
                        localStorage.getItem('lotteryStarsData') || '[]'
                    );
                } catch (error) {
                    console.error('Erreur de lecture des données locales :', error);
                    this.historicalData = [];
                    this.starsHistoricalData = [];
                }
            }
        },

        saveHistoricalData: function () {
            localStorage.setItem(
                'lotteryData',
                JSON.stringify(this.historicalData)
            );

            localStorage.setItem(
                'lotteryStarsData',
                JSON.stringify(this.starsHistoricalData)
            );
        },

        handleCSVUpload: function (event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();

            reader.onload = e => {
                const { mainData, starsData } =
                    parseLotteryCSV(e.target.result);

                if (!mainData.length) {
                    alert('Aucun tirage valide trouvé. Vérifie les en-têtes et le format du CSV.');
                    event.target.value = '';
                    return;
                }

                const append = confirm(
                    "Ajouter ces tirages à l'historique existant ?\n\n" +
                    "OK : ajouter à la suite.\n" +
                    "Annuler : remplacer l'historique (recommandé si tu charges le fichier complet)."
                );

                if (append) {
                    this.historicalData =
                        this.historicalData.concat(mainData);

                    this.starsHistoricalData =
                        this.starsHistoricalData.concat(starsData);
                } else {
                    this.historicalData = mainData;
                    this.starsHistoricalData = starsData;
                }

                this.saveHistoricalData();
                this.rebuildPredictors();
                this.displayPredictions();
                this.displayStatistics(
                    document.getElementById('stats-filter').value
                );

                document.getElementById('backtest-results').innerHTML = '';
                alert(`${mainData.length} tirages chargés.`);
                event.target.value = '';
            };

            reader.readAsText(file);
        },

        displayPredictions: function () {
            const container =
                document.getElementById('predictions-results');

            if (!this.predictor) {
                container.innerHTML =
                    '<p>Aucune donnée disponible. Charge un fichier CSV pour commencer.</p>';
                return;
            }

            const requested = parseInt(
                document.getElementById('num-predictions').value,
                10
            ) || 5;

            const count = Math.max(1, Math.min(requested, 20, 50));

            const lastMain =
                this.historicalData[this.historicalData.length - 1];

            const results = this.predictor.predictAll(
                count, lastMain, true
            );

            const labels = {
                classical: 'Méthode classique',
                bayesian: 'Méthode bayésienne',
                hybrid: 'Méthode hybride'
            };

            const descriptions = {
                classical: 'Retard, affinités et fréquence historique.',
                bayesian: 'Fréquences observées régularisées par un a priori théorique.',
                hybrid: 'Combinaison à parts égales des classements classique et bayésien.'
            };

            let html = '';

            for (const method of ['classical', 'bayesian', 'hybrid']) {
                html += `
                    <div class="prediction-item">
                        <h3>${labels[method]}</h3>
                        <p class="prediction-numbers">
                            ${results[method].predictions.join(' - ')}
                        </p>
                        <p class="help-text">${descriptions[method]}</p>
                    </div>
                `;
            }

            if (this.starsPredictor) {
                const lastStars =
                    this.starsHistoricalData[
                        this.starsHistoricalData.length - 1
                    ];

                const starResults = this.starsPredictor.predictAll(
                    2, lastStars, true
                );

                html += '<h2>Suggestions pour les étoiles</h2>';

                for (const method of ['classical', 'bayesian', 'hybrid']) {
                    html += `
                        <div class="prediction-item">
                            <h3>${labels[method]}</h3>
                            <p class="prediction-numbers">
                                ${starResults[method].predictions.join(' - ')}
                            </p>
                        </div>
                    `;
                }
            }

            html += `
                <p class="help-text">
                    Historique analysé : ${this.historicalData.length} tirages.
                    Les méthodes proposent des classements statistiques,
                    pas des probabilités de gain garanties.
                </p>
            `;

            container.innerHTML = html;
        },

        displayBacktest: function () {
            const container =
                document.getElementById('backtest-results');

            if (this.historicalData.length <= 30) {
                container.innerHTML =
                    '<p>Il faut au moins 31 tirages pour effectuer le backtest.</p>';
                return;
            }

            const main = runBacktest(
                this.historicalData, 50, 5, 100
            );

            const stars = this.starsHistoricalData.length > 30
                ? runBacktest(this.starsHistoricalData, 12, 2, 100)
                : null;

            const labels = {
                classical: 'Classique',
                bayesian: 'Bayésien',
                hybrid: 'Hybride'
            };

            let html = `
                <h3>Résultats sur les ${main.sampleSize} derniers tirages</h3>
                <p class="help-text">
                    À chaque étape, les méthodes utilisent uniquement les tirages
                    antérieurs au tirage évalué.
                </p>
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Méthode</th>
                            <th>Moyenne de bons numéros / 5</th>
                            <th>Tirages avec ≥ 1 bon numéro</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            for (const method of ['classical', 'bayesian', 'hybrid']) {
                const item = main.methods[method];

                html += `
                    <tr>
                        <td>${labels[method]}</td>
                        <td>${item.averageHits.toFixed(3)}</td>
                        <td>${item.drawsWithOneOrMoreHits.toFixed(1)} %</td>
                    </tr>
                `;
            }

            html += `
                    <tr>
                        <td>Hasard théorique</td>
                        <td>${main.randomExpected.toFixed(3)}</td>
                        <td>—</td>
                    </tr>
                    </tbody>
                </table>
                <p class="help-text">
                    Le hasard donne en moyenne ${main.randomExpected.toFixed(3)}
                    bon numéro par grille de 5. Cette valeur est une espérance
                    mathématique, pas le résultat d'une simulation.
                </p>
            `;

            if (stars) {
                html += `
                    <h3>Backtest des étoiles (${stars.sampleSize} tirages)</h3>
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th>Méthode</th>
                                <th>Moyenne de bonnes étoiles / 2</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                for (const method of ['classical', 'bayesian', 'hybrid']) {
                    html += `
                        <tr>
                            <td>${labels[method]}</td>
                            <td>${stars.methods[method].averageHits.toFixed(3)}</td>
                        </tr>
                    `;
                }

                html += `
                        <tr>
                            <td>Hasard théorique</td>
                            <td>${stars.randomExpected.toFixed(3)}</td>
                        </tr>
                        </tbody>
                    </table>
                `;
            } else {
                html += `
                    <p class="help-text">
                        Pas assez de tirages d'étoiles pour effectuer leur backtest.
                    </p>
                `;
            }

            html += `
                <p class="help-text">
                    Attention : un avantage observé sur cette période peut être
                    dû au hasard. Il faudrait le confirmer sur de nouvelles données.
                </p>
            `;

            container.innerHTML = html;
        },

        displayStatistics: function (filter) {
            const tbody = document.getElementById('stats-body');
            if (!tbody) return;

            tbody.innerHTML = '';

            if (!this.predictor) {
                tbody.innerHTML =
                    '<tr><td colspan="4">Aucune donnée disponible.</td></tr>';
                return;
            }

            const allStats = [];

            for (let n = 1; n <= 50; n++) {
                const stats = this.predictor.getNumberStats(n);
                if (stats && stats.occurrences > 0) allStats.push(stats);
            }

            let rows = [...allStats];

            if (filter === 'hot') {
                rows.sort((a, b) => b.occurrences - a.occurrences);
                rows = rows.slice(0, 10);
            } else if (filter === 'cold') {
                rows.sort((a, b) => a.occurrences - b.occurrences);
                rows = rows.slice(0, 10);
            } else if (filter === 'overdue') {
                rows.sort(
                    (a, b) =>
                        parseFloat(b.overdueScore) -
                        parseFloat(a.overdueScore)
                );
                rows = rows.slice(0, 10);
            } else {
                rows.sort((a, b) => a.number - b.number);
            }

            rows.forEach(stats => {
                const tr = document.createElement('tr');

                let cssClass = '';
                if (filter === 'hot') cssClass = 'hot-numbers';
                if (filter === 'cold') cssClass = 'cold-numbers';

                tr.innerHTML = `
                    <td class="${cssClass}">${stats.number}</td>
                    <td>${stats.frequency}</td>
                    <td>${stats.drawsSinceLastAppearance}</td>
                    <td>${stats.overdueScore}</td>
                `;

                tbody.appendChild(tr);
            });
        },

        addNewDraw: function () {
            const input =
                document.getElementById('new-draw-input').value;

            const values = input.split(',')
                .map(value => Number(value.trim()));

            if (
                ![5, 7].includes(values.length) ||
                values.some(value => !Number.isInteger(value))
            ) {
                alert('Entre 5 numéros principaux, ou 5 numéros suivis de 2 étoiles.');
                return;
            }

            const main = values.slice(0, 5);
            const stars = values.length === 7
                ? values.slice(5)
                : [];

            if (
                main.some(n => n < 1 || n > 50) ||
                new Set(main).size !== 5
            ) {
                alert('Les 5 numéros principaux doivent être uniques et compris entre 1 et 50.');
                return;
            }

            if (
                stars.length &&
                (stars.some(n => n < 1 || n > 12) ||
                new Set(stars).size !== 2)
            ) {
                alert('Les 2 étoiles doivent être uniques et comprises entre 1 et 12.');
                return;
            }

            this.historicalData.push(main.sort((a, b) => a - b));

            if (stars.length) {
                this.starsHistoricalData.push(stars.sort((a, b) => a - b));
            }

            this.saveHistoricalData();
            this.rebuildPredictors();
            this.displayPredictions();

            this.displayStatistics(
                document.getElementById('stats-filter').value
            );

            document.getElementById('backtest-results').innerHTML = '';
            document.getElementById('new-draw-input').value = '';
        }
    };

    app.init();
}

document.addEventListener('DOMContentLoaded', initializeApp);
