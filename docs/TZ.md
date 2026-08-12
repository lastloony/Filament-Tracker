# ТЗ: Filament Tracker

Приложение для учёта филамента: количество, стоимость, бренд, личный рейтинг.

## Стек

- **Backend:** Python 3.13, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2
- **DB:** SQLite (файл в volume)
- **Auth:** JWT (httpOnly cookie), один пользователь
- **Frontend:** React + Vite, TanStack Table, Recharts
- **Proxy/внешний доступ:** Caddy (reverse proxy + автоматический HTTPS через Let's Encrypt), домен: см. `.env` / приватный конфиг сервера (не хранить в публичном репо)
- **Деплой:** Docker Compose на VM (VPS с белым статическим IP)

## Структура репозитория

```
filament-tracker/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py          # настройки из .env (SECRET_KEY, DATABASE_URL, ADMIN_PASSWORD_HASH)
│   │   ├── database.py        # engine, SessionLocal, get_db
│   │   ├── models.py          # SQLAlchemy ORM
│   │   ├── schemas.py         # Pydantic схемы
│   │   ├── crud.py
│   │   ├── auth.py            # хэш пароля, JWT create/verify, dependency get_current_user
│   │   └── routers/
│   │       ├── auth.py        # /auth/login, /auth/logout
│   │       ├── filaments.py   # /filaments CRUD
│   │       └── stats.py       # /stats/*
│   ├── alembic/
│   ├── alembic.ini
│   ├── pyproject.toml      # зависимости и метаданные (менеджер пакетов — uv)
│   ├── uv.lock
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/                # клиент к backend (fetch/axios обёртка)
│   │   ├── pages/
│   │   │   ├── FilamentList.tsx
│   │   │   ├── FilamentForm.tsx
│   │   │   ├── Stats.tsx
│   │   │   └── Login.tsx
│   │   ├── components/
│   │   └── App.tsx
│   ├── Dockerfile
│   └── nginx.conf
├── caddy/
│   └── Caddyfile
├── docker-compose.yml
├── .env.example
└── data/                       # volume, sqlite-файл (гитигнор)
```

## Модель данных

### Filament

| Поле | Тип | Обязательное | Комментарий |
|---|---|---|---|
| id | int, PK | auto | |
| brand | str | да | бренд |
| material | str | да | PLA / PETG / ABS / ASA / TPU / прочее (enum или свободная строка) |
| color | str | нет | |
| weight_total_g | int | да | вес катушки при покупке, грамм |
| weight_remaining_g | int | да | текущий остаток, грамм (обновляется вручную) |
| price | decimal | да | цена покупки |
| currency | str | да | по умолчанию из конфига, напр. EUR |
| price_per_kg | decimal | вычисляемое | price / (weight_total_g/1000), не хранить, считать на лету |
| rating | int (1–5) | нет | личная оценка, может быть null пока не попробовал |
| vendor | str | нет | где куплено |
| purchase_date | date | нет | |
| notes | text | нет | свободный текст |
| created_at | datetime | auto | |
| updated_at | datetime | auto | |

Задел на будущее (не реализовывать сейчас, но не блокировать миграциями): таблица `print_jobs` (id, filament_id FK, weight_used_g, printed_at, model_name) — добавится отдельной Alembic-миграцией, когда будет решение.

## API

Все `/filaments/*` и `/stats/*` защищены авторизацией (JWT из cookie).

```
POST   /auth/login              { username, password } -> ставит httpOnly cookie
POST   /auth/logout

GET    /filaments                ?brand=&material=&rating_min=&sort=&order=
POST   /filaments
GET    /filaments/{id}
PATCH  /filaments/{id}
DELETE /filaments/{id}

GET    /stats/by-brand           # сумма потрачено, кол-во катушек, средний рейтинг на бренд
GET    /stats/by-material
GET    /stats/summary            # общий остаток в кг, общая сумма вложений, средний рейтинг
```

Пагинация на `GET /filaments` — `limit`/`offset`, дефолт limit=50.

## Auth

- Один пользователь, логин/пароль заданы в `.env` (пароль хранится как bcrypt-хэш).
- `POST /auth/login` проверяет пароль, выдаёт JWT (срок жизни, напр. 7 дней), кладёт в httpOnly+secure cookie.
- Dependency `get_current_user` в защищённых роутерах проверяет cookie.
- `POST /auth/logout` чистит cookie.

## Frontend (React)

Страницы:
1. **Login** — форма логин/пароль.
2. **FilamentList** — таблица (TanStack Table): сортировка по цене/рейтингу/остатку, фильтр по бренду/материалу, инлайн-редактирование остатка.
3. **FilamentForm** — добавление/редактирование записи (модалка или отдельная страница).
4. **Stats** — графики (Recharts): расходы по брендам, распределение рейтингов, остаток в кг по материалам.

## Docker Compose

Сервисы: `backend`, `frontend`, `caddy`. Деплой на том же сервере, куда уже указывает используемый домен.

```yaml
services:
  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    depends_on:
      - backend
      - frontend

  backend:
    build: ./backend
    volumes:
      - ./data:/app/data
    env_file: .env
    expose:
      - "8000"

  frontend:
    build: ./frontend
    expose:
      - "80"

volumes:
  caddy_data:
```

`caddy/Caddyfile` — **не коммитить в публичный репозиторий с реальным доменом** (можно попасть в scope сканеров/спама на поддомен). Хранить локально на сервере или в `.gitignore`, в репо оставить `caddy/Caddyfile.example`:

```
your-domain.example {
    reverse_proxy /api/* backend:8000
    reverse_proxy frontend:80
}
```

`.env.example` должен содержать: `SECRET_KEY`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `DATABASE_URL`.

### Эксплуатация VM

Подробная пошаговая инструкция (firewall, бэкапы, fail2ban, обновление) — `docs/DEPLOY.md`.

- **Бэкапы:** cron-задача `sqlite3 .backup` на файл в `./data`, выгрузка снапшота во внешнее хранилище (S3-совместимое/облако) на регулярной основе.
- **Файрвол:** открыты только 80/443 (и SSH на нестандартном порту/по ключу). Рекомендуется `fail2ban` или rate-limiting на уровне Caddy, так как порты открыты всему интернету.
- **Обновления хост-ОС:** VM обслуживается вручную (unattended-upgrades или регулярный `apt upgrade`), в отличие от домашнего варианта это полностью на тебе.
- **Ресурсы:** для стека FastAPI + SQLite + React достаточно минимальной VM (1 vCPU / 1–2GB RAM).

## Этапы реализации (для последовательной работы в PyCharm)

1. **Backend skeleton**: FastAPI app, models.py, database.py, первая Alembic-миграция, CRUD для Filament без auth — проверить руками через `/docs` (Swagger).
2. **Auth**: login/logout, JWT, защита роутеров.
3. **Stats роутеры**: агрегации через SQLAlchemy (`func.sum`, `func.avg`, `group_by`).
4. **Dockerfile backend** + проверка, что поднимается отдельно (`docker build`, `docker run`).
5. **Frontend skeleton**: Vite + React, страница логина, вызов `/auth/login`.
6. **FilamentList + FilamentForm**: CRUD через API.
7. **Stats-страница** с графиками.
8. **Dockerfile frontend** (multi-stage: build + nginx для отдачи статики).
9. **docker-compose.yml**, проверка связки backend+frontend локально.
10. **Деплой**: поднять Docker и Docker Compose на сервере (домен уже указывает на него), создать локально `caddy/Caddyfile` из `Caddyfile.example` с реальным доменом (не коммитить), добавить `caddy` в compose, открыть 80/443 в файрволе (если облачный провайдер), настроить бэкап SQLite по cron.
11. **Задел под Telegram-бота** (позже, отдельный сервис, дергает тот же backend API) — не реализовывать сейчас, только не архитектурить так, чтобы это стало невозможным.

## Не входит в текущий scope

- PrintJob / учёт расхода по печатям — решение отложено.
- Telegram-бот — отдельная задача позже.
- Многопользовательский доступ — не нужен сейчас, но JWT-подход это не блокирует.
