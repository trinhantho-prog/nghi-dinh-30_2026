import type { DocumentState } from '@/types'

export function signatureAuthorityLines(state: Pick<DocumentState, 'agencyUpper' | 'signPosition' | 'signAuthority'>): string[] {
  // An explicitly imported empty string means the source has no TM./KT. lines.
  if (state.signAuthority !== undefined) return state.signAuthority.split('\n').map(line => line.trim()).filter(Boolean)
  const lines: string[] = []
  const agency = state.agencyUpper.trim().toUpperCase()
  if (/^TM\./iu.test(agency)) lines.push(agency)
  else if (/^(?:ỦY BAN|UỶ BAN|HỘI ĐỒNG|BAN CHẤP HÀNH|BAN THƯỜNG VỤ|HỘI)(?=\s|$)/u.test(agency)) lines.push(`TM. ${agency}`)
  if (/^phó\s+/iu.test(state.signPosition)) lines.push(`KT. ${state.signPosition.replace(/^phó\s+/iu, '').trim().toUpperCase()}`)
  return lines
}
