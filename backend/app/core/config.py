"""Application configuration."""
import os


def get_required_env(name: str) -> str:
	value = os.getenv(name)
	if not value:
		raise RuntimeError(f"{name} is not set")
	return value


def get_required_bool_env(name: str) -> bool:
	value = get_required_env(name).strip().lower()
	if value in {"1", "true", "yes", "on"}:
		return True
	if value in {"0", "false", "no", "off"}:
		return False
	raise RuntimeError(f"{name} must be a boolean value")


# JWT settings
SECRET_KEY = get_required_env("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # 1 hour
ACCESS_TOKEN_EXPIRE_MINUTES_REMEMBER = 24 * 60  # 24 hours
COOKIE_SECURE = get_required_bool_env("COOKIE_SECURE")

# Database
DATABASE_URL = get_required_env("DATABASE_URL")
