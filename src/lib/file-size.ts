export function formatFileSize(bytes: number, language: 'ar' | 'en') {
  const units = language === 'ar' ? ['بايت', 'كيلوبايت', 'ميغابايت', 'غيغابايت'] : ['B', 'KB', 'MB', 'GB']
  let amount = Math.max(0, bytes)
  let unit = 0
  while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit++ }
  const digits = amount >= 100 || unit === 0 ? 0 : amount >= 10 ? 1 : 2
  return `${amount.toFixed(digits)} ${units[unit]}`
}

export function compressionSavings(before: number, after: number) {
  if (before <= 0) return { bytes: 0, percent: 0 }
  const bytes = Math.max(0, before - after)
  return { bytes, percent: Math.round(bytes / before * 1000) / 10 }
}
