export function calculateFinance({ principal, annualRate, years, frequency }) {
  const rate = annualRate / 100;
  const valid = Number.isFinite(principal) && principal >= 0
    && Number.isFinite(rate) && rate >= 0
    && Number.isFinite(years) && years >= 0
    && Number.isFinite(frequency) && frequency > 0;
  if (!valid) {
    return { valid: false, simpleTotal: NaN, compoundTotal: NaN, interest: NaN, payment: NaN };
  }

  const simpleTotal = principal * (1 + rate * years);
  const compoundTotal = principal * Math.pow(1 + rate / frequency, frequency * years);
  const interest = compoundTotal - principal;
  const months = years * 12;
  const monthlyRate = rate / 12;
  const payment = months > 0
    ? (monthlyRate === 0
      ? principal / months
      : principal * monthlyRate * Math.pow(1 + monthlyRate, months)
        / (Math.pow(1 + monthlyRate, months) - 1))
    : NaN;

  return { valid: true, simpleTotal, compoundTotal, interest, payment };
}
