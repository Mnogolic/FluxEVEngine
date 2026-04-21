export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8001'

export function buildApiUrl(path: string): string {
  return new URL(path, API_BASE_URL).toString()
}

export async function fetchFromApi<T>(path: string): Promise<T> {
  const response = await fetch(buildApiUrl(path))

  if (!response.ok) {
    throw new Error(`Backend request failed with ${response.status}`)
  }

  return (await response.json()) as T
}
