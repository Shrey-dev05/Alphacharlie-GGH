from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import TokenData, get_optional_current_user
from app.db.database import get_db
from app.models.models import ChatMessage
from app.schemas.schemas import ChatRequest, ChatResponse
from app.services import rag_chatbot_service

router = APIRouter(prefix="/chatbot", tags=["chatbot"])


@router.post("/ask", response_model=ChatResponse)
def ask(payload: ChatRequest, current: TokenData | None = Depends(get_optional_current_user), db: Session = Depends(get_db)):
    result = rag_chatbot_service.answer_question(payload.message)

    if current and current.username:
        try:
            db.add(ChatMessage(user_id=current.username, session_id=payload.session_id, role="user", content=payload.message))
            db.add(
                ChatMessage(
                    user_id=current.username,
                    session_id=payload.session_id,
                    role="assistant",
                    content=result["reply"],
                    cited_rules=result["cited_rules"],
                )
            )
            db.commit()
        except Exception:
            db.rollback()

    return ChatResponse(reply=result["reply"], cited_rules=result["cited_rules"])
