from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(p: str) -> str:
    # bcrypt has a hard 72-byte limit; truncate consistently on both sides
    return pwd_context.hash(p.encode("utf-8")[:72].decode("utf-8", "ignore"))


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(
        plain.encode("utf-8")[:72].decode("utf-8", "ignore"), hashed
    )


def create_access_token(subject: str) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": subject, "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    cred_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        email = payload.get("sub")
        if email is None:
            raise cred_exc
    except JWTError:
        raise cred_exc from None
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise cred_exc
    return user
