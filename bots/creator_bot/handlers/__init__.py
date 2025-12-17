from aiogram import Router

from .start import router as start_router
from .tournaments import router as tournaments_router

router = Router()
router.include_router(start_router)
router.include_router(tournaments_router)
