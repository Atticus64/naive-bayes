import * as XLSX from 'xlsx'

export class AttributeTypeDetector {
  /**
   * Detecta el tipo de cada columna escaneando las filas hasta el primer valor no vacío.
   * @param {string[]} headers
   * @param {any[][]} rows
   * @returns {Array<'discreto' | 'continuo'>}
   */
  detect(headers, rows) {
    return headers.map((_, index) => {
      for (const row of rows) {
        const value = row[index]
        if (value === '' || value == null) continue
        return Number.isNaN(Number(value)) || typeof value === 'boolean' ? 'discreto' : 'continuo'
      }
      return 'discreto'
    })
  }
}

export class Dataset {
  constructor({ fileName, headers, rows, tipos_atributos }) {
    this.fileName = fileName
    this.headers = headers
    this.rows = rows
    this.tipos_atributos = tipos_atributos ?? new AttributeTypeDetector().detect(headers, rows)
    this.continuousColumns = this.tipos_atributos
      .map((tipo, index) => (tipo === 'continuo' ? index : null))
      .filter((index) => index !== null)
    this.discreteColumns = this.tipos_atributos
      .map((tipo, index) => (tipo === 'discreto' ? index : null))
      .filter((index) => index !== null)
  }

  get rowCount() {
    return this.rows.length
  }

  get columnCount() {
    return this.headers.length
  }

  hasSameHeaders(other) {
    return headersMatch(this.headers, other.headers)
  }

  detectContinuousColumns() {
    return this.continuousColumns
  }

  getClassColumn(position = 'last') {
    const index = position === 'first' ? 0 : this.headers.length - 1
    return { position, index, name: this.headers[index] ?? '' }
  }
}

/**
 * @param {string[]} left
 * @param {string[]} right
 */
export function headersMatch(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

/**
 * Obtiene el número y la lista de clases de una columna.
 * @param {any[][]} rows
 * @param {number} columnIndex
 * @returns {{ count: number, classes: string[] }}
 */
export function getClassInfoFromRows(rows, columnIndex) {
  const classes = []
  const seen = new Set()

  for (const row of rows) {
    const raw = row[columnIndex]
    if (raw === '' || raw == null) continue

    const value = String(raw).trim()
    if (!value || seen.has(value)) continue

    seen.add(value)
    classes.push(value)
  }

  return { count: classes.length, classes }
}

/**
 * Obtiene el número y la lista de clases de la columna de clase.
 * @param {Dataset} dataset
 * @param {'first' | 'last'} position
 * @returns {{ count: number, classes: string[] }}
 */
export function getClassInfo(dataset, position = 'last') {
  const { index } = dataset.getClassColumn(position)
  return getClassInfoFromRows(dataset.rows, index)
}

export class DatasetValidator {
  static MAX_FILE_SIZE = 20 * 1024 * 1024

  validateFile(file) {
    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      throw new Error('Elige un archivo .csv o .xlsx.')
    }

    if (file.size > DatasetValidator.MAX_FILE_SIZE) {
      throw new Error('Este archivo supera el límite de 20 MB.')
    }
  }

  /**
   * @param {{ headers: string[], rows: any[][], tipos_atributos?: string[] }} parsed
   */
  verificarDataset({ headers, rows, tipos_atributos }) {
    rows.forEach((row, rowIndex) => {
      if (row.length !== headers.length) {
        throw new Error(`La fila ${rowIndex + 1} tiene un número de columnas diferente al encabezado.`)
      }
    })

    if (tipos_atributos && tipos_atributos.length !== headers.length) {
      throw new Error('El número de tipos de atributos no coincide con el número de columnas.')
    }
  }
}

export class DatasetService {
  constructor({ validator = new DatasetValidator(), typeDetector = new AttributeTypeDetector() } = {}) {
    this.validator = validator
    this.typeDetector = typeDetector
  }

  /**
   * @param {File} file
   * @returns {Promise<Dataset>}
   */
  async load(file) {
    this.validator.validateFile(file)

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


    const tipos_atributos = this.typeDetector.detect(headers, populatedRows)
    const parsed = { headers, rows: populatedRows, tipos_atributos }
    this.validator.verificarDataset(parsed)

    return new Dataset({ fileName: file.name, ...parsed })
  }
}
