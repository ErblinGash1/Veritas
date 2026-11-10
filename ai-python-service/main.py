"""
Veritas AI - shërbimi i analizës (FastAPI)

Metodat: analizë heuristike dhe model eksperimental ML në shqip.
Asnjëra metodë nuk verifikon faktet në mënyrë të pavarur.
"""
import ipaddress
import re
import socket
import urllib.parse
from typing import Optional
from pathlib import Path
import joblib

import requests
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Veritas AI - Analysis Service", version="3.1")
# Modeli eksperimental Machine Learning në shqip
ML_EN_MODEL_PATH = Path(__file__).resolve().parent / "english_fake_news_pipeline_v1.pkl"
ML_SQ_MODEL_PATH = Path(__file__).resolve().parent / "albanian_fake_news_pipeline.pkl"

# Ngarkimi i modelit eksperimental anglisht V1
ml_en_model = None

if ML_EN_MODEL_PATH.exists():
    try:
        ml_en_model = joblib.load(ML_EN_MODEL_PATH)
        print("English ML model loaded successfully.")
    except Exception as exc:
        print(f"English ML model could not be loaded: {exc}")
else:
    print("English ML model file not found.")


ml_sq_model = None

if ML_SQ_MODEL_PATH.exists():
    try:
        ml_sq_model = joblib.load(ML_SQ_MODEL_PATH)
        print("Albanian ML model loaded successfully.")
    except Exception as exc:
        print(f"Albanian ML model could not be loaded: {exc}")
else:
    print("Albanian ML model file not found.")
# ---------------------------------------------------------------- konfigurim
MAX_CONTENT_CHARS = 20_000
MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024
MAX_REDIRECTS = 3
FETCH_TIMEOUT = 5
SHORT_TEXT_WORDS = 8
CRITICAL_CLAIM_MAX_WORDS = 25

KNOWN_TRUSTED_DOMAINS = [
    "bbc.com", "bbc.co.uk", "cnn.com", "reuters.com", "aljazeera.com",
    "top-channel.tv", "koha.net", "gazetaexpress.com", "rtklive.com",
]
SUSPICIOUS_TLDS = [".xyz", ".top", ".click", ".tk", ".buzz"]

SENSATIONAL_WORDS = [
    "shokuese", "e papasionit", "skandal", "nuk do ta besoni",
    "ekskluzive", "urgjente", "tronditëse", "mrekulli", "sekret", "sektret",
    "shocking", "you won't believe", "miracle cure", "secret revealed", "breaking!!!",
]
CRITICAL_HOAX_KEYWORDS = [
    "vdiq", "vdekur", "vritet", "u vra", "atentat",
    "arrestohet", "u arrestua", "skape", "tragjedi",
    "was killed", "has died", "found dead", "assassinated", "was arrested", "shot himself",
]
HIGH_PROFILE_NAMES = [
    "trump", "biden", "putin", "kurti", "rama", "osmani", "musk", "zelensky",
]


class NewsRequest(BaseModel):
    content: str = Field(..., max_length=MAX_CONTENT_CHARS)
    type: Optional[str] = "text"  # "text" ose "url"


# ------------------------------------------------------------------ ndihmëse
def find_terms(text_lower: str, terms: list[str]) -> list[str]:
    """Gjen terma si FJALË të plota (p.sh. 'rama' nuk gjendet te 'drama')."""
    return [
        t for t in terms
        if re.search(r"(?<!\w)" + re.escape(t) + r"(?!\w)", text_lower)
    ]


def looks_like_url(value: str) -> bool:
    return bool(re.match(r"^[a-zA-Z][a-zA-Z0-9+.\-]*://", value))


# ------------------------------------------------------- marrja e URL (SSRF-safe)
def assert_public_url(url: str) -> None:
    """Lejon vetëm http/https drejt adresave publike. Hedh ValueError ndryshe."""
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError("URL i pavlefshëm. Lejohen vetëm lidhje http:// dhe https://")
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("URL me kredenciale nuk lejohen.")
    port = parsed.port  # ValueError trajtohet nga extract_text_from_url
    if port not in (None, 80, 443):
        raise ValueError("Lejohen vetëm portet 80 dhe 443.")
    try:
        infos = socket.getaddrinfo(
            parsed.hostname, port or (443 if parsed.scheme == "https" else 80),
            proto=socket.IPPROTO_TCP,
        )
    except OSError:
        raise ValueError("Domeni nuk u gjet ose nuk mund të kontrollohet.")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0].split("%")[0])
        if not ip.is_global:
            raise ValueError("Adresat e brendshme/private nuk lejohen.")


def fetch_html(url: str) -> str:
    headers = {"User-Agent": "Mozilla/5.0 (compatible; VeritasBot/3.0)"}
    current = url
    for _ in range(MAX_REDIRECTS + 1):
        assert_public_url(current)  # rikontrollohet në çdo ridrejtim
        with requests.get(
            current, headers=headers, timeout=FETCH_TIMEOUT,
            allow_redirects=False, stream=True,
        ) as r:
            if r.status_code in (301, 302, 303, 307, 308):
                location = r.headers.get("Location")
                if not location:
                    raise ValueError("Ridrejtim i pavlefshëm.")
                current = urllib.parse.urljoin(current, location)
                continue
            if r.status_code != 200:
                raise ValueError(f"Faqja nuk u hap (status {r.status_code}).")
            ctype = r.headers.get("Content-Type", "").lower()
            if "html" not in ctype and "text" not in ctype:
                raise ValueError("Lidhja nuk shpie te një faqe teksti/HTML.")
            body, size = [], 0
            for chunk in r.iter_content(8192):
                size += len(chunk)
                if size > MAX_DOWNLOAD_BYTES:
                    raise ValueError("Faqja është shumë e madhe për t'u analizuar.")
                body.append(chunk)
            raw = b"".join(body)
            try:
                return raw.decode("utf-8")
            except UnicodeDecodeError:
                return raw.decode(r.encoding or "latin-1", errors="replace")
    raise ValueError("Shumë ridrejtime.")


def extract_text_from_url(url: str) -> str:
    try:
        html = fetch_html(url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Gabim gjatë skanimit të URL: {e}")
    except requests.RequestException:
        raise HTTPException(status_code=400, detail="Faqja nuk u arrit (gabim rrjeti ose timeout).")

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "header", "footer", "nav", "aside", "form"]):
        tag.decompose()
    paragraphs = [p.get_text().strip() for p in soup.find_all("p")]
    text = " ".join(p for p in paragraphs if len(p) > 20)
    if not text:
        raise HTTPException(
            status_code=422,
            detail="Nuk u gjet tekst artikulli në këtë faqe. Provo të ngjitësh tekstin direkt.",
        )
    return text


# ------------------------------------------------------------------- domeni
def analyze_domain(url: str) -> dict:
    info = {"domain": None, "is_suspicious_domain": False, "warning": None}
    host = (urllib.parse.urlparse(url).hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    info["domain"] = host

    is_trusted = any(host == t or host.endswith("." + t) for t in KNOWN_TRUSTED_DOMAINS)
    if is_trusted:
        return info

    if any(host.endswith(tld) for tld in SUSPICIOUS_TLDS):
        info["is_suspicious_domain"] = True
        info["warning"] = f"Prapashtesa e domenit '{host}' përdoret shpesh nga faqe jo-zyrtare."
        return info

    tokens = set(re.split(r"[.\-]", host))
    for trusted in KNOWN_TRUSTED_DOMAINS:
        if trusted.split(".")[0] in tokens:
            info["is_suspicious_domain"] = True
            info["warning"] = (
                f"Domeni '{host}' përngjan me një media të njohur ({trusted}) "
                f"por nuk është domeni i saj zyrtar."
            )
            break
    return info


# ----------------------------------------------------------------- sinjalet
def collect_signals(text: str, domain_info: dict) -> list[dict]:
    """Burimi i vetëm i së vërtetës: i njëjti sinjal jep pikët DHE shpjegimin."""
    low = text.lower()
    words = low.split()
    signals = []

    hoax = find_terms(low, CRITICAL_HOAX_KEYWORDS)
    names = find_terms(low, HIGH_PROFILE_NAMES)
    if hoax and names and len(words) < CRITICAL_CLAIM_MAX_WORDS:
        signals.append({
            "id": "critical_claim", "weight": 0.55,
            "detail": "Deklaratë e rëndë (vdekje/arrestim/atentat) për një figurë publike, "
                      "që kërkon verifikim të pavarur. Kontrollo burimet para se ta besosh.",
        })

    sensational = find_terms(low, SENSATIONAL_WORDS)
    if sensational:
        signals.append({
            "id": "sensational_words", "weight": 0.30,
            "detail": f"Fjalë senzacionale/klikbajt: {', '.join(sensational)}.",
        })

    punct = text.count("!") + text.count("?")
    if punct >= 3:
        signals.append({
            "id": "punctuation", "weight": 0.20,
            "detail": f"Pikësim emocional i tepruar ({punct} shenja '!' ose '?').",
        })

    letters = [c for c in text if c.isalpha()]
    if len(letters) >= 20 and sum(c.isupper() for c in letters) / len(letters) > 0.25:
        signals.append({
            "id": "all_caps", "weight": 0.15,
            "detail": "Përdorim i tepruar i shkronjave të mëdha (ALL CAPS).",
        })

    if domain_info.get("is_suspicious_domain"):
        signals.append({
            "id": "suspicious_domain", "weight": 0.25,
            "detail": domain_info["warning"],
        })
    return signals


def summarize(text: str, max_sentences: int = 2) -> str:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 10]
    if not sentences:
        return text[:150] + ("..." if len(text) > 150 else "")
    return " ".join(sentences[:max_sentences])


# ---------------------------------------------------------------- endpoint
@app.post("/predict")
def predict_news(request: NewsRequest):
    raw = request.content.strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Teksti ose URL është i zbrazët.")

    wants_url = (request.type == "url") or looks_like_url(raw)
    if wants_url:
        if not re.match(r"^https?://", raw, re.IGNORECASE):
            raise HTTPException(status_code=400, detail="URL i pavlefshëm. Përdor http:// ose https://")
        domain_info = analyze_domain(raw)
        text = extract_text_from_url(raw)
    else:
        domain_info = {"domain": None, "is_suspicious_domain": False, "warning": None}
        text = raw

    signals = collect_signals(text, domain_info)
    score = min(sum(s["weight"] for s in signals), 0.98)
    word_count = len(text.split())

    if score >= 0.50:
        risk_level = "HIGH"
    elif score >= 0.20 or word_count < SHORT_TEXT_WORDS:
        risk_level = "UNCERTAIN"
    else:
        risk_level = "LOW"

    reasons = [s["detail"] for s in signals]
    if word_count < SHORT_TEXT_WORDS:
        reasons.append(f"Teksti ka vetëm {word_count} fjalë, shumë pak për një analizë të besueshme.")
    if not signals:
        reasons.append(
            "Nuk u gjetën sinjale stilistike të dyshimta. Kjo NUK provon që përmbajtja është e vërtetë."
        )

    suggestions = ["Kërko titullin në disa media të njohura për të parë nëse konfirmohet."]
    if risk_level == "HIGH":
        suggestions.insert(0, "Mos e shpërndaj këtë përmbajtje para se ta verifikosh në një burim zyrtar.")
    if domain_info.get("domain"):
        suggestions.append(f"Shiko faqen 'Rreth nesh' të domenit {domain_info['domain']}.")
    suggestions.append("Kontrollo datën e publikimit dhe autorin.")

    is_fake = risk_level == "HIGH"
    # Fushat historike prediction/is_fake ruhen për përputhshmëri me Laravel.
    # Ato NUK përfaqësojnë verifikim faktesh; LOW/UNCERTAIN nuk provojnë REAL.
    return {
        "status": "success",
        "method": "heuristic-rules-v3",
        "disclaimer": "Sinjal stilistik, jo gjykim faktik. 0% nuk do të thotë se lajmi është i vërtetë.",
        "fact_checked": False,
        # fushat e reja
        "risk_score": round(score * 100, 1),
        "risk_level": risk_level,
        "word_count": word_count,
        "signals": [{"id": s["id"], "weight": s["weight"], "detail": s["detail"]} for s in signals],
        # fusha ekzistuese (përputhshmëri me Laravel; do hiqen më vonë)
        "prediction": "FAKE" if is_fake else "REAL",
        "is_fake": is_fake,
        "confidence_score": round(score * 100, 1),  # kompatibilitet; JO probabilitet ML
        "analyzed_text_sample": text[:300] + ("..." if len(text) > 300 else ""),
        "domain_info": domain_info,
        "ai_summary": summarize(text),
        "explanation_reasons": reasons,
        "suggestions": suggestions,
    }


@app.post("/predict-ml-sq")
def predict_ml_albanian(request: NewsRequest):
    if ml_sq_model is None:
        raise HTTPException(
            status_code=503,
            detail="Modeli ML në shqip nuk është i disponueshëm."
        )

    text = request.content.strip()

    if not text:
        raise HTTPException(
            status_code=400,
            detail="Teksti nuk mund të jetë i zbrazët."
        )

    if request.type == "url" or looks_like_url(text):
        raise HTTPException(
            status_code=400,
            detail="Ky endpoint pranon vetëm tekst, jo URL."
        )

    if len(text.split()) < 8:
        raise HTTPException(
            status_code=422,
            detail="Teksti është shumë i shkurtër për analizë ML."
        )

    probabilities = ml_sq_model.predict_proba([text])[0]
    classes = list(ml_sq_model.classes_)

    fake_probability = float(probabilities[classes.index(1)])
    real_probability = float(probabilities[classes.index(0)])

    # Pragje eksperimentale: probabilitet statistikor, jo vërtetim faktesh.
    if fake_probability > 0.60:
        prediction = "FAKE"
    elif fake_probability < 0.40:
        prediction = "REAL"
    else:
        prediction = "UNCERTAIN"

    confidence = max(fake_probability, real_probability) * 100

    return {
        "status": "success",
        "method": "tfidf-logistic-regression-sq",
        "language": "sq",
        "prediction": prediction,
        "confidence_score": round(confidence, 2),
        "probability_real": round(real_probability * 100, 2),
        "probability_fake": round(fake_probability * 100, 2),
        "fact_checked": False,
        "disclaimer": (
            "Klasifikim statistikor eksperimental. "
            "Probabilitetet nuk janë garanci për vërtetësinë "
            "ose falsitetin e lajmit."
        ),
        "word_count": len(text.split())
    }


@app.post("/predict-ml-en")
def predict_ml_english(request: NewsRequest):
    if ml_en_model is None:
        raise HTTPException(
            status_code=503,
            detail="English ML model is unavailable."
        )

    text = request.content.strip()

    if not text:
        raise HTTPException(
            status_code=400,
            detail="Text cannot be empty."
        )

    if request.type == "url" or looks_like_url(text):
        raise HTTPException(
            status_code=400,
            detail="This endpoint accepts text only, not URLs."
        )

    if len(text.split()) < 8:
        raise HTTPException(
            status_code=422,
            detail="Text is too short for ML analysis."
        )

    probabilities = ml_en_model.predict_proba([text])[0]
    classes = list(ml_en_model.classes_)

    # WELFake: 0 = REAL, 1 = FAKE
    real_probability = float(probabilities[classes.index(0)])
    fake_probability = float(probabilities[classes.index(1)])

    # Pragje eksperimentale, jo të validuara.
    if fake_probability > 0.60:
        prediction = "FAKE"
    elif fake_probability < 0.40:
        prediction = "REAL"
    else:
        prediction = "UNCERTAIN"

    return {
        "status": "success",
        "method": "tfidf-logistic-regression-en-v1",
        "language": "en",
        "prediction": prediction,
        "confidence_score": round(
            max(real_probability, fake_probability) * 100, 2
        ),
        "probability_real": round(real_probability * 100, 2),
        "probability_fake": round(fake_probability * 100, 2),
        "fact_checked": False,
        "disclaimer": (
            "Experimental statistical classification, not fact-checking. "
            "Model probabilities do not establish whether a claim is true. "
            "Performance on unfamiliar sources may be substantially lower."
        ),
        "word_count": len(text.split())
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=5001)
