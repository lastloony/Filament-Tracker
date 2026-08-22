# Filament Tracker

Личный трекер филамента для 3D-печати: количество, стоимость, бренд, личный рейтинг катушек. Исходное ТЗ (архив) — [`docs/archive/TZ.md`](docs/archive/TZ.md), планы на будущее — [`docs/ROADMAP.md`](docs/ROADMAP.md).

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
    models.py         # SQLAlchemy-модели: Filament, Brand, Material, Currency
    schemas.py         # Pydantic-схемы
    crud.py           # CRUD + агрегации для статистики
    auth.py           # JWT, bcrypt, get_current_user
    routers/
      auth.py          # /api/auth/login, /logout, /me
      filaments.py       # /api/filaments CRUD
      settings.py        # /api/settings/brands, /materials, /currencies
      stats.py          # /api/stats/*
  alembic/            # миграции БД
  pyproject.toml / uv.lock
  Dockerfile

frontend/
  src/
    api/              # обёртки над fetch к /api/*
    pages/             # Login, Overview, FilamentList, FilamentForm, Stats, Settings
    App.tsx            # роутинг, проверка сессии
  nginx.conf           # раздача статики + прокси /api для локального docker compose
  Dockerfile

caddy/
  Caddyfile.example      # реальный Caddyfile с доменом не коммитится (см. .gitignore)

docker-compose.yml       # backend + frontend + caddy
docs/
  ROADMAP.md            # что не реализовано / отложено
  DEPLOY.md            # инструкция по деплою на VPS
  archive/
    TZ.md              # исходное ТЗ (архив, не обновляется)
```

## Что реализовано

- CRUD катушек (`/api/filaments`): фильтры по бренду/материалу, сортировка, пагинация, `price_per_kg` считается на лету
- Авторизация: логин/логаут, JWT в httpOnly cookie, все `/api/filaments/*` и `/api/stats/*` защищены
- Статистика (`/api/stats/*`): расходы и остаток по брендам/материалам, распределение рейтингов, общая сводка (вложено — с разбивкой по валюте, если их несколько)
- Остатки (`/api/stats/overview`): сводка «с первого взгляда» — сколько пластика по типу/цвету (со свотчем цвета) и список катушек, которые пора дозаказать; стартовая страница приложения
- Настройки (`/api/settings/*`): справочники брендов, типов филамента и валют — просмотр и добавление новых значений; одна валюта помечена как базовая (по умолчанию RUB), её можно сменить; правила порога «пора дозаказать» по материалу+цвету, опционально с привязкой к производителю (без правила — общий порог 300 г)
- Фронтенд: страница логина, страница остатков (стартовая), таблица катушек с инлайн-редактированием остатка и свотчем цвета, форма добавления/редактирования (бренд/материал — подсказки из справочников настроек, валюта — выбор из списка, цвет — палитра + свой оттенок), страница статистики с графиками, страница настроек
- Docker: отдельные образы backend (uv, миграции накатываются при старте контейнера) и frontend (multi-stage, nginx), полная сборка через `docker-compose.yml` с Caddy как единственной точкой входа

Не реализовано / отложено — см. [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Локальный запуск

### Вариант 0 — один скрипт (Windows, PowerShell)

```powershell
.\scripts\dev.ps1
```

Проверяет `python`/`uv`/`npm` в PATH. При первом запуске создаёт `backend/.env`, спрашивает пароль для `admin` (Enter — будет пароль `admin`) и сам генерирует `SECRET_KEY` и bcrypt-хэш — руками ничего заполнять не нужно. Дальше сам делает `uv sync` + `alembic upgrade head` и `npm install`, поднимает backend и frontend каждый в своём окне PowerShell и открывает `localhost:5173` в браузере. По сути автоматизирует «Вариант 1» ниже — Docker он не трогает.

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
