const UNITS = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf']
const TEENS = [
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize',
  'dix-sept',
  'dix-huit',
  'dix-neuf'
]
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', '', '', '']

function convertBelow100(n: number): string {
  if (n === 0) return ''
  if (n < 10) return UNITS[n]
  if (n < 20) return TEENS[n - 10]

  const ten = Math.floor(n / 10)
  const unit = n % 10

  if (ten === 8) {
    return unit === 0 ? 'quatre-vingts' : `quatre-vingt-${UNITS[unit]}`
  }
  if (ten === 7 || ten === 9) {
    const base = ten === 7 ? 'soixante' : 'quatre-vingt'
    if (unit === 1 && ten === 7) return `${base}-et-onze`
    return `${base}-${TEENS[unit]}`
  }

  const base = TENS[ten]
  if (unit === 0) return base
  if (unit === 1) return `${base}-et-un`
  return `${base}-${UNITS[unit]}`
}

function convertBelow1000(n: number): string {
  if (n < 100) return convertBelow100(n)

  const hundred = Math.floor(n / 100)
  const rest = n % 100

  let result = hundred === 1 ? 'cent' : `${UNITS[hundred]}-cent`
  if (rest === 0 && hundred > 1) result += 's'
  if (rest > 0) result += `-${convertBelow100(rest)}`
  return result
}

/** Convertit un entier positif en toutes lettres françaises (ex: 150000 → "cent-cinquante-mille"). */
export function numberToFrenchWords(value: number): string {
  const n = Math.round(Math.abs(value))
  if (n === 0) return 'zéro'

  const millions = Math.floor(n / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000

  const parts: string[] = []
  if (millions > 0) {
    parts.push(millions === 1 ? 'un-million' : `${convertBelow1000(millions)}-millions`)
  }
  if (thousands > 0) {
    parts.push(thousands === 1 ? 'mille' : `${convertBelow1000(thousands)}-mille`)
  }
  if (rest > 0 || parts.length === 0) {
    parts.push(convertBelow1000(rest))
  }

  const words = parts.join('-')
  return value < 0 ? `moins ${words}` : words
}

/** Formate un montant FCFA en toutes lettres, avec majuscule initiale et devise. */
export function formatAmountInWords(amount: number): string {
  const words = numberToFrenchWords(amount)
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1)
  return `${capitalized} francs CFA`
}
