from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    esi_base_url: str = "https://esi.evetech.net/latest"

    model_config = {"env_file": ".env"}


settings = Settings()
