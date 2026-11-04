import { DatasetService, getClassInfo } from './dataset.js'
import { AnalysisConfig, AnalysisService, NaiveBayesClassifier } from './analysis.js'
import { Metrics } from './metrics.js'
import { AppUI } from './ui.js'

export let dataset = null
export let testDataset = null
export let analysisRequest = null
let currentModel = null

const datasetService = new DatasetService()
const config = new AnalysisConfig()
const classifier = new NaiveBayesClassifier()
const analysisService = new AnalysisService({ config, classifier, metrics: Metrics })
const ui = new AppUI({
  onDatasetFile: handleDatasetFile,
  onTestFile: handleTestFile,
  onRemoveDatasetFile: handleRemoveDatasetFile,
  onToggleExternalTest: handleToggleExternalTest,
  onRemoveTestFile: handleRemoveTestFile,
  onClassPositionChange: handleClassPositionChange,
  onValidationMethodChange: handleValidationMethodChange,
  onDiscretizationMethodChange: handleDiscretizationMethodChange,
  onTrainingPercentageChange: handleTrainingPercentageChange,
  onStratifiedPercentageChange: handleStratifiedPercentageChange,
  onBinCountChange: handleBinCountChange,
  onAnalyze: handleAnalyze,
  onPredictInstance: handlePredictInstance,
})

async function handleDatasetFile(file) {
  ui.clearUploadError()

  try {
    const parsed = await datasetService.load(file)
    dataset = parsed
    currentModel = null
    ui.hideInstanceSection()
    ui.clearMetrics()
    console.log(dataset)
    const classInfo = getClassInfo(dataset, config.classPosition)
    console.log(classInfo)
    analysisService.previewDiscretization(dataset)
    ui.updateClassNote(dataset.getClassColumn(config.classPosition), classInfo)
    ui.updateContinuousNote(dataset)
    ui.renderDatasetFileMeta(dataset)

    if (testDataset && !dataset.hasSameHeaders(testDataset)) {
      testDataset = null
      config.setUseExternalTest(false)
      ui.setExternalTestEnabled(false)
      ui.showTestUploadError('El dataset cambió y las columnas del archivo de pruebas ya no coinciden.')
    }
  } catch (error) {
    ui.showUploadError(
      error instanceof Error
        ? error.message
        : 'No se pudo leer este archivo. Comprueba que sea un CSV o XLSX válido.',
    )
  }
}

async function handleTestFile(file) {
  ui.clearTestUploadError()

  if (!dataset) {
    ui.showTestUploadError('Carga primero el dataset principal para comparar las columnas.')
    return
  }

  try {
    const parsed = await datasetService.load(file)

    if (!dataset.hasSameHeaders(parsed)) {
      throw new Error('Las columnas del archivo de pruebas no coinciden con el dataset principal.')
    }

    testDataset = parsed
    console.log(testDataset)
    config.setUseExternalTest(true)
    ui.setExternalTestEnabled(true)
    ui.renderTestFileMeta(testDataset)
    ui.clearMetrics()
  } catch (error) {
    ui.showTestUploadError(
      error instanceof Error
        ? error.message
        : 'No se pudo leer el archivo de pruebas. Comprueba que sea un CSV o XLSX válido.',
    )
  }
}

function handleToggleExternalTest(enabled) {
  config.setUseExternalTest(enabled)
  if (!enabled) testDataset = null
  ui.setExternalTestEnabled(enabled)
  ui.clearMetrics()
}

function handleRemoveDatasetFile() {
  dataset = null
  testDataset = null
  analysisRequest = null
  currentModel = null
  config.setUseExternalTest(false)

  ui.clearDatasetFile()
  ui.setExternalTestEnabled(false)
  ui.clearTestUploadError()
  ui.updateClassNote(null)
  ui.updateContinuousNote(null)
  ui.hideSummary()
  ui.hideInstanceSection()
  ui.clearMetrics()
}

function handleRemoveTestFile() {
  testDataset = null
  config.setUseExternalTest(false)
  ui.setExternalTestEnabled(false)
  ui.clearMetrics()
}

function handleClassPositionChange(position) {
  config.setClassPosition(position)
  currentModel = null
  ui.hideInstanceSection()
  ui.clearMetrics()
  if (!dataset) return

  const classInfo = getClassInfo(dataset, position)
  ui.updateClassNote(dataset.getClassColumn(position), classInfo)
}

function handleValidationMethodChange(method) {
  config.setValidationMethod(method)
  ui.clearMetrics()
}

function handleDiscretizationMethodChange(method) {
  config.setDiscretizationMethod(method)
  ui.clearMetrics()
}

function handleTrainingPercentageChange(value) {
  config.setTrainingPercentage(value)
  ui.clearMetrics()
}

function handleStratifiedPercentageChange(value) {
  config.setStratifiedPercentage(value)
  ui.clearMetrics()
}

function handleBinCountChange(value) {
  config.setBinCount(value)
  ui.clearMetrics()
}

function handleAnalyze() {
  ui.hideSummary()
  currentModel = null
  ui.hideInstanceSection()
  ui.clearMetrics()

  if (!dataset) {
    ui.renderSummaryError('Carga un dataset antes de analizar.')
    return
  }

  if (config.useExternalTest && !testDataset) {
    ui.renderSummaryError('Selecciona un archivo de pruebas externo o desactiva esa opción.')
    return
  }

  analysisRequest = analysisService.buildRequest({ dataset, testDataset })
  console.log(analysisRequest)

  try {
    const result = analysisService.run(analysisRequest)
    console.log(result)
    ui.renderMetrics(result)
    currentModel = result.model
    ui.renderInstanceForm(dataset, currentModel)
  } catch (error) {
    ui.renderSummaryError(
      error instanceof Error ? error.message : 'No se pudo completar el análisis.',
    )
  }
}

function handlePredictInstance(instance) {
  if (!currentModel) {
    ui.showPredictionError('Ejecuta primero el análisis para entrenar el modelo.')
    return
  }

  try {
    console.log(currentModel)
    const prediction = classifier.predict(currentModel, instance)
    ui.renderPredictionResult(prediction)
  } catch (error) {
    ui.showPredictionError(
      error instanceof Error ? error.message : 'No se pudo predecir la instancia.',
    )
  }
}
