"""
Synthetic Training Data Generator
===================================
There is no public dataset of labeled Indian packaging OCR text (and none of
this repository's synthetic examples are copied from any real product — every
template below is written from scratch to represent a *category* of
declaration, not any specific brand's actual label text).

This module generates realistic (label_line -> field_category) training pairs
for `train_field_classifier.py` by:
  1. Filling randomized template strings for each regulatory field category
     (brand names, numbers, units, phone numbers, etc. are all synthetic).
  2. Injecting simulated OCR noise (the character confusions Tesseract
     actually makes: O/0, I/1/l, S/5, B/8, rn/m, dropped spaces, random
     char drops) so the classifier learns to be robust to real-world OCR
     errors, not just clean text.

Run standalone to preview the dataset: `python -m app.ml.data_generation`
"""
from __future__ import annotations

import random
import re

random.seed(42)

# ---------------------------------------------------------------------------
# Synthetic vocabulary (all invented, not sourced from any real product)
# ---------------------------------------------------------------------------
BRANDS = ["Sunrise", "Vantage", "Greenfield", "Bluepeak", "Northstar", "Amberly", "Crestline", "Rosewood"]
PRODUCT_NOUNS = ["Foods Pvt Ltd", "Industries Ltd", "Consumer Products", "Enterprises", "Traders", "Agro Ltd"]
CITIES = ["Indore", "Pune", "Ahmedabad", "Coimbatore", "Nagpur", "Lucknow", "Guwahati", "Bhopal"]
STATES = ["Madhya Pradesh", "Maharashtra", "Gujarat", "Tamil Nadu", "Uttar Pradesh", "Assam"]
UNITS_WEIGHT = ["g", "gm", "kg", "ml", "l", "mg"]
FLAVOR_WORDS = ["Classic", "Masala", "Original", "Extra", "Premium", "Family Pack", "Value Pack"]
ALLERGENS = ["milk", "peanuts", "soy", "wheat", "tree nuts", "gluten"]
COUNTRIES = ["China", "Vietnam", "Thailand", "Germany", "USA", "Sri Lanka"]
PLASTIC_CODES = ["PET", "HDPE", "LDPE", "PP", "PS", "PVC"]

# ---------------------------------------------------------------------------
# Per-category template generators. Each returns one synthetic line of text
# resembling what OCR would extract from that declaration on a real package.
# ---------------------------------------------------------------------------


def _rand_phone() -> str:
    return "1800" + "".join(random.choices("0123456789", k=6))


def _rand_price() -> str:
    return str(random.choice([10, 20, 25, 35, 50, 75, 99, 120, 150, 250, 499]))


def _rand_date() -> str:
    day = random.randint(1, 28)
    month = random.randint(1, 12)
    year = random.randint(2024, 2027)
    y_short = year % 100
    mon_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    fmt = random.choice([
        "{m:02d}/{y}",
        "{m:02d}.{y}",
        "{m:02d}/{y_short:02d}",
        "{mon} {y}",
        "{mon}-{y_short:02d}",
        "{d:02d}/{m:02d}/{y}",
        "{d:02d}-{m:02d}-{y}",
    ])
    return fmt.format(d=day, m=month, y=year, y_short=y_short, mon=mon_names[month - 1])


TEMPLATES: dict[str, list] = {
    "net_quantity": [
        lambda: f"Net Wt {random.randint(50, 999)} {random.choice(UNITS_WEIGHT)}",
        lambda: f"Net Quantity: {random.randint(1, 5)} {random.choice(['kg','l'])}",
        lambda: f"Contents {random.randint(100, 1000)}{random.choice(['ml','g'])}",
        lambda: f"Net Weight - {random.randint(50, 500)} gm",
        lambda: f"This pack contains {random.randint(50, 999)} {random.choice(['grams','ml','gm'])} net",
        lambda: f"Weighs approximately {random.randint(1,5)} {random.choice(['kg','l','litre'])}",
        lambda: f"Quantity: {random.randint(100,1000)} {random.choice(UNITS_WEIGHT)}",
        lambda: f"Net contents: {random.randint(50,999)}{random.choice(['g','ml'])}",
        lambda: f"{random.randint(1,10)} x {random.randint(50,200)}g",
        lambda: f"Net Qty: {random.randint(1, 50)} N",
        lambda: f"Net Quantity: {random.randint(1, 100)} Units",
        lambda: f"Quantity: {random.randint(1, 20)} pcs",
        lambda: f"{random.randint(1, 10)} N",
        lambda: f"Contents: {random.randint(1, 60)} Tablets",
    ],
    "mrp": [
        lambda: f"MRP Rs.{_rand_price()} Inclusive of all taxes",
        lambda: f"M.R.P ₹{_rand_price()}/- incl. of all taxes",
        lambda: f"Maximum Retail Price Rs {_rand_price()} inclusive of all taxes",
        lambda: f"MRP: Rs.{_rand_price()} (incl. of all taxes)",
        lambda: f"Price to the consumer Rs {_rand_price()} all taxes included",
        lambda: f"Retail price ₹{_rand_price()} taxes included",
        lambda: f"Rs {_rand_price()} only, inclusive of all taxes",
        lambda: f"Sale price: Rs.{_rand_price()}/- (all taxes incl.)",
        lambda: f"MRP (inclusive of all taxes) : Rs. {_rand_price()}.00",
    ],
    "manufacturer_details": [
        lambda: f"Mfg by: {random.choice(BRANDS)} {random.choice(PRODUCT_NOUNS)}, {random.choice(CITIES)}, {random.choice(STATES)}",
        lambda: f"Manufactured by {random.choice(BRANDS)} {random.choice(PRODUCT_NOUNS)}",
        lambda: f"Marketed by: {random.choice(BRANDS)} {random.choice(PRODUCT_NOUNS)}, {random.choice(CITIES)}",
        lambda: f"Packed by {random.choice(BRANDS)} {random.choice(PRODUCT_NOUNS)}",
        lambda: f"Produced and packed at our facility in {random.choice(CITIES)} by {random.choice(BRANDS)} {random.choice(PRODUCT_NOUNS)}",
        lambda: f"A product of {random.choice(BRANDS)} {random.choice(PRODUCT_NOUNS)}, {random.choice(STATES)}",
        lambda: f"Manufacturing unit: {random.choice(BRANDS)} {random.choice(PRODUCT_NOUNS)}, {random.choice(CITIES)}",
        lambda: f"Mfd. by: {random.choice(BRANDS)} {random.choice(PRODUCT_NOUNS)}, Plot {random.randint(1,99)}, {random.choice(CITIES)}",
        lambda: f"Mfg & Pkd by: {random.choice(BRANDS)} {random.choice(PRODUCT_NOUNS)}",
        lambda: f"Marketed & Distributed by {random.choice(BRANDS)} {random.choice(PRODUCT_NOUNS)}",
    ],
    "mfg_date": [
        lambda: f"Mfg Date: {_rand_date()}",
        lambda: f"Pkd on {_rand_date()}",
        lambda: f"Manufactured on {_rand_date()}",
        lambda: f"Date of Mfg {_rand_date()}",
        lambda: f"This product was packed in the month of {_rand_date()}",
        lambda: f"Packaging date: {_rand_date()}",
        lambda: f"Produced in {_rand_date()}",
        lambda: f"Manufacture month/year: {_rand_date()}",
        lambda: f"Date of Packing: {_rand_date()}",
    ],
    "consumer_care": [
        lambda: f"Consumer Care: {_rand_phone()} care@{random.choice(BRANDS).lower()}.in",
        lambda: f"For complaints call toll-free {_rand_phone()}",
        lambda: f"Customer Care {_rand_phone()} email: support@{random.choice(BRANDS).lower()}.com",
        lambda: f"Helpline: {_rand_phone()}",
        lambda: f"If you have any issue please write to us at feedback@{random.choice(BRANDS).lower()}.com or dial {_rand_phone()}",
        lambda: f"For queries and feedback contact {_rand_phone()}",
        lambda: f"Write to us at {random.choice(['care','support','feedback'])}@{random.choice(BRANDS).lower()}.com",
        lambda: f"Customer Service Cell: {_rand_phone()}",
    ],
    "common_name": [
        lambda: f"{random.choice(FLAVOR_WORDS)} {random.choice(['Biscuits','Namkeen','Noodles','Pickle','Snacks'])}",
        lambda: f"{random.choice(['Wheat','Rice','Corn'])} based {random.choice(['Snack','Cereal'])}",
        lambda: f"Whole Wheat Flour (Atta)",
        lambda: f"Refined Sunflower Oil",
        lambda: f"Organic Spices - Turmeric Powder",
    ],
    "country_of_origin": [
        lambda: f"Country of Origin: {random.choice(COUNTRIES)}",
        lambda: f"Made in {random.choice(COUNTRIES)}",
        lambda: f"Product of {random.choice(COUNTRIES)}",
        lambda: f"Imported from {random.choice(COUNTRIES)}",
        lambda: f"Manufactured in {random.choice(COUNTRIES)} and imported by an Indian entity",
    ],
    "best_before": [
        lambda: f"Best Before {random.randint(3, 12)} months from packaging",
        lambda: f"Use By {_rand_date()}",
        lambda: f"Expiry: {_rand_date()}",
        lambda: f"Best before end: {_rand_date()}",
        lambda: f"Do not consume after the date printed: {_rand_date()}",
        lambda: f"Do not use after {_rand_date()}",
        lambda: f"Consume before {_rand_date()}",
        lambda: f"This product expires on {_rand_date()}",
    ],
    "fssai_license": [
        lambda: f"FSSAI Lic No. {random.randint(10000000000, 19999999999)}",
        lambda: f"Lic. No {random.randint(10000000000, 19999999999)}",
        lambda: f"FSSAI License Number: {random.randint(10000000000, 19999999999)}",
        lambda: f"FSSAI {random.randint(10000000000, 19999999999)}",
        lambda: f"Lic {random.randint(10000000000, 19999999999)}",
    ],
    "fssai_nutrition": [
        lambda: f"Energy {random.randint(200, 600)} kcal, Protein {random.randint(1,20)}g per 100g",
        lambda: f"Nutritional Info (per 100g): Carbohydrate {random.randint(10,80)}g, Fat {random.randint(1,30)}g",
        lambda: f"Per Serving: Energy {random.randint(50,300)} kcal, Sugar {random.randint(0,20)}g",
        lambda: f"Nutrition Facts: Total Fat {random.randint(1,30)}g, Sodium {random.randint(10,900)}mg",
    ],
    "fssai_veg_nonveg": [
        lambda: "Vegetarian",
        lambda: "Non-Vegetarian",
        lambda: "Contains Egg",
        lambda: "Pure Veg",
        lambda: "100% Vegetarian",
    ],
    "fssai_allergen": [
        lambda: f"Contains {random.choice(ALLERGENS)}",
        lambda: f"Allergen Info: Contains {random.choice(ALLERGENS)} and {random.choice(ALLERGENS)}",
        lambda: f"May contain traces of {random.choice(ALLERGENS)}",
        lambda: f"This item may contain traces of {random.choice(ALLERGENS)} and {random.choice(ALLERGENS)}",
        lambda: f"Allergy advice: contains {random.choice(ALLERGENS)}",
    ],
    "plastic_material_code": [
        lambda: f"Plastic Type: {random.choice(PLASTIC_CODES)}",
        lambda: f"Material: {random.choice(PLASTIC_CODES)}",
        lambda: f"{random.choice(PLASTIC_CODES)} - Recyclable",
        lambda: f"Made from {random.choice(PLASTIC_CODES)} plastic, code {random.randint(1,7)}",
        lambda: f"Packaging material: {random.choice(PLASTIC_CODES)}",
    ],
    "plastic_recycled_content": [
        lambda: f"Recycled {random.randint(10,80)}% - IS 14534:2023",
        lambda: f"Contains {random.randint(10,80)}% recycled plastic",
        lambda: "Compostable only under industrial composting - IS/ISO 17088:2021",
        lambda: f"This packaging contains {random.randint(10,80)}% post-consumer recycled content, conforms to IS 14534:2023",
    ],
    "plastic_epr_number": [
        lambda: f"EPR Reg No: EPR/{random.randint(2022,2026)}/{random.randint(100000,999999)}",
        lambda: f"CPCB EPR Certificate: {random.randint(100000,999999)}",
        lambda: f"EPR Registration Certificate Number {random.randint(100000,999999)}",
    ],
    "other_noise": [
        lambda: random.choice(
            [
                "Store in a cool dry place",
                "Keep away from direct sunlight",
                "Shake well before use",
                "Tear here",
                "www.example-brand.com",
                "Follow us @examplebrand",
                "New improved formula",
                "100% natural ingredients",
                "Serving suggestion",
                "Recipe on back",
                "Store away from moisture and heat",
                "Please recycle this packaging responsibly",
                "Please dispose of this packaging responsibly",
                "Do your bit for the environment, recycle",
                "Best enjoyed chilled",
                "Handle with care",
                "This side up",
                "Limited edition pack",
                "Scan QR code to know more",
                random.choice(BRANDS) + " " + random.choice(FLAVOR_WORDS),
            ]
        ),
    ],
}


# ---------------------------------------------------------------------------
# OCR noise simulation — the actual character-level errors Tesseract makes
# on real packaging photos (glare, low contrast, small print).
# ---------------------------------------------------------------------------
_CONFUSIONS = {
    "O": "0", "0": "O", "I": "1", "l": "1", "1": "l",
    "S": "5", "5": "S", "B": "8", "8": "B", "Z": "2",
}


def inject_ocr_noise(text: str, noise_rate: float = 0.12) -> str:
    """Randomly applies character confusions, drops, and spacing errors to
    simulate real OCR output on imperfect packaging photos."""
    chars = list(text)
    out = []
    for ch in chars:
        r = random.random()
        if r < noise_rate * 0.4 and ch in _CONFUSIONS:
            out.append(_CONFUSIONS[ch])
        elif r < noise_rate * 0.5:
            continue  # dropped character (common with small/blurred fonts)
        else:
            out.append(ch)
    noisy = "".join(out)
    # Occasionally merge two words together (missing space) or split one
    if random.random() < 0.15:
        noisy = re.sub(r" ", "", noisy, count=1)
    return noisy


def generate_dataset(examples_per_class: int = 250, noise_fraction: float = 0.5) -> list[tuple[str, str]]:
    """Returns a list of (text, label) pairs across all field categories."""
    dataset: list[tuple[str, str]] = []
    for label, generators in TEMPLATES.items():
        for _ in range(examples_per_class):
            gen = random.choice(generators)
            text = gen()
            if random.random() < noise_fraction:
                text = inject_ocr_noise(text)
            dataset.append((text, label))
    random.shuffle(dataset)
    return dataset


if __name__ == "__main__":
    data = generate_dataset(examples_per_class=5)
    for text, label in data[:40]:
        print(f"[{label:24s}] {text}")
    print(f"\nTotal categories: {len(TEMPLATES)}")
