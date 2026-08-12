from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    secret_key: str
    database_url: str = "sqlite:///./data/filament.db"
    admin_username: str
    admin_password_hash: str
    default_currency: str = "EUR"
    cookie_secure: bool = True


settings = Settings()
