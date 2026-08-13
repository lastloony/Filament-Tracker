# Деплой на VPS

Инструкция по деплою (изначально — этап 10 из архивного `docs/archive/TZ.md`). Написана заранее, до реального сервера — команды не обкатаны в бою, при первом деплое сверяться и поправлять по месту.

## Требования

- VPS с белым статическим IP, 1 vCPU / 1–2 GB RAM достаточно.
- Домен, указывающий A-записью на IP сервера (нужен Caddy для автоматического HTTPS).
- Ubuntu/Debian (команды ниже под `apt`).

## 1. Базовая настройка сервера

**SSH:**
- Завести отдельного пользователя (не root), добавить в `sudo`.
- Положить публичный ключ в `~/.ssh/authorized_keys`.
- В `/etc/ssh/sshd_config`: сменить `Port 22` на нестандартный, `PasswordAuthentication no`, `PermitRootLogin no`.
- `sudo systemctl restart ssh`.

**Автообновления ОС:**
```bash
sudo apt update && sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

**Firewall (ufw) — открыты только 80/443 и SSH-порт:**
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow <SSH_PORT>/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 2. Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# перелогиниться, чтобы группа применилась
docker compose version
```

## 3. Разворачивание приложения

```bash
git clone <repo-url> /opt/filament-tracker
cd /opt/filament-tracker

cp .env.example .env
# заполнить SECRET_KEY, ADMIN_USERNAME, ADMIN_PASSWORD_HASH, DATABASE_URL
# ВАЖНО: каждый "$" в bcrypt-хэше удвоить на "$$" — иначе Docker Compose
# интерполирует его как переменную и обрежет значение (см. .env.example).

cp caddy/Caddyfile.example caddy/Caddyfile
# заменить your-domain.example на реальный домен

docker compose up -d --build
docker compose logs -f caddy   # убедиться, что сертификат Let's Encrypt выпустился
```

`caddy/Caddyfile` с реальным доменом не коммитить — он в `.gitignore` намеренно (см. `docs/archive/TZ.md`).

## 4. Бэкапы SQLite

Скрипт `/opt/filament-tracker/backup.sh` (создать на сервере, не в репозитории):

```bash
#!/usr/bin/env bash
set -euo pipefail

DATA_DIR=/opt/filament-tracker/data
BACKUP_DIR=/opt/filament-tracker/backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
sqlite3 "$DATA_DIR/filament.db" ".backup '$BACKUP_DIR/filament_$TIMESTAMP.db'"

# выгрузка в S3-совместимое хранилище, пример через rclone
# (настроить remote заранее: rclone config)
rclone copy "$BACKUP_DIR/filament_$TIMESTAMP.db" remote:filament-tracker-backups/

# хранить локально последние 7 дней
find "$BACKUP_DIR" -name "*.db" -mtime +7 -delete
```

```bash
chmod +x /opt/filament-tracker/backup.sh
crontab -e
# добавить строку (бэкап каждую ночь в 03:00):
0 3 * * * /opt/filament-tracker/backup.sh >> /var/log/filament-backup.log 2>&1
```

`sqlite3` на хосте нужен только для этого скрипта: `sudo apt install -y sqlite3`.

## 5. Rate limiting / fail2ban

Порты 80/443 открыты всему интернету — базовая защита через fail2ban по логам Caddy.

В `caddy/Caddyfile` добавить логирование:
```
your-domain.example {
    log {
        output file /var/log/caddy/access.log
        format json
    }
    reverse_proxy /api/* backend:8000
    reverse_proxy frontend:80
}
```
и примонтировать `/var/log/caddy` томом в `docker-compose.yml` для сервиса `caddy`.

```bash
sudo apt install -y fail2ban
```

`/etc/fail2ban/filter.d/caddy-req-limit.conf`:
```ini
[Definition]
failregex = ^.*"client_ip":"<HOST>".*"status":4\d\d.*$
ignoreregex =
```

`/etc/fail2ban/jail.local`:
```ini
[caddy-req-limit]
enabled = true
filter = caddy-req-limit
logpath = /var/log/caddy/access.log
maxretry = 20
findtime = 60
bantime = 3600
```

Это стартовая точка (детектит всплеск 4xx с одного IP), не проверялось на реальном трафике — после первого деплоя посмотреть на живые логи и подстроить `maxretry`/`findtime`.

## 6. Обновление приложения

```bash
cd /opt/filament-tracker
git pull
docker compose up -d --build
```

Alembic-миграции накатываются автоматически при старте `backend` (см. `backend/Dockerfile`).

## 7. Проверка после деплоя

```bash
curl -s https://your-domain.example/api/health
curl -s https://your-domain.example/api/version
```

Открыть домен в браузере, проверить логин и что `/filaments`, `/stats` работают через HTTPS.
