export class Metrics {
  static accuracy(matrix) {
    const total = matrix.reduce((sum, row) => sum + row.reduce((rowSum, count) => rowSum + count, 0), 0)
    const correct = matrix.reduce((sum, row, i) => sum + row[i], 0)
    return total === 0 ? null : correct / total;

  }

  static confusionMatrix(classList, evaluated) {

    const matrix = []

    for (const actualClass of classList) {
      const row = []
      for (const predictedClass of classList) {
        const count = evaluated.filter(
          (prediction) =>
            prediction.actual === actualClass && prediction.predicted === predictedClass,
        ).length
        row.push(count)
      }
      matrix.push(row)
    }
    return matrix
  }

  static precision(matrix, classIndex) {

    const truePositive = matrix[classIndex][classIndex]

    let falsePositive = 0;
    for (let i = 0; i < matrix.length; i++) {
      if (i !== classIndex) {
        falsePositive += matrix[i][classIndex];
      }
    }
    // const falsePositive = matrix.reduce(
      // (sum, row, i) => (i !== classIndex ? sum + row[classIndex] : sum),
      // 0,
    // )
    
    return truePositive + falsePositive === 0 ? null : truePositive / (truePositive + falsePositive)
  }

  static recall(matrix, classIndex) {

    const truePositive = matrix[classIndex][classIndex]
    let falseNegative = 0;

    for (let j = 0; j < matrix.length; j++) {
      if (j !== classIndex) {
        falseNegative += matrix[classIndex][j];
      }
    }
    return truePositive + falseNegative === 0 ? null : truePositive / (truePositive + falseNegative)
  }

  static f1(precision, recall) {

    if (precision === null || recall === null || precision + recall === 0) {
      return null
    }

    return 2 * (precision * recall) / (precision + recall)
  }

  static report(actual, predicted) {
    throw new Error('Método report pendiente de implementar.')
  }
}
