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
      metricsSection: document.querySelector('#metrics-section'),
      metricsKpis: document.querySelector('#metrics-kpis'),
      metricsGrid: document.querySelector('#metrics-grid'),
      metricsMatrix: document.querySelector('#metrics-matrix'),
      metricsTable: document.querySelector('#metrics-table'),
      metricsChartPanel: document.querySelector('#metrics-chart-panel'),
      chartContainer: document.querySelector('#chartContainer'),
    }

    this.instanceFields = []
    this.instanceColumnCount = 0
    this.metricsChart = null
    this.percentFormatters = new Map()

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
    const {
      metricsSection,
      metricsKpis,
      metricsGrid,
      metricsMatrix,
      metricsTable,
      metricsChartPanel,
    } = this.elements

    if (!metricsSection) return

    const {
      classList,
      confusionMatrix,
      precisions,
      recalls,
      f1Scores,
      accuracy,
      correct,
      evaluatedCount,
    } = result
    const supports =
      result.supports ?? confusionMatrix.map((row) => row.reduce((sum, count) => sum + count, 0))
    const macroPrecision = result.macroPrecision ?? this.macroAverage(precisions)
    const macroRecall = result.macroRecall ?? this.macroAverage(recalls)
    const macroF1 = result.macroF1 ?? this.macroAverage(f1Scores)

    this.destroyMetricsChart()
    metricsKpis.replaceChildren()
    metricsMatrix.replaceChildren()
    metricsTable.replaceChildren()

    if (!evaluatedCount) {
      const empty = document.createElement('p')
      empty.className = 'metrics-empty'
      empty.textContent =
        'No hay instancias evaluables: el conjunto de pruebas no contiene clases reales o no se generaron predicciones.'
      metricsKpis.append(empty)
      if (metricsGrid) metricsGrid.hidden = true
      if (metricsChartPanel) metricsChartPanel.hidden = true
      metricsSection.hidden = false
      return
    }

    if (metricsGrid) metricsGrid.hidden = false
    if (metricsChartPanel) metricsChartPanel.hidden = false
    metricsSection.hidden = false

    this.renderMetricCards({
      accuracy,
      macroPrecision,
      macroRecall,
      macroF1,
      correct,
      evaluatedCount,
    })
    this.renderConfusionMatrix({ classList, confusionMatrix, supports, evaluatedCount })
    this.renderClassMetricsTable({
      classList,
      precisions,
      recalls,
      f1Scores,
      supports,
      macroPrecision,
      macroRecall,
      macroF1,
      evaluatedCount,
    })
    this.renderMetricsChart({ classList, precisions, recalls, f1Scores })
  }

  renderMetricCards({ accuracy, macroPrecision, macroRecall, macroF1, correct, evaluatedCount }) {
    const { metricsKpis } = this.elements
    const cards = [
      {
        label: 'Exactitud',
        value: accuracy,
        detail: `${correct} de ${evaluatedCount} aciertos`,
        primary: true,
      },
      { label: 'Precisión macro', value: macroPrecision, detail: 'Promedio por clase' },
      { label: 'Recall macro', value: macroRecall, detail: 'Promedio por clase' },
      { label: 'F1 macro', value: macroF1, detail: 'Media armónica' },
    ]

    for (const card of cards) {
      const article = document.createElement('article')
      article.className = 'metric-card'
      if (card.primary) article.classList.add('metric-card--primary')

      const label = document.createElement('span')
      label.className = 'metric-label'
      label.textContent = card.label

      const value = document.createElement('strong')
      value.className = 'metric-value'
      value.textContent = this.formatPercent(card.value, 1)

      const detail = document.createElement('span')
      detail.className = 'metric-detail'
      detail.textContent = card.value === null ? 'Sin datos evaluables' : card.detail

      article.append(label, value, detail)
      metricsKpis.append(article)
    }
  }

  renderConfusionMatrix({ classList, confusionMatrix, supports, evaluatedCount }) {
    const { metricsMatrix } = this.elements
    const table = document.createElement('table')
    table.className = 'confusion-matrix'

    const caption = document.createElement('caption')
    caption.className = 'visually-hidden'
    caption.textContent =
      'Matriz de confusión: las filas representan la clase real y las columnas la clase predicha.'
    table.append(caption)

    const thead = document.createElement('thead')
    const headRow = document.createElement('tr')
    const corner = document.createElement('th')
    corner.scope = 'col'
    corner.className = 'matrix-corner'
    corner.textContent = 'Real \\ Predicha'
    headRow.append(corner)

    for (const classValue of classList) {
      const header = document.createElement('th')
      header.scope = 'col'
      header.className = 'matrix-class-header'
      header.textContent = String(classValue)
      headRow.append(header)
    }

    const totalHeader = document.createElement('th')
    totalHeader.scope = 'col'
    totalHeader.textContent = 'Total real'
    headRow.append(totalHeader)
    thead.append(headRow)
    table.append(thead)

    const tbody = document.createElement('tbody')
    const columnTotals = new Array(classList.length).fill(0)

    classList.forEach((actualClass, rowIndex) => {
      const row = document.createElement('tr')

      const rowHeader = document.createElement('th')
      rowHeader.scope = 'row'
      rowHeader.className = 'matrix-row-header'
      rowHeader.textContent = String(actualClass)
      row.append(rowHeader)

      const rowTotal = supports[rowIndex] ?? 0

      classList.forEach((predictedClass, columnIndex) => {
        const count = confusionMatrix[rowIndex][columnIndex]
        columnTotals[columnIndex] += count
        const isCorrect = rowIndex === columnIndex
        const cell = document.createElement('td')
        let cellState = 'matrix-cell--zero'
        if (count > 0) cellState = isCorrect ? 'matrix-cell--correct' : 'matrix-cell--error'
        cell.className = `matrix-cell ${cellState}`

        if (count > 0 && rowTotal > 0) {
          const share = count / rowTotal
          const heat = Math.max(12, Math.min(60, Math.round(share * 60)))
          cell.style.setProperty('--heat', `${heat}%`)
          cell.title = `${count} de ${rowTotal} (${this.formatPercent(share, 1)}) instancias reales de ${actualClass} ${
            isCorrect ? 'clasificadas correctamente' : `predichas como ${predictedClass}`
          }.`
        } else {
          cell.title = `Sin instancias reales de ${actualClass} predichas como ${predictedClass}.`
        }

        const countLabel = document.createElement('span')
        countLabel.className = 'matrix-count'
        countLabel.textContent = this.formatCount(count)
        cell.append(countLabel)

        if (count > 0 && rowTotal > 0) {
          const shareLabel = document.createElement('span')
          shareLabel.className = 'matrix-share'
          shareLabel.textContent = this.formatPercent(count / rowTotal, 0)
          cell.append(shareLabel)
        }

        row.append(cell)
      })

      const totalCell = document.createElement('td')
      totalCell.className = 'matrix-total'
      totalCell.textContent = this.formatCount(rowTotal)
      row.append(totalCell)
      tbody.append(row)
    })

    table.append(tbody)

    const tfoot = document.createElement('tfoot')
    const totalRow = document.createElement('tr')
    totalRow.className = 'matrix-total-row'

    const totalRowHeader = document.createElement('th')
    totalRowHeader.scope = 'row'
    totalRowHeader.textContent = 'Total predicho'
    totalRow.append(totalRowHeader)

    for (const total of columnTotals) {
      const cell = document.createElement('td')
      cell.textContent = this.formatCount(total)
      totalRow.append(cell)
    }

    const grandTotal = document.createElement('td')
    grandTotal.textContent = this.formatCount(evaluatedCount)
    totalRow.append(grandTotal)
    tfoot.append(totalRow)
    table.append(tfoot)

    metricsMatrix.append(table)
  }

  renderClassMetricsTable({
    classList,
    precisions,
    recalls,
    f1Scores,
    supports,
    macroPrecision,
    macroRecall,
    macroF1,
    evaluatedCount,
  }) {
    const { metricsTable } = this.elements
    const table = document.createElement('table')
    table.className = 'class-metrics'

    const caption = document.createElement('caption')
    caption.className = 'visually-hidden'
    caption.textContent =
      'Precisión, recall, F1 y soporte por clase, con el promedio macro al final.'
    table.append(caption)

    const thead = document.createElement('thead')
    const headRow = document.createElement('tr')
    for (const title of ['Clase', 'Precisión', 'Recall', 'F1', 'Soporte']) {
      const header = document.createElement('th')
      header.scope = 'col'
      header.textContent = title
      headRow.append(header)
    }
    thead.append(headRow)
    table.append(thead)

    const tbody = document.createElement('tbody')
    classList.forEach((classValue, index) => {
      const row = document.createElement('tr')

      const rowHeader = document.createElement('th')
      rowHeader.scope = 'row'
      rowHeader.className = 'class-name'
      rowHeader.textContent = String(classValue)
      row.append(rowHeader)

      row.append(
        this.createMetricCell(precisions[index], 'precision'),
        this.createMetricCell(recalls[index], 'recall'),
        this.createMetricCell(f1Scores[index], 'f1'),
      )

      const supportCell = document.createElement('td')
      supportCell.className = 'metric-support'
      supportCell.textContent = this.formatCount(supports[index] ?? 0)
      row.append(supportCell)

      tbody.append(row)
    })
    table.append(tbody)

    const tfoot = document.createElement('tfoot')
    const macroRow = document.createElement('tr')

    const macroHeader = document.createElement('th')
    macroHeader.scope = 'row'
    macroHeader.textContent = 'Promedio macro'
    macroRow.append(macroHeader)

    macroRow.append(
      this.createMetricCell(macroPrecision, 'precision', { bar: false }),
      this.createMetricCell(macroRecall, 'recall', { bar: false }),
      this.createMetricCell(macroF1, 'f1', { bar: false }),
    )

    const totalSupport = document.createElement('td')
    totalSupport.className = 'metric-support'
    totalSupport.textContent = this.formatCount(evaluatedCount)
    macroRow.append(totalSupport)

    tfoot.append(macroRow)
    table.append(tfoot)

    metricsTable.append(table)
  }

  createMetricCell(value, variant, { bar = true } = {}) {
    const cell = document.createElement('td')
    cell.className = 'metric-cell'

    const number = document.createElement('span')
    number.className = 'metric-number'

    if (value === null || value === undefined || !Number.isFinite(value)) {
      cell.classList.add('is-null')
      number.textContent = '—'
      cell.title = 'No calculable con los datos actuales.'
    } else {
      number.textContent = this.formatPercent(value, 2)
    }
    cell.append(number)

    if (bar && value !== null && Number.isFinite(value)) {
      const barElement = document.createElement('span')
      barElement.className = 'metric-bar'
      barElement.setAttribute('aria-hidden', 'true')

      const fill = document.createElement('span')
      fill.className = `metric-bar-fill metric-bar-fill--${variant}`
      fill.style.width = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
      barElement.append(fill)
      cell.append(barElement)
    }

    return cell
  }

  renderMetricsChart({ classList, precisions, recalls, f1Scores }) {
    const { chartContainer } = this.elements
    if (!chartContainer) return

    this.destroyMetricsChart()
    chartContainer.replaceChildren()

    const reduceMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const series = (name, color, values) => ({
      type: 'column',
      name,
      color,
      showInLegend: true,
      yValueFormatString: '0.0%',
      dataPoints: classList.map((classValue, index) => ({
        label: String(classValue),
        y: Number.isFinite(values[index]) ? values[index] : 0,
      })),
    })

    this.metricsChart = new CanvasJS.Chart('chartContainer', {
      animationEnabled: !reduceMotion,
      exportEnabled: true,
      theme: 'light1',
      backgroundColor: 'transparent',
      axisX: {
        labelFontColor: '#3a506b',
        labelFontSize: 12,
        tickLength: 0,
      },
      axisY: {
        minimum: 0,
        maximum: 1,
        interval: 0.2,
        gridColor: '#e3e8ef',
        labelFontColor: '#3a506b',
        labelFontSize: 11,
        tickLength: 0,
        labelFormatter: (event) => `${Math.round(event.value * 100)}%`,
      },
      legend: {
        horizontalAlign: 'center',
        verticalAlign: 'bottom',
        fontSize: 12,
        fontColor: '#3a506b',
      },
      toolTip: { shared: true },
      data: [
        series('Precisión', '#1c2541', precisions),
        series('Recall', '#5bc0be', recalls),
        series('F1', '#3a506b', f1Scores),
      ],
    })
    this.metricsChart.render()
  }

  destroyMetricsChart() {
    if (!this.metricsChart) return
    try {
      this.metricsChart.destroy()
    } catch (error) {
      console.error(error)
    }
    this.metricsChart = null
  }

  clearMetrics() {
    const {
      metricsSection,
      metricsKpis,
      metricsGrid,
      metricsMatrix,
      metricsTable,
      metricsChartPanel,
      chartContainer,
    } = this.elements

    this.destroyMetricsChart()
    metricsKpis?.replaceChildren()
    metricsMatrix?.replaceChildren()
    metricsTable?.replaceChildren()
    chartContainer?.replaceChildren()
    if (metricsGrid) metricsGrid.hidden = false
    if (metricsChartPanel) metricsChartPanel.hidden = false
    if (metricsSection) metricsSection.hidden = true
  }

  macroAverage(values) {
    const valid = values.filter((value) => value !== null && Number.isFinite(value))
    if (!valid.length) return null
    return valid.reduce((sum, value) => sum + value, 0) / valid.length
  }

  formatPercent(value, digits = 1) {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—'
    if (!this.percentFormatters.has(digits)) {
      this.percentFormatters.set(
        digits,
        new Intl.NumberFormat('es-ES', {
          style: 'percent',
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }),
      )
    }
    return this.percentFormatters.get(digits).format(value)
  }

  formatCount(value) {
    return Number(value).toLocaleString('es-ES')
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
