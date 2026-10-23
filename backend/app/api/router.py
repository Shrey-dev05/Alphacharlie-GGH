from fastapi import APIRouter

from app.api import analytics, auth, chatbot, consumer, reports, samadhan, scan, system

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(scan.router)
api_router.include_router(reports.router)
api_router.include_router(chatbot.router)
api_router.include_router(analytics.router)
api_router.include_router(system.router)
api_router.include_router(consumer.router)
api_router.include_router(samadhan.router)
