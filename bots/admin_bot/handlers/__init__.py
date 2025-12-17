from aiogram import Router

from .settings import router as settings_router
from .creators import router as creators_router

router = Router()
router.include_router(settings_router)
router.include_router(creators_router)

