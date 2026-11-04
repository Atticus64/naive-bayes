import { getClassInfoFromRows } from './dataset.js'

const MISSING_VALUE = '(vacío)'
const LAPLACE_ALPHA = 1
const MIN_VARIANCE = 1e-9

function normalizeCategory(value) {
  // if (value === '' || value == null) return MISSING_VALUE
  const normalized = String(value).trim()
  return normalized || MISSING_VALUE
}

function normalizeClassValue(value) {
  if (value === '' || value == null) return null
  const normalized = String(value).trim()
  return normalized || null
}

function toNumber(value) {
  if (value === '' || value == null) return null
  const number = Number(value)
  return Number.isNaN(number) ? null : number
}

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
    return undefined
  }

  numericValues(rows, columnIndex) {
    const values = []
    for (const row of rows) {
      const value = toNumber(row[columnIndex])
      if (value !== null) values.push(value)
    }
    return values
  }

  equalWidth(rows, columnIndex, bins) {
    const values = this.numericValues(rows, columnIndex)
    if (!values.length) return []

    const min = Math.min(...values)
    const max = Math.max(...values)
    if (min === max) return [{ lowerBound: min, upperBound: max }]

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
    const values = this.numericValues(rows, columnIndex).sort((a, b) => a - b)
    if (!values.length) return []

    const effectiveBins = Math.min(bins, values.length)
    const intervals = []
    for (let i = 0; i < effectiveBins; i++) {
      const lowerIndex = Math.floor((i * values.length) / effectiveBins)
      const upperIndex =
        i === effectiveBins - 1
          ? values.length - 1
          : Math.floor(((i + 1) * values.length) / effectiveBins) - 1
      intervals.push({ lowerBound: values[lowerIndex], upperBound: values[upperIndex] })
    }

    return intervals
  }

  findInterval(value, intervals) {
    if (!intervals.length) return null

    const lastIndex = intervals.length - 1
    if (value < intervals[0].lowerBound) return 0
    if (value > intervals[lastIndex].upperBound) return lastIndex

    for (let i = 0; i < intervals.length; i++) {
      if (this.contains(value, intervals[i])) return i
    }

    return lastIndex
  }

  contains(value, interval) {
    return value >= interval.lowerBound && value <= interval.upperBound
  }
}

export class ProbabilityEstimator {
  constructor({ discretizer = new Discretizer() } = {}) {
    this.discretizer = discretizer
  }

  normalizeType(tipo) {
    if (tipo === 'continuo' || tipo === 'continuous') return 'continuous'
    if (tipo === 'discreto' || tipo === 'discrete') return 'discrete'
    return tipo
  }

  estimate(rows, type, columnIndex, context = {}) {
    const normalized = this.normalizeType(type)

    if (normalized === 'continuous') {
      if (context.method == null || context.method === 'density') {
        return this.continuous(rows, columnIndex)
      }
      return this.discretizedContinuous(rows, columnIndex, context.intervals ?? [])
    }

    if (normalized === 'discrete') {
      return this.discrete(rows, columnIndex, context.categories)
    }

    return undefined
  }

  continuous(rows, columnIndex) {
    const values = []
    for (const row of rows) {
      const value = toNumber(row[columnIndex])
      if (value !== null) values.push(value)
    }

    if (!values.length) {
      return { kind: 'gaussian', mean: 0, variance: 0, stdDev: 0, empty: true }
    }

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
    const stdDev = Math.sqrt(variance)
    return { kind: 'gaussian', mean, variance, stdDev, empty: false }
  }

  discrete(rows, columnIndex, categories) {
    const counts = new Map()
    let total = 0

    for (const row of rows) {
      const value = normalizeCategory(row[columnIndex])
      counts.set(value, (counts.get(value) ?? 0) + 1)
      total += 1
    }

    return {
      kind: 'categorical',
      counts,
      total,
      categories: categories ?? new Set(counts.keys()),
      intervalDiscretization: false,
      intervals: null,
    }
  }

  discretizedContinuous(rows, columnIndex, intervals) {
    const counts = new Map()
    let total = 0

    for (const row of rows) {
      const category = this.discretizeValue(row[columnIndex], intervals)
      counts.set(category, (counts.get(category) ?? 0) + 1)
      total += 1
    }

    const categories = new Set(intervals.map((_, index) => index))
    // categories.add(MISSING_VALUE)

    return {
      kind: 'categorical',
      counts,
      total,
      categories,
      intervalDiscretization: true,
      intervals,
    }
  }

  logLikelihood(model, value, alpha = LAPLACE_ALPHA) {
    if (!model) return 0

    if (model.kind === 'gaussian') {
      if (model.empty) return 0

      const numeric = toNumber(value)
      if (numeric === null) return 0

      const variance = Math.max(model.variance, MIN_VARIANCE)
      return (
        -0.5 * Math.log(2 * Math.PI * variance) -
        ((numeric - model.mean) ** 2) / (2 * variance)
      )
    }

    if (model.kind === 'categorical') {
      const category = model.intervalDiscretization
        ? this.discretizeValue(value, model.intervals)
        : normalizeCategory(value)
      const count = model.counts.get(category) ?? 0
      const denominator = model.total + alpha * model.categories.size
      return Math.log((count + alpha) / denominator)
    }

    return 0
  }

  discretizeValue(value, intervals) {
    const numeric = toNumber(value)
    // if (numeric === null || !intervals.length) return MISSING_VALUE
    return this.discretizer.findInterval(numeric, intervals)
  }
}

export class NaiveBayesClassifier {
  constructor({
    discretizer = new Discretizer(),
    probabilityEstimator = new ProbabilityEstimator({ discretizer }),
  } = {}) {
    this.discretizer = discretizer
    this.probabilityEstimator = probabilityEstimator
  }

  train(training, options) {
    const { rows, headers, tipos_atributos } = training
    const { classColumn, discretization } = options
    const classIndex = classColumn.index
    const validRows = rows.filter((row) => normalizeClassValue(row[classIndex]) !== null)
    const { classes } = getClassInfoFromRows(validRows, classIndex)

    if (!classes.length) {
      throw new Error('No se encontraron clases válidas para entrenar el modelo.')
    }

    const classRows = new Map(classes.map((classValue) => [classValue, []]))
    for (const row of validRows) {
      const classValue = normalizeClassValue(row[classIndex])
      classRows.get(classValue).push(row)
    }

    const total = validRows.length
    const priors = new Map(
      classes.map((classValue) => [classValue, classRows.get(classValue).length / total]),
    )

    const attributeIndices = headers
      .map((_, index) => index)
      .filter((index) => index !== classIndex)

    const categoriesByAttribute = new Map()
    const intervalsByAttribute = new Map()

    for (const index of attributeIndices) {
      const type = this.probabilityEstimator.normalizeType(tipos_atributos[index])

      if (type === 'discrete') {
        const categories = new Set()
        for (const row of validRows) categories.add(normalizeCategory(row[index]))
        // categories.add(MISSING_VALUE)
        categoriesByAttribute.set(index, categories)
      }

      if (type === 'continuous' && discretization.method !== 'density') {
        intervalsByAttribute.set(
          index,
          this.discretizer.calculate(validRows, index, discretization.method, discretization.bins),
        )
      }
    }

    const attributes = attributeIndices.map((index) => {
      const perClass = new Map()
      const context = {
        method: discretization.method,
        bins: discretization.bins,
        categories: categoriesByAttribute.get(index),
        intervals: intervalsByAttribute.get(index),
      }

      for (const classValue of classes) {
        perClass.set(
          classValue,
          this.probabilityEstimator.estimate(
            classRows.get(classValue),
            tipos_atributos[index],
            index,
            context,
          ),
        )
      }

      return { index, type: tipos_atributos[index], perClass }
    })


    return {
      classIndex,
      classes,
      priors,
      attributes,
      discretization: { ...discretization },
    }
  }

  predict(model, instance) {
    if (!model.classes.length) {
      return { predicted: null, probabilities: new Map(), logScores: new Map() }
    }

    const logScores = new Map()

    for (const classValue of model.classes) {
      let score = Math.log(model.priors.get(classValue))

      for (const attribute of model.attributes) {
        const attributeModel = attribute.perClass.get(classValue)
        score += this.probabilityEstimator.logLikelihood(attributeModel, instance[attribute.index])
      }

      logScores.set(classValue, score)
    }

    let predicted = null
    let best = -Infinity
    for (const [classValue, score] of logScores) {
      if (score > best) {
        best = score
        predicted = classValue
      }
    }

    const max = Math.max(...logScores.values())
    const exps = new Map()
    let total = 0

    for (const [classValue, score] of logScores) {
      const value = Math.exp(score - max)
      exps.set(classValue, value)
      total += value
    }

    const probabilities = new Map()
    for (const [classValue, value] of exps) {
      probabilities.set(classValue, total === 0 ? 0 : value / total)
    }

    return { predicted, probabilities, logScores }
  }

  classify(request) {
    const { dataset, testDataset, classColumn, validation, discretization } = request
    const classIndex = classColumn.index

    let trainingRows
    let testRows

    if (validation.method === 'external') {
      trainingRows = dataset.rows
      testRows = testDataset?.rows ?? []
    } else {
      const split = this.splitRows(dataset.rows, classIndex, validation)
      trainingRows = split.trainingRows
      testRows = split.testRows
    }

    const model = this.train(
      {
        rows: trainingRows,
        headers: dataset.headers,
        tipos_atributos: dataset.tipos_atributos,
      },
      { classColumn, discretization },
    )

    const predictions = testRows.map((row) => {
      const result = this.predict(model, row)
      return {
        actual: normalizeClassValue(row[classIndex]),
        predicted: result.predicted,
        probabilities: result.probabilities,
        logScores: result.logScores,
      }
    })

    return {
      model,
      predictions,
      trainingCount: trainingRows.length,
      testCount: testRows.length,
    }
  }

  splitRows(rows, classIndex, validation) {
    if (validation.method === 'stratified') {
      return this.stratifiedSplit(rows, classIndex, validation.trainingPercentage)
    }

    return this.randomSplit(rows, validation.trainingPercentage)
  }

  randomSplit(rows, trainingPercentage) {
    const shuffled = this.shuffle([...rows])
    if (shuffled.length <= 1) {
      return { trainingRows: shuffled, testRows: [] }
    }

    const trainingCount = Math.min(
      shuffled.length - 1,
      Math.max(1, Math.round((shuffled.length * trainingPercentage) / 100)),
    )

    return {
      trainingRows: shuffled.slice(0, trainingCount),
      testRows: shuffled.slice(trainingCount),
    }
  }

  stratifiedSplit(rows, classIndex, trainingPercentage) {
    const groups = new Map()

    for (const row of rows) {
      const classValue = normalizeClassValue(row[classIndex])
      if (classValue === null) continue

      if (!groups.has(classValue)) groups.set(classValue, [])
      groups.get(classValue).push(row)
    }

    const trainingRows = []
    const testRows = []

    for (const group of groups.values()) {
      const shuffled = this.shuffle([...group])
      const trainingCount =
        shuffled.length <= 1
          ? shuffled.length
          : Math.min(
              shuffled.length - 1,
              Math.max(1, Math.round((shuffled.length * trainingPercentage) / 100)),
            )

      trainingRows.push(...shuffled.slice(0, trainingCount))
      testRows.push(...shuffled.slice(trainingCount))
    }

    return { trainingRows, testRows }
  }

  shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[items[i], items[j]] = [items[j], items[i]]
    }

    return items
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
      const value = toNumber(row[columnIndex])
      if (value === null) continue

      const interval = intervals[this.discretizer.findInterval(value, intervals)]
      intervalMap.set(interval, (intervalMap.get(interval) || 0) + 1)
    }

    return { intervals, intervalMap }
  }

  run(request) {
    const result = this.classifier.classify(request)
    const evaluated = result.predictions.filter(
      (prediction) => prediction.actual != null && prediction.predicted != null,
    )
    const correct = evaluated.filter(
      (prediction) => prediction.actual === prediction.predicted,
    ).length

    const classList = result.model.classes
    const matrix = this.metrics.confusionMatrix(classList, evaluated)
    const acc = this.metrics.accuracy(matrix)
    // const precisions = classList.map((_, index) => this.metrics.precision(matrix, index))
    const precisions = classList.map((_, index) => this.metrics.precision(matrix, index)) 
    const recalls = classList.map((_, index) => this.metrics.recall(matrix, index))
    const f1Scores = classList.map((_, index) => this.metrics.f1(precisions[index], recalls[index]))
    // const matrix = this.metrics.confusionMatrix(evaluated, result.model.classes)

    const accuracy = evaluated.length ? correct / evaluated.length : null

    const predictionCounts = new Map()
    for (const prediction of result.predictions) {
      const label = prediction.predicted ?? '(sin predicción)'
      predictionCounts.set(label, (predictionCounts.get(label) ?? 0) + 1)
    }

    return {
      ...result,
      accuracy,
      correct,
      evaluatedCount: evaluated.length,
      predictionCounts,
      classList,
      confusionMatrix: matrix,
      precisions,
      recalls,
      f1Scores,
    }
  }
}
