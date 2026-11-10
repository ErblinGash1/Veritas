"""
Teste pa nevojë për server të ndezur:  python test_edge_cases.py
(kërkon: pip install httpx)
"""
from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from main import analyze_domain, app, find_terms

client = TestClient(app)
failures = 0


def check(name: str, condition: bool, extra: str = ""):
    global failures
    print(f"{'✅' if condition else '❌'} {name} {extra}")
    if not condition:
        failures += 1


def post(content: str, type_: str = "text"):
    return client.post("/predict", json={"content": content, "type": type_})


# --- statuse
check("Tekst i zbrazët -> 400", post("").status_code == 400)
check("URL e pavlefshme (htps) -> 400", post("htps://invalid-url-example", "url").status_code == 400)
check("URL pa skemë në mënyrë URL -> 400", post("example.com/artikull", "url").status_code == 400)
check("Tekst shumë i gjatë -> 422", post("a " * 20_001).status_code == 422)

# --- SSRF
for bad in ["http://127.0.0.1:5001/docs", "http://localhost/", "http://169.254.169.254/latest/meta-data/",
            "http://10.0.0.1/", "http://192.168.1.1/", "http://[::1]/", "ftp://example.com/file", "file:///etc/passwd",
            "http://example.com:8080/"]:
    check(f"SSRF bllokuar: {bad}", post(bad, "url").status_code == 400)

# --- logjika
r = post("Sonte ka vdekur Donald Trump").json()
check("Hoax vdekje -> HIGH", r["risk_level"] == "HIGH", f"({r['risk_score']}%)")

r = post("Real Madridi e mundi Rayo Vallecano 4-1").json()
check("Tekst i shkurtër pa sinjale -> UNCERTAIN", r["risk_level"] == "UNCERTAIN")

r = post("SHOKUESE!!! $$$ Fito 10000€ TANI BUM!!!").json()
check("ALL CAPS + !!! -> HIGH/UNCERTAIN me sinjale", len(r["signals"]) >= 2 and r["risk_score"] > 0)

normal = ("Qeveria miratoi sot buxhetin e ri për arsimin. Ministri tha se fondet do të shpërndahen "
          "gjatë vitit të ardhshëm sipas planit të publikuar në faqen zyrtare.")
r = post(normal).json()
check("Tekst normal -> LOW dhe pa sinjale", r["risk_level"] == "LOW" and r["signals"] == [])

r = post("Drama e re tregon një tragjedi të madhe për familjen e vogël në qytetin tonë të bukur sot").json()
check("'rama' nuk gjendet te 'drama'", "critical_claim" not in [s["id"] for s in r["signals"]])

check("find_terms me kufij fjalësh", find_terms("programi dramatik", ["rama"]) == [])
check("find_terms gjen fjalën e plotë", find_terms("kryeministri rama tha", ["rama"]) == ["rama"])

# --- domeni
check("bbc.co.uk i besuar", not analyze_domain("https://www.bbc.co.uk/news")["is_suspicious_domain"])
check("edition.cnn.com i besuar", not analyze_domain("https://edition.cnn.com/x")["is_suspicious_domain"])
check("bbc-news-live.com i dyshimtë", analyze_domain("https://bbc-news-live.com/x")["is_suspicious_domain"])
check("TLD .xyz i dyshimtë", analyze_domain("https://lajme.xyz/x")["is_suspicious_domain"])

print(f"\n{failures} teste dështuan")
raise SystemExit(1 if failures else 0)
