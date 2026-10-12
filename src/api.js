const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5080/api').replace(/\/$/, '')

async function request(path, options = {}) {
  const token = localStorage.getItem('labslot_token')
  const headers = new Headers(options.headers || {})
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers })
  } catch {
    throw new Error('Не удалось связаться с сервером. Проверьте, запущен ли backend.')
  }

  if (response.status === 204) return null
  const text = await response.text()
  let payload = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { message: text }
    }
  }

  if (!response.ok) {
    const validationMessage = payload?.errors
      ? Object.values(payload.errors).flat().join(' ')
      : null
    throw new Error(payload?.message || validationMessage || `Ошибка запроса (${response.status})`)
  }
  return payload
}

const json = (method, body) => ({ method, body: JSON.stringify(body) })

export const api = {
  me: () => request('/auth/me'),
  login: (body) => request('/auth/login', json('POST', body)),
  register: (body) => request('/auth/register', json('POST', body)),
  resources: (search = '', category = '') => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    if (category) params.set('category', category)
    const query = params.toString()
    return request(`/resources${query ? `?${query}` : ''}`)
  },
  availability: (id, from, to) => {
    const params = new URLSearchParams({ from, to })
    return request(`/resources/${id}/availability?${params.toString()}`)
  },
  bookings: () => request('/bookings'),
  createBooking: (body) => request('/bookings', json('POST', body)),
  cancelBooking: (id) => request(`/bookings/${id}`, { method: 'DELETE' }),
  adminResources: () => request('/admin/resources'),
  createResource: (body) => request('/admin/resources', json('POST', body)),
  updateResource: (id, body) => request(`/admin/resources/${id}`, json('PUT', body)),
  archiveResource: (id) => request(`/admin/resources/${id}`, { method: 'DELETE' }),
}
