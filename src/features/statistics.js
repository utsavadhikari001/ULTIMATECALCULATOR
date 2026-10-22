export function parseStatisticsInput(raw) {
  const text = String(raw).trim();
  if (!text) return [];
  const values = text.split(/[\s,;]+/).filter(Boolean).map(Number);
  if (values.some(value => !Number.isFinite(value))) {
    throw new TypeError('Use finite numbers separated by spaces, commas, or new lines.');
  }
  return values;
}

export function calculateStatistics(values, mode = 'population') {
  if (!Array.isArray(values) || values.length === 0 || values.some(value => !Number.isFinite(value))) {
    throw new TypeError('Enter at least one finite number.');
  }

  const sorted = [...values].sort((a, b) => a - b);
  const count = values.length;
  const sum = values.reduce((total, value) => total + value, 0);
  const mean = sum / count;
  const median = count % 2
    ? sorted[(count - 1) / 2]
    : (sorted[count / 2 - 1] + sorted[count / 2]) / 2;
  const frequencies = new Map();
  values.forEach(value => frequencies.set(value, (frequencies.get(value) || 0) + 1));
  const highestFrequency = Math.max(...frequencies.values());
  const modes = highestFrequency > 1
    ? [...frequencies.entries()]
      .filter(([, frequency]) => frequency === highestFrequency)
      .map(([value]) => value)
      .sort((a, b) => a - b)
    : [];
  const min = sorted[0];
  const max = sorted[count - 1];
  const squaredSum = values.reduce((total, value) => total + (value - mean) ** 2, 0);
  const divisor = mode === 'sample' ? count - 1 : count;
  const variance = divisor > 0 ? squaredSum / divisor : NaN;

  return {
    count,
    sum,
    mean,
    median,
    modes,
    min,
    max,
    range: max - min,
    variance,
    deviation: Math.sqrt(variance)
  };
}
