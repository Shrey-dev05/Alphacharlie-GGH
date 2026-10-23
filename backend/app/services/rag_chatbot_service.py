"""
Metrology Bot -- Retrieval-Augmented legal assistant
======================================================
Retrieval strategy: the full legal corpus is chunked into rule-level
entries pulled from two sources:
  1. app/data/legal_metrology_rules.json -- the structured rules engine
     seed (converted to rich chunks including keywords, descriptions,
     font size bands, and misleading pricing patterns).
  2. app/data/legal_metrology_corpus/*.txt and *.jsonl -- free-form corpus
     files, including expanded_dataset.jsonl with Q&A pairs and Hinglish
     translations.

We use TF-IDF vectorization (scikit-learn) with English + Hinglish stopword
filtering, n-grams, and hybrid keyword/rule-number boosting to provide
accurate, pinpoint retrieval for inspectors, auditors, and manufacturers.

MULTI-PROVIDER LLM SUPPORT
-----------------------------
`CHATBOT_PROVIDER` in config.py selects which LLM reasons over the
retrieved context: "gemini" (Google) or "anthropic" (Claude). Both paths
share the same retrieval + system prompt + graceful no-key fallback.
"""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
RULES_JSON_PATH = DATA_DIR / "legal_metrology_rules.json"
CORPUS_DIR = DATA_DIR / "legal_metrology_corpus"

# Common stopwords across English and Hinglish to prevent irrelevant chunk matches
STOP_WORDS = [
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "as", "at", "be", "because", "been", "before", "being", "below",
    "between", "both", "but", "by", "can", "could", "did", "do", "does", "doing",
    "down", "during", "each", "few", "for", "from", "further", "had", "has", "have",
    "having", "he", "her", "here", "hers", "herself", "him", "himself", "his", "how",
    "i", "if", "in", "into", "is", "it", "its", "itself", "just", "me", "more", "most",
    "my", "myself", "no", "nor", "not", "now", "of", "off", "on", "once", "only", "or",
    "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she", "should",
    "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves",
    "then", "there", "these", "they", "this", "those", "through", "to", "too", "under",
    "until", "up", "very", "was", "we", "were", "what", "when", "where", "which", "while",
    "who", "whom", "why", "with", "would", "you", "your", "yours", "yourself",
    # Hinglish common words
    "kya", "hai", "hain", "ko", "ki", "ka", "ke", "par", "pe", "mein", "se", "aur",
    "ya", "nahi", "nahin", "hota", "hoti", "hote", "bhi", "yeh", "woh", "kar",
    "sakte", "sakta", "sakti", "liye", "kisi", "batao", "bataiye", "karein"
]


def _load_corpus_chunks() -> list[dict]:
    """Builds a flat list of {rule_reference, text} chunks from the
    structured rules JSON plus any .txt/.jsonl files dropped into
    legal_metrology_corpus/.
    """
    chunks: list[dict] = []

    if RULES_JSON_PATH.exists():
        with open(RULES_JSON_PATH, "r", encoding="utf-8") as f:
            rules = json.load(f)

        # 1. Mandatory Declarations
        for d in rules.get("mandatory_declarations", []):
            ref = d.get("rule_reference", "Mandatory Declaration")
            label = d.get("label", "")
            field = d.get("field", "")
            severity = d.get("severity", "")
            keywords = ", ".join(d.get("keywords", []))
            keywords_text = f" Keywords/indicators: {keywords}." if keywords else ""
            chunks.append(
                {
                    "rule_reference": ref,
                    "text": (
                        f"{ref}: {label} (Field: {field}). Severity if missing or non-compliant: {severity}."
                        f"{keywords_text}"
                    ),
                }
            )

        # 2. Font Size Rules
        font = rules.get("font_size_rules", {})
        if font:
            bands = ", ".join(
                f"up to {b['max_area_cm2']}cm2 -> min numeral height {b['min_numeral_height_mm']}mm"
                if b.get("max_area_cm2")
                else f"above 500cm2 -> min numeral height {b['min_numeral_height_mm']}mm"
                for b in font.get("numeral_height_by_pdp_area_mm", [])
            )
            chunks.append(
                {
                    "rule_reference": font.get("rule_reference", "Rule 7"),
                    "text": (
                        f"{font.get('rule_reference', 'Rule 7')}: {font.get('description', '')} "
                        f"Minimum letter height is {font.get('min_letter_height_mm', 1.0)} mm in any case. "
                        f"Numeral height bands by Principal Display Panel (PDP) area: {bands}. "
                        f"Minimum width to height ratio: width must be at least 1/3 of height."
                    ),
                }
            )

        # 3. Misleading Pricing & Units
        for p in rules.get("misleading_pricing_patterns", []):
            chunks.append(
                {
                    "rule_reference": p.get("rule_reference", "Misleading Pricing Rule"),
                    "text": f"{p.get('rule_reference')}: {p.get('description')} (Governing field: {p.get('field')}).",
                }
            )

        # 4. Regulations scope descriptions
        for reg_key, reg_val in rules.get("regulations", {}).items():
            chunks.append(
                {
                    "rule_reference": reg_val.get("name", reg_key),
                    "text": f"{reg_val.get('name')}: Applicability: {reg_val.get('applicability')}. {reg_val.get('description')}",
                }
            )

    # 5. Core provisions explicitly added for high precision
    explicit_clauses = [
        {
            "rule_reference": "Rule 6(1)(e)",
            "text": (
                "Rule 6(1)(e): Retail Sale Price / Maximum Retail Price (MRP). Every pre-packaged commodity "
                "must bear the retail sale price inclusive of all taxes, formatted strictly as 'Maximum or Max. retail price Rs.../Rs... "
                "(inclusive of all taxes)' or 'MRP Rs.../Rs... (incl. of all taxes)'. Charging above MRP or adding separate "
                "taxes/cooling charges is illegal. Hinglish: MRP hamesha inclusive of all taxes likhna zaroori hai, "
                "aur MRP se zyada charge karna illegal hai."
            ),
        },
        {
            "rule_reference": "Rule 6(1)(g) (Country of Origin)",
            "text": (
                "Rule 6(1)(g) / 2017 Amendment: Country of Origin. For imported goods, the country of origin or "
                "manufacture must be explicitly declared on the package label (e.g., 'Country of Origin: [Country]' or "
                "'Made in [Country]'). Displaying only the foreign manufacturer without Indian importer and country of origin is non-compliant. "
                "Hinglish: Imported goods par Country of Origin aur Indian importer ka naam/address likhna mandatory hai."
            ),
        },
        {
            "rule_reference": "Rule 18(5) (Prohibition on Price Stickers)",
            "text": (
                "Rule 18(5): Prohibition on price-override stickers. A shopkeeper, dealer, or retailer cannot affix a new sticker "
                "with a higher price over the original manufacturer-printed MRP (e.g., sticking Rs.60 over a printed Rs.50). "
                "Altering MRP using a sticker to charge more is strictly prohibited under the law, regardless of inflation or rising costs. "
                "Hinglish: Shopkeeper purane printed MRP ke upar higher price ka sticker nahi laga sakta."
            ),
        },
        {
            "rule_reference": "Section 36(1), Legal Metrology Act, 2009 (Penalties)",
            "text": (
                "Section 36(1) of the Legal Metrology Act, 2009: Penalties for non-compliant packaging or selling pre-packaged "
                "commodities that do not conform to the declarations. First offense carries a fine extending up to Rs. 25,000; "
                "a second offense carries a fine extending up to Rs. 50,000; and for subsequent offenses, a fine extending up to "
                "Rs. 1,00,000 or imprisonment for up to one year, or both. Hinglish: First offense par up to 25,000, "
                "second offense par up to 50,000 fine lagta hai."
            ),
        },
    ]
    chunks.extend(explicit_clauses)

    # 6. Additional corpus files (.txt and .jsonl)
    if CORPUS_DIR.exists():
        for path in CORPUS_DIR.glob("*.txt"):
            chunks.append({"rule_reference": path.stem, "text": path.read_text(encoding="utf-8")})

        for path in CORPUS_DIR.glob("*.jsonl"):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    entry = json.loads(line)
                    chunks.append({"rule_reference": entry["rule_reference"], "text": entry["text"]})

    return chunks


_CHUNKS_CACHE: list[dict] | None = None
_VECTORIZER: TfidfVectorizer | None = None
_TFIDF_MATRIX = None


def _get_search_index() -> tuple[list[dict], TfidfVectorizer, np.ndarray]:
    """Builds or returns cached chunks, TF-IDF vectorizer, and matrix."""
    global _CHUNKS_CACHE, _VECTORIZER, _TFIDF_MATRIX

    if _CHUNKS_CACHE is None or _VECTORIZER is None or _TFIDF_MATRIX is None:
        _CHUNKS_CACHE = _load_corpus_chunks()
        corpus_texts = [f"{c['rule_reference']} {c['text']}" for c in _CHUNKS_CACHE]
        _VECTORIZER = TfidfVectorizer(
            ngram_range=(1, 2),
            sublinear_tf=True,
            stop_words=STOP_WORDS,
        )
        _TFIDF_MATRIX = _VECTORIZER.fit_transform(corpus_texts)

    return _CHUNKS_CACHE, _VECTORIZER, _TFIDF_MATRIX


def retrieve(query: str, top_k: int = 5) -> list[dict]:
    """Accurate hybrid retrieval using TF-IDF cosine similarity augmented by
    exact rule-number and key legal phrase boosting.
    """
    chunks, vectorizer, matrix = _get_search_index()
    if not chunks:
        return []

    # 1. TF-IDF Cosine Similarity
    query_vec = vectorizer.transform([query])
    sims = (matrix * query_vec.T).toarray().flatten()

    # 2. Rule Number & Phrase Boosting
    query_lower = query.lower()
    rule_refs_in_query = re.findall(r"\b(?:rule|section|reg|regulation)\s*(\d+(?:\(\w+\))*|\d+)", query_lower)

    # Key terms that deserve high priority if matched
    priority_terms = [
        "country of origin", "origin", "mrp", "retail sale price", "sticker",
        "font size", "pdp", "principal display panel", "net quantity", "net weight",
        "cement", "coffee", "tea", "paneer", "institutional", "industrial",
        "wholesale", "water", "isi", "bis", "plastic", "gsm", "micron",
        "allergen", "egg", "veg", "non-veg", "expiry", "best before",
        "second offense", "penalty", "error", "tolerance"
    ]

    scores = []
    for idx, chunk in enumerate(chunks):
        score = float(sims[idx])
        chunk_text_lower = chunk["text"].lower()
        chunk_ref_lower = chunk["rule_reference"].lower()

        # Rule reference match boost
        for r_ref in rule_refs_in_query:
            if r_ref in chunk_ref_lower:
                score += 0.45
            elif r_ref in chunk_text_lower:
                score += 0.25

        # Priority keyword / phrase match boost
        for term in priority_terms:
            if term in query_lower:
                if term in chunk_ref_lower:
                    score += 0.35
                elif term in chunk_text_lower:
                    score += 0.20

        scores.append((score, idx))

    scores.sort(key=lambda x: x[0], reverse=True)

    # Return top_k unique rule references or top scoring chunks
    selected_chunks = []
    seen_refs = set()
    for s, idx in scores:
        chunk = chunks[idx]
        ref = chunk["rule_reference"]
        # Allow up to 2 chunks per reference type (e.g. general rule + verified Q&A)
        count = sum(1 for c in selected_chunks if c["rule_reference"] == ref)
        if count < 2:
            selected_chunks.append(chunk)
        if len(selected_chunks) >= top_k:
            break

    return selected_chunks


SYSTEM_PROMPT = """You are Paramarsh AI (परामर्श AI), an expert legal AI assistant embedded in the Pramaan Portal (Legal Metrology Compliance Platform) \
used by Indian government inspectors, e-commerce auditors, and manufacturers. Answer accurately, clearly, and \
authoritatively using the CONTEXT provided below, which is drawn from Legal Metrology (Packaged Commodities) Rules, 2011, \
FSSAI, Plastic Waste Management, and BIS packaging regulations.

Guidelines:
1. Answer completely and precisely based on the CONTEXT. Cite the specific rule number/reference \
(e.g., Rule 6(1)(e), Rule 7, Rule 18(5), Section 36(1)) for every legal claim.
2. Structure your answer cleanly with standard Markdown: use bolding for key terms, bullet points for lists/bands, \
and concise explanations. Do NOT use LaTeX or math dollar signs (do not output $ or \\text{...}). Use plain symbols \
and units like cm², mm, and %.
3. If the user asks in Hinglish (mixed Hindi/English), match their language and register naturally while \
retaining the official legal citations.
4. If a question cannot be answered from the context, state that clearly and advise consulting the official \
Gazette notification or a Legal Metrology officer.
5. You are an AI legal assistant; briefly state a standard non-lawyer disclaimer only when asked for a legal judgment call.
6. MANUFACTURER COMPLIANT LABEL BUILDING & DESIGN PROMPT GENERATION:
If a manufacturer or user asks you to build, create, or design a label for any product (or provides product details/ingredients):
- First, list the MANDATORY STATUTORY DECLARATIONS required on the packaging under Legal Metrology (Packaged Commodities) Rules, 2011:
  * Rule 6(1)(a): Complete name & physical address of the manufacturer and packer.
  * Rule 6(1)(b): Generic or common name of the commodity on the Principal Display Panel (PDP).
  * Rule 6(1)(c): Net quantity declared in standard metric units (e.g. g, kg, ml, l) or count ('N').
  * Rule 6(1)(d): Month & year of manufacture or packing (MM/YYYY).
  * Rule 6(1)(e): Maximum Retail Price stated strictly as 'MRP Rs. XX.XX (incl. of all taxes)' and Unit Sale Price under Rule 6(11).
  * Rule 6(1)(f): Consumer care contact details (phone/email/address).
  * Rule 7: Minimum font size proportional to the packaging area.
  * FSSAI Requirements: FSSAI 14-digit License Number & Logo, Green Vegetarian / Brown Non-Vegetarian symbol, Ingredients in descending order of incoming weight, and Nutritional Facts table.
- Validate any ingredients provided by the manufacturer (check for allergens, high-risk preservatives, and descending weight order).
- Provide a ready-to-use structured **Design Prompt** inside a Markdown code block with header `### Samadhan AI Compliant Design Prompt (Model: gemini-nano-banana-2.1)`.
- Inform the manufacturer: "You can copy this design prompt directly into **Samadhan AI (समाधान AI)** to generate the complete, certified packaging label artwork!"
"""


def _clean_citations(chunks: list[dict]) -> list[str]:
    """Extracts unique legal rule references, filtering out internal dataset placeholders."""
    seen = set()
    cleaned = []
    for c in chunks:
        ref = c.get("rule_reference", "").strip()
        if not ref or "dataset-provided" in ref.lower():
            continue
        if ref not in seen:
            seen.add(ref)
            cleaned.append(ref)
    return cleaned


def _synthesize_local_response(query: str, context_chunks: list[dict], notice: str | None = None) -> dict:
    """Provides a clean, authoritative response directly from local rules context
    when the remote LLM is unavailable, rate-limited, or unconfigured."""
    cited = _clean_citations(context_chunks)
    if not context_chunks:
        return {
            "reply": (
                "I couldn't find a matching provision for that query in the local Legal Metrology corpus. "
                "Please verify the phrasing or consult the official Legal Metrology (Packaged Commodities) Rules, 2011."
            ),
            "cited_rules": [],
        }

    lines = []
    if notice:
        lines.append(f"*{notice}*\n")
    lines.append("Based on the **Legal Metrology (Packaged Commodities) Rules, 2011**, here are the governing provisions:\n")

    for c in context_chunks:
        ref = c.get("rule_reference", "")
        text = c.get("text", "").strip()
        if "dataset-provided" in ref.lower():
            lines.append(f"- {text}\n")
        else:
            lines.append(f"- **{ref}**: {text}\n")

    lines.append("\n---\n*Disclaimer: Guidance based on the local Legal Metrology corpus. Consult official Gazette notifications for formal enforcement.*")

    return {
        "reply": "\n".join(lines),
        "cited_rules": cited,
    }


def _answer_with_gemini(query: str, context_chunks: list[dict]) -> dict:
    if not settings.GEMINI_API_KEY:
        return _synthesize_local_response(query, context_chunks, "Operating in local offline mode (no API key configured).")

    from google import genai
    from google.genai import types

    context_text = "\n".join(f"[{c['rule_reference']}] {c['text']}" for c in context_chunks) or "(no matching context found)"
    cited_rules = _clean_citations(context_chunks)

    # De-duplicate candidate models preserving order
    candidates = []
    for m in [settings.GEMINI_MODEL, "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.5-flash"]:
        if m and m not in candidates:
            candidates.append(m)

    last_err = None
    for model_name in candidates:
        try:
            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            response = client.models.generate_content(
                model=model_name,
                contents=f"CONTEXT:\n{context_text}\n\nQUESTION: {query}",
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    max_output_tokens=2048,
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                ),
            )

            reply_text = response.text or ""
            if not reply_text and response.candidates:
                parts = response.candidates[0].content.parts
                reply_text = "".join(p.text for p in parts if getattr(p, "text", None))

            if reply_text and reply_text.strip():
                return {
                    "reply": reply_text.strip(),
                    "cited_rules": cited_rules,
                }
        except Exception as exc:
            last_err = exc
            logger.warning("Gemini model %s failed (%s); trying fallback candidate if available.", model_name, exc)
            continue

    logger.warning("All Gemini candidate models failed (last error: %s); falling back to local corpus.", last_err)
    return _synthesize_local_response(
        query,
        context_chunks,
        "Notice: Live AI service is currently at capacity; answer retrieved directly from local Legal Metrology corpus.",
    )


def _answer_with_anthropic(query: str, context_chunks: list[dict]) -> dict:
    if not settings.ANTHROPIC_API_KEY:
        return _synthesize_local_response(query, context_chunks, "Operating in local mode (no Anthropic API key configured).")

    import anthropic

    context_text = "\n".join(f"[{c['rule_reference']}] {c['text']}" for c in context_chunks) or "(no matching context found)"
    cited_rules = _clean_citations(context_chunks)

    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        message = client.messages.create(
            model=settings.CHATBOT_MODEL,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"CONTEXT:\n{context_text}\n\nQUESTION: {query}",
                }
            ],
        )
        reply_text = "".join(block.text for block in message.content if block.type == "text")
        return {"reply": reply_text.strip(), "cited_rules": cited_rules}
    except Exception as exc:
        logger.warning("Anthropic API call failed (%s); falling back to local corpus.", exc)
        return _synthesize_local_response(
            query,
            context_chunks,
            "Notice: Anthropic service temporarily unavailable; answer retrieved directly from local Legal Metrology corpus.",
        )


def answer_question(query: str) -> dict:
    """Returns {"reply": str, "cited_rules": list[str]}. Routes to the
    provider configured via CHATBOT_PROVIDER (default: "gemini")."""
    context_chunks = retrieve(query)

    if settings.CHATBOT_PROVIDER == "gemini":
        return _answer_with_gemini(query, context_chunks)
    elif settings.CHATBOT_PROVIDER == "anthropic":
        return _answer_with_anthropic(query, context_chunks)
    else:
        raise ValueError(
            f"Unknown CHATBOT_PROVIDER: {settings.CHATBOT_PROVIDER!r}. Expected 'gemini' or 'anthropic'."
        )
