export interface CountryInfo {
  code: string
  country: string
  flag: string
  minDigits: number
  maxDigits: number
}

export const countries: CountryInfo[] = [
  { code: "+52", country: "México", flag: "🇲🇽", minDigits: 10, maxDigits: 10 },
  { code: "+1", country: "EE. UU. / Canadá", flag: "🇺🇸", minDigits: 10, maxDigits: 10 },
  { code: "+34", country: "España", flag: "🇪🇸", minDigits: 9, maxDigits: 9 },
  { code: "+54", country: "Argentina", flag: "🇦🇷", minDigits: 10, maxDigits: 10 },
  { code: "+57", country: "Colombia", flag: "🇨🇴", minDigits: 10, maxDigits: 10 },
  { code: "+56", country: "Chile", flag: "🇨🇱", minDigits: 9, maxDigits: 9 },
  { code: "+51", country: "Perú", flag: "🇵🇪", minDigits: 9, maxDigits: 9 },
  { code: "+593", country: "Ecuador", flag: "🇪🇨", minDigits: 9, maxDigits: 10 },
  { code: "+58", country: "Venezuela", flag: "🇻🇪", minDigits: 10, maxDigits: 10 },
  { code: "+55", country: "Brasil", flag: "🇧🇷", minDigits: 10, maxDigits: 11 },
  { code: "+598", country: "Uruguay", flag: "🇺🇾", minDigits: 8, maxDigits: 8 },
  { code: "+595", country: "Paraguay", flag: "🇵🇾", minDigits: 9, maxDigits: 10 },
  { code: "+591", country: "Bolivia", flag: "🇧🇴", minDigits: 8, maxDigits: 8 },
  { code: "+506", country: "Costa Rica", flag: "🇨🇷", minDigits: 8, maxDigits: 8 },
  { code: "+503", country: "El Salvador", flag: "🇸🇻", minDigits: 8, maxDigits: 8 },
  { code: "+502", country: "Guatemala", flag: "🇬🇹", minDigits: 8, maxDigits: 8 },
  { code: "+504", country: "Honduras", flag: "🇭🇳", minDigits: 8, maxDigits: 8 },
  { code: "+505", country: "Nicaragua", flag: "🇳🇮", minDigits: 8, maxDigits: 8 },
  { code: "+507", country: "Panamá", flag: "🇵🇦", minDigits: 8, maxDigits: 8 },
  { code: "+53", country: "Cuba", flag: "🇨🇺", minDigits: 8, maxDigits: 8 },
  { code: "+1-809", country: "Rep. Dominicana", flag: "🇩🇴", minDigits: 10, maxDigits: 10 },
  { code: "+351", country: "Portugal", flag: "🇵🇹", minDigits: 9, maxDigits: 9 },
  { code: "+39", country: "Italia", flag: "🇮🇹", minDigits: 10, maxDigits: 10 },
  { code: "+33", country: "Francia", flag: "🇫🇷", minDigits: 9, maxDigits: 9 },
  { code: "+49", country: "Alemania", flag: "🇩🇪", minDigits: 10, maxDigits: 11 },
  { code: "+44", country: "Reino Unido", flag: "🇬🇧", minDigits: 10, maxDigits: 10 },
]

export function getCountryByCode(code: string): CountryInfo | undefined {
  return countries.find((c) => c.code === code)
}
