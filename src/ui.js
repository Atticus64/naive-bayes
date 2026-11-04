import CanvasJS from '@canvasjs/charts'

export class AppUI {
  constructor(handlers) {
    this.handlers = handlers
    this.validationMethod = 'simple'
    this.elements = {
      fileInput: document.querySelector('#file-input'),
      dropZone: document.querySelector('#drop-zone'),
      uploadMessage: document.querySelector('#upload-message'),
      browseButton: document.querySelector('#browse-button'),
      datasetFileMeta: document.querySelector('#dataset-file-meta'),
      datasetFileLabel: document.querySelector('#dataset-file-name'),
      removeDatasetFile: document.querySelector('#remove-dataset-file'),

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

      instanceSection: document.querySelector('#instance-section'),
      instanceForm: document.querySelector('#instance-form'),
      predictButton: document.querySelector('#predict-button'),
      predictionResult: document.querySelector('#prediction-result'),
      metricsContainer: document.querySelector('#metrics_container'),
      tableContainer: document.querySelector('#table_container'),
      chartContainer: document.querySelector('#chartContainer'),
    }

    this.instanceFields = []
    this.instanceColumnCount = 0

    this.bindEvents()
    this.updateValidationVisibility('simple')
  }

  bindEvents() {
    const { elements, handlers } = this

    elements.browseButton.addEventListener('click', () => elements.fileInput.click())
    elements.testBrowseButton.addEventListener('click', () => elements.testFileInput.click())

    elements.removeDatasetFile.addEventListener('click', () => {
      handlers.onRemoveDatasetFile()
    })

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

    elements.predictButton.addEventListener('click', () => {
      handlers.onPredictInstance(this.readInstance())
    })
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

  renderDatasetFileMeta(dataset) {
    this.elements.datasetFileLabel.textContent = `Cargado: ${dataset.fileName} · ${dataset.rowCount.toLocaleString()} filas · ${dataset.columnCount} columnas`
    this.elements.datasetFileMeta.hidden = false
    this.elements.dropZone.classList.add('is-loaded')
  }

  clearDatasetFile() {
    const { elements } = this

    elements.fileInput.value = ''
    elements.uploadMessage.textContent = ''
    elements.datasetFileMeta.hidden = true
    elements.datasetFileLabel.textContent = ''
    elements.dropZone.classList.remove('is-loaded')
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
      discretizationFieldset.disabled = false
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

  renderResults(result) {
    const { analysisSummary } = this.elements

    const title = document.createElement('h2')
    title.textContent = 'Resultados del análisis'

    const list = document.createElement('dl')
    this.appendSummaryItem(
      list,
      'Entrenamiento',
      `${result.trainingCount.toLocaleString()} filas`,
    )
    this.appendSummaryItem(list, 'Pruebas', `${result.testCount.toLocaleString()} filas`)
    this.appendSummaryItem(list, 'Clases', String(result.model.classes.length))

    if (result.evaluatedCount > 0) {
      this.appendSummaryItem(list, 'Aciertos', `${result.correct} de ${result.evaluatedCount}`)
      this.appendSummaryItem(list, 'Precisión', `${(result.accuracy * 100).toFixed(2)}%`)
    } else {
      this.appendSummaryItem(list, 'Precisión', 'No evaluable sin clase real')
    }

    const predictions = [...result.predictionCounts.entries()]
      .map(([label, count]) => `${label}: ${count}`)
      .join(' · ')
    this.appendSummaryItem(list, 'Predicciones', predictions || 'Sin predicciones')

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

  renderInstanceForm(dataset, model) {
    const { instanceSection, instanceForm, predictionResult } = this.elements

    instanceForm.replaceChildren()
    predictionResult.replaceChildren()
    predictionResult.hidden = true
    this.instanceFields = []
    this.instanceColumnCount = dataset.headers.length

    for (const attribute of model.attributes) {
      const header = dataset.headers[attribute.index] ?? `Columna ${attribute.index + 1}`
      const type = String(attribute.type ?? '').toLowerCase()
      const isContinuous = type === 'continuo' || type === 'continuous'

      const field = document.createElement('label')
      field.className = 'instance-field'

      const label = document.createElement('span')
      label.className = 'instance-label'
      const name = document.createElement('span')
      name.textContent = header
      label.append(name)

      let control
      if (isContinuous) {
        const stats = this.continuousStats(dataset.rows, attribute.index)
        control = document.createElement('input')
        control.type = 'number'
        control.step = 'any'
        control.value = stats.mean === null ? '' : String(Math.round(stats.mean * 100) / 100)
        control.placeholder = 'Valor'

        const hint = document.createElement('span')
        hint.className = 'instance-hint'
        hint.textContent =
          stats.min === null ? 'sin datos' : `${stats.min} – ${stats.max}`
        label.append(hint)
      } else {
        control = document.createElement('select')
        for (const value of this.discreteValues(dataset.rows, attribute.index)) {
          const option = document.createElement('option')
          option.value = value
          option.textContent = value
          control.append(option)
        }
        // const missing = document.createElement('option')
        // missing.value = ''
        // missing.textContent = '(vacío)'
        // control.append(missing)
      }

      field.append(label, control)
      instanceForm.append(field)
      this.instanceFields.push({ index: attribute.index, element: control })
    }

    instanceSection.hidden = false
  }

  discreteValues(rows, columnIndex) {
    const values = []
    const seen = new Set()

    for (const row of rows) {
      const raw = row[columnIndex]
      if (raw === '' || raw == null) continue
      const value = String(raw).trim()
      if (!value || seen.has(value)) continue
      seen.add(value)
      values.push(value)
    }

    return values
  }

  continuousStats(rows, columnIndex) {
    let min = null
    let max = null
    let sum = 0
    let count = 0

    for (const row of rows) {
      const raw = row[columnIndex]
      if (raw === '' || raw == null) continue
      const value = Number(raw)
      if (Number.isNaN(value)) continue

      min = min === null ? value : Math.min(min, value)
      max = max === null ? value : Math.max(max, value)
      sum += value
      count += 1
    }

    return { min, max, mean: count ? sum / count : null }
  }

  readInstance() {
    const instance = new Array(this.instanceColumnCount).fill('')
    for (const field of this.instanceFields) {
      instance[field.index] = field.element.value
    }
    return instance
  }

  renderPredictionResult({ predicted, probabilities }) {
    const { predictionResult } = this.elements

    predictionResult.replaceChildren()

    const title = document.createElement('h2')
    title.textContent = 'Predicción de la instancia'

    const paragraph = document.createElement('p')
    paragraph.className = 'prediction-class'
    paragraph.append('Clase estimada: ')
    const highlight = document.createElement('strong')
    highlight.textContent = predicted ?? '(sin predicción)'
    paragraph.append(highlight)

    const list = document.createElement('dl')
    const sorted = [...probabilities.entries()].sort((a, b) => b[1] - a[1])
    for (const [label, probability] of sorted) {
      this.appendSummaryItem(list, label, `${(probability * 100).toFixed(2)}%`)
    }

    predictionResult.append(title, paragraph, list)
    predictionResult.hidden = false
  }

  renderMetrics(result) {
    const { metricsContainer, tableContainer, chartContainer } = this.elements
    const { classList, confusionMatrix, precisions, recalls, f1Scores, accuracy } = result

    if (metricsContainer) {
      const matrixHtml = `
        <div>
          <p>Accuracy: ${accuracy !== null ? accuracy.toFixed(4) : 'N/A'}</p>
        </div>
        <table>
          <thead>
            <tr class="table-header">
              <th>Clase</th>
              ${classList.map((v) => `<th>${v}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${classList
              .map(
                (actualClass, rowIndex) => `
              <tr>
                <td>${actualClass}</td>
                ${confusionMatrix[rowIndex].map((count) => `<td>${count}</td>`).join('')}
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
      `
      metricsContainer.innerHTML = matrixHtml
    }

    if (tableContainer) {
      const tableHtml = `
        <table>
          <thead>
            <tr class="table-header">
              <th>Clase</th>
              <th>Precisión</th>
              <th>Recall</th>
              <th>F1</th>
            </tr>
          </thead>
          <tbody>
            ${classList
              .map(
                (classValue, index) => `
              <tr>
                <td>${classValue}</td>
                <td>${precisions[index] !== null ? precisions[index].toFixed(4) : 'N/A'}</td>
                <td>${recalls[index] !== null ? recalls[index].toFixed(4) : 'N/A'}</td>
                <td>${f1Scores[index] !== null ? f1Scores[index].toFixed(4) : 'N/A'}</td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
      `
      tableContainer.innerHTML = tableHtml
    }

    if (chartContainer) {
      const data = [
        ...classList.map((classValue, index) => ({
          label: `precision ${classValue}`,
          y: precisions[index] !== null ? precisions[index] : 0,
        })),
        ...classList.map((classValue, index) => ({
          label: `recall ${classValue}`,
          y: recalls[index] !== null ? recalls[index] : 0,
        })),
        ...classList.map((classValue, index) => ({
          label: `f1 ${classValue}`,
          y: f1Scores[index] !== null ? f1Scores[index] : 0,
        })),
      ]

      const chart = new CanvasJS.Chart('chartContainer', {
        animationEnabled: true,
        exportEnabled: true,
        theme: 'light1',
        title: { text: 'Medidas de desempeño por clase' },
        axisY: { includeZero: true },
        data: [{ type: 'column', indexLabelFontColor: '#5A5757', indexLabelFontSize: 16, indexLabelPlacement: 'outside', dataPoints: data }],
      })
      chart.render()
    }
  }
  showPredictionError(message) {
    const { predictionResult } = this.elements

    predictionResult.replaceChildren()
    const paragraph = document.createElement('p')
    paragraph.className = 'summary-error'
    paragraph.textContent = message
    predictionResult.append(paragraph)
    predictionResult.hidden = false
  }

  hideInstanceSection() {
    const { instanceSection, instanceForm, predictionResult } = this.elements

    instanceSection.hidden = true
    instanceForm.replaceChildren()
    predictionResult.replaceChildren()
    predictionResult.hidden = true
    this.instanceFields = []
    this.instanceColumnCount = 0
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
