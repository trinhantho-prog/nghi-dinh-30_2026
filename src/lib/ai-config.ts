export const AI_PROVIDERS = [
  { value: 'gemini', label: 'Gemini', keyLabel: 'Gemini Key (Trả phí)', storageKey: 'ai-gemini-key', placeholder: 'Nhập API Key Gemini riêng (tùy chọn)' },
  { value: 'deepseek', label: 'DeepSeek', keyLabel: 'DeepSeek Key', storageKey: 'ai-deepseek-key', placeholder: 'Nhập sk-...' },
  { value: 'anthropic', label: 'AI miễn phí', keyLabel: 'Gemini Free API Key', storageKey: 'ai-anthropic-key', placeholder: 'Nhập API Key Gemini Free (tùy chọn)' },
] as const

export type AIProvider = typeof AI_PROVIDERS[number]['value']

export function readAIConfig() {
  const saved = localStorage.getItem('ai-active-provider')
  const selected = AI_PROVIDERS.find(provider => provider.value === saved) || AI_PROVIDERS[0]
  return { provider: selected.value, apiKey: localStorage.getItem(selected.storageKey)?.trim() || undefined }
}
