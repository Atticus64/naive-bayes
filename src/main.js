// import './style.css'
import * as XLSX from 'xlsx'

const fileInput = document.querySelector('#file-input')
const dropZone = document.querySelector('#drop-zone')
const uploadMessage = document.querySelector('#upload-message')
const browseButton = document.querySelector('#browse-button')

const useExternalTest = document.querySelector('#use-external-test')
const testPanel = document.querySelector('#test-file-panel')
const testDropZone = document.querySelector('#test-drop-zone')
const testFileInput = document.querySelector('#test-file-input')
const testBrowseButton = document.querySelector('#test-browse-button')
const testUploadMessage = document.querySelector('#test-upload-message')
const testFileMeta = document.querySelector('#test-file-meta')
const testFileLabel = document.querySelector('#test-file-name')
const removeTestFile = document.querySelector('#remove-test-file')
const testNote = document.querySelector('#test-note')

const validationFieldset = document.querySelector('#validation-fieldset')
const simplePercentageRow = document.querySelector('#simple-percentage-row')
const stratifiedPercentageRow = document.querySelector('#stratified-percentage-row')
const trainPercentageInput = document.querySelector('#train-percentage')
const stratifiedPercentageInput = document.querySelector('#stratified-percentage')
const simpleTestHint = document.querySelector('#simple-test-hint')
const stratifiedTestHint = document.querySelector('#stratified-test-hint')

const discretizationFieldset = document.querySelector('#discretization-fieldset')
const binCountInput = document.querySelector('#bin-count')
const continuousNote = document.querySelector('#continuous-note')

const analyzeButton = document.querySelector('#analyze-button')
const analysisSummary = document.querySelector('#analysis-summary')

export let dataset = { headers: [], rows: [] }
export let testDataset = null
export let analysisRequest = null

let mainFileName = ''
let testFileName = ''
let continuousColumns = []

const config = {
  useExternalTest: false,
  validationMethod: 'simple',
  trainingPercentage: 70,
  stratifiedPercentage: 70,
  discretizationMethod: 'equal-width',
  binCount: 5,
}

browseButton.addEventListener('click', () => fileInput.click())
testBrowseButton.addEventListener('click', () => testFileInput.click())

bindDropZone(dropZone, fileInput, loadDataset)
bindDropZone(testDropZone, testFileInput, loadTestDataset)

useExternalTest.addEventListener('change', () => {
  setExternalTestEnabled(useExternalTest.checked)
})

removeTestFile.addEventListener('click', () => {
  clearTestFile()
  setExternalTestEnabled(false)
})

document.querySelectorAll('input[name="validation-method"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    if (!radio.checked) return
    config.validationMethod = radio.value
    updateValidationVisibility()
  })
})

document.querySelectorAll('input[name="discretization-method"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    if (radio.checked) config.discretizationMethod = radio.value
  })
})

trainPercentageInput.addEventListener('input', () => {
  config.trainingPercentage = readPercentage(trainPercentageInput, 70)
  simpleTestHint.textContent = `Pruebas: ${100 - config.trainingPercentage}%`
})

trainPercentageInput.addEventListener('blur', () => {
  trainPercentageInput.value = String(config.trainingPercentage)
})

stratifiedPercentageInput.addEventListener('input', () => {
  config.stratifiedPercentage = readPercentage(stratifiedPercentageInput, 70)
  stratifiedTestHint.textContent = `Pruebas por clase: ${100 - config.stratifiedPercentage}%`
})

stratifiedPercentageInput.addEventListener('blur', () => {
  stratifiedPercentageInput.value = String(config.stratifiedPercentage)
})

binCountInput.addEventListener('input', () => {
  config.binCount = readBins(binCountInput)
})

binCountInput.addEventListener('blur', () => {
  binCountInput.value = String(config.binCount)
})

analyzeButton.addEventListener('click', analyze)

updateValidationVisibility()

function bindDropZone(zone, input, onFile) {
  zone.addEventListener('click', (event) => {
    if (event.target !== input && !event.target.closest('button')) input.click()
  })

  zone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      input.click()
    }
  })

  for (const eventName of ['dragenter', 'dragover']) {
    zone.addEventListener(eventName, (event) => {
      event.preventDefault()
      zone.classList.add('is-dragging')
    })
  }

  for (const eventName of ['dragleave', 'drop']) {
    zone.addEventListener(eventName, (event) => {
      event.preventDefault()
      zone.classList.remove('is-dragging')
    })
  }

  zone.addEventListener('drop', (event) => {
    const [file] = event.dataTransfer.files
    if (file) onFile(file)
  })

  input.addEventListener('change', () => {
    if (input.files[0]) onFile(input.files[0])
  })
}

/**
 * @param {{ headers: string[], rows: any[][] }} parsed
 */
function verificarDataset({ headers, rows }) {
  rows.forEach((row, rowIndex) => {
    if (row.length !== headers.length) {
      throw new Error(`La fila ${rowIndex + 1} tiene un número de columnas diferente al encabezado.`)
    }

    
  })
}

async function parseDatasetFile(file) {
  if (!/\.(csv|xlsx)$/i.test(file.name)) {
    throw new Error('Elige un archivo .csv o .xlsx.')
  }

  if (file.size > 20 * 1024 * 1024) {
    throw new Error('Este archivo supera el límite de 20 MB.')
  }

  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  const [headerRow = [], ...rows] = XLSX.utils.sheet_to_json(firstSheet, {
    header: 1,
    defval: '',
    blankrows: false,
  })
  const headers = headerRow.map((value, index) => String(value).trim() || `Columna ${index + 1}`)
  const populatedRows = rows.filter((row) => row.some((value) => String(value).trim() !== ''))

  if (!headers.length || !populatedRows.length) {
    throw new Error('El archivo seleccionado no contiene una fila de encabezados y datos.')
  }

  const tipos_atributos = headers.map((_, index) => {
    for (const row of populatedRows) {
      const value = row[index]
      console.log(value);
      if (value === '') continue
      return Number.isNaN(Number(value)) || typeof value == 'boolean' ? 'discreto' : 'continuo'
    }
  })

  const parsed = { headers, rows: populatedRows, tipos_atributos }
  verificarDataset(parsed)
  return parsed
}

function calcDiscretization(rows, columnIndex, type, bins) {

  if (type === 'equal-width') {

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

  } else if (type === 'equal-frequency') {
    const n = rows.length
    const sortedValues = rows.map((row) => Number(row[columnIndex])).filter((value) => !Number.isNaN(value)).sort((a, b) => a - b)
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

}

function checkInterval(value, interval) {
  return value >= interval.lowerBound && value <= interval.upperBound
}


function calcProbability(rows, type, columnIndex, discretization) {

  if (type === 'continuous') {
    // density function

    const values = rows.map((row) => Number(row[columnIndex])).filter((value) => !Number.isNaN(value))
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
    const stdDev = Math.sqrt(variance)
    return { mean, stdDev }
  } else if (type === 'discrete') {
    // by laplace
    const categories = new Map(rows.map((row) => row[columnIndex]));
    const no_categories = categories.size
    const counts = new Map()
    for (const row of rows) {
      const value = row[columnIndex]
      counts.set(value, (counts.get(value) || 0) + 1)
    }

    const prob = 1;
  }


}

async function loadDataset(file) {
  uploadMessage.textContent = ''

  try {
    const parsed = await parseDatasetFile(file)
    dataset = parsed
    mainFileName = file.name
    continuousColumns = detectContinuousColumns(parsed)
    console.log(dataset)
    // const intervals = calcDiscretization(dataset.rows, 1, 'equal-frequency', 5)
    const intervals = calcDiscretization(dataset.rows, 1, 'equal-width', 5)

    const intervalMap = new Map()
    for (let i = 0; i < dataset.rows.length; i++) {
      const value = Number(dataset.rows[i][1])
      const interval = intervals.find((int) => checkInterval(value, int))
      intervalMap.set(interval, (intervalMap.get(interval) || 0) + 1)
    }
    console.log('Intervalos:', intervals)
    console.log('Mapa de intervalos:', intervalMap)
    updateContinuousNote()

    if (testDataset && !headersMatch(testDataset.headers, dataset.headers)) {
      setExternalTestEnabled(false)
      testUploadMessage.textContent = 'El dataset cambió y las columnas del archivo de pruebas ya no coinciden.'
    }
  } catch (error) {
    uploadMessage.textContent = error instanceof Error
      ? error.message
      : 'No se pudo leer este archivo. Comprueba que sea un CSV o XLSX válido.'
  } finally {
    fileInput.value = ''
  }
}

async function loadTestDataset(file) {
  testUploadMessage.textContent = ''

  if (!dataset.headers.length) {
    testUploadMessage.textContent = 'Carga primero el dataset principal para comparar las columnas.'
    testFileInput.value = ''
    return
  }

  try {
    const parsed = await parseDatasetFile(file)

    if (!headersMatch(parsed.headers, dataset.headers)) {
      throw new Error('Las columnas del archivo de pruebas no coinciden con el dataset principal.')
    }

    testDataset = parsed
    testFileName = file.name
    console.log(testDataset)
    setExternalTestEnabled(true)
    renderTestFileMeta()
  } catch (error) {
    testUploadMessage.textContent = error instanceof Error
      ? error.message
      : 'No se pudo leer el archivo de pruebas. Comprueba que sea un CSV o XLSX válido.'
  } finally {
    testFileInput.value = ''
  }
}

function headersMatch(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function detectContinuousColumns({ rows }) {
  const firstRow = rows[0] ?? []
  return firstRow
    .map((value, index) => {
      const text = String(value).trim()
      return text !== '' && !Number.isNaN(Number(text)) ? index : null
    })
    .filter((index) => index !== null)
}

function updateContinuousNote() {
  if (!dataset.headers.length) {
    continuousNote.textContent = ''
    return
  }

  if (!continuousColumns.length) {
    continuousNote.textContent = 'No se detectaron atributos continuos en el dataset.'
    discretizationFieldset.disabled = true
    return
  }

  discretizationFieldset.disabled = false
  const names = continuousColumns.map((index) => dataset.headers[index]).join(', ')
  continuousNote.textContent = `Atributos continuos detectados: ${names}.`
}

function setExternalTestEnabled(enabled) {
  config.useExternalTest = enabled
  useExternalTest.checked = enabled
  testPanel.hidden = !enabled
  validationFieldset.disabled = enabled
  testNote.hidden = !enabled

  if (!enabled) clearTestFile()

  updateValidationVisibility()
}

function clearTestFile() {
  testDataset = null
  testFileName = ''
  testFileInput.value = ''
  testUploadMessage.textContent = ''
  testFileMeta.hidden = true
  testFileLabel.textContent = ''
}

function renderTestFileMeta() {
  testFileLabel.textContent = `${testFileName} · ${testDataset.rows.length.toLocaleString()} filas · ${testDataset.headers.length} columnas`
  testFileMeta.hidden = false
}

function updateValidationVisibility() {
  simplePercentageRow.hidden = config.validationMethod !== 'simple'
  stratifiedPercentageRow.hidden = config.validationMethod !== 'stratified'
}

function readPercentage(input, fallback) {
  const value = Number.parseInt(input.value, 10)
  if (Number.isNaN(value)) return fallback
  return Math.min(99, Math.max(1, value))
}

function readBins(input) {
  const value = Number.parseInt(input.value, 10)
  if (Number.isNaN(value)) return 5
  return Math.min(50, Math.max(2, value))
}

function analyze() {
  analysisSummary.hidden = true

  if (!dataset.headers.length) {
    renderSummaryError('Carga un dataset antes de analizar.')
    return
  }

  if (config.useExternalTest && !testDataset) {
    renderSummaryError('Selecciona un archivo de pruebas externo o desactiva esa opción.')
    return
  }

  analysisRequest = {
    dataset: {
      fileName: mainFileName,
      headers: dataset.headers,
      rows: dataset.rows,
    },
    testDataset: testDataset
      ? {
          fileName: testFileName,
          headers: testDataset.headers,
          rows: testDataset.rows,
        }
      : null,
    validation: buildValidationConfig(),
    discretization: {
      method: config.discretizationMethod,
      bins: config.binCount,
    },
  }

  console.log(analysisRequest)
  renderSummary()
}

function buildValidationConfig() {
  if (config.useExternalTest) {
    return {
      method: 'external',
      trainingPercentage: 100,
      testPercentage: 0,
      stratifiedPercentage: null,
    }
  }

  if (config.validationMethod === 'cross') {
    return {
      method: 'cross',
      trainingPercentage: 50,
      testPercentage: 50,
      stratifiedPercentage: null,
    }
  }

  if (config.validationMethod === 'stratified') {
    return {
      method: 'stratified',
      trainingPercentage: config.stratifiedPercentage,
      testPercentage: 100 - config.stratifiedPercentage,
      stratifiedPercentage: config.stratifiedPercentage,
    }
  }

  return {
    method: 'simple',
    trainingPercentage: config.trainingPercentage,
    testPercentage: 100 - config.trainingPercentage,
    stratifiedPercentage: null,
  }
}

function renderSummary() {
  const methodLabels = {
    simple: 'Validación simple',
    cross: 'Validación cruzada (50%–50%)',
    stratified: 'Selección aleatoria estratificada',
    external: 'Archivo de pruebas externo',
  }
  const discretizationLabels = {
    density: 'Por función de densidad',
    'equal-frequency': 'Intervalos de frecuencia iguales',
    'equal-width': 'Intervalos de ancho igual',
  }

  analysisSummary.replaceChildren()

  const title = document.createElement('h2')
  title.textContent = 'Configuración del análisis'

  const list = document.createElement('dl')
  appendSummaryItem(
    list,
    'Dataset',
    `${mainFileName} · ${dataset.rows.length.toLocaleString()} filas · ${dataset.headers.length} columnas`,
  )

  if (testDataset) {
    appendSummaryItem(
      list,
      'Pruebas',
      `${testFileName} · ${testDataset.rows.length.toLocaleString()} filas · ${testDataset.headers.length} columnas`,
    )
  }

  const { validation } = analysisRequest
  appendSummaryItem(list, 'Validación', methodLabels[validation.method])

  if (validation.method !== 'external' && validation.method !== 'cross') {
    appendSummaryItem(list, 'Entrenamiento', `${validation.trainingPercentage}%`)
    appendSummaryItem(list, 'Pruebas', `${validation.testPercentage}%`)
  }

  appendSummaryItem(list, 'Discretización', discretizationLabels[analysisRequest.discretization.method])
  appendSummaryItem(list, 'Intervalos', String(analysisRequest.discretization.bins))

  analysisSummary.append(title, list)
  analysisSummary.hidden = false
}

function appendSummaryItem(list, term, description) {
  const dt = document.createElement('dt')
  dt.textContent = term
  const dd = document.createElement('dd')
  dd.textContent = description
  list.append(dt, dd)
}

function renderSummaryError(message) {
  analysisSummary.replaceChildren()
  const paragraph = document.createElement('p')
  paragraph.className = 'summary-error'
  paragraph.textContent = message
  analysisSummary.append(paragraph)
  analysisSummary.hidden = false
}
