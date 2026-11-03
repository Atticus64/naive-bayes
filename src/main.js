import { DatasetService, getClassInfo } from './dataset.js'
import { AnalysisConfig, AnalysisService, NaiveBayesClassifier } from './analysis.js'
import { Metrics } from './metrics.js'
import { AppUI } from './ui.js'

export let dataset = null
export let testDataset = null
export let analysisRequest = null

const datasetService = new DatasetService()
const config = new AnalysisConfig()
const classifier = new NaiveBayesClassifier()
const analysisService = new AnalysisService({ config, classifier, metrics: Metrics })
const ui = new AppUI({
  onDatasetFile: handleDatasetFile,
  onTestFile: handleTestFile,
  onToggleExternalTest: handleToggleExternalTest,
  onRemoveTestFile: handleRemoveTestFile,
  onClassPositionChange: handleClassPositionChange,
  onValidationMethodChange: handleValidationMethodChange,
  onDiscretizationMethodChange: handleDiscretizationMethodChange,
  onTrainingPercentageChange: handleTrainingPercentageChange,
  onStratifiedPercentageChange: handleStratifiedPercentageChange,
  onBinCountChange: handleBinCountChange,
  onAnalyze: handleAnalyze,
})

async function handleDatasetFile(file) {
  ui.clearUploadError()

  try {
    const parsed = await datasetService.load(file)
    dataset = parsed
    console.log(dataset)
    const classInfo = getClassInfo(dataset, config.classPosition)
    console.log(classInfo)
    analysisService.previewDiscretization(dataset)
    ui.updateClassNote(dataset.getClassColumn(config.classPosition), classInfo)
    ui.updateContinuousNote(dataset)

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
}

function handleRemoveTestFile() {
  testDataset = null
  config.setUseExternalTest(false)
  ui.setExternalTestEnabled(false)
}

function handleClassPositionChange(position) {
  config.setClassPosition(position)
  if (!dataset) return

  const classInfo = getClassInfo(dataset, position)
  ui.updateClassNote(dataset.getClassColumn(position), classInfo)
}

function handleValidationMethodChange(method) {
  config.setValidationMethod(method)
}

function handleDiscretizationMethodChange(method) {
  config.setDiscretizationMethod(method)
}

function handleTrainingPercentageChange(value) {
  config.setTrainingPercentage(value)
}

function handleStratifiedPercentageChange(value) {
  config.setStratifiedPercentage(value)
}

function handleBinCountChange(value) {
  config.setBinCount(value)
}

function handleAnalyze() {
  ui.hideSummary()

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
  ui.renderSummary(analysisRequest)
}
