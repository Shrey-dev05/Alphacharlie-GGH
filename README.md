# Label AI — Next-Gen Packaging Intelligence & Statutory Compliance Studio

An AI-driven scanning, health intelligence, and label generation platform that automates statutory compliance checks for
packaged commodities against India's **Legal Metrology (Packaged Commodities) Rules, 2011** and **FSSAI** regulations.
It combines Multimodal Vision AI, OCR, statutory rules validation, Consumer Ingredient & Health Intelligence, and the
**Samadhan AI** label generator (`gemini-nano-banana-2.1`) to streamline compliance for regulators, consumers, and manufacturers.

> **Read this file first if you are picking up this project** — whether you're a
> human developer or another AI coding assistant (Antigravity, Cursor, Claude Code,
> etc.). It documents the full architecture, what's implemented vs. stubbed, and
> exactly how to run and extend the system.

---

## 1. Who this is for

| Role | What they do in the app |
|---|---|
| **Field Inspector** (Govt.) | Capture/upload packaging photos in the field, run AI scans, issue compliance notices |
| **E-Commerce Auditor** | Bulk-check online listing images/URLs for compliance |
| **Manufacturer** | Pre-print QA — catch labeling errors *before* printing runs |
| **Super Admin** (Govt.) | Nationwide/statewide compliance dashboard, trend analytics |

---

## 2. Architecture

```
┌─────────────────┐      HTTPS/JSON       ┌──────────────────────┐
│   Next.js 14     │ ───────────────────▶ │      FastAPI          │
│   (frontend/)    │ ◀─────────────────── │      (backend/)       │
│  Tailwind CSS    │                       │                       │
└─────────────────┘                       │  ┌─────────────────┐  │
                                            │  │  OCR Service     │  │
                                            │  │  (Tesseract /    │  │
                                            │  │   GCV / Textract)│  │
                                            │  └────────┬────────┘  │
                                            │           ▼            │
                                            │  ┌─────────────────┐  │
                                            │  │  CV Service      │  │
                                            │  │  (OpenCV: PDP    │  │
                                            │  │  detection,      │  │
                                            │  │  calibration)    │  │
                                            │  └────────┬────────┘  │
                                            │           ▼            │
                                            │  ┌─────────────────┐  │
                                            │  │ Validation Engine│  │
                                            │  │ (rules JSON →    │  │
                                            │  │  pass/fail)      │  │
                                            │  └────────┬────────┘  │
                                            │           ▼            │
                                            │  ┌─────────────────┐  │
                                            │  │  PDF Service     │  │
                                            │  │  (reportlab)     │  │
                                            │  └─────────────────┘  │
                                            │                       │
                                            │  ┌─────────────────┐  │
                                            │  │ Metrology Bot    │  │
                                            │  │ (RAG + Claude)   │  │
                                            │  └─────────────────┘  │
                                            └──────────┬────────────┘
                                                        ▼
                                    ┌───────────────────────────────────┐
                                    │ PostgreSQL (users, scans,          │
                                    │ violations, reports, chat log)     │
                                    │ + File storage (local disk / S3)   │
                                    └───────────────────────────────────┘
```

### The scan pipeline, step by step

1. **Upload** — operator submits an image (JPEG/PNG) via the drag-and-drop UI.
2. **Barcode detection & product auto-fill** — `barcode_service.py` scans the image
   for a retail barcode (fully offline) and, if found and the operator left
   brand/product name blank, looks it up against Open Food Facts to auto-fill
   them — see §9 for the full behavior and honest testing status.
3. **OCR** — `ocr_service.py` preprocesses the image (denoise, adaptive threshold,
   deskew) and runs Tesseract to extract text + per-word bounding boxes.
4. **Calibration** — `cv_service.py` establishes a pixels-per-millimetre ratio
   using one of three methods (reference ID card in frame, known pack
   dimensions, or embedded DPI), which is required to check Rule 7's font-size
   thresholds meaningfully.
5. **Validation** — `validation_engine.py` checks the extracted text against
   `app/data/legal_metrology_rules.json`: presence of mandatory declarations
   (regex/keyword matching) and numeral height vs. the Rule-7 area-banded
   minimums.
6. **Annotation** — compliant fields are boxed in green, violations in red, and
   any detected barcode in gray, on a copy of the source image.
7. **Persistence** — the scan, its violations, both images, and the barcode/
   lookup result are saved (PostgreSQL + file storage).
8. **Reporting** — on demand, `pdf_service.py` renders a timestamped,
   SHA-256-checksummed PDF with the annotated image, barcode, and full checklist.

---

## 3. Tech stack & why

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS | Fast iteration, server + client components, easy to deploy anywhere |
| Backend | FastAPI (Python, async) | High-performance async I/O, automatic OpenAPI docs at `/docs`, first-class Pydantic validation |
| OCR | Tesseract (default) | Runs fully offline — no cloud dependency for local dev or air-gapped govt. deployments. Swap to Google Cloud Vision or AWS Textract for production accuracy on curved/glossy packaging (stubs already wired up in `ocr_service.py`) |
| Computer Vision | OpenCV | PDP contour detection, calibration, bounding-box annotation |
| Validation | Custom rules engine over a JSON rule corpus | Transparent, auditable, easy for a non-engineer (legal officer) to review/update thresholds without touching code |
| Database | PostgreSQL (SQLite fallback for zero-setup local dev) | Relational integrity for users/scans/violations/audit trail |
| File storage | Local disk (default) / AWS S3 (toggle via env) | Zero-setup dev, S3-ready for production scale |
| PDF generation | ReportLab | Full layout control for a legally-formatted evidence document |
| Chatbot | Retrieval over the rules corpus + Claude API | Grounded, rule-cited answers — the model is instructed to answer *only* from retrieved context, which matters when wrong answers have legal consequences |

---

## 4. Folder structure

```
legal-metrology-compliance/
├── README.md                      ← you are here
├── docker-compose.yml             ← one-command local orchestration (Postgres + backend + frontend)
├── .env.example                   ← every configurable variable, documented
├── .gitignore
│
├── backend/
│   ├── main.py                    ← FastAPI app entrypoint, CORS, static file mount
│   ├── requirements.txt
│   ├── Dockerfile
│   └── app/
│       ├── core/
│       │   ├── config.py          ← pydantic-settings config (reads .env)
│       │   └── security.py        ← JWT auth + RBAC (Role enum, require_roles dependency)
│       ├── db/
│       │   └── database.py        ← SQLAlchemy engine/session
│       ├── models/
│       │   └── models.py          ← User, Scan, Violation, Report, ChatMessage ORM models
│       ├── schemas/
│       │   └── schemas.py         ← Pydantic request/response models
│       ├── services/
│       │   ├── ocr_service.py     ← Tesseract OCR (+ GCV/Textract stubs), now line-grouped
│       │   ├── barcode_service.py ← barcode detection (pyzbar) + Open Food Facts product lookup
│       │   ├── cv_service.py      ← PDP detection, px-to-mm calibration, annotation drawing, optional trained-detector hook
│       │   ├── validation_engine.py ← rules engine: regex/keyword + ML classifier ensemble → pass/fail checks + score
│       │   ├── pdf_service.py     ← compliance report PDF generation
│       │   ├── storage_service.py ← pluggable local-disk / S3 file storage
│       │   └── rag_chatbot_service.py ← Metrology Bot retrieval + Gemini/Claude API call (provider-selectable)
│       ├── api/
│       │   ├── router.py          ← combines all routers
│       │   ├── auth.py            ← register / login / me
│       │   ├── scan.py            ← upload, get, list/search scans
│       │   ├── reports.py         ← generate & download PDF reports
│       │   ├── chatbot.py         ← Metrology Bot endpoint
│       │   └── analytics.py       ← Super Admin dashboard aggregates
│       ├── data/
│       │   └── legal_metrology_rules.json ← the rule corpus: Legal Metrology + FSSAI + Plastic Waste Management (see §7)
│       └── ml/                    ← trained-model pipeline (see §8)
│           ├── data_generation.py         ← synthetic OCR-line generator + noise simulation
│           ├── train_field_classifier.py  ← trains the text field classifier
│           ├── field_classifier_service.py← runtime wrapper, used by validation_engine.py
│           ├── generate_image_dataset.py  ← synthetic labeled-image generator (YOLO format)
│           ├── train_detector.py          ← trains the PDP field-region object detector
│           ├── build_expanded_corpus.py   ← builds the chatbot's expanded legal corpus (see §10)
│           └── artifacts/                 ← trained model files + training reports (see §8)
│
└── frontend/
    ├── package.json
    ├── tailwind.config.ts         ← design tokens (colors, fonts)
    ├── next.config.js             ← proxies /api and /static to the backend
    ├── Dockerfile
    ├── app/
    │   ├── layout.tsx             ← root layout, fonts, AuthProvider
    │   ├── page.tsx                ← redirects to /login or /dashboard
    │   ├── login/page.tsx
    │   ├── register/page.tsx
    │   ├── dashboard/page.tsx     ← role-aware: analytics (admin) vs. quick actions (operator)
    │   ├── upload/page.tsx        ← drag-and-drop scan submission, food/plastic category flags
    │   ├── results/[scanId]/page.tsx ← annotated image + checklist (with regulation source + detection method) + PDF download
    │   ├── history/page.tsx       ← searchable scan repository
    │   └── chatbot/page.tsx       ← Metrology Bot chat UI
    ├── components/
    │   ├── AppShell.tsx           ← sidebar + auth guard wrapper for protected pages
    │   ├── Sidebar.tsx            ← role-aware nav
    │   └── ui.tsx                 ← ComplianceBadge, SeverityTag, RuleTag, DetectionMethodTag, Panel
    └── lib/
        ├── api.ts                 ← typed fetch wrapper, attaches JWT
        ├── auth-context.tsx       ← React context for the logged-in user
        └── types.ts                ← TypeScript types mirroring the backend Pydantic schemas
```

---

## 5. Running it locally

### Option A — Docker Compose (recommended, one command)

```bash
cp .env.example .env   # then edit values as needed
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend + interactive API docs: http://localhost:8000/docs

### Option B — Run each service natively

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env   # keep only the BACKEND block, or trim as needed
uvicorn main:app --reload
```
This uses SQLite by default (`DATABASE_URL=sqlite:///./legal_metrology.db`) so it
runs with **zero external dependencies** beyond the `tesseract-ocr` system package
(`apt install tesseract-ocr` / `brew install tesseract`).

The trained field classifier (§8.1) ships pre-trained at
`app/ml/artifacts/field_classifier.joblib` and is used automatically — its only
dependencies (`scikit-learn`, `joblib`) are in the base `requirements.txt`, nothing
extra to install. If you want to retrain it (e.g. after editing
`data_generation.py`), run `python -m app.ml.train_field_classifier` from `backend/`.

The object detector proof-of-concept (§8.2) ships its trained weights too, but its
dependency (`ultralytics`, which pulls in PyTorch — a multi-GB install) is kept out
of the base `requirements.txt` since the detector is disabled by default. Install it
separately with `pip install -r requirements-ml.txt --break-system-packages` before
running `python -m app.ml.train_detector` or flipping `USE_TRAINED_DETECTOR = True`
in `cv_service.py`.

**Frontend:**
```bash
cd frontend
npm install
cp ../.env.example .env.local  # keep only the FRONTEND block
npm run dev
```

Then visit http://localhost:3000, register an account (pick a role), and run your
first scan from **New Scan**.

---

## 6. RBAC — roles & access

Defined in `backend/app/core/security.py::Role` and enforced per-endpoint via the
`require_roles(...)` FastAPI dependency:

| Role | Can create scans | Sees own history | Sees all history | Analytics dashboard |
|---|---|---|---|---|
| `field_inspector` | Yes | Yes | No | No |
| `ecommerce_auditor` | Yes | Yes | No | No |
| `manufacturer` | Yes | Yes | No | No |
| `super_admin` | No | — | Yes (all users' scans) | Yes |

---

## 7. The rules engine — how compliance is actually checked

`backend/app/data/legal_metrology_rules.json` is the single source of truth the
validation engine reads. It currently seeds:

- **Rule 6 mandatory declarations**: manufacturer details, generic name, net
  quantity (regex against standard units), month/year of manufacture, MRP
  inclusive-of-taxes, consumer care contact, country of origin, best-before/expiry.
- **Rule 7 font-size bands**: minimum numeral height in mm, banded by Principal
  Display Panel (PDP) area, used once a calibration reference is available.

**Important — read before any enforcement use:** the JSON file's `_meta.disclaimer`
field states this plainly, but it bears repeating here: these thresholds were seeded
from the general structure of the 2011 Rules (as amended) for development purposes.
**Have a Legal Metrology domain expert verify every figure against the current
Gazette-notified text and any state amendments before this is used to issue real
compliance notices.** Getting a legal threshold wrong in a regulatory tool has real
consequences — this is the one part of the codebase that needs human legal
sign-off, not just code review.

To adjust a rule: edit the JSON entry (no code changes needed for most tweaks — the
engine reads `rule_reference`, `severity`, `match_type` (`presence` | `regex`), and
either `keywords` or `pattern`). To add a wholly new rule category, add a checker
function in `validation_engine.py` following the pattern of
`check_mandatory_declarations` / `check_font_size_compliance`.

The rules corpus now spans **three regulations**, each with an `applicability` flag
so it only fires for relevant products:

| Regulation | Applicability | Fields covered |
|---|---|---|
| Legal Metrology (Packaged Commodities) Rules, 2011 | `always` — every product | Manufacturer details, generic name, net quantity, mfg date, MRP, consumer care, country of origin, best-before |
| Food Safety and Standards (Labelling and Display) Regulations, 2020 | `food` — only when `is_food_product=true` on the scan | FSSAI license number, nutritional info, veg/non-veg logo, allergen declaration, mfg+expiry date (food-specific: FSSAI requires both, not either/or) |
| Plastic Waste Management Rules, 2016, as amended (Rule 11(1A)) | `plastic_packaging` — only when `is_plastic_packaging=true` | Polymer/material code (PET/HDPE/etc.), EPR registration certificate number, recycled-content or compostability declaration (IS 14534:2023 / IS-ISO 17088:2021) |

Set these flags via the `is_food_product` / `is_plastic_packaging` form fields on
`POST /api/v1/scans` (the upload page exposes them as checkboxes) — verified by
running an actual scan with both flags on and confirming all three regulations'
checks appeared, and a scan with both flags off (default) and confirming only
Legal Metrology's checks ran.

---

## 8. The trained ML models — what was actually trained, and how well it works

Two models live in `app/ml/`. Both were **actually trained and evaluated in this
environment**, not just scaffolded — see the honest results below, including one
place a naive first attempt looked great and turned out not to generalize.

### 8.1 Field classifier (`train_field_classifier.py`) — production-integrated

**What it does:** reads one OCR'd line from a label and predicts which regulatory
field it is (`net_quantity`, `mrp`, `fssai_license`, `plastic_epr_number`, etc., 16
categories total, or `other_noise`). It's used in `validation_engine.py` as a
second signal alongside regex/keyword matching — a declaration counts as present if
**either** method finds it. This matters because pure regex misses real declarations
that are phrased differently than expected, or corrupted by OCR noise; the classifier
was specifically trained to survive both.

**Why this approach:** character n-gram (2-4) TF-IDF features + a calibrated Linear
SVM. Character n-grams (not word tokens) because OCR noise corrupts individual
characters — a word-token model simply loses a word with one bad character, an
n-gram model degrades gracefully.

**Training data:** no real dataset exists for this (see §8.3), so training pairs are
generated programmatically by `data_generation.py` — every template is written from
scratch, not copied from any real product's label — with **simulated OCR noise**
(character confusions, dropped characters, merged words) injected into half the
examples, so the model learns robustness to real OCR errors rather than just
memorizing clean text.

**Honest results — including a real generalization failure and how it was fixed:**

| Test | Accuracy | Note |
|---|---|---|
| Held-out split of the synthetic dataset (v1, narrow templates) | 99.9% | Inflated — same template family as training data |
| Hand-written novel phrasing never seen in training (v1) | **69.2%** | The real test. Exposed weak generalization on `net_quantity`, `mfg_date`/`best_before` confusion, and generic vs. regulatory recycling-message confusion |
| Same hand-written test, after diagnosing the failures and expanding template diversity (v2) | **100%** | Same test set the v1 model failed on, plus additional new sentences |
| Held-out split of the synthetic dataset (v2) | 100% | |

The full scikit-learn classification report (precision/recall/F1 per class) is saved
at `app/ml/artifacts/training_report.txt`. Re-run training any time with
`python -m app.ml.train_field_classifier` from `backend/` (takes under 2 seconds).

**Verified in the live pipeline**, not just in isolation: running an actual scan
through `POST /api/v1/scans` showed the classifier catching a declaration
(`common_name`) that the regex/keyword check had no reliable pattern for at all —
the `detection_method: "ml_classifier"` field on that check result is the audit
trail proving it, and the UI surfaces this via a "Pattern match" / "AI classifier" /
"Pattern + AI" tag on each checklist item so a human reviewer can see exactly which
signal found what.

### 8.2 PDP field detector (`train_detector.py`) — proof-of-concept, NOT integrated by default

**What it's for:** a YOLOv8n object detector that would localize declaration fields
directly on the image (bounding boxes), as a learned alternative/supplement to the
heuristic contour-based PDP detection in `cv_service.py`.

**Training data:** `generate_image_dataset.py` renders synthetic packaging-label
images with pixel-accurate ground-truth bounding boxes (verified visually — see the
methodology notes in that file's docstring). 60 images, 9 classes.

**What actually happened when this was trained (15 epochs, CPU, ~5 min):**

| Metric | Result |
|---|---|
| Overall mAP50 | 0.300 |
| Overall mAP50-95 | 0.211 |
| Best class: `common_name` | mAP50 = 0.942 |
| Worst class: `consumer_care` | mAP50 = 0.070 |

**The genuinely useful finding from this run:** visually inspecting the model's raw
predictions (at a low confidence threshold, since the calibrated confidences are low
at only 15 epochs) shows that **bounding-box localization converges fast and is
already excellent** — the model draws a tight box around essentially every text line
on the label. **Classification is the bottleneck** — several fields are still
predicted as `mrp` by default, and confidence scores are low across the board. This
is the expected shape of the problem (localization is a simpler learning task than
9-way classification on 48 training images), not a bug, and it tells you exactly
where more epochs/data would help most. Full per-class numbers and the reasoning
above are saved at `app/ml/artifacts/detector_training_report.txt`.

**Because of this, `USE_TRAINED_DETECTOR` in `cv_service.py` defaults to `False`.**
The shipped pipeline relies on the heuristic contour method + the OCR/regex/ML-text
ensemble (§8.1) instead, which is well-tested. The detector's weights
(`app/ml/artifacts/pdp_detector/weights/best.pt`) are still included so you can
inspect them, extend training, or flip the flag on once you've retrained with more
data and re-verified per-class mAP is trustworthy.

### 8.3 What it would take to make either model production-grade

Both models are trained entirely on programmatically generated synthetic data
because no accessible dataset of real, labeled Indian packaging photos existed in
the environment this was built in. Synthetic data is a legitimate way to bootstrap
and pipeline-test a model, but it is not a substitute for real data before trusting
either model's output in a regulatory decision. Concretely:

1. **Collect real photographed packaging** — a few hundred images minimum, covering
   varied lighting, angles, pack materials, and product categories.
2. **Annotate them** — for the text classifier, that's just (line text, category)
   pairs, cheap to produce; for the detector, bounding boxes in YOLO format
   (Roboflow, CVAT, and LabelImg all export this directly).
3. **Mix with or replace the synthetic set** in the same training scripts — both
   `train_field_classifier.py` and `train_detector.py` already accept this without
   modification, they just need real data pointed at them.
4. **Re-run the same generalization tests** this README documents (held-out split
   *and* a hand-written/held-out-source novel-phrasing test) before trusting the
   result — the 69%→100% story in §8.1 is exactly the kind of gap that a
   same-distribution test alone would have hidden.

---

## 9. Barcode scanning & product auto-fill

The operator no longer has to type in which product and company is being
scanned — if the packaging has a retail barcode (EAN-13/EAN-8/UPC-A/UPC-E),
`barcode_service.py` reads it automatically and, when found, resolves it to a
brand and product name.

**How it behaves:**
- Barcode **detection** (`detect_barcodes`) runs on every scan, always, fully
  offline via `pyzbar` — no network dependency, so this part works identically
  whether or not the deployment has internet access.
- If a retail barcode is found and the operator left brand name and/or product
  name blank, **product lookup** (`lookup_product`) queries Open Food Facts'
  public API to fill them in.
- **Manually entered values always win.** If the operator already typed a
  brand or product name, it's never overwritten by a lookup result — auto-fill
  only fills in what was left blank.
- The barcode value and symbology are recorded on every scan regardless of
  whether lookup succeeds, so it's always visible on the results page and in
  the PDF report, and it's searchable in the Historical Repository (the search
  box auto-detects an all-digit query as a barcode rather than a brand name).
- If lookup fails or finds nothing — wrong network, barcode not in the
  database, no barcode present at all — the scan still completes normally;
  brand/product name are just left for manual entry, exactly as before this
  feature existed. A failed lookup never blocks or breaks a scan.

**What was verified, and what wasn't — read this before relying on it:**

| Part | Status |
|---|---|
| Barcode decoding (`detect_barcodes`) | **Verified end-to-end.** A real EAN-13 barcode was rendered into a test label image and correctly decoded back to its exact original value, with a pixel-accurate bounding box, through the full upload → scan → API response path. |
| Graceful fallback when lookup is unreachable | **Verified.** In the environment this was built in, the lookup API is unreachable (see below) — that's exactly what let this path get tested for real: confirmed the scan completes successfully with barcode data recorded and brand/product name simply left blank, rather than erroring. |
| Manual values never overwritten | **Verified** — ran a scan with manual brand/product name against a barcoded image and confirmed both were preserved untouched, with `brand_product_source: "manual"` in the response. |
| Live product lookup against Open Food Facts | **NOT verified against the real API.** This sandbox's network egress only reaches a fixed allowlist of package-registry domains (pypi.org, npmjs.com, etc.) — `world.openfoodfacts.org` isn't on it, and the request is rejected before it leaves the sandbox (`x-deny-reason: host_not_allowed`). This is a constraint of the build environment, not of your deployment: once running with normal internet access, the call reaches Open Food Facts exactly as its public API is documented. **Confirm this yourself** on first deployment with a barcode you know is in their database (most major Indian packaged-food brands are). |

**Coverage caveat:** Open Food Facts is strongest for food products; a
non-food item's barcode may simply not be in it, in which case lookup returns
"not found" and the operator fills in the name manually as before — this is
expected, not a bug. For broader category coverage, swap in a commercial
UPC/EAN database in `lookup_product()` — the function's signature was written
to make that a self-contained change (one function, no callers need to
change).

---

## 10. Metrology Bot (RAG legal assistant)

`rag_chatbot_service.py` retrieves the most relevant entries from the corpus
(simple keyword-overlap scoring — swap for a vector store once the corpus grows
past a few hundred clauses) and passes them as context to an LLM, with a system
prompt that instructs the model to **answer only from retrieved context and always
cite the rule number**. If no API key is set, or the API call fails for any reason
(network issue, invalid key, rate limit), it gracefully degrades to returning the
raw matched corpus text instead of failing the request — verified by actually
triggering a live API failure and confirming the response is still a normal 200
with useful content, not a crash.

**LLM provider:** set via `CHATBOT_PROVIDER` in `.env` — `"gemini"` (default) uses
Google's Gemini API, `"anthropic"` uses Claude. Both share the same retrieval and
system prompt; only the API call differs. Gemini needs `GEMINI_API_KEY` +
`GEMINI_MODEL` (default `gemini-3.5-flash` — this space moves fast, so re-check
[Google's current model list](https://ai.google.dev/gemini-api/docs/models) if a
few months have passed); Claude needs `ANTHROPIC_API_KEY` + `CHATBOT_MODEL`.

**Your Gemini key is already configured** in `backend/.env` (gitignored, never
committed) — nothing to do to run it locally. One practical note: that key was
shared in plaintext in chat to get it into this project, so as routine hygiene
once you've confirmed the integration works, consider rotating/regenerating it
in [Google AI Studio](https://aistudio.google.com/apikey) and swapping the new
value into `backend/.env` — same as you'd do for any credential that passed
through a chat log.

**Honest testing note:** retrieval quality was verified extensively (see below) —
the live Gemini/Claude API *call* itself could not be exercised end-to-end in the
sandbox this was built in, since its network egress doesn't reach either
`generativelanguage.googleapis.com` or `api.anthropic.com` from that restricted
environment (confirmed directly: both return `403 host_not_allowed`). What WAS
verified for real: a live 403 from Gemini was triggered on purpose, and the
request still returned a normal `200` with the raw retrieved corpus context
rather than crashing — so the failure-handling path is proven, even though the
success path (an actual LLM-generated answer) needs confirming once deployed
with real network access to Google's API.

### The corpus

Two sources feed the retrieval index:
- `app/data/legal_metrology_rules.json` — the structured rules engine seed
  (auto-converted to chunks).
- `app/data/legal_metrology_corpus/*.txt` and `*.jsonl` — free-form corpus files.
  `.txt` files are indexed whole-file-as-one-chunk; `.jsonl` files are one
  `{"rule_reference", "text"}` chunk per line, which is the right format for many
  small chunks (Q&A pairs, a big multi-section dataset).

**`expanded_dataset.jsonl`** (54 chunks) was built from a multi-domain legal
dataset supplied by the project owner — Legal Metrology extended provisions,
FSSAI, Plastic Waste Management, and BIS, in English and Hinglish, plus 20
verification Q&A pairs — via `app/ml/build_expanded_corpus.py`. That script's
docstring documents an important data-quality issue worth knowing about: **the
source PDF's text layer extracts with a scrambled reading order** in its Q&A
section (a common artifact of certain PDF layouts), so the 20 questions and
their bilingual answers did not appear adjacent to each other in the raw
extracted text. Each pair was manually re-matched by content/topic — not
position — and cross-checked against specific facts named in each answer (e.g.
only one answer mentions "45 GSM", so it can only pair with the 45 GSM
non-woven-bag question). Run `python -m app.ml.build_expanded_corpus --verify`
from `backend/` to print all 20 pairs for your own spot-check.

**Retrieval was verified working well** against this corpus with live API
requests through the full HTTP pipeline — not just the retrieval function in
isolation — including a Hinglish-phrased query ("45 GSM ke non-woven plastic
bag legal hai kya?") correctly surfacing the matching PWM provision, and an
English query about a 325g coffee jar correctly surfacing the exact matching
Q&A pair as its top result ahead of four other relevant-but-less-precise chunks.

**Legal accuracy disclaimer:** like `legal_metrology_rules.json`, this dataset is
project-owner-supplied training material, not verified by Claude against an
official Gazette text — it reads as curated/compiled content (its own section
headers say "for RAG Testing" and "for Bot Verification") rather than a primary
legal source. It also contains at least one internal ambiguity the build
script's docstring flags explicitly: "Rule 19" (Maximum Permissible Error) and
"Rule 20" (Inspector Action) are attributed to both a general Legal Metrology
context and, separately, to FSSAI's own regulations in the source's own
heading. The script preserves the source's own attribution rather than
guessing at a correction. Have a domain expert confirm before this goes beyond
chatbot Q&A assistance.

---

## 11. API reference

Full interactive docs are auto-generated at `http://localhost:8000/docs` (Swagger UI)
whenever the backend is running. Summary:

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/register` | — | Create an account with a role |
| POST | `/api/v1/auth/login` | — | Get a JWT (OAuth2 password flow) |
| GET | `/api/v1/auth/me` | any | Current user profile |
| POST | `/api/v1/scans` | inspector/auditor/manufacturer | Upload image, run full pipeline (incl. barcode detection + auto-fill), return result |
| GET | `/api/v1/scans/{id}` | any | Fetch a single scan result |
| GET | `/api/v1/scans` | any | List/search scans (own scans, unless `super_admin`) — filters: `brand_name`, `state`, `compliance_status`, `barcode_value` |
| POST | `/api/v1/reports/scans/{scan_id}/generate` | any | Generate a PDF compliance report |
| GET | `/api/v1/reports/{report_id}/download` | — | Download the generated PDF |
| POST | `/api/v1/chatbot/ask` | any | Ask the Metrology Bot a question |
| GET | `/api/v1/analytics/summary` | `super_admin` only | Nationwide compliance metrics |

---

## 12. Database schema (high level)

- **users** — id, name, email, hashed_password, role, organization, state
- **scans** — id, created_by (FK), brand/product name (+ `brand_product_source`
  tracking whether they came from manual entry or barcode lookup, stored in
  raw_analysis), image storage keys, compliance_status/score, raw_analysis
  (JSON: OCR text + full check list), state, barcode_value, barcode_symbology,
  product_lookup_source, product_lookup_found
- **violations** — id, scan_id (FK), rule_id, rule_reference, field, severity,
  description, bounding_box (JSON), passed
- **reports** — id, scan_id (FK), pdf_storage_key, checksum_sha256, generated_by
- **chat_messages** — id, user_id (FK), session_id, role, content, cited_rules (JSON)

Uses SQLAlchemy ORM (`backend/app/models/models.py`). For production, generate
Alembic migrations rather than relying on `init_db()`'s `create_all` (which is
fine for local dev only).

---

## 13. What's real vs. what's a stub — read this before demoing

This scaffold was built and **smoke-tested end-to-end** (register → login → upload
→ OCR → validation → annotated image → PDF report, all verified against a real
image). Here's the honest state of each piece:

| Component | Status |
|---|---|
| Auth (register/login/JWT/RBAC) | Working, tested |
| OCR (Tesseract, now with line-grouping) | Working, tested |
| Validation engine (Legal Metrology + FSSAI + Plastic Waste Management, regex+ML ensemble) | Working, tested — verified all three regulations trigger/filter correctly by product category, and that the ML classifier catches declarations regex alone misses |
| Field classifier (trained ML model) | Working, tested, integrated into the live pipeline — see §8.1 for full accuracy results including a caught-and-fixed generalization failure |
| PDP field detector (trained ML model) | Proof-of-concept only, NOT integrated by default — see §8.2 for why (localization works, classification doesn't yet) |
| Font-size check (Rule 7) | Logic implemented; needs a real calibration reference (ID card or known pack dims) in the request to produce a definitive result — otherwise it returns an informational "no calibration" result rather than guessing |
| PDF report generation (now shows regulation source per rule) | Working, tested, checksum verified |
| Barcode detection (pyzbar) | Working, tested end-to-end with a real EAN-13 barcode |
| Barcode → product auto-fill (Open Food Facts lookup) | Code complete, graceful-fallback path verified; the live external API call itself could not be exercised in this sandbox (network-restricted) — see §9 for exactly what to confirm on first real deployment |
| Frontend (all 9 routes) | Builds cleanly with zero TypeScript errors |
| Google Cloud Vision / AWS Textract OCR | Stubbed — raises `NotImplementedError` with clear instructions; wire up once you have credentials |
| S3 storage backend | Stubbed — code path exists and is straightforward, untested without AWS credentials |
| Metrology Bot retrieval + corpus (Legal Metrology + FSSAI + PWM + BIS, English + Hinglish) | Working, tested with live HTTP requests against the full expanded corpus — verified precise retrieval including a Hinglish query |
| Metrology Bot LLM call (Gemini default, Claude alternative) | Failure-handling path verified for real (triggered a live 403 and confirmed graceful fallback, not a crash); the success path (an actual generated answer) couldn't be exercised in this sandbox — see §10 |
| Camera capture with live bounding-box guides | Not built — the spec calls for this as a mobile/web camera module; current upload flow supports file upload only. Would need `getUserMedia` + an overlay canvas |
| De-warping curved/cylindrical surfaces | Noted as a hook point in `cv_service.py` but not implemented — start there if bottle/jar labels are a priority |
| Bulk upload for e-commerce audits | Single-file upload only; the scan endpoint is synchronous, so bulk would need a background job queue (Celery/RQ) — noted inline in `scan.py` |
| Editable/exportable report formats (beyond PDF) | Not built |
| Email delivery of reports | Not built |
| PDP segmentation | Heuristic (largest non-border contour) by default — a trained alternative exists (§8.2) but isn't trustworthy enough yet to switch on |

---

## 14. Known trade-offs / upgrade paths

- **Next.js 14.2.35** was pinned deliberately (patched against the CVE present in
  `next@14.2.5`). Several transitive dev-dependencies (eslint tooling) still show
  `npm audit` warnings for a Next.js 15/16 migration — that's a deliberate scope
  decision for this scaffold (a major-version bump touches routing/caching
  behavior and deserves its own testing pass), not an oversight. Worth doing
  before production.
- **SQLite by default** — swap `DATABASE_URL` to Postgres (already fully wired,
  see `docker-compose.yml`) for anything beyond solo local development;
  SQLite doesn't handle concurrent writes well.
- **Synchronous scan pipeline** — fine for interactive single-image use; move to
  a background task queue before enabling bulk e-commerce audits or you'll block
  the request thread on OCR.
- **Keyword-based chatbot retrieval** — fine for the current rule-count; swap for
  embeddings + a vector index (pgvector is the path of least resistance given
  Postgres is already in the stack) once the corpus grows.

---

## 15. For AI coding assistants picking up this project

If you're Claude Code, Antigravity, Cursor, or similar: this README plus the
inline docstrings in every `services/*.py` file are meant to be sufficient context
to continue work without re-deriving architecture decisions. A few pointers:

- Business logic lives in `backend/app/services/` and is deliberately kept free
  of FastAPI/DB imports so it's independently testable — don't leak request/DB
  concerns into those files.
- The rules JSON (`app/data/legal_metrology_rules.json`) is the extension point
  non-engineers will want to edit — keep the validation engine driven by it
  rather than hardcoding new rule logic in Python where you can avoid it.
- Frontend TypeScript types in `frontend/lib/types.ts` are hand-mirrored from the
  backend Pydantic schemas (`backend/app/schemas/schemas.py`) — if you change one,
  change the other; there's no shared codegen step yet (a good next addition:
  generate `types.ts` from the OpenAPI schema at `/openapi.json`).
- Run `npm run build` (frontend) and a manual `uvicorn main:app` smoke test
  (backend) before considering a change done — both were used throughout this
  project's own build and caught real bugs (a passlib/bcrypt incompatibility, a
  Pydantic schema mismatch, a PDF table overflow, and — for the ML work — a
  classifier that looked great on paper (99.9%) and only got 69% on genuinely
  novel phrasing) that a code-only review would have missed.
- If you retrain either model in `app/ml/`, don't trust a single held-out-split
  accuracy number — it was specifically demonstrated in this project that a
  narrow synthetic template set can pass its own held-out test at 99%+ while
  failing on realistic novel input. Always also test against hand-written
  examples the training data generator didn't produce.

---

## 16. License / legal note

This is a development scaffold, not certified compliance software. Before using
it to issue real regulatory notices, have both (a) the codebase and (b) the legal
rule thresholds in §7 reviewed and signed off by qualified Legal Metrology and
software-audit professionals.
