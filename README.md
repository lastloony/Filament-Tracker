# Filament Tracker

Личный трекер филамента для 3D-печати: количество, стоимость, бренд, личный рейтинг катушек. Полное ТЗ — [`docs/TZ.md`](docs/TZ.md).

## Стек

- **Backend:** Python 3.13, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, [uv](https://docs.astral.sh/uv/)
- **DB:** SQLite
- **Auth:** JWT в httpOnly cookie, один пользователь
- **Frontend:** React + Vite + TypeScript, TanStack Table, Recharts, React Router
- **Proxy:** Caddy (reverse proxy + автоматический HTTPS)
- **Деплой:** Docker Compose

## Структура

```
backend/
  app/
    main.py          # FastAPI app, роуты смонтированы под /api
    config.py         # настройки из .env
    database.py        # engine, SessionLocal, get_db
    models.py         # SQLAlchemy-модель Filament
    schemas.py         # Pydantic-схемы
    crud.py           # CRUD + агрегации для статистики
    auth.py           # JWT, bcrypt, get_current_user
    routers/
      auth.py          # /api/auth/login, /logout, /me
      filaments.py       # /api/filaments CRUD
      stats.py          # /api/stats/*
  alembic/            # миграции БД
  pyproject.toml / uv.lock
  Dockerfile

frontend/
  src/
    api/              # обёртки над fetch к /api/*
    pages/             # Login, FilamentList, FilamentForm, Stats
    App.tsx            # роутинг, проверка сессии
  nginx.conf           # раздача статики + прокси /api для локального docker compose
  Dockerfile

caddy/
  Caddyfile.example      # реальный Caddyfile с доменом не коммитится (см. .gitignore)

docker-compose.yml       # backend + frontend + caddy
docs/
  TZ.md               # ТЗ
  DEPLOY.md            # инструкция по деплою на VPS
```

## Что реализовано

- CRUD катушек (`/api/filaments`): фильтры по бренду/материалу, сортировка, пагинация, `price_per_kg` считается на лету
- Авторизация: логин/логаут, JWT в httpOnly cookie, все `/api/filaments/*` и `/api/stats/*` защищены
- Статистика (`/api/stats/*`): расходы и остаток по брендам/материалам, распределение рейтингов, общая сводка
- Фронтенд: страница логина, таблица катушек с инлайн-редактированием остатка, форма добавления/редактирования, страница статистики с графиками
- Docker: отдельные образы backend (uv, миграции накатываются при старте контейнера) и frontend (multi-stage, nginx), полная сборка через `docker-compose.yml` с Caddy как единственной точкой входа

Не реализовано (осознанно, вне текущего scope — см. ТЗ): учёт расхода по печатям (`print_jobs`), Telegram-бот, многопользовательский доступ.

## Локальный запуск

### Вариант 1 — напрямую

Backend:
```bash
cd backend
uv sync
cp ../.env.example .env   # заполнить SECRET_KEY, ADMIN_USERNAME, ADMIN_PASSWORD_HASH
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000
```

Frontend (в отдельном терминале, есть прокси `/api` → `localhost:8000` в `vite.config.ts`):
```bash
cd frontend
npm install
npm run dev
```

### Вариант 2 — через Docker Compose

```bash
cp .env.example .env      # заполнить, см. предупреждение про "$" в bcrypt-хэше внутри файла
cp caddy/Caddyfile.example caddy/Caddyfile   # для локального теста заменить домен на ":80"
docker compose up -d --build
```

Подробности по продовому деплою (firewall, бэкапы, fail2ban) — [`docs/DEPLOY.md`](docs/DEPLOY.md).

Хэш пароля для `ADMIN_PASSWORD_HASH`:
```bash
cd backend && uv run python -c "import bcrypt; print(bcrypt.hashpw(b'пароль', bcrypt.gensalt()).decode())"
```
