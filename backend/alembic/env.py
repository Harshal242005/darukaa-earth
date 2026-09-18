from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool, text

from alembic import context
from app import models  # noqa: F401
from app.config import settings
from app.database import Base

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

ALLOWED_SCHEMAS = {None, "public"}
IGNORED_TABLES = {"spatial_ref_sys", "alembic_version"}


def include_name(name, type_, parent_names):
    if type_ == "schema":
        return name in ALLOWED_SCHEMAS
    if type_ == "table":
        if parent_names.get("schema_name") not in ALLOWED_SCHEMAS:
            return False
        return name not in IGNORED_TABLES
    return True


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_name=include_name,
        include_schemas=False,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        # Critical: PostGIS ships sample data in tiger/topology schemas that
        # the default search_path includes. Force only "public".
        connection.execute(text("SET search_path TO public"))
        connection.commit()
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_name=include_name,
            include_schemas=False,
            version_table_schema="public",
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
