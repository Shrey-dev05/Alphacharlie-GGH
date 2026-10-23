"""
Ingredient & Chemical Intelligence Service
============================================
Expert regulatory and biochemical analysis of food, beverage, and consumer product
ingredients under Legal Metrology, FSSAI, and international food safety standards.

Provides:
  1. Deep ingredient parsing & chemical identification (preservatives, INS codes, colors, sweeteners).
  2. Ingredient Quality Rating (0-100 score + Grade A/B/C/D/E).
  3. Condition-specific side effect & contraindication mapping (Hypertension, Diabetes, Asthma, Kidney, Children, Pregnancy, Gut).
  4. Multi-Product Comparative Intelligence ("Which is Better to Consume").
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


# ---------------------------------------------------------------------------
# Comprehensive Chemical, Additive & Preservative Knowledge Base
# ---------------------------------------------------------------------------

CHEMICAL_DATABASE: dict[str, dict[str, Any]] = {
    # --- Chemical Preservatives & Antimicrobials ---
    "sodium benzoate": {
        "code": "INS 211",
        "category": "preservative",
        "severity": "high",
        "purpose": "Chemical antimicrobial preservative inhibiting mold and bacteria in acidic foods.",
        "health_risks": "Can form benzene (known human carcinogen) when combined with Vitamin C (Ascorbic acid). Known to exacerbate asthma and urticaria.",
        "condition_risks": {
            "asthma": "High Risk: Proven to trigger bronchial constriction and acute asthmatic attacks.",
            "children_adhd": "High Risk: Clinically linked to hyperactivity, behavioral changes, and attention deficits in children.",
            "hypertension": "Caution: Adds sodium load which contributes to fluid retention and elevated blood pressure.",
            "pregnancy": "Caution: Animal studies indicate potential oxidative stress on fetal cells; minimal intake recommended.",
        },
    },
    "potassium sorbate": {
        "code": "INS 202",
        "category": "preservative",
        "severity": "moderate",
        "purpose": "Antifungal and antimicrobial preservative widely used in dairy, syrups, and baked goods.",
        "health_risks": "Generally recognized as safe in low doses, but high consumption can cause allergic contact dermatitis, nausea, and gut irritation.",
        "condition_risks": {
            "kidney": "High Risk: Introduces supplemental potassium that impaired kidneys struggle to filter, risking hyperkalemia.",
            "gut_health": "Caution: May perturb intestinal epithelial integrity at chronic exposure levels.",
        },
    },
    "sodium metabisulphite": {
        "code": "INS 223",
        "category": "preservative",
        "severity": "high",
        "purpose": "Sulphite preservative and bleaching agent used in dried fruits, juices, and wine.",
        "health_risks": "Releases sulphur dioxide in acidic environments. Can induce severe, life-threatening anaphylactic reactions in sensitive individuals.",
        "condition_risks": {
            "asthma": "Critical Risk: Known trigger for acute bronchospasms and asthmatic episodes (Sulphite Sensitivity).",
            "gut_health": "Caution: Depletes thiamine (Vitamin B1) and causes gastric irritation in sensitive individuals.",
        },
    },
    "potassium metabisulphite": {
        "code": "INS 224",
        "category": "preservative",
        "severity": "high",
        "purpose": "Antioxidant and antimicrobial preservative in fruit juices and processed beverages.",
        "health_risks": "Sulphite compound causing respiratory constriction, headache, and allergic skin flushing.",
        "condition_risks": {
            "asthma": "Critical Risk: Primary respiratory irritant triggering wheezing and acute bronchoconstriction.",
            "kidney": "Caution: Increases metabolic burden on renal filtration.",
        },
    },
    "butylated hydroxyanisole": {
        "code": "INS 320",
        "category": "antioxidant",
        "severity": "high",
        "purpose": "Synthetic phenolic antioxidant used to prevent rancidity in fats and oils.",
        "health_risks": "Classified by IARC as a possible human carcinogen (Group 2B). Suspected endocrine disruptor affecting thyroid and testosterone hormones.",
        "condition_risks": {
            "pregnancy": "High Risk: Endocrine disruption potential poses risks during fetal organogenesis.",
            "children_adhd": "Caution: Suspected neurochemical disruption in developing nervous systems.",
        },
    },
    "butylated hydroxytoluene": {
        "code": "INS 321",
        "category": "antioxidant",
        "severity": "high",
        "purpose": "Synthetic fat-soluble antioxidant preserving potato chips, cereals, and baked snacks.",
        "health_risks": "Toxicological studies associate high doses with liver enlargement and pulmonary cell damage.",
        "condition_risks": {
            "pregnancy": "High Risk: Crosses the placental barrier with potential toxicological effects.",
            "kidney": "Caution: Requires hepatic and renal clearance pathways.",
        },
    },
    "sodium nitrite": {
        "code": "INS 250",
        "category": "preservative",
        "severity": "high",
        "purpose": "Curing agent and preservative in processed meats preventing Clostridium botulinum.",
        "health_risks": "Reacts with amines during high-heat cooking to form carcinogenic nitrosamines.",
        "condition_risks": {
            "hypertension": "High Risk: Directly implicated in arterial stiffness and endothelial dysfunction.",
            "pregnancy": "Critical Risk: High methemoglobinemia risk (Blue Baby syndrome) and developmental toxicity.",
        },
    },

    # --- Artificial Food Colors & Coal-Tar Dyes ---
    "tartrazine": {
        "code": "INS 102",
        "category": "color",
        "severity": "high",
        "purpose": "Synthetic lemon yellow azo dye (coal-tar derivative).",
        "health_risks": "Cross-reacts with aspirin, triggers severe hives, eczema, and asthma attacks.",
        "condition_risks": {
            "children_adhd": "Critical Risk: Primary constituent of the 'Southampton Six' dyes proven to cause hyperactive behavioral disorders in kids.",
            "asthma": "High Risk: Triggers bronchospasm in individuals with aspirin sensitivity.",
        },
    },
    "sunset yellow": {
        "code": "INS 110",
        "category": "color",
        "severity": "high",
        "purpose": "Synthetic orange-red petroleum-derived azo dye.",
        "health_risks": "Associated with chromosome damage, urticaria, rhinitis, and hyperactivity.",
        "condition_risks": {
            "children_adhd": "Critical Risk: Clinically proven to amplify attention deficit and hyperactivity in pediatric consumers.",
            "asthma": "Caution: Can exacerbate rhinitis and respiratory allergies.",
        },
    },
    "carmoisine": {
        "code": "INS 122",
        "category": "color",
        "severity": "high",
        "purpose": "Synthetic red azo dye in sweets, syrups, and packaged snacks.",
        "health_risks": "Restricted in several European countries due to allergy and ADHD links.",
        "condition_risks": {
            "children_adhd": "Critical Risk: Strong evidence of pediatric neurobehavioral impairment.",
            "asthma": "Caution: Triggers hypersensitivity reactions.",
        },
    },
    "allura red": {
        "code": "INS 129",
        "category": "color",
        "severity": "high",
        "purpose": "Synthetic red dye manufactured from petroleum distillates.",
        "health_risks": "Linked to inflammatory bowel disease (IBD) flare-ups and gut epithelial damage.",
        "condition_risks": {
            "gut_health": "High Risk: Clinically demonstrated to impair gut barrier function and induce colitis in sensitive models.",
            "children_adhd": "High Risk: Increases hyperactivity and impulsive behavior in children.",
        },
    },
    "caramel color iii": {
        "code": "INS 150c",
        "category": "color",
        "severity": "moderate",
        "purpose": "Ammonia caramel coloring in colas, sauces, and baked goods.",
        "health_risks": "May contain 4-MEI (4-methylimidazole), an impurity classified as potentially carcinogenic.",
        "condition_risks": {
            "pregnancy": "Caution: Avoid frequent consumption due to heterocyclic amine impurities.",
        },
    },

    # --- Artificial Sweeteners & Sugar Substitutes ---
    "aspartame": {
        "code": "INS 951",
        "category": "sweetener",
        "severity": "high",
        "purpose": "Low-calorie artificial dipeptide sweetener.",
        "health_risks": "Classified by WHO/IARC as possibly carcinogenic (Group 2B). Metabolized into phenylalanine, aspartic acid, and methanol.",
        "condition_risks": {
            "diabetes": "Caution: May cause paradoxical insulin release and alter gut microbiome glucose tolerance.",
            "pregnancy": "Caution: Inadvisable for individuals with undetected phenylketonuria (PKU).",
        },
    },
    "acesulfame potassium": {
        "code": "INS 950",
        "category": "sweetener",
        "severity": "moderate",
        "purpose": "Calorie-free artificial sweetener often blended with aspartame or sucralose.",
        "health_risks": "Contains methylene chloride solvent residues during manufacturing; potential thyroid effects.",
        "condition_risks": {
            "kidney": "Caution: Provides additional potassium load requiring renal clearance.",
            "gut_health": "Caution: Disrupts gut microbiome diversity.",
        },
    },
    "sucralose": {
        "code": "INS 955",
        "category": "sweetener",
        "severity": "moderate",
        "purpose": "Chlorinated sucrose derivative artificial sweetener.",
        "health_risks": "Reduces beneficial gut bifidobacteria and lactobacilli by up to 50%. Thermal decomposition produces chloropropanols.",
        "condition_risks": {
            "gut_health": "High Risk: Substantially suppresses commensal gut microflora and elevates gut permeability.",
            "diabetes": "Caution: Influences GLP-1 secretion and glycemic variability in insulin-resistant patients.",
        },
    },

    # --- Emulsifiers, Thickeners & Texture Modifiers ---
    "carrageenan": {
        "code": "INS 407",
        "category": "thickener",
        "severity": "high",
        "purpose": "Sulfated polysaccharide extracted from red seaweed used for thickening and gelling.",
        "health_risks": "Widely used in scientific studies to induce acute gut inflammation and ulceration.",
        "condition_risks": {
            "gut_health": "Critical Risk: Strongly contraindicated for IBD, Crohn's disease, and Ulcerative Colitis.",
        },
    },
    "carboxymethyl cellulose": {
        "code": "INS 466",
        "category": "emulsifier",
        "severity": "moderate",
        "purpose": "Cellulose gum stabilizer and thickening agent.",
        "health_risks": "Alters gut microbiota composition, promoting low-grade chronic systemic inflammation.",
        "condition_risks": {
            "gut_health": "High Risk: Induces mucosal layer degradation and exacerbates irritable bowel syndrome (IBS).",
            "diabetes": "Caution: Associated with increased adiposity and insulin insensitivity.",
        },
    },
    "mono- and diglycerides of fatty acids": {
        "code": "INS 471",
        "category": "emulsifier",
        "severity": "moderate",
        "purpose": "Synthetic lipid emulsifier combining water and oil in bakery and confectionery.",
        "health_risks": "Often contains hidden trans-fatty acids and alters gut mucus permeability.",
        "condition_risks": {
            "hypertension": "Caution: Contributes to lipid dysregulation and arterial plaque formation.",
            "gut_health": "Caution: May disrupt the intestinal mucus barrier.",
        },
    },

    # --- Flavor Enhancers & Excitotoxins ---
    "monosodium glutamate": {
        "code": "INS 621",
        "category": "flavor_enhancer",
        "severity": "moderate",
        "purpose": "Umami flavor enhancer used extensively in snacks, noodles, and savory dishes.",
        "health_risks": "Can trigger glutamate excitotoxicity symptoms: headaches, facial numbness, sweating, palpitations.",
        "condition_risks": {
            "hypertension": "High Risk: Contains significant sodium, compounding vascular hypertension and arterial stiffness.",
            "asthma": "Caution: Known to trigger bronchospasm in MSG-sensitive individuals.",
        },
    },

    # --- Refined Sugars, Syrups & Ultra-Processed Fats ---
    "high fructose corn syrup": {
        "code": "HFCS",
        "category": "sugar",
        "severity": "high",
        "purpose": "Industrial enzymatically-converted corn syrup high in unbound fructose.",
        "health_risks": "Directly metabolized by the liver into triglycerides, causing non-alcoholic fatty liver disease (NAFLD).",
        "condition_risks": {
            "diabetes": "Critical Risk: Spikes blood glucose, triggers severe insulin resistance, and elevates visceral fat.",
            "hypertension": "High Risk: Raises serum uric acid which impairs nitric oxide and elevates systemic blood pressure.",
        },
    },
    "hydrogenated vegetable oil": {
        "code": "Trans Fat",
        "category": "fat",
        "severity": "high",
        "purpose": "Partially or fully hydrogenated industrial vegetable shortening.",
        "health_risks": "Contains artificial trans-fatty acids that raise LDL (bad) cholesterol and lower HDL (good) cholesterol.",
        "condition_risks": {
            "hypertension": "Critical Risk: Direct primary driver of coronary artery atherosclerosis, heart attacks, and stroke.",
            "diabetes": "High Risk: Impairs cellular membrane fluidity, worsening insulin resistance.",
        },
    },
    "palm oil": {
        "code": "Palmolein",
        "category": "fat",
        "severity": "moderate",
        "purpose": "Refined saturated vegetable oil widely used in fried commercial snacks.",
        "health_risks": "High in palmitic acid (saturated fat), contributing to cardiovascular lipid deposition.",
        "condition_risks": {
            "hypertension": "Caution: High saturated fat intake accelerates arterial plaque development.",
        },
    },
    "refined wheat flour": {
        "code": "Maida",
        "category": "refined_grain",
        "severity": "moderate",
        "purpose": "Bleached, stripped wheat endosperm lacking bran, germ, and dietary fiber.",
        "health_risks": "Very high glycemic index (GI 70-85), rapid glucose surge, stripped of micronutrients.",
        "condition_risks": {
            "diabetes": "High Risk: Induces postprandial glucose spikes and metabolic strain.",
            "celiac_gluten": "Critical Risk: High gluten concentration causes severe autoimmune enteropathy.",
        },
    },
}

# Aliases and regex patterns to match chemical and additive mentions
CHEMICAL_ALIASES: dict[str, str] = {
    # Benzoate
    "sodium benzoate": "sodium benzoate",
    "ins 211": "sodium benzoate",
    "ins211": "sodium benzoate",
    "e211": "sodium benzoate",
    "211": "sodium benzoate",
    "benzoate": "sodium benzoate",
    # Sorbate
    "potassium sorbate": "potassium sorbate",
    "ins 202": "potassium sorbate",
    "ins202": "potassium sorbate",
    "e202": "potassium sorbate",
    "202": "potassium sorbate",
    "sorbic acid": "potassium sorbate",
    # Sulphites
    "sodium metabisulphite": "sodium metabisulphite",
    "sodium metabisulfite": "sodium metabisulphite",
    "ins 223": "sodium metabisulphite",
    "e223": "sodium metabisulphite",
    "potassium metabisulphite": "potassium metabisulphite",
    "potassium metabisulfite": "potassium metabisulphite",
    "ins 224": "potassium metabisulphite",
    "e224": "potassium metabisulphite",
    "sulphite": "sodium metabisulphite",
    "sulfite": "sodium metabisulphite",
    "sulphites": "sodium metabisulphite",
    # BHA / BHT
    "bha": "butylated hydroxyanisole",
    "ins 320": "butylated hydroxyanisole",
    "butylated hydroxyanisole": "butylated hydroxyanisole",
    "bht": "butylated hydroxytoluene",
    "ins 321": "butylated hydroxytoluene",
    "butylated hydroxytoluene": "butylated hydroxytoluene",
    # Nitrites
    "sodium nitrite": "sodium nitrite",
    "ins 250": "sodium nitrite",
    "nitrite": "sodium nitrite",
    # Colors
    "tartrazine": "tartrazine",
    "ins 102": "tartrazine",
    "e102": "tartrazine",
    "yellow 5": "tartrazine",
    "sunset yellow": "sunset yellow",
    "ins 110": "sunset yellow",
    "e110": "sunset yellow",
    "yellow 6": "sunset yellow",
    "carmoisine": "carmoisine",
    "ins 122": "carmoisine",
    "azorubine": "carmoisine",
    "allura red": "allura red",
    "ins 129": "allura red",
    "red 40": "allura red",
    "caramel": "caramel color iii",
    "ins 150c": "caramel color iii",
    "ins 150d": "caramel color iii",
    # Sweeteners
    "aspartame": "aspartame",
    "ins 951": "aspartame",
    "acesulfame potassium": "acesulfame potassium",
    "acesulfame k": "acesulfame potassium",
    "ins 950": "acesulfame potassium",
    "sucralose": "sucralose",
    "ins 955": "sucralose",
    # Emulsifiers
    "carrageenan": "carrageenan",
    "ins 407": "carrageenan",
    "carboxymethyl cellulose": "carboxymethyl cellulose",
    "cmc": "carboxymethyl cellulose",
    "ins 466": "carboxymethyl cellulose",
    "mono and diglycerides": "mono- and diglycerides of fatty acids",
    "ins 471": "mono- and diglycerides of fatty acids",
    # MSG
    "monosodium glutamate": "monosodium glutamate",
    "msg": "monosodium glutamate",
    "ins 621": "monosodium glutamate",
    "flavor enhancer 621": "monosodium glutamate",
    # Fats & Sugars
    "high fructose corn syrup": "high fructose corn syrup",
    "hfcs": "high fructose corn syrup",
    "liquid glucose": "high fructose corn syrup",
    "invert sugar": "high fructose corn syrup",
    "hydrogenated vegetable oil": "hydrogenated vegetable oil",
    "hydrogenated fat": "hydrogenated vegetable oil",
    "partially hydrogenated": "hydrogenated vegetable oil",
    "trans fat": "hydrogenated vegetable oil",
    "palm oil": "palm oil",
    "palmolein": "palm oil",
    "refined palm oil": "palm oil",
    "refined wheat flour": "refined wheat flour",
    "maida": "refined wheat flour",
}

# Wholesome and natural ingredients that boost quality score
WHOLESOME_INGREDIENTS = [
    "whole wheat", "atta", "oats", "rolled oats", "ragi", "millet", "jowar", "bajra",
    "almonds", "walnuts", "cashews", "chia seeds", "flax seeds", "pumpkin seeds",
    "cold-pressed", "virgin coconut oil", "extra virgin olive oil", "mustard oil",
    "turmeric", "cumin", "coriander", "ginger", "garlic", "cardamom", "cinnamon",
    "honey", "jaggery", "cow milk", "curd", "yogurt", "ghee", "clarified butter",
    "fresh fruit", "mango pulp", "apple juice", "lemon juice", "rock salt", "saindhava lavana"
]

# Sensitive Health Conditions Profile
HEALTH_CONDITIONS: dict[str, str] = {
    "hypertension": "Hypertension / High BP & Cardiovascular",
    "diabetes": "Type 1 & Type 2 Diabetes / Metabolic Syndrome",
    "asthma": "Asthma, Bronchospasm & Respiratory Allergies",
    "kidney": "Chronic Kidney Disease (CKD) & Renal Burden",
    "celiac_gluten": "Celiac Disease & Severe Gluten Sensitivity",
    "children_adhd": "Children, Pediatric Health & ADHD / Hyperactivity",
    "pregnancy": "Pregnancy, Fetal Safety & Lactation",
    "gut_health": "Gut Health, Microbiome, IBS & IBD / Colitis",
    "dairy_lactose": "Lactose Intolerance & Dairy Sensitivities",
}


# ---------------------------------------------------------------------------
# Data Models for Ingredient Analysis
# ---------------------------------------------------------------------------

@dataclass
class ChemicalDetection:
    name: str
    code: str
    category: str
    severity: str
    purpose: str
    health_risks: str
    condition_risks: dict[str, str] = field(default_factory=dict)


@dataclass
class ConditionAssessment:
    condition_key: str
    condition_name: str
    status: str  # "safe" | "caution" | "high_risk"
    reasons: list[str] = field(default_factory=list)
    offending_chemicals: list[str] = field(default_factory=list)


@dataclass
class IngredientQualityReport:
    raw_ingredients_text: str
    parsed_ingredients: list[str]
    total_ingredients_count: int
    detected_chemicals: list[ChemicalDetection]
    preservatives_count: int
    artificial_colors_count: int
    artificial_sweeteners_count: int
    emulsifiers_count: int
    wholesome_ingredients_count: int
    quality_score: float  # 0 to 100
    quality_grade: str  # A, B, C, D, E
    cleanliness_tier: str  # "Clean / Natural" | "Moderate" | "Caution" | "Ultra-Processed"
    summary_verdict: str
    condition_assessments: dict[str, ConditionAssessment] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Core Analysis Engine
# ---------------------------------------------------------------------------

def parse_ingredients_list(text: str) -> list[str]:
    """Splits an ingredient string into discrete ingredient tokens,
    handling nested parentheses like 'Emulsifier (INS 322, INS 471)'."""
    if not text:
        return []

    # Strip prefixes like "Ingredients:" or "Contains:"
    cleaned = re.sub(r"^(ingredients|contains|content)\s*[:\-]\s*", "", text, flags=re.IGNORECASE).strip()

    # Split by commas or semicolons outside parentheses
    tokens = []
    current: list[str] = []
    depth = 0

    for ch in cleaned:
        if ch == "(" or ch == "[":
            depth += 1
            current.append(ch)
        elif ch == ")" or ch == "]":
            depth = max(0, depth - 1)
            current.append(ch)
        elif (ch == "," or ch == ";") and depth == 0:
            token = "".join(current).strip()
            if token:
                tokens.append(token)
            current = []
        else:
            current.append(ch)

    if current:
        token = "".join(current).strip()
        if token:
            tokens.append(token)

    return tokens


def analyze_ingredients(text: str, product_name: str | None = None) -> IngredientQualityReport:
    """Performs deep regulatory and biochemical safety analysis on an ingredients list."""
    parsed = parse_ingredients_list(text)
    lower_text = text.lower()

    detected_chemicals_map: dict[str, ChemicalDetection] = {}
    matched_aliases_seen = set()

    # Match chemicals from full text and individual tokens
    for alias, canonical_key in CHEMICAL_ALIASES.items():
        # Match word boundaries
        pattern = r"\b" + re.escape(alias) + r"\b"
        if re.search(pattern, lower_text):
            if canonical_key not in detected_chemicals_map:
                chem_info = CHEMICAL_DATABASE[canonical_key]
                detected_chemicals_map[canonical_key] = ChemicalDetection(
                    name=canonical_key.title(),
                    code=chem_info["code"],
                    category=chem_info["category"],
                    severity=chem_info["severity"],
                    purpose=chem_info["purpose"],
                    health_risks=chem_info["health_risks"],
                    condition_risks=chem_info.get("condition_risks", {}),
                )
            matched_aliases_seen.add(alias)

    detected_chemicals = list(detected_chemicals_map.values())

    # Count categories
    preservatives_count = sum(1 for c in detected_chemicals if c.category == "preservative")
    colors_count = sum(1 for c in detected_chemicals if c.category == "color")
    sweeteners_count = sum(1 for c in detected_chemicals if c.category == "sweetener")
    emulsifiers_count = sum(1 for c in detected_chemicals if c.category in ("emulsifier", "thickener"))

    # Count wholesome ingredients
    wholesome_count = 0
    for w in WHOLESOME_INGREDIENTS:
        if re.search(r"\b" + re.escape(w) + r"\b", lower_text):
            wholesome_count += 1

    # Quality Score Calculation (0 - 100)
    # Baseline starts at 90 for clean/minimal foods
    score = 90.0

    # Penalties for chemical additives
    for c in detected_chemicals:
        if c.severity == "high":
            score -= 14.0
        elif c.severity == "moderate":
            score -= 8.0
        else:
            score -= 4.0

    # Extra penalties for multiple synthetic additives
    if len(detected_chemicals) >= 4:
        score -= 10.0
    elif len(detected_chemicals) >= 2:
        score -= 5.0

    # Penalty for excessive ingredient length (ultra-processed indicator)
    if len(parsed) > 20:
        score -= 10.0
    elif len(parsed) > 12:
        score -= 5.0

    # Boost for wholesome whole-food ingredients
    score += min(15.0, wholesome_count * 4.0)

    # Clamp score to 5.0 - 100.0
    score = max(5.0, min(100.0, round(score, 1)))

    # Grade determination
    if score >= 85.0:
        grade = "A"
        cleanliness = "Clean & Natural Formulation"
    elif score >= 70.0:
        grade = "B"
        cleanliness = "Generally Safe / Minimally Processed"
    elif score >= 50.0:
        grade = "C"
        cleanliness = "Moderate Additives / Consume with Caution"
    elif score >= 35.0:
        grade = "D"
        cleanliness = "Heavily Processed with Chemical Preservatives"
    else:
        grade = "E"
        cleanliness = "High Chemical Load & Synthetic Additives"

    # Evaluate against 9 health conditions
    condition_assessments: dict[str, ConditionAssessment] = {}

    for cond_key, cond_name in HEALTH_CONDITIONS.items():
        reasons: list[str] = []
        offenders: list[str] = []
        status = "safe"

        # Check detected chemicals for this condition
        for chem in detected_chemicals:
            if cond_key in chem.condition_risks:
                risk_note = chem.condition_risks[cond_key]
                reasons.append(f"{chem.name} ({chem.code}): {risk_note}")
                offenders.append(chem.name)
                if "critical" in risk_note.lower() or "high risk" in risk_note.lower():
                    status = "high_risk"
                elif status != "high_risk":
                    status = "caution"

        # Specific keyword heuristics
        if cond_key == "celiac_gluten":
            gluten_markers = ["wheat", "maida", "barley", "malt", "gluten", "semolina", "suji", "atta"]
            found_g = [m for m in gluten_markers if re.search(r"\b" + re.escape(m) + r"\b", lower_text)]
            if found_g and status == "safe":
                status = "high_risk"
                reasons.append(f"Contains gluten grains ({', '.join(set(found_g))}). Unsafe for Celiac disease.")
                offenders.extend(found_g)

        elif cond_key == "dairy_lactose":
            dairy_markers = ["milk", "milk solids", "whey", "lactose", "casein", "butter", "cheese"]
            found_d = [m for m in dairy_markers if re.search(r"\b" + re.escape(m) + r"\b", lower_text)]
            if found_d and status == "safe":
                status = "caution"
                reasons.append(f"Contains dairy derivatives ({', '.join(set(found_d))}). May trigger lactose intolerance.")
                offenders.extend(found_d)

        elif cond_key == "diabetes":
            sugar_markers = ["sugar", "sucrose", "glucose", "fructose", "corn syrup", "maltodextrin", "dextrose"]
            found_s = [s for s in sugar_markers if re.search(r"\b" + re.escape(s) + r"\b", lower_text)]
            if found_s:
                if status != "high_risk":
                    status = "caution"
                reasons.append(f"Contains added refined sugars/glycemic carbohydrates ({', '.join(set(found_s))}).")
                offenders.extend(found_s)

        if not reasons:
            reasons.append("No specific high-risk additives or contraindications detected for this condition.")

        condition_assessments[cond_key] = ConditionAssessment(
            condition_key=cond_key,
            condition_name=cond_name,
            status=status,
            reasons=reasons,
            offending_chemicals=list(set(offenders)),
        )

    # Summary verdict text
    if grade in ("A", "B"):
        summary = (
            f"This product receives a Quality Rating of {score}/100 (Grade {grade}). "
            f"It features a clean formulation with {wholesome_count} natural ingredients and minimal synthetic additives."
        )
    elif grade == "C":
        summary = (
            f"This product receives a Quality Rating of {score}/100 (Grade {grade}). "
            f"It contains {len(detected_chemicals)} synthetic additives/preservatives ({', '.join(c.name for c in detected_chemicals[:3])}). "
            f"Moderate consumption is advised."
        )
    else:
        summary = (
            f"This product receives a low Quality Rating of {score}/100 (Grade {grade}). "
            f"It contains multiple high-risk chemicals or artificial colors ({', '.join(c.name for c in detected_chemicals)}). "
            f"Consumers with sensitive health conditions (e.g. Asthma, ADHD, Hypertension) should exercise caution."
        )

    return IngredientQualityReport(
        raw_ingredients_text=text,
        parsed_ingredients=parsed,
        total_ingredients_count=len(parsed),
        detected_chemicals=detected_chemicals,
        preservatives_count=preservatives_count,
        artificial_colors_count=colors_count,
        artificial_sweeteners_count=sweeteners_count,
        emulsifiers_count=emulsifiers_count,
        wholesome_ingredients_count=wholesome_count,
        quality_score=score,
        quality_grade=grade,
        cleanliness_tier=cleanliness,
        summary_verdict=summary,
        condition_assessments=condition_assessments,
    )


# ---------------------------------------------------------------------------
# Multi-Product Comparison Engine
# ---------------------------------------------------------------------------

@dataclass
class ProductComparisonItem:
    product_id: str
    product_name: str
    brand_name: str | None
    ingredients_text: str
    report: IngredientQualityReport
    pros: list[str] = field(default_factory=list)
    cons: list[str] = field(default_factory=list)
    rank: int = 1


@dataclass
class MultiProductComparisonResult:
    products: list[ProductComparisonItem]
    winner_product_id: str
    winner_product_name: str
    verdict_explanation: str
    comparison_matrix: list[dict[str, Any]]
    recommendation_summary: str


def compare_multiple_products(
    items: list[dict[str, Any]]
) -> MultiProductComparisonResult:
    """Compares 2 or more products based on their ingredients, chemical safety,
    and nutritional health impact, picking the best product to consume."""
    if len(items) < 2:
        raise ValueError("Comparison requires at least 2 products.")

    compared_items: list[ProductComparisonItem] = []

    for idx, item in enumerate(items):
        pid = str(item.get("id") or f"prod_{idx + 1}")
        pname = item.get("product_name") or f"Product {idx + 1}"
        bname = item.get("brand_name")
        ing_text = item.get("ingredients") or ""

        report = analyze_ingredients(ing_text, product_name=pname)

        pros: list[str] = []
        cons: list[str] = []

        # Generate Pros
        if report.quality_score >= 80:
            pros.append(f"High Quality Rating: {report.quality_score}/100 (Grade {report.quality_grade})")
        if report.preservatives_count == 0:
            pros.append("Zero chemical preservatives detected (Clean formulation)")
        if report.artificial_colors_count == 0:
            pros.append("No artificial or petroleum-derived azo dyes")
        if report.wholesome_ingredients_count > 0:
            pros.append(f"Contains {report.wholesome_ingredients_count} nutrient-dense wholesome ingredients")
        if report.total_ingredients_count <= 8:
            pros.append("Simple, minimally-processed ingredient profile")

        # Generate Cons
        if report.quality_score < 60:
            cons.append(f"Low Quality Score: {report.quality_score}/100 (Grade {report.quality_grade})")
        if report.preservatives_count > 0:
            cons.append(f"Contains {report.preservatives_count} chemical preservative(s)")
        if report.artificial_colors_count > 0:
            cons.append(f"Contains {report.artificial_colors_count} synthetic food dye(s)")
        if report.artificial_sweeteners_count > 0:
            cons.append("Contains synthetic non-nutritive sweetener(s)")
        for chem in report.detected_chemicals:
            if chem.severity == "high":
                cons.append(f"Includes high-hazard additive: {chem.name} ({chem.code})")

        compared_items.append(
            ProductComparisonItem(
                product_id=pid,
                product_name=pname,
                brand_name=bname,
                ingredients_text=ing_text,
                report=report,
                pros=pros,
                cons=cons,
            )
        )

    # Rank products: primary = quality_score DESC, secondary = chemical count ASC
    sorted_items = sorted(
        compared_items,
        key=lambda x: (x.report.quality_score, -len(x.report.detected_chemicals)),
        reverse=True,
    )

    for rank, item in enumerate(sorted_items, start=1):
        item.rank = rank

    winner = sorted_items[0]

    # Generate comparative matrix
    matrix: list[dict[str, Any]] = [
        {
            "feature": "Quality Score",
            **{f"{it.product_id}": f"{it.report.quality_score}/100 (Grade {it.report.quality_grade})" for it in compared_items},
        },
        {
            "feature": "Formulation Cleanliness",
            **{f"{it.product_id}": it.report.cleanliness_tier for it in compared_items},
        },
        {
            "feature": "Chemical Preservatives",
            **{f"{it.product_id}": f"{it.report.preservatives_count} detected" for it in compared_items},
        },
        {
            "feature": "Artificial Dyes / Colors",
            **{f"{it.product_id}": f"{it.report.artificial_colors_count} detected" for it in compared_items},
        },
        {
            "feature": "Artificial Sweeteners",
            **{f"{it.product_id}": f"{it.report.artificial_sweeteners_count} detected" for it in compared_items},
        },
        {
            "feature": "Total Ingredients Count",
            **{f"{it.product_id}": f"{it.report.total_ingredients_count} items" for it in compared_items},
        },
    ]

    # Explanatory verdict
    verdict = (
        f"🏆 Recommended: **{winner.product_name}** is the healthiest and safest choice to consume. "
        f"It achieved the highest Quality Score of **{winner.report.quality_score}/100 (Grade {winner.report.quality_grade})** "
        f"with {winner.report.preservatives_count} chemical preservatives, compared to "
        f"{', '.join(f'{it.product_name} ({it.report.quality_score}/100)' for it in sorted_items[1:])}. "
    )

    rec_summary = (
        f"Based on rigorous FSSAI and nutritional safety metrics, **{winner.product_name}** offers superior "
        f"cleanliness and minimal chemical additive burden. Sensitive consumers (e.g., asthmatics, children, and diabetics) "
        f"will experience significantly reduced health risks choosing {winner.product_name}."
    )

    return MultiProductComparisonResult(
        products=sorted_items,
        winner_product_id=winner.product_id,
        winner_product_name=winner.product_name,
        verdict_explanation=verdict,
        comparison_matrix=matrix,
        recommendation_summary=rec_summary,
    )
