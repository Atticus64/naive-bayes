export class AnalysisConfig {
  static DEFAULT_TRAINING_PERCENTAGE = 70
  static DEFAULT_STRATIFIED_PERCENTAGE = 70
  static DEFAULT_BIN_COUNT = 5
  static MIN_PERCENTAGE = 1
  static MAX_PERCENTAGE = 99
  static MIN_BINS = 2
  static MAX_BINS = 50

  constructor(overrides = {}) {
    this.useExternalTest = false
    this.classPosition = 'last'
    this.validationMethod = 'simple'
    this.trainingPercentage = AnalysisConfig.DEFAULT_TRAINING_PERCENTAGE
    this.stratifiedPercentage = AnalysisConfig.DEFAULT_STRATIFIED_PERCENTAGE
    this.discretizationMethod = 'equal-width'
    this.binCount = AnalysisConfig.DEFAULT_BIN_COUNT
    Object.assign(this, overrides)
  }

  setUseExternalTest(enabled) {
    this.useExternalTest = Boolean(enabled)
  }

  setClassPosition(position) {
    this.classPosition = position === 'first' ? 'first' : 'last'
  }

  setValidationMethod(method) {
    this.validationMethod = method
  }

  setTrainingPercentage(value) {
    this.trainingPercentage = AnalysisConfig.clampPercentage(value)
  }

  setStratifiedPercentage(value) {
    this.stratifiedPercentage = AnalysisConfig.clampPercentage(value)
  }

  setDiscretizationMethod(method) {
    this.discretizationMethod = method
  }

  setBinCount(value) {
    this.binCount = AnalysisConfig.clampBins(value)
  }

  static clampPercentage(value, fallback = AnalysisConfig.DEFAULT_TRAINING_PERCENTAGE) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) return fallback
    return Math.min(AnalysisConfig.MAX_PERCENTAGE, Math.max(AnalysisConfig.MIN_PERCENTAGE, parsed))
  }

  static clampBins(value, fallback = AnalysisConfig.DEFAULT_BIN_COUNT) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) return fallback
    return Math.min(AnalysisConfig.MAX_BINS, Math.max(AnalysisConfig.MIN_BINS, parsed))
  }

  buildValidationConfig() {
    if (this.useExternalTest) {
      return {
        method: 'external',
        trainingPercentage: 100,
        testPercentage: 0,
        stratifiedPercentage: null,
      }
    }

    if (this.validationMethod === 'cross') {
      return {
        method: 'cross',
        trainingPercentage: 50,
        testPercentage: 50,
        stratifiedPercentage: null,
      }
    }

    if (this.validationMethod === 'stratified') {
      return {
        method: 'stratified',
        trainingPercentage: this.stratifiedPercentage,
        testPercentage: 100 - this.stratifiedPercentage,
        stratifiedPercentage: this.stratifiedPercentage,
      }
    }

    return {
      method: 'simple',
      trainingPercentage: this.trainingPercentage,
      testPercentage: 100 - this.trainingPercentage,
      stratifiedPercentage: null,
    }
  }

  /**
   * @param {{ dataset: import('./dataset.js').Dataset, testDataset: import('./dataset.js').Dataset | null }} datasets
   */
  toRequest({ dataset, testDataset }) {
    return {
      dataset: {
        fileName: dataset.fileName,
        headers: dataset.headers,
        rows: dataset.rows,
        tipos_atributos: dataset.tipos_atributos,
      },
      testDataset: testDataset
        ? {
            fileName: testDataset.fileName,
            headers: testDataset.headers,
            rows: testDataset.rows,
            tipos_atributos: testDataset.tipos_atributos,
          }
        : null,
      classColumn: dataset.getClassColumn(this.classPosition),
      validation: this.buildValidationConfig(),
      discretization: {
        method: this.discretizationMethod,
        bins: this.binCount,
      },
    }
  }
}

export class Discretizer {
  calculate(rows, columnIndex, type, bins) {
    if (type === 'equal-width') return this.equalWidth(rows, columnIndex, bins)
    if (type === 'equal-frequency') return this.equalFrequency(rows, columnIndex, bins)
    if (type === 'density') return this.density(rows, columnIndex, bins)
    return undefined
  }

  equalWidth(rows, columnIndex, bins) {
    const values = rows.map((row) => Number(row[columnIndex])).filter((value) => !Number.isNaN(value))
    const min = Math.min(...values)
    const max = Math.max(...values)
    const width = (max - min) / bins

    const intervals = []
    for (let i = 0; i < bins; i++) {
      const lowerBound = min + i * width
      const upperBound = i === bins - 1 ? max : lowerBound + width
      intervals.push({ lowerBound, upperBound })
    }

    return intervals
  }

  equalFrequency(rows, columnIndex, bins) {
    const n = rows.length
    const sortedValues = rows
      .map((row) => Number(row[columnIndex]))
      .filter((value) => !Number.isNaN(value))
      .sort((a, b) => a - b)
    const intervals = []
    const binSize = Math.floor(n / bins)

    for (let i = 0; i < bins; i++) {
      const lowerIndex = i * binSize
      const upperIndex = i === bins - 1 ? n - 1 : (i + 1) * binSize - 1
      const lowerBound = sortedValues[lowerIndex]
      const upperBound = sortedValues[upperIndex]
      intervals.push({ lowerBound, upperBound })
    }

    return intervals
  }

  density() {
    // TODO: implementar discretización por función de densidad
    return undefined
  }

  contains(value, interval) {
    return value >= interval.lowerBound && value <= interval.upperBound
  }
}

export class ProbabilityEstimator {
  normalizeType(tipo) {
    if (tipo === 'continuo' || tipo === 'continuous') return 'continuous'
    if (tipo === 'discreto' || tipo === 'discrete') return 'discrete'
    return tipo
  }

  estimate(rows, type, columnIndex, discretization) {
    const normalized = this.normalizeType(type)
    if (normalized === 'continuous') return this.continuous(rows, columnIndex)
    if (normalized === 'discrete') return this.discrete(rows, columnIndex)
    return undefined
  }

  continuous(rows, columnIndex) {
    // density function
    const values = rows.map((row) => Number(row[columnIndex])).filter((value) => !Number.isNaN(value))
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
    const stdDev = Math.sqrt(variance)
    return { mean, stdDev }
  }

  discrete(rows, columnIndex) {
    // by laplace
    const categories = new Map(rows.map((row) => [row[columnIndex], true]))
    const no_categories = categories.size
    const counts = new Map()
    for (const row of rows) {
      const value = row[columnIndex]
      counts.set(value, (counts.get(value) || 0) + 1)
    }

    const prob = 1
    // TODO: implementar Laplace y retornar la probabilidad
    void no_categories
    void prob
    void counts
  }
}

export class NaiveBayesClassifier {
  constructor({ discretizer = new Discretizer(), probabilityEstimator = new ProbabilityEstimator() } = {}) {
    this.discretizer = discretizer
    this.probabilityEstimator = probabilityEstimator
  }

  train(dataset, config) {
    // TODO: implementar entrenamiento Naive Bayes
    return { dataset, config }
  }

  predict(instance) {
    // TODO: implementar predicción
    return null
  }

  classify(request) {
    // TODO: implementar clasificación completa
    return null
  }
}

export class AnalysisService {
  constructor({ config, classifier, metrics, discretizer = new Discretizer() }) {
    this.config = config
    this.classifier = classifier
    this.metrics = metrics
    this.discretizer = discretizer
  }

  buildRequest({ dataset, testDataset }) {
    return this.config.toRequest({ dataset, testDataset })
  }

  previewDiscretization(dataset) {
    const columnIndex = dataset.continuousColumns[0] ?? 1
    const intervals = this.discretizer.calculate(dataset.rows, columnIndex, 'equal-width', 5)

    const intervalMap = new Map()
    for (const row of dataset.rows) {
      const value = Number(row[columnIndex])
      const interval = intervals.find((int) => this.discretizer.contains(value, int))
      intervalMap.set(interval, (intervalMap.get(interval) || 0) + 1)
    }

    console.log('Intervalos:', intervals)
    console.log('Mapa de intervalos:', intervalMap)
    return { intervals, intervalMap }
  }

  run(request) {
    // TODO: entrenar, clasificar y calcular métricas
    return null
  }
}
