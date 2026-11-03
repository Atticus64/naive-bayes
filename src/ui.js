export class AppUI {
  constructor(handlers) {
    this.handlers = handlers
    this.validationMethod = 'simple'
    this.elements = {
      fileInput: document.querySelector('#file-input'),
      dropZone: document.querySelector('#drop-zone'),
      uploadMessage: document.querySelector('#upload-message'),
      browseButton: document.querySelector('#browse-button'),

      classNote: document.querySelector('#class-note'),
      classRadios: document.querySelectorAll('input[name="class-position"]'),

      useExternalTest: document.querySelector('#use-external-test'),
      testPanel: document.querySelector('#test-file-panel'),
      testDropZone: document.querySelector('#test-drop-zone'),
      testFileInput: document.querySelector('#test-file-input'),
      testBrowseButton: document.querySelector('#test-browse-button'),
      testUploadMessage: document.querySelector('#test-upload-message'),
      testFileMeta: document.querySelector('#test-file-meta'),
      testFileLabel: document.querySelector('#test-file-name'),
      removeTestFile: document.querySelector('#remove-test-file'),
      testNote: document.querySelector('#test-note'),

      validationFieldset: document.querySelector('#validation-fieldset'),
      simplePercentageRow: document.querySelector('#simple-percentage-row'),
      stratifiedPercentageRow: document.querySelector('#stratified-percentage-row'),
      trainPercentageInput: document.querySelector('#train-percentage'),
      stratifiedPercentageInput: document.querySelector('#stratified-percentage'),
      simpleTestHint: document.querySelector('#simple-test-hint'),
      stratifiedTestHint: document.querySelector('#stratified-test-hint'),
      validationRadios: document.querySelectorAll('input[name="validation-method"]'),

      discretizationFieldset: document.querySelector('#discretization-fieldset'),
      binCountInput: document.querySelector('#bin-count'),
      continuousNote: document.querySelector('#continuous-note'),
      discretizationRadios: document.querySelectorAll('input[name="discretization-method"]'),

      analyzeButton: document.querySelector('#analyze-button'),
      analysisSummary: document.querySelector('#analysis-summary'),
    }

    this.bindEvents()
    this.updateValidationVisibility('simple')
  }

  bindEvents() {
    const { elements, handlers } = this

    elements.browseButton.addEventListener('click', () => elements.fileInput.click())
    elements.testBrowseButton.addEventListener('click', () => elements.testFileInput.click())

    this.bindDropZone(elements.dropZone, elements.fileInput, (file) => handlers.onDatasetFile(file))
    this.bindDropZone(elements.testDropZone, elements.testFileInput, (file) => handlers.onTestFile(file))

    elements.useExternalTest.addEventListener('change', () => {
      handlers.onToggleExternalTest(elements.useExternalTest.checked)
    })

    elements.removeTestFile.addEventListener('click', () => {
      handlers.onRemoveTestFile()
    })

    elements.classRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        if (radio.checked) handlers.onClassPositionChange(radio.value)
      })
    })

    elements.validationRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        if (!radio.checked) return
        this.updateValidationVisibility(radio.value)
        handlers.onValidationMethodChange(radio.value)
      })
    })

    elements.discretizationRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        if (radio.checked) handlers.onDiscretizationMethodChange(radio.value)
      })
    })

    elements.trainPercentageInput.addEventListener('input', () => {
      const value = this.readPercentage(elements.trainPercentageInput, 70)
      elements.simpleTestHint.textContent = `Pruebas: ${100 - value}%`
      handlers.onTrainingPercentageChange(value)
    })

    elements.trainPercentageInput.addEventListener('blur', () => {
      elements.trainPercentageInput.value = String(this.readPercentage(elements.trainPercentageInput, 70))
    })

    elements.stratifiedPercentageInput.addEventListener('input', () => {
      const value = this.readPercentage(elements.stratifiedPercentageInput, 70)
      elements.stratifiedTestHint.textContent = `Pruebas por clase: ${100 - value}%`
      handlers.onStratifiedPercentageChange(value)
    })

    elements.stratifiedPercentageInput.addEventListener('blur', () => {
      elements.stratifiedPercentageInput.value = String(this.readPercentage(elements.stratifiedPercentageInput, 70))
    })

    elements.binCountInput.addEventListener('input', () => {
      handlers.onBinCountChange(this.readBins(elements.binCountInput))
    })

    elements.binCountInput.addEventListener('blur', () => {
      elements.binCountInput.value = String(this.readBins(elements.binCountInput))
    })

    elements.analyzeButton.addEventListener('click', () => handlers.onAnalyze())
  }

  bindDropZone(zone, input, onFile) {
    const handleFile = async (file) => {
      try {
        await onFile(file)
      } catch (error) {
        console.error(error)
      } finally {
        input.value = ''
      }
    }

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
      if (file) handleFile(file)
    })

    input.addEventListener('change', () => {
      if (input.files[0]) handleFile(input.files[0])
    })
  }

  showUploadError(message) {
    this.elements.uploadMessage.textContent = message
  }

  clearUploadError() {
    this.elements.uploadMessage.textContent = ''
  }

  showTestUploadError(message) {
    this.elements.testUploadMessage.textContent = message
  }

  clearTestUploadError() {
    this.elements.testUploadMessage.textContent = ''
  }

  setExternalTestEnabled(enabled) {
    const { elements } = this

    elements.useExternalTest.checked = enabled
    elements.testPanel.hidden = !enabled
    elements.validationFieldset.disabled = enabled
    elements.testNote.hidden = !enabled

    if (!enabled) this.clearTestFile()

    this.updateValidationVisibility()
  }

  clearTestFile() {
    const { elements } = this

    elements.testFileInput.value = ''
    elements.testUploadMessage.textContent = ''
    elements.testFileMeta.hidden = true
    elements.testFileLabel.textContent = ''
  }

  renderTestFileMeta(dataset) {
    this.elements.testFileLabel.textContent = `${dataset.fileName} · ${dataset.rowCount.toLocaleString()} filas · ${dataset.columnCount} columnas`
    this.elements.testFileMeta.hidden = false
  }

  updateValidationVisibility(method = this.validationMethod) {
    this.validationMethod = method
    this.elements.simplePercentageRow.hidden = method !== 'simple'
    this.elements.stratifiedPercentageRow.hidden = method !== 'stratified'
  }

  updateClassNote(classColumn, classInfo) {
    const { classNote } = this.elements

    if (!classColumn || !classColumn.name) {
      classNote.textContent = ''
      return
    }

    const positionLabel = classColumn.position === 'first' ? 'al inicio' : 'al final'
    const count = classInfo?.count ?? 0
    const classList = classInfo?.classes?.length
      ? classInfo.classes.map(String).join(', ')
      : 'sin clases'
    classNote.textContent = `Clase identificada: ${classColumn.name} (columna ${classColumn.index + 1}, ${positionLabel}). ${count} ${count === 1 ? 'clase' : 'clases'}: ${classList}.`
  }

  updateContinuousNote(dataset) {
    const { continuousNote, discretizationFieldset } = this.elements

    if (!dataset || !dataset.headers.length) {
      continuousNote.textContent = ''
      return
    }

    if (!dataset.continuousColumns.length) {
      continuousNote.textContent = 'No se detectaron atributos continuos en el dataset.'
      discretizationFieldset.disabled = true
      return
    }

    discretizationFieldset.disabled = false
    const names = dataset.continuousColumns.map((index) => dataset.headers[index]).join(', ')
    continuousNote.textContent = `Atributos continuos detectados: ${names}.`
  }

  setTrainingPercentage(value) {
    this.elements.trainPercentageInput.value = String(value)
    this.elements.simpleTestHint.textContent = `Pruebas: ${100 - value}%`
  }

  setStratifiedPercentage(value) {
    this.elements.stratifiedPercentageInput.value = String(value)
    this.elements.stratifiedTestHint.textContent = `Pruebas por clase: ${100 - value}%`
  }

  setBinCount(value) {
    this.elements.binCountInput.value = String(value)
  }

  readPercentage(input, fallback) {
    const value = Number.parseInt(input.value, 10)
    if (Number.isNaN(value)) return fallback
    return Math.min(99, Math.max(1, value))
  }

  readBins(input) {
    const value = Number.parseInt(input.value, 10)
    if (Number.isNaN(value)) return 5
    return Math.min(50, Math.max(2, value))
  }

  hideSummary() {
    this.elements.analysisSummary.hidden = true
  }

  renderSummary(request) {
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

    const { analysisSummary } = this.elements
    analysisSummary.replaceChildren()

    const title = document.createElement('h2')
    title.textContent = 'Configuración del análisis'

    const list = document.createElement('dl')
    this.appendSummaryItem(
      list,
      'Dataset',
      `${request.dataset.fileName} · ${request.dataset.rows.length.toLocaleString()} filas · ${request.dataset.headers.length} columnas`,
    )

    if (request.testDataset) {
      this.appendSummaryItem(
        list,
        'Pruebas',
        `${request.testDataset.fileName} · ${request.testDataset.rows.length.toLocaleString()} filas · ${request.testDataset.headers.length} columnas`,
      )
    }

    this.appendSummaryItem(
      list,
      'Clase',
      `${request.classColumn.name} (columna ${request.classColumn.index + 1})`,
    )

    const { validation } = request
    this.appendSummaryItem(list, 'Validación', methodLabels[validation.method])

    if (validation.method !== 'external' && validation.method !== 'cross') {
      this.appendSummaryItem(list, 'Entrenamiento', `${validation.trainingPercentage}%`)
      this.appendSummaryItem(list, 'Pruebas', `${validation.testPercentage}%`)
    }

    this.appendSummaryItem(list, 'Discretización', discretizationLabels[request.discretization.method])
    this.appendSummaryItem(list, 'Intervalos', String(request.discretization.bins))

    analysisSummary.append(title, list)
    analysisSummary.hidden = false
  }

  appendSummaryItem(list, term, description) {
    const dt = document.createElement('dt')
    dt.textContent = term
    const dd = document.createElement('dd')
    dd.textContent = description
    list.append(dt, dd)
  }

  renderSummaryError(message) {
    const { analysisSummary } = this.elements
    analysisSummary.replaceChildren()
    const paragraph = document.createElement('p')
    paragraph.className = 'summary-error'
    paragraph.textContent = message
    analysisSummary.append(paragraph)
    analysisSummary.hidden = false
  }
}
