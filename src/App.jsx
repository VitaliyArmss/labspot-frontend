import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, Armchair, ArrowRight, ArrowUpRight, Atom, BadgeCheck,
  Bell, CalendarDays, CalendarPlus, Check, CheckCircle2, ChevronDown, Clock3,
  Cpu, DoorOpen, FlaskConical, LayoutDashboard, LogIn, MapPin, Monitor,
  MoreHorizontal, Plus, Search, Settings2, ShieldCheck, SlidersHorizontal,
  Sparkles, Users, Wrench, X, Zap,
} from 'lucide-react'
import { api } from './api.js'

const CATEGORY_LABELS = {
  Equipment: 'Оборудование',
  Workspace: 'Рабочее место',
  Room: 'Помещение',
}

const CATEGORY_ICONS = {
  Equipment: Cpu,
  Workspace: Armchair,
  Room: DoorOpen,
}

const CATEGORY_ACCENTS = {
  Equipment: 'mint',
  Workspace: 'sand',
  Room: 'lilac',
}

function getLocalDateValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDate(value, options = {}) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', ...options,
  }).format(new Date(value))
}

function formatTime(value) {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'U'
}

function isFuture(value) {
  return new Date(value).getTime() > Date.now()
}

function IconMark({ category, size = 22 }) {
  const Icon = CATEGORY_ICONS[category] || Atom
  return <Icon size={size} strokeWidth={1.7} />
}

function App() {
  const [activeView, setActiveView] = useState('overview')
  const [user, setUser] = useState(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [resources, setResources] = useState([])
  const [catalogCount, setCatalogCount] = useState(0)
  const [adminResources, setAdminResources] = useState([])
  const [bookings, setBookings] = useState([])
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [selectedResource, setSelectedResource] = useState(null)
  const [editingResource, setEditingResource] = useState(null)
  const [resourceFormOpen, setResourceFormOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pageError, setPageError] = useState('')
  const [notice, setNotice] = useState(null)

  const notify = useCallback((message, type = 'success') => {
    setNotice({ message, type, key: Date.now() })
  }, [])

  const refreshCatalogCount = useCallback(async () => {
    try {
      setCatalogCount((await api.resources()).length)
    } catch { /* The catalog request below displays the connection error. */ }
  }, [])

  const refreshBookings = useCallback(async () => {
    if (!localStorage.getItem('labslot_token')) {
      setBookings([])
      return
    }
    try {
      const items = await api.bookings()
      setBookings(items)
    } catch (error) {
      setPageError(error.message)
    }
  }, [])

  const refreshAdminResources = useCallback(async () => {
    try {
      setAdminResources(await api.adminResources())
    } catch (error) {
      notify(error.message, 'error')
    }
  }, [notify])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    refreshCatalogCount()
  }, [refreshCatalogCount])

  useEffect(() => {
    api.resources(debouncedSearch, category)
      .then((items) => { setResources(items); setPageError('') })
      .catch((error) => setPageError(error.message))
  }, [debouncedSearch, category])

  useEffect(() => {
    const token = localStorage.getItem('labslot_token')
    if (!token) return
    api.me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('labslot_token')
        localStorage.removeItem('labslot_user')
      })
  }, [])

  useEffect(() => {
    if (user) refreshBookings()
    else setBookings([])
  }, [user, refreshBookings])

  useEffect(() => {
    if (activeView === 'admin' && user?.role === 'Admin') refreshAdminResources()
  }, [activeView, user, refreshAdminResources])

  const upcomingBookings = useMemo(() => bookings
    .filter((booking) => booking.status === 'Confirmed' && isFuture(booking.startAt))
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt)), [bookings])

  const showOverview = () => setActiveView('overview')

  function openBooking(resource) {
    setSelectedResource(resource)
    if (!user) {
      setAuthMode('login')
      setAuthOpen(true)
      notify('Войдите в аккаунт, чтобы забронировать ресурс.', 'info')
    }
  }

  async function handleAuthSubmit(formData) {
    setBusy(true)
    try {
      const response = authMode === 'login' ? await api.login(formData) : await api.register(formData)
      localStorage.setItem('labslot_token', response.token)
      localStorage.setItem('labslot_user', JSON.stringify(response.user))
      setUser(response.user)
      setAuthOpen(false)
      notify(authMode === 'login' ? 'Вы вошли в аккаунт.' : 'Аккаунт создан. Добро пожаловать!')
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  function logout() {
    localStorage.removeItem('labslot_token')
    localStorage.removeItem('labslot_user')
    setUser(null)
    setBookings([])
    setActiveView('overview')
    setSelectedResource(null)
    notify('Вы вышли из аккаунта.', 'info')
  }

  async function cancelBooking(booking) {
    try {
      await api.cancelBooking(booking.id)
      await refreshBookings()
      notify('Бронирование отменено.')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  async function saveResource(formData) {
    setBusy(true)
    try {
      if (editingResource) await api.updateResource(editingResource.id, formData)
      else await api.createResource(formData)
      setResourceFormOpen(false)
      setEditingResource(null)
      await Promise.all([refreshAdminResources(), api.resources(debouncedSearch, category).then(setResources), refreshCatalogCount()])
      notify(editingResource ? 'Изменения сохранены.' : 'Ресурс добавлен.')
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function toggleResource(resource) {
    try {
      await api.updateResource(resource.id, { ...resource, isActive: !resource.isActive })
      await Promise.all([refreshAdminResources(), api.resources(debouncedSearch, category).then(setResources), refreshCatalogCount()])
      notify(resource.isActive ? 'Ресурс скрыт из каталога.' : 'Ресурс снова доступен.')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  async function archiveResource(resource) {
    if (!window.confirm(`Архивировать «${resource.name}»?`)) return
    try {
      await api.archiveResource(resource.id)
      await Promise.all([refreshAdminResources(), api.resources(debouncedSearch, category).then(setResources), refreshCatalogCount()])
      notify('Ресурс отправлен в архив.')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  const isAdmin = user?.role === 'Admin'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={showOverview} aria-label="LabSlot — главная">
          <span className="brand-symbol"><FlaskConical size={21} strokeWidth={2.2} /></span>
          <span className="brand-name">labslot<span>.</span></span>
        </button>

        <div className="workspace-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <nav className="main-nav" aria-label="Основная навигация">
          <button className={`nav-item ${activeView === 'overview' ? 'active' : ''}`} onClick={showOverview}>
            <LayoutDashboard size={18} /> <span>Обзор</span>
          </button>
          <button className={`nav-item ${activeView === 'bookings' ? 'active' : ''}`} onClick={() => { if (user) setActiveView('bookings'); else { setAuthMode('login'); setAuthOpen(true) } }}>
            <CalendarDays size={18} /> <span>{isAdmin ? 'Все бронирования' : 'Мои бронирования'}</span>
            {upcomingBookings.length > 0 && <span className="nav-count">{upcomingBookings.length}</span>}
          </button>
          {isAdmin && (
            <>
              <div className="workspace-label nav-section-label">УПРАВЛЕНИЕ</div>
              <button className={`nav-item ${activeView === 'admin' ? 'active' : ''}`} onClick={() => setActiveView('admin')}>
                <Settings2 size={18} /> <span>Ресурсы</span>
              </button>
            </>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon"><Sparkles size={17} /></span>
            <div>
              <strong>Есть идея?</strong>
              <p>Предложите ресурс для лаборатории.</p>
            </div>
            <ArrowUpRight size={15} className="help-arrow" />
          </div>
          <div className="sidebar-footnote"><span className="online-dot" /> Пространство для идей</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>LabSlot</span><span className="crumb-slash">/</span><strong>{activeView === 'overview' ? 'Обзор' : activeView === 'bookings' ? (isAdmin ? 'Бронирования' : 'Мои бронирования') : 'Управление ресурсами'}</strong></div>
          <div className="topbar-actions">
            <span className="today-label"><CalendarDays size={15} /> {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' }).format(new Date())}</span>
            <span className="topbar-divider" />
            {user ? (
              <div className="user-menu-wrap">
                <button className="user-menu" onClick={() => setUserMenuOpen(!userMenuOpen)} aria-expanded={userMenuOpen} aria-label="Меню пользователя">
                  <span className="avatar">{initials(user.name)}</span>
                  <span className="user-menu-copy"><strong>{user.name}</strong><small>{isAdmin ? 'Администратор' : 'Участник'}</small></span>
                  <ChevronDown size={15} className="muted-icon" />
                </button>
                {userMenuOpen && <div className="user-popover"><div className="user-popover-heading"><strong>{user.name}</strong><span>{user.email}</span></div><button onClick={() => { setUserMenuOpen(false); logout() }}><LogIn size={15} />Выйти из аккаунта</button></div>}
              </div>
            ) : (
              <button className="button button-dark button-small" onClick={() => { setAuthMode('login'); setAuthOpen(true) }}><LogIn size={15} /> Войти</button>
            )}
          </div>
        </header>

        {activeView === 'overview' && (
          <div className="page-content page-enter">
            <section className="welcome-row">
              <div>
                <div className="eyebrow"><span className="eyebrow-line" /> ТВОЯ СЛЕДУЮЩАЯ ИДЕЯ НАЧИНАЕТСЯ ЗДЕСЬ</div>
                <h1>Пространство для<br /><span>больших идей.</span></h1>
                <p className="welcome-copy">Всё нужное для учёбы, исследований и собственных проектов — в одном месте.</p>
              </div>
              <div className="welcome-art" aria-hidden="true">
                <div className="art-orbit orbit-one" />
                <div className="art-orbit orbit-two" />
                <div className="art-core"><Atom size={66} strokeWidth={1.15} /></div>
                <span className="art-dot dot-one" /><span className="art-dot dot-two" /><span className="art-dot dot-three" />
                <span className="art-tag"><Zap size={13} fill="currentColor" /> MAKE IT HAPPEN</span>
              </div>
            </section>

            <section className="stats-grid" aria-label="Статистика">
              <div className="stat-card"><div className="stat-top"><span className="stat-icon icon-green"><BoxIcon /></span><span className="stat-kicker">В КАТАЛОГЕ</span></div><div className="stat-value">{catalogCount}<span> ресурсов</span></div><div className="stat-bottom"><span className="stat-trend"><ArrowUpRight size={13} /> Всё для проектов</span></div></div>
              <div className="stat-card"><div className="stat-top"><span className="stat-icon icon-orange"><CalendarPlus size={19} /></span><span className="stat-kicker">{isAdmin ? 'ПЛАН КАМПУСА' : 'ТВОЙ ПЛАН'}</span></div><div className="stat-value">{upcomingBookings.length}<span>{isAdmin ? ' записей впереди' : ' впереди'}</span></div><div className="stat-bottom"><span className="stat-subtle">{upcomingBookings.length ? `Ближайшее — ${formatDate(upcomingBookings[0].startAt)}` : 'Пока нет запланированных слотов'}</span></div></div>
              <div className="stat-card"><div className="stat-top"><span className="stat-icon icon-purple"><ShieldCheck size={19} /></span><span className="stat-kicker">ТВОЙ АККАУНТ</span></div><div className="stat-value stat-word">{user ? 'На месте' : 'Открыт'}</div><div className="stat-bottom"><span className="stat-subtle">{user ? 'Можно планировать работу' : 'Войди, чтобы бронировать'}</span>{!user && <button className="text-link" onClick={() => setAuthOpen(true)}>Войти <ArrowRight size={13} /></button>}</div></div>
            </section>

            <section className="catalog-section">
              <div className="section-heading">
                <div><div className="section-overline">НАЙДИ СВОЁ МЕСТО</div><h2>Каталог ресурсов <span className="heading-count">{resources.length}</span></h2></div>
                <div className="catalog-tools">
                  <label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск ресурсов" aria-label="Поиск ресурсов" />{search && <button onClick={() => setSearch('')} aria-label="Очистить поиск"><X size={14} /></button>}</label>
                  <div className="filter-wrap">
                    <button className={`filter-button ${category ? 'filter-active' : ''}`} onClick={() => setFilterOpen(!filterOpen)} aria-expanded={filterOpen} title="Фильтр по категории"><SlidersHorizontal size={16} /><span>Фильтр</span><span className="filter-dot" /></button>
                    {filterOpen && <div className="filter-menu">{[['', 'Все ресурсы'], ['Equipment', 'Оборудование'], ['Workspace', 'Рабочие места'], ['Room', 'Помещения']].map(([value, label]) => <button key={value || 'all-filter'} className={`filter-option ${category === value ? 'chosen' : ''}`} onClick={() => { setCategory(value); setFilterOpen(false) }}><span>{label}</span>{category === value && <Check size={14} />}</button>)}</div>}
                  </div>
                </div>
              </div>

              <div className="category-tabs" role="group" aria-label="Категории ресурсов">
                {[['', 'Все ресурсы'], ['Equipment', 'Оборудование'], ['Workspace', 'Рабочие места'], ['Room', 'Помещения']].map(([value, label]) => (
                  <button key={value || 'all'} className={`category-tab ${category === value ? 'selected' : ''}`} onClick={() => setCategory(value)}>{label}{value === '' && <span>{resources.length}</span>}</button>
                ))}
              </div>

              {pageError && <div className="inline-error"><span>{pageError}</span><button onClick={() => setPageError('')}><X size={15} /></button></div>}
              {resources.length ? (
                <div className="resource-grid">
                  {resources.map((resource, index) => <ResourceCard key={resource.id} resource={resource} index={index} onBook={openBooking} />)}
                </div>
              ) : (
                <div className="empty-state"><div className="empty-icon"><Search size={23} /></div><h3>Ничего не нашлось</h3><p>Попробуй изменить запрос или выбрать другую категорию.</p><button className="button button-light" onClick={() => { setSearch(''); setCategory('') }}>Сбросить фильтры</button></div>
              )}
              <div className="catalog-footer"><span>Показываем доступные ресурсы</span><span>LABSLOT <span className="footer-dot">✳</span> CAMPUS TOOLS</span></div>
            </section>
          </div>
        )}

        {activeView === 'bookings' && (
          <div className="page-content page-enter">
            <div className="simple-page-heading"><div className="section-overline">{isAdmin ? 'РАСПИСАНИЕ КАМПУСА' : 'ТВОЁ РАСПИСАНИЕ'}</div><h1>{isAdmin ? 'Все бронирования' : 'Мои бронирования'}<span className="heading-count big-count">{bookings.length}</span></h1><p>{isAdmin ? 'Записи пользователей и управление их отменой.' : 'Все запланированные сессии и история работы с ресурсами.'}</p></div>
            <div className="booking-summary"><div className="booking-summary-icon"><CalendarDays size={21} /></div><div><strong>{upcomingBookings.length === 1 ? '1 предстоящее бронирование' : `${upcomingBookings.length} предстоящих ${pluralize(upcomingBookings.length, 'бронирование', 'бронирования', 'бронирований')}`}</strong><p>Не забудь прийти вовремя — ресурс ждёт тебя.</p></div><button className="button button-dark button-small" onClick={showOverview}>Найти ресурс <ArrowRight size={15} /></button></div>
            <h2 className="subsection-title">Все записи</h2>
            {bookings.length ? <div className="booking-list">{bookings.map((booking) => <BookingRow key={booking.id} booking={booking} onCancel={cancelBooking} showUser={isAdmin} />)}</div> : <div className="empty-state bookings-empty"><div className="empty-icon"><CalendarPlus size={23} /></div><h3>{isAdmin ? 'Бронирований пока нет' : 'Здесь пока пусто'}</h3><p>{isAdmin ? 'Записи появятся здесь, когда пользователи забронируют ресурсы.' : 'Найди подходящее оборудование или рабочее место и создай первую бронь.'}</p><button className="button button-dark" onClick={showOverview}>Перейти в каталог <ArrowRight size={15} /></button></div>}
          </div>
        )}

        {activeView === 'admin' && isAdmin && (
          <div className="page-content page-enter">
            <div className="admin-heading-row"><div className="simple-page-heading"><div className="section-overline">ПАНЕЛЬ АДМИНИСТРАТОРА</div><h1>Управление ресурсами</h1><p>Добавляй оборудование, редактируй информацию и управляй доступностью.</p></div><button className="button button-dark" onClick={() => { setEditingResource(null); setResourceFormOpen(true) }}><Plus size={17} /> Добавить ресурс</button></div>
            <div className="admin-summary-row"><div className="admin-summary"><span className="admin-summary-icon"><Monitor size={18} /></span><div><small>Всего ресурсов</small><strong>{adminResources.length}</strong></div></div><div className="admin-summary"><span className="admin-summary-icon summary-icon-green"><BadgeCheck size={18} /></span><div><small>В каталоге</small><strong>{adminResources.filter((resource) => resource.isActive).length}</strong></div></div><div className="admin-summary"><span className="admin-summary-icon summary-icon-orange"><CalendarDays size={18} /></span><div><small>Бронирований</small><strong>{bookings.length}</strong></div></div></div>
            <div className="admin-table-wrap"><div className="admin-table-heading"><div><h2>Все ресурсы</h2><p>Нажми на строку, чтобы изменить данные.</p></div><span className="table-status"><span className="online-dot" /> Система активна</span></div>
              <div className="responsive-table"><table><thead><tr><th>Ресурс</th><th>Категория</th><th>Расположение</th><th>Статус</th><th aria-label="Действия" /></tr></thead><tbody>{adminResources.map((resource) => <tr key={resource.id}><td><div className="table-resource"><span className={`resource-mini-icon ${CATEGORY_ACCENTS[resource.category] || 'mint'}`}><IconMark category={resource.category} size={17} /></span><div><strong>{resource.name}</strong><small>До {resource.capacity} {pluralize(resource.capacity, 'человека', 'человек', 'человек')}</small></div></div></td><td><span className="table-category">{CATEGORY_LABELS[resource.category] || resource.category}</span></td><td><span className="table-location"><MapPin size={13} />{resource.location}</span></td><td><span className={`status-pill ${resource.isActive ? 'status-active' : 'status-inactive'}`}><span />{resource.isActive ? 'Активен' : 'В архиве'}</span></td><td><div className="table-actions"><button className="icon-button" title="Редактировать" onClick={() => { setEditingResource(resource); setResourceFormOpen(true) }}><Settings2 size={16} /></button><button className="icon-button" title={resource.isActive ? 'Скрыть из каталога' : 'Вернуть в каталог'} onClick={() => toggleResource(resource)}>{resource.isActive ? <X size={16} /> : <Check size={16} />}</button><button className="icon-button danger-hover" title="Архивировать" onClick={() => archiveResource(resource)}><MoreHorizontal size={16} /></button></div></td></tr>)}</tbody></table></div>
              {adminResources.length === 0 && <div className="table-empty">Пока нет ресурсов. Добавь первый, чтобы он появился в каталоге.</div>}
            </div>
          </div>
        )}

        <footer className="main-footer"><span>© 2026 LabSlot</span><span>СОЗДАНО ДЛЯ ЛЮБОПЫТНЫХ <span className="footer-dot">✳</span></span><span>Campus edition · 1.0</span></footer>
      </main>

      {authOpen && <AuthModal mode={authMode} setMode={setAuthMode} onClose={() => setAuthOpen(false)} onSubmit={handleAuthSubmit} busy={busy} />}
      {selectedResource && user && <BookingModal resource={selectedResource} onClose={() => setSelectedResource(null)} onBooked={async () => { setSelectedResource(null); await refreshBookings(); notify('Ресурс забронирован. Он появился в твоём расписании.') }} notify={notify} />}
      {resourceFormOpen && isAdmin && <ResourceModal resource={editingResource} onClose={() => { setResourceFormOpen(false); setEditingResource(null) }} onSave={saveResource} busy={busy} />}
      {notice && <div key={notice.key} className={`toast toast-${notice.type}`} role="status"><span className="toast-check">{notice.type === 'error' ? <X size={17} /> : notice.type === 'info' ? <Bell size={16} /> : <CheckCircle2 size={17} />}</span><span>{notice.message}</span><button onClick={() => setNotice(null)} aria-label="Закрыть уведомление"><X size={15} /></button></div>}
    </div>
  )
}

function BoxIcon() {
  return <Monitor size={19} />
}

function ResourceCard({ resource, index, onBook }) {
  const [categoryLabel, setCategoryLabel] = useState(false)
  const iconSet = resource.category === 'Equipment' ? [Cpu, Activity, Wrench] : resource.category === 'Workspace' ? [Armchair, Monitor, Users] : [DoorOpen, Users, Monitor]
  const Illustration = iconSet[index % iconSet.length]
  const accent = CATEGORY_ACCENTS[resource.category] || 'mint'
  return (
    <article className="resource-card" style={{ animationDelay: `${index * 45}ms` }}>
      <div className={`resource-visual visual-${accent}`}>
        <div className="visual-topline"><span className="visual-category"><span className="visual-category-dot" />{CATEGORY_LABELS[resource.category] || resource.category}</span><button className="card-more" title="Информация о ресурсе" onClick={() => setCategoryLabel(!categoryLabel)}><MoreHorizontal size={19} /></button></div>
        <div className="resource-illustration"><div className="illustration-backdrop" /><Illustration size={52} strokeWidth={1.25} /><span className="illustration-spark spark-a">✳</span><span className="illustration-spark spark-b">·</span></div>
        <div className="visual-bottomline"><span>LS / {String(index + 1).padStart(2, '0')}</span><span className="capacity-label"><Users size={13} /> до {resource.capacity}</span></div>
      </div>
      <div className="resource-card-content">
        <div className="resource-title-line"><h3>{resource.name}</h3><span className="resource-status-dot" title="Доступен для бронирования" /></div>
        <p className="resource-description">{resource.description}</p>
        {categoryLabel && <p className="resource-extra"><IconMark category={resource.category} size={14} /> Можно забронировать на срок до 8 часов.</p>}
        <div className="resource-meta"><span><MapPin size={14} />{resource.location}</span><span><Clock3 size={14} /> По расписанию</span></div>
        <button className="resource-book-button" onClick={() => onBook(resource)}><span>Забронировать</span><span className="book-button-icon"><ArrowUpRight size={16} /></span></button>
      </div>
    </article>
  )
}

function BookingRow({ booking, onCancel, showUser = false }) {
  const isUpcoming = booking.status === 'Confirmed' && isFuture(booking.startAt)
  const isCancelled = booking.status === 'Cancelled'
  const Icon = CATEGORY_ICONS[booking.resourceCategory] || Atom
  return (
    <article className={`booking-row ${isCancelled ? 'booking-cancelled' : ''}`}>
      <div className={`booking-date-block ${isUpcoming ? 'date-upcoming' : ''}`}><strong>{new Intl.DateTimeFormat('ru-RU', { day: '2-digit' }).format(new Date(booking.startAt))}</strong><span>{new Intl.DateTimeFormat('ru-RU', { month: 'short' }).format(new Date(booking.startAt)).replace('.', '')}</span></div>
      <div className={`booking-row-icon ${CATEGORY_ACCENTS[booking.resourceCategory] || 'mint'}`}><Icon size={21} strokeWidth={1.7} /></div>
      <div className="booking-main"><strong>{booking.resourceName}</strong><span><MapPin size={13} />{booking.location}</span><span className="booking-time"><Clock3 size={13} />{formatTime(booking.startAt)} — {formatTime(booking.endAt)}</span>{showUser && <span className="booking-owner"><Users size={13} />{booking.userName}</span>}</div>
      <div className="booking-row-side"><span className={`status-pill ${isCancelled ? 'status-inactive' : isUpcoming ? 'status-active' : 'status-past'}`}><span />{isCancelled ? 'Отменено' : isUpcoming ? 'Предстоит' : 'Завершено'}</span>{isUpcoming && <button className="text-link cancel-link" onClick={() => onCancel(booking)}>Отменить</button>}</div>
    </article>
  )
}

function AuthModal({ mode, setMode, onClose, onSubmit, busy }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const registering = mode === 'register'

  function submit(event) {
    event.preventDefault()
    onSubmit(registering ? { name: name.trim(), email: email.trim(), password } : { email: email.trim(), password })
  }

  return (
    <Modal onClose={onClose} size="narrow">
      <div className="auth-modal-content">
        <div className="modal-brand"><span className="brand-symbol"><FlaskConical size={20} /></span><span className="brand-name">labslot<span>.</span></span></div>
        <div className="modal-eyebrow">ТВОЁ ПРОСТРАНСТВО ДЛЯ ИДЕЙ</div>
        <h2>{registering ? 'Создай свой аккаунт' : 'Рады видеть тебя'}</h2>
        <p className="auth-subtitle">{registering ? 'Зарегистрируйся, чтобы бронировать ресурсы кампуса.' : 'Войди, чтобы продолжить работу над своими проектами.'}</p>
        <form onSubmit={submit} className="form-stack">
          {registering && <label className="field-label">Имя и фамилия<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={80} placeholder="Александр Иванов" /></label>}
          <label className="field-label">Электронная почта<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="name@university.edu" /></label>
          <label className="field-label">Пароль<span className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={registering ? 8 : 1} maxLength={100} placeholder={registering ? 'Не менее 8 символов' : 'Введи пароль'} /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Скрыть' : 'Показать'}</button></span></label>
          <button type="submit" className="button button-dark auth-submit" disabled={busy}>{busy ? 'Подожди…' : registering ? 'Создать аккаунт' : 'Войти в аккаунт'} <ArrowRight size={16} /></button>
        </form>
        <div className="auth-switch">{registering ? 'Уже есть аккаунт?' : 'Впервые в LabSlot?'} <button onClick={() => setMode(registering ? 'login' : 'register')}>{registering ? 'Войти' : 'Создать аккаунт'}</button></div>
        {!registering && <div className="demo-hint"><ShieldCheck size={15} /><span>Для демо: <strong>demo@labslot.local</strong> / <strong>Demo123!</strong></span></div>}
      </div>
    </Modal>
  )
}

function BookingModal({ resource, onClose, onBooked, notify }) {
  const [date, setDate] = useState(getLocalDateValue())
  const [startTime, setStartTime] = useState('10:00')
  const [duration, setDuration] = useState('1')
  const [availability, setAvailability] = useState([])
  const [loadingAvailability, setLoadingAvailability] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState('')
  const slots = Array.from({ length: 9 }, (_, index) => `${String(index + 9).padStart(2, '0')}:00`)
  const requestedStart = new Date(`${date}T${startTime}:00`)
  const requestedEnd = new Date(requestedStart.getTime() + Number(duration) * 60 * 60 * 1000)
  const dayIsPast = date < getLocalDateValue()
  const slotIsPast = requestedStart.getTime() <= Date.now() + 60_000
  const tooLate = requestedEnd.getHours() < requestedStart.getHours() || requestedEnd.getDate() !== requestedStart.getDate()

  useEffect(() => {
    let cancelled = false
    async function loadAvailability() {
      setLoadingAvailability(true)
      setLoadError('')
      try {
        const from = new Date(`${date}T00:00:00`).toISOString()
        const to = new Date(`${date}T23:59:59`).toISOString()
        const items = await api.availability(resource.id, from, to)
        if (!cancelled) setAvailability(items)
      } catch (error) {
        if (!cancelled) setLoadError(error.message)
      } finally {
        if (!cancelled) setLoadingAvailability(false)
      }
    }
    loadAvailability()
    return () => { cancelled = true }
  }, [resource.id, date])

  function isUnavailable(slot) {
    const start = new Date(`${date}T${slot}:00`)
    const end = new Date(start.getTime() + Number(duration) * 60 * 60 * 1000)
    if (start <= new Date()) return true
    if (end.getDate() !== start.getDate()) return true
    return availability.some((block) => new Date(block.startAt) < end && new Date(block.endAt) > start)
  }

  async function submit(event) {
    event.preventDefault()
    if (dayIsPast || slotIsPast || tooLate || isUnavailable(startTime)) {
      notify('Выбранный интервал недоступен. Проверьте дату и время.', 'error')
      return
    }
    setSubmitting(true)
    try {
      await api.createBooking({ resourceId: resource.id, startAt: requestedStart.toISOString(), endAt: requestedEnd.toISOString() })
      await onBooked()
    } catch (error) {
      notify(error.message, 'error')
      if (error.message.toLowerCase().includes('зан')) {
        try {
          const from = new Date(`${date}T00:00:00`).toISOString()
          const to = new Date(`${date}T23:59:59`).toISOString()
          setAvailability(await api.availability(resource.id, from, to))
        } catch { /* The next attempt will show the server response. */ }
      }
    } finally {
      setSubmitting(false)
    }
  }

  const CategoryIcon = CATEGORY_ICONS[resource.category] || Atom

  return (
    <Modal onClose={onClose} size="booking">
      <div className="booking-modal-layout">
        <div className="booking-modal-side">
          <div className={`booking-modal-art visual-${CATEGORY_ACCENTS[resource.category] || 'mint'}`}><CategoryIcon size={58} strokeWidth={1.25} /><span className="booking-art-mark">LS / RESOURCES</span></div>
          <span className="modal-eyebrow">НОВАЯ БРОНЬ</span>
          <h2>{resource.name}</h2>
          <p>{resource.description}</p>
          <div className="booking-side-meta"><span><MapPin size={15} />{resource.location}</span><span><Users size={15} />До {resource.capacity} {pluralize(resource.capacity, 'человека', 'человек', 'человек')}</span></div>
          <div className="booking-side-note"><CheckCircle2 size={16} /><span>Бронь подтвердится сразу после создания.</span></div>
        </div>
        <div className="booking-modal-form-wrap">
          <div className="modal-topline"><span className="section-overline">ВЫБЕРИ ВРЕМЯ</span><button className="modal-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button></div>
          <form onSubmit={submit} className="form-stack booking-form">
            <label className="field-label">Дата посещения<input type="date" value={date} min={getLocalDateValue()} onChange={(event) => setDate(event.target.value)} required /></label>
            <div className="field-label">Начало сессии<div className="time-slot-grid">{slots.map((slot) => {
              const disabled = isUnavailable(slot)
              return <button type="button" key={slot} disabled={disabled || loadingAvailability || dayIsPast} className={`time-slot ${startTime === slot ? 'time-slot-selected' : ''}`} onClick={() => setStartTime(slot)}>{slot}</button>
            })}</div>{loadingAvailability && <small className="field-hint">Проверяем свободное время…</small>}</div>
            <label className="field-label">Длительность<select value={duration} onChange={(event) => setDuration(event.target.value)}><option value="1">1 час</option><option value="2">2 часа</option><option value="3">3 часа</option><option value="4">4 часа</option><option value="6">6 часов</option><option value="8">8 часов</option></select></label>
            {loadError && <div className="form-error">{loadError}</div>}
            <div className="booking-total"><div><span>Время бронирования</span><strong>{startTime} — {String(requestedEnd.getHours()).padStart(2, '0')}:{String(requestedEnd.getMinutes()).padStart(2, '0')}</strong></div><span className="total-date">{formatDate(`${date}T12:00:00`)}</span></div>
            <button type="submit" className="button button-dark booking-submit" disabled={submitting || loadingAvailability || dayIsPast || slotIsPast || tooLate || isUnavailable(startTime)}>{submitting ? 'Создаём бронь…' : 'Подтвердить бронь'} <ArrowRight size={16} /></button>
            <p className="form-legal">Создавая бронь, ты подтверждаешь, что будешь использовать ресурс по назначению.</p>
          </form>
        </div>
      </div>
    </Modal>
  )
}

function ResourceModal({ resource, onClose, onSave, busy }) {
  const [name, setName] = useState(resource?.name || '')
  const [category, setCategory] = useState(resource?.category || 'Equipment')
  const [location, setLocation] = useState(resource?.location || '')
  const [capacity, setCapacity] = useState(String(resource?.capacity || 1))
  const [description, setDescription] = useState(resource?.description || '')
  const [isActive, setIsActive] = useState(resource?.isActive ?? true)

  function submit(event) {
    event.preventDefault()
    onSave({ name: name.trim(), category, location: location.trim(), capacity: Number(capacity), description: description.trim(), isActive })
  }

  return (
    <Modal onClose={onClose} size="narrow">
      <div className="resource-form-modal"><div className="modal-topline"><div><div className="modal-eyebrow">КАТАЛОГ LABSLOT</div><h2>{resource ? 'Редактировать ресурс' : 'Новый ресурс'}</h2></div><button className="modal-close" onClick={onClose} aria-label="Закрыть"><X size={19} /></button></div>
        <form onSubmit={submit} className="form-stack">
          <label className="field-label">Название<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={120} placeholder="Например, 3D-принтер" /></label>
          <label className="field-label">Категория<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="Equipment">Оборудование</option><option value="Workspace">Рабочее место</option><option value="Room">Помещение</option></select></label>
          <label className="field-label">Расположение<input value={location} onChange={(event) => setLocation(event.target.value)} required minLength={2} maxLength={120} placeholder="Корпус, этаж, номер" /></label>
          <label className="field-label">Вместимость<input type="number" min="1" max="100" value={capacity} onChange={(event) => setCapacity(event.target.value)} required /></label>
          <label className="field-label">Описание<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows="3" required minLength={5} maxLength={600} placeholder="Что это за ресурс и для чего он подходит" /></label>
          <label className="checkbox-field"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} /><span>Показывать в каталоге</span></label>
          <div className="modal-action-row"><button type="button" className="button button-light" onClick={onClose}>Отмена</button><button type="submit" className="button button-dark" disabled={busy}>{busy ? 'Сохраняем…' : resource ? 'Сохранить изменения' : 'Добавить ресурс'} <ArrowRight size={16} /></button></div>
        </form>
      </div>
    </Modal>
  )
}

function Modal({ children, onClose, size = 'default' }) {
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const initialOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = initialOverflow
    }
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className={`modal-panel modal-${size}`} role="dialog" aria-modal="true">{children}</div></div>
}

function pluralize(number, one, few, many) {
  const mod10 = number % 10
  const mod100 = number % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export default App
