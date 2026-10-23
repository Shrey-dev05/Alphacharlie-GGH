"""
Builds app/data/legal_metrology_corpus/expanded_dataset.jsonl from the
user-provided multi-domain legal dataset (Legal Metrology extended
provisions, FSSAI, Plastic Waste Management, BIS -- English + Hinglish,
plus 20 verification Q&A pairs).

IMPORTANT NOTE ON THE SOURCE PDF
-----------------------------------
The source PDF's text layer extracts with a scrambled reading order in its
Q&A section (a common artifact of certain PDF layouts) -- the 20 questions
and their English/Hinglish answers do not appear adjacent to each other in
extraction order. Each (question, answer) pair below was manually
re-matched by content/topic rather than by position in the raw extracted
text, and cross-checked against the specific facts named in each answer
(e.g. "45 GSM non-woven bag" only matches the PWM/EPR answer). Run this
script's `--verify` flag to print all 20 pairs for a manual spot-check.

LEGAL ACCURACY DISCLAIMER
-----------------------------
This dataset was supplied by the project owner, not sourced or verified by
Claude against an official Gazette text. It reads as curated/compiled
training material (note the "for RAG Testing", "for Bot Verification"
section headers) rather than a primary legal source, and it contains at
least one internal ambiguity worth flagging: the source attributes "Rule
19" (Maximum Permissible Error) and "Rule 20" (Inspector Action) to BOTH
the Legal Metrology Rules context and, separately and explicitly, to the
"Food Safety and Standards (Packaging and Labelling) Regulations, 2011"
in its own Part 2 heading. This script preserves the source's own
attribution (FSSAI Regulations 19/20) rather than inventing a correction --
have a Legal Metrology / FSSAI domain expert confirm which regime's rule
numbering actually applies before this is used for anything beyond
chatbot Q&A assistance. This is the same category of caveat already
attached to app/data/legal_metrology_rules.json -- this is training data
for a legal assistant, not a certified legal reference.

Run: `python -m app.ml.build_expanded_corpus` from backend/
"""
from __future__ import annotations

import json
from pathlib import Path

OUTPUT_PATH = (
    Path(__file__).resolve().parent.parent / "data" / "legal_metrology_corpus" / "expanded_dataset.jsonl"
)

# ---------------------------------------------------------------------------
# Definitions
# ---------------------------------------------------------------------------
DEFINITIONS = [
    {
        "rule_reference": "Legal Metrology (Packaged Commodities) Rules, 2011 -- Definitions",
        "text": (
            "Pre-packaged Commodity: a commodity which, without the purchaser being present, is placed in a "
            "package of whatever nature (sealed or not) so that the product contained has a pre-determined "
            "quantity. Hinglish: Pre-packaged Commodity ka matlab hai aisa commodity jo consumer ki presence ke "
            "bina kisi package (box, pouch, wrapper, bottle) mein seal ya pack kiya jata hai, jisme andar ka "
            "quantity pehle se fixed aur pre-determined hota hai."
        ),
    },
    {
        "rule_reference": "Legal Metrology (Packaged Commodities) Rules, 2011 -- Definitions",
        "text": (
            "Institutional Consumer: an institution that buys packaged commodities bearing a declaration 'not "
            "for retail sale', directly from the manufacturer, importer, or wholesale dealer, for that "
            "institution's own use and not for commercial or trade purposes -- e.g. a restaurant, hotel, "
            "hospital, or airline buying in bulk for its own consumption. Hinglish: Institutional Consumer aisi "
            "institutions hain (jaise hotels, hospitals, airlines, restaurants) jo packaged commodities direct "
            "manufacturer, importer, ya wholesaler se bulk mein kharidti hain apne consumption ke liye, "
            "commercial resale ke liye nahi. In packets par strictly 'not for retail sale' likha hona mandatory hai."
        ),
    },
    {
        "rule_reference": "Legal Metrology (Packaged Commodities) Rules, 2011 -- Definitions",
        "text": (
            "Industrial Consumer: a consumer who buys packaged commodities directly from the manufacturer, "
            "importer, or wholesale dealer for use by that industry (raw material/processing use); the package "
            "must bear the declaration 'not for retail sale'. Hinglish: Industrial Consumer aise companies ya "
            "industries hain jo raw material ya processing ke liye direct manufacturer ya importer se bulk "
            "packaged items lete hain. In packages par bhi 'not for retail sale' ka declaration hona compulsory hai."
        ),
    },
]

# ---------------------------------------------------------------------------
# Legal Metrology -- extended provisions beyond the base rules.json seed
# ---------------------------------------------------------------------------
LM_EXTENDED_RULES = [
    (
        "Rule 3 (general exemption, cement exception)",
        "General commodities packaged above 25 kg are exempt from most Legal Metrology declaration "
        "requirements. Cement is a named exception to this exemption: cement sold in bags up to 50 kg must "
        "still display all mandatory declarations, even though 30 kg (for example) is under the general 25 kg "
        "exemption threshold that would otherwise apply to other commodities. Hinglish: General items 25kg ke "
        "baad Rule 3 ke tahat exempt ho jaate hain, par cement is exemption ka exception hai -- cement ke bags "
        "jo 50 kg tak ke hain, unpar saare mandatory declarations lagte hain, chahe woh 30 kg ka hi bag kyun na ho.",
    ),
    (
        "Rule 6(1) (importer address for imported goods)",
        "For imported packages, the name and complete address of the Indian importer must be declared on the "
        "package. Displaying only the foreign manufacturer's address, without the Indian importer's name and "
        "address, is not sufficient and is not legally compliant. Hinglish: Rule 6(1) ke mutabiq, kisi bhi "
        "imported product par sirf foreign company ka nahi, balki Indian importer ka naam aur complete address "
        "hona mandatory hai. Sirf foreign manufacturer ka address hona compliant nahi hai.",
    ),
    (
        "Rule 6(10) (e-commerce declarations)",
        "E-commerce entities must display all mandatory Legal Metrology declarations on their digital/online "
        "listings, with one specific exception: the month and year of manufacture or packing is NOT required to "
        "be shown online. So a mobile phone listing missing its manufacturing date online is not, by itself, a "
        "violation. Hinglish: Rule 6(10) ke hisaab se e-commerce websites ko digital platform par saari "
        "mandatory details dikhani hoti hain, bas manufacturing ya packing ka month aur year dikhana compulsory "
        "nahi hai -- isliye sirf mfg date missing hona violation nahi hai.",
    ),
    (
        "Rule 7 (cylindrical package PDP area)",
        "For a cylindrical package, the area of the Principal Display Panel (PDP) is calculated as 40 percent "
        "of the product of the package's height multiplied by its circumference. This PDP area then determines "
        "which font-size band applies under Rule 9(3)/Rule 7's numeral height table. Hinglish: Rule 7 ke "
        "anusar, cylindrical bottle ka Principal Display Panel calculate karne ke liye bottle ki height aur "
        "circumference (golai) ko multiply karke uska 40% nikalna hota hai.",
    ),
    (
        "Rule 9(3) (numeral/letter height by PDP area band)",
        "For a Principal Display Panel area between 50 and 100 square centimeters, the minimum height of "
        "numerals and letters for the 'Net Quantity' declaration is 2 mm for normal characters. (This is "
        "consistent with, and a more granular version of, the <=100cm2 -> 2mm band already encoded in "
        "app/data/legal_metrology_rules.json's font_size_rules table.) Hinglish: Agar panel ka area 50 se 100 "
        "sq cm ke beech hai, toh 'Net Quantity' ke letters aur numbers ki minimum height 2 mm honi chahiye.",
    ),
    (
        "Rule 9(4) (language of declarations)",
        "Declarations must be printed in Hindi (Devnagri script) or in English. A regional language (e.g. "
        "Bengali, Marathi, Tamil) may be used IN ADDITION to Hindi or English, but cannot replace both of them "
        "-- a label using only a regional language with no Hindi or English is not compliant. Hinglish: "
        "Declarations Hindi (Devnagri) ya English mein hona mandatory hai. Bengali ya Marathi ko additional "
        "language ki tarah add kiya ja sakta hai, par Hindi/English ko completely replace nahi kiya ja sakta.",
    ),
    (
        "Rule 13 (standard metric units)",
        "The declaration of quantity must be expressed in standard metric units of weight, measure, or number "
        "(grams, kilograms, litres, or count) -- vague marketing terms like 'Jumbo Size' or 'Family Pack' "
        "without an accompanying standard metric quantity are a violation of this rule. Hinglish: Quantity "
        "hamesha standard metric units (jaise grams ya kilograms) mein honi chahiye, vague terms jaise 'Jumbo "
        "Size' mein nahi -- yeh Rule 13 ka violation hai.",
    ),
    (
        "Rule 18(2) (MRP wording format)",
        "The retail price must be formatted exactly as 'Maximum or Max. retail price Rs.../Rs... (inclusive of "
        "all taxes)' or 'MRP Rs.../Rs... (incl. of all taxes)' -- this exact inclusive-of-taxes wording is "
        "required to prevent sellers from adding illegal surcharges (e.g. a 'cooling charge') on top of the "
        "printed price. Hinglish: MRP ka exact legal format 'Maximum or Max. retail price Rs.../Rs... "
        "(inclusive of all taxes)' ya 'MRP Rs.../Rs... (incl. of all taxes)' hona chahiye taaki koi extra "
        "cooling charge ya tax na maang sake.",
    ),
    (
        "Rule 18(5) (prohibition on price-override stickers)",
        "A shopkeeper/retailer cannot affix a new sticker with a HIGHER price over the original manufacturer-"
        "printed MRP to increase the price (e.g. sticking Rs.60 over a printed Rs.50), regardless of the "
        "stated reason (such as inflation). This is explicitly prohibited. Hinglish: Koi bhi shopkeeper purane "
        "printed MRP ke upar higher price (jaise Rs.50 ke upar Rs.60) ka naya sticker nahi chipka sakta, chahe "
        "wajah inflation hi kyun na ho.",
    ),
    (
        "Section 36(1), Legal Metrology Act 2009 (repeat-offense penalty)",
        "A second offense for non-compliant package declarations carries a fine that may extend to fifty "
        "thousand rupees (Rs 50,000) under Section 36(1) of the Legal Metrology Act, 2009. Hinglish: Legal "
        "Metrology Act, 2009 ke Section 36(1) ke under, agar koi doosri baar non-compliant packaging ke sath "
        "pakda jata hai, toh uspe 50,000 rupaye tak ka fine lag sakta hai.",
    ),
    (
        "Rule 24 (wholesale package declarations)",
        "Wholesale packages (e.g. a master carton containing many individual retail units) must declare the "
        "name and address of the manufacturer, the identity of the commodity, and the total number/net "
        "quantity -- but Rule 24 does NOT require the retail sale price (MRP) to be printed on the wholesale "
        "carton itself; MRP is a retail-package requirement. Hinglish: Rule 24 ke mutabiq wholesale master "
        "carton par manufacturer ka naam/address, product ka naam aur total quantity likhna zaroori hai, par "
        "us par retail sale price (MRP) likhna mandatory nahi hai.",
    ),
]

# ---------------------------------------------------------------------------
# FSSAI (Food Safety and Standards (Packaging and Labelling) Regulations, 2011)
# ---------------------------------------------------------------------------
FSSAI_RULES = [
    (
        "FSSAI Regulations, 2011, Rule 4 (pre-packing and sale)",
        "No person may pre-pack, or cause to be pre-packed, any commodity for sale, distribution, or delivery "
        "unless the package (or a label securely affixed to it) bears all declarations required under these "
        "regulations.",
    ),
    (
        "FSSAI Regulations, 2011, Rule 5 (standard package sizes)",
        "Certain commodities -- bread, butter, tea, coffee, and milk powder -- must be packed only in the "
        "standard quantities specified in Schedule II. Tea, for example, may only be packed in 25g, 50g, 100g, "
        "250g, 500g, 1kg, or thereafter in multiples of 1kg -- an arbitrary weight like 325g or 410g is not a "
        "permitted standard size. The Q&A example of coffee powder in a 325g jar is a direct violation of this "
        "rule for the same reason. Hinglish: Bread, butter, chai patti, coffee, aur milk powder ko sirf "
        "Schedule II ke prescribed standard weights mein hi pack karna padega. Chai patti sirf 25g, 50g, 100g, "
        "250g, 500g, 1kg ya uske multiples mein hi pack ho sakti hai -- 325g jaisa random weight illegal hai.",
    ),
    (
        "FSSAI Regulations, 2011, Rule 9(4) (language)",
        "Declarations must be printed in Hindi (Devnagri script) or English; other regional languages may be "
        "used in addition, not as a replacement.",
    ),
    (
        "FSSAI Regulations, 2011, Rule 19 (maximum permissible error)",
        "The net quantity of a pre-packaged commodity may vary slightly due to manufacturing/machine variance, "
        "but must not exceed the maximum permissible error in Schedule I -- for a product weighing 100g-500g, "
        "the limit is 3%. A single package being a few grams short (e.g. a 250g pack weighing 245g, which is "
        "within a 3% tolerance) falls within this permissible error and is not by itself a punishable offense; "
        "it becomes actionable when shortages are found repeatedly/consistently across a sampled batch beyond "
        "this limit. Hinglish: Packaging ke dauran thoda weight upar-neche ho sakta hai, par yeh Schedule I ke "
        "Maximum Permissible Error se zyada nahi hona chahiye (100g-500g range ke liye 3%). 250g ka packet "
        "245g nikalna is tolerance ke andar hai aur turant punishable nahi hai, jab tak pure batch mein "
        "consistently shortage na mile.",
    ),
    (
        "FSSAI Regulations, 2011, Rule 20 (inspector action on error)",
        "If an Inspector finds the net quantity of a pre-packaged commodity is less than declared by more than "
        "the maximum permissible error, the Inspector may seize the packages and take legal action against the "
        "manufacturer/packer.",
    ),
    (
        "FSSAI -- Declaration of Name",
        "Every package of food must carry the name of the food indicating its true nature.",
    ),
    (
        "FSSAI -- Ingredients List",
        "Except for single-ingredient foods, the ingredients list must be declared in descending order of "
        "composition by weight or volume.",
    ),
    (
        "FSSAI -- Nutritional Information",
        "Nutritional facts per 100g/100ml or per serving must be given: energy value in kcal; amounts of "
        "protein, carbohydrate (with sugar quantity specified), and fat.",
    ),
    (
        "FSSAI -- Vegetarian/Non-Vegetarian Declaration",
        "Vegetarian food must bear a green-filled circle inside a green-outlined square (square side = double "
        "the circle's diameter). Non-vegetarian food must bear a brown-filled circle inside a brown-outlined "
        "square. A product containing egg (even egg powder) must use the brown non-vegetarian mark -- a green "
        "veg logo on a package whose ingredients include egg powder is a direct violation of this rule. "
        "Hinglish: Vegetarian food par green circle green square ke andar, aur non-vegetarian food par brown "
        "circle brown square ke andar hona chahiye. Egg powder wale product par green veg logo lagana is rule "
        "ka violation hai -- brown non-veg symbol hona chahiye.",
    ),
    (
        "FSSAI -- Best Before Date",
        "The date signifying the end of the period, under stated storage conditions, during which the food "
        "remains fully marketable and retains its specific claimed qualities. The product isn't necessarily "
        "unsafe after this date, but quality may decline.",
    ),
    (
        "FSSAI -- Use By / Expiry Date",
        "The date signifying the end of the estimated period after which the food probably will not have the "
        "quality attributes consumers expect, AND the food must not be sold after this date -- unlike Best "
        "Before, this is a hard legal cutoff for sale. Hinglish: 'Best Before' ka matlab hai ki us date tak "
        "product ki quality best rahegi (unsafe nahi hota, quality kam ho sakti hai). 'Use By'/Expiry Date woh "
        "date hai jiske baad product consume karna risky hota hai aur use bechna strictly illegal hai.",
    ),
    (
        "FSSAI -- Allergen Declaration",
        "Foods containing ingredients known to cause hypersensitivity (gluten, milk, eggs, peanuts, tree nuts, "
        "soybeans, sulphites at 10mg/kg or more) must explicitly declare these allergens, typically as bold "
        "'Contains: [Allergen Name]' text -- this is required regardless of how small the concentration is; "
        "there is no minimum-percentage exemption. Hinglish: Peanuts jaise allergens ka percentage chahe 1% se "
        "kitna bhi kam kyun na ho, unhe label par 'Contains: [Allergen Name]' jaisa bold text mein clearly "
        "declare karna mandatory hai.",
    ),
]

# ---------------------------------------------------------------------------
# Plastic Waste Management (Amendment) Rules, 2021 & 2022
# ---------------------------------------------------------------------------
PWM_RULES = [
    (
        "Plastic Waste Management Rules -- single-use plastic",
        "The manufacture, import, stocking, distribution, sale, and use of single-use plastic (including "
        "polystyrene and expanded polystyrene commodities) is strictly regulated/banned for identified items.",
    ),
    (
        "Plastic Waste Management Rules -- carry bag thickness",
        "Plastic carry bags must have a minimum thickness of 120 microns (effective December 31, 2022).",
    ),
    (
        "Plastic Waste Management Rules -- non-woven bag weight",
        "Non-woven plastic carry bags must be at least 60 GSM (Grams Per Square Meter); anything below 60 GSM "
        "(e.g. a 45 GSM bag) is not legally permissible. Hinglish: Non-woven plastic carry bags ka minimum "
        "weight 60 GSM hona mandatory hai. 45 GSM ka bag legally prohibited/illegal hai.",
    ),
    (
        "Plastic Waste Management Rules -- EPR (Extended Producer Responsibility)",
        "Producers, Importers, and Brand Owners (PIBOs) must register on the Central Pollution Control Board "
        "(CPCB) portal and ensure their plastic packaging waste is processed through recycling, re-use, or "
        "end-of-life disposal.",
    ),
    (
        "Plastic Waste Management Rules -- resin identification code",
        "Every primary plastic packaging must bear a printed recycling symbol with the resin identification "
        "code (e.g. PETE 1, HDPE 2) to enable waste sorting/recycling.",
    ),
]

# ---------------------------------------------------------------------------
# Bureau of Indian Standards (BIS) Act, 2016
# ---------------------------------------------------------------------------
BIS_RULES = [
    (
        "BIS Act, 2016 -- mandatory certification scope",
        "Certain packaged commodities -- electronics, toys, safety equipment, and packaged drinking water -- "
        "are under mandatory BIS certification.",
    ),
    (
        "BIS Act, 2016 -- Packaged Drinking Water (IS 14543)",
        "It is illegal to manufacture or sell packaged drinking water, whether domestic or imported, without "
        "the ISI mark. The label must state 'Packaged Drinking Water' and display the CM/L (Certification "
        "Marks License) number, typically a 7- or 8-digit number, directly below the ISI mark, per the IS "
        "14543 standard (IS 13428 applies to packaged mineral water specifically). Hinglish: Bina valid ISI "
        "mark ke packaged drinking water bechna cognizable offence hai. Bottle par ISI logo ke sath CM/L "
        "(License) number directly printed hona chahiye, IS 14543 standard ke hisaab se.",
    ),
    (
        "BIS -- Compulsory Registration Order (CRS) for electronics",
        "Electronic products (mobile phones, adapters, smartwatches, laptop chargers, power banks) must bear "
        "the BIS Standard Mark and Registration Number (R-number). If the product itself is too small to "
        "display these clearly, the law allows printing them on the primary packaging/outer box instead. "
        "Hinglish: Agar product itna chota hai ki uspe BIS mark aur Registration Number print nahi ho sakta, "
        "toh kanoon use primary packaging (outer box) par print karne ki permission deta hai.",
    ),
]

# ---------------------------------------------------------------------------
# The 20 verification Q&A pairs -- carefully re-matched from the source
# PDF's scrambled extraction order by content, not position. See module
# docstring. Each tuple is (question_en, question_hi, answer_combined).
# ---------------------------------------------------------------------------
QA_PAIRS = [
    (
        "If a restaurant buys a 10 kg box of paneer specifically for cooking meals and not for retail sale, "
        "does that box need to have an MRP printed on it under Legal Metrology Rules?",
        "Agar koi restaurant 10 kg ka paneer packet apne kitchen mein use karne ke liye khareedta hai, toh kya "
        "us packet par Legal Metrology rules ke under MRP likhna mandatory hai?",
        "No. Institutional consumers (like restaurants) buying packages strictly for their own use, not for "
        "commercial resale, are exempt from retail MRP requirements, provided the package explicitly bears the "
        "declaration 'not for retail sale'. Hinglish: Nahi, institutional consumers (jaise restaurants) jo apne "
        "use ke liye package kharidte hain, unhe retail MRP likhne ki zaroorat nahi hai, bas packet par 'not "
        "for retail sale' likha hona mandatory hai.",
    ),
    (
        "A packaged snack has a green circle inside a green square printed on it, but the ingredient list "
        "includes egg powder. Which specific regulation does this violate?",
        "Ek snack packet ke front par green veg logo laga hai, par piche ingredients list mein egg powder "
        "mention hai. Yeh FSSAI ke kis rule ka direct violation hai?",
        "This violates the FSSAI Veg/Non-Veg declaration rule: foods containing egg must display the brown "
        "non-vegetarian symbol (brown circle inside a brown square outline), not the green vegetarian symbol. "
        "Hinglish: Yeh FSSAI ke Veg/Non-Veg declarations rule ka direct violation hai, kyunki egg powder wale "
        "food items par mandatory brown non-vegetarian symbol hona chahiye.",
    ),
    (
        "Under the Legal Metrology Rules, if I pack coffee powder, can I pack it in a 325g jar, or do I have "
        "to follow a specific standard quantity?",
        "Kya koi manufacturer coffee powder ko 325g ke jar mein pack karke market mein bech sakta hai, ya fir "
        "koi specific standard size follow karna padega?",
        "No -- coffee is specified in Schedule II as a commodity that must be packed only in recommended "
        "standard packages (e.g. 25g, 50g, 100g, 250g, 500g). Packing it in a 325g jar is a direct violation "
        "of Rule 5 (standard package sizes). Hinglish: Coffee Schedule II ke under aati hai jise sirf standard "
        "sizes (jaise 25g, 50g, 100g, 250g, 500g) mein pack karna padta hai. 325g jar mein pack karna Rule 5 "
        "ka direct violation hai.",
    ),
    (
        "An Inspector checks a batch of 250g packaged flour and finds they weigh 245g. Is this considered a "
        "punishable offense, or does it fall under the maximum permissible error?",
        "Ek 250g flour packet ka actual weight 245g nikalta hai. Kya inspector is par legal action le sakta "
        "hai, ya yeh permissible error tolerance limit ke andar aata hai?",
        "This falls within the maximum permissible error limit specified under Rule 19 for this weight range "
        "(a small statistical variance is allowed). It is not immediately a punishable offense unless repeated "
        "shortages exceeding this limit are found consistently across a sampled batch. Hinglish: Yeh Rule 19 "
        "ke under maximum permissible error limit ke andar aata hai. Agar yeh shortage pure batch mein "
        "consistently nahi mil rahi hai, toh yeh punishable offence nahi hai.",
    ),
    (
        "What is the difference between 'Best Before' and 'Expiry Date' on a food label according to FSSAI "
        "regulations?",
        "FSSAI rules ke hisaab se 'Best Before' aur 'Expiry Date' mein exact legal difference kya hota hai?",
        "'Best Before' signifies the date until which the product retains its specific marketable qualities "
        "under stated storage conditions -- it isn't necessarily unsafe after, just possibly lower quality. "
        "'Use By' (Expiry Date) is the date after which the food is considered unsafe and legally cannot be "
        "sold. Hinglish: 'Best Before' ka matlab hai ki us date tak product ki quality best rahegi, jabki 'Use "
        "By' (Expiry Date) woh date hai jiske baad product consume karna risky hota hai aur use bechna illegal "
        "hai.",
    ),
    (
        "If a company is importing and selling packaged drinking water in India, do they need to display an "
        "ISI mark on the bottle, and what specific standard applies?",
        "Agar koi company bahar se packaged drinking water India mein import karke bech rahi hai, toh kya us "
        "bottle par ISI mark hona zaroori hai aur kaunsa IS standard lagega?",
        "Yes -- under the BIS Act, 2016, packaged drinking water (including imported water) must bear the "
        "mandatory ISI mark along with the CM/L (Certification Marks License) number, per the IS 14543 "
        "standard. Hinglish: Haan, BIS Act, 2016 ke mutabiq kisi bhi imported packaged drinking water par ISI "
        "mark aur uske niche CM/L number hona mandatory hai, IS 14543 standard ke hisaab se.",
    ),
    (
        "A company packs its product in a non-woven plastic bag that is 45 GSM thick. Is this legally "
        "permissible under the current Plastic Waste Management Rules?",
        "Ek brand ne apna product 45 GSM ke non-woven plastic bag mein pack kiya hai. Kya Plastic Waste "
        "Management Rules ke under yeh permissible hai?",
        "No, it is not legally permissible. Non-woven plastic carry bags must have a minimum weight of 60 GSM "
        "(Grams Per Square Meter); 45 GSM is below this minimum. Hinglish: Nahi, yeh permissible nahi hai. "
        "Non-woven plastic carry bags ka minimum weight 60 GSM hona mandatory hai. 45 GSM illegal hai.",
    ),
    (
        "I am selling a packaged laptop charger. The charger itself is too small to print the BIS registration "
        "number clearly. Where does the law allow me to print it?",
        "Main ek chota laptop charger bech raha hoon jahan charger par jagah nahi hai. Kya main BIS "
        "registration number sirf product ke outer box par print kar sakta hoon?",
        "Yes -- under the Compulsory Registration Order (CRS) for electronic goods, if the product is too "
        "small to display the BIS mark and Registration Number clearly, the law allows printing it on the "
        "primary packaging instead. Hinglish: Compulsory Registration Order ke hisaab se, agar product itna "
        "chota hai ki uspe BIS mark aur Registration Number print nahi ho sakta, toh kanoon ise primary "
        "packaging (outer box) par print karne ki permission deta hai.",
    ),
    (
        "If a pre-packaged food contains peanut extract, is it mandatory to declare it on the label, even if "
        "peanuts make up less than 1% of the total ingredients?",
        "Agar kisi food product mein peanut extract 1% se bhi kam quantity mein hai, toh kya fir bhi alag se "
        "allergen declaration print karna zaroori hai?",
        "Yes -- under FSSAI allergen warning regulations, ingredients known to cause hypersensitivity like "
        "peanuts must be explicitly declared regardless of how small the concentration percentage is; there is "
        "no minimum-percentage exemption. Hinglish: Haan, FSSAI regulations ke mutabiq, peanuts jaise allergens "
        "ka percentage chahe 1% se kitna bhi kam kyun na ho, unhe label par clearly declare karna mandatory hai.",
    ),
    (
        "Can a manufacturer use regional languages like Bengali or Marathi on their product labels, or are "
        "they legally restricted to only using English and Hindi?",
        "Kya koi brand apne packaging label par English aur Hindi ko chhodkar sirf Bengali ya Marathi use kar "
        "sakti hai?",
        "No -- per Rule 9(4), declarations must be printed in Hindi (Devnagri script) or English. Regional "
        "languages like Bengali or Marathi can only be used IN ADDITION to Hindi or English, not as a "
        "replacement for both. Hinglish: Nahi, Rule 9(4) ke anusar declarations Hindi (Devnagri) ya English "
        "mein hona mandatory hai. Bengali ya Marathi ko additional language ki tarah add kiya ja sakta hai, "
        "par Hindi/English ko completely replace nahi kiya ja sakta.",
    ),
    (
        "Does a 30 kg bag of cement need to display the MRP and consumer care details under the 2011 rules?",
        "Kya 30 kg cement ke bag par Legal Metrology Rules, 2011 ke under MRP aur consumer care details print "
        "hona mandatory hai?",
        "Yes. While Rule 3 generally exempts packages over 25 kg from most declaration requirements, it "
        "explicitly makes cement sold in bags up to 50 kg an exception to that exemption. So a 30 kg cement "
        "bag must display all mandatory declarations, including MRP and consumer care. Hinglish: Haan, print "
        "hona mandatory hai. Rule 3 general items ko 25kg ke baad exempt karta hai, par cement up to 50 kg "
        "isme exception hai. Isliye 30 kg cement bag par saare rules lagte hain.",
    ),
    (
        "If I am selling a packaged water bottle, how exactly should the maximum retail price be written on "
        "the label?",
        "Packaged water bottle par Maximum Retail Price likhne ka legal format kya hona chahiye taaki koi "
        "extra tax ya cooling charge na le sake?",
        "Under Rule 18(2), the retail price must be formatted exactly as 'Maximum or Max. retail price "
        "Rs.../Rs... (inclusive of all taxes)' or 'MRP Rs.../Rs... (incl. of all taxes)' -- this exact wording "
        "prevents illegal surcharges being added on top. Hinglish: Rule 18(2) ke mutabiq, MRP ka exact legal "
        "format 'Maximum or Max. retail price Rs.../Rs... (inclusive of all taxes)' ya 'MRP Rs.../Rs... (incl. "
        "of all taxes)' hona chahiye taaki koi extra cooling charge ya tax na maang sake.",
    ),
    (
        "I am inspecting a cylindrical soft drink bottle. How do I calculate the area of the principal display "
        "panel to check the font size?",
        "Cylindrical shape wali cold drink bottle ka Principal Display Panel calculate karne ka exact formula "
        "kya hai taaki font size match kiya ja sake?",
        "Under Rule 7, for a cylindrical package, the Principal Display Panel area is calculated as 40 percent "
        "of the product of the package's height multiplied by its circumference. Hinglish: Rule 7 ke anusar, "
        "cylindrical bottle ka Principal Display Panel calculate karne ke liye bottle ki height aur "
        "circumference (golai) ko multiply karke uska 40% nikalna hota hai.",
    ),
    (
        "Can a shopkeeper place a new price sticker of Rs.60 over an originally printed MRP of Rs.50 because "
        "of inflation?",
        "Kya shopkeeper purane printed MRP Rs.50 ke upar Rs.60 ka naya price sticker chipka kar extra charge "
        "le sakta hai?",
        "No -- Rule 18(5) explicitly prohibits affixing a sticker with a higher price over the original "
        "printed price to alter it, regardless of the stated reason. Hinglish: Nahi, Rule 18(5) ke tahat koi "
        "bhi shopkeeper purane printed MRP ke upar higher price ka naya sticker nahi chipka sakta, chahe wajah "
        "inflation hi kyun na ho.",
    ),
    (
        "What is the penalty if a manufacturer is caught selling non-compliant packaging for the second time?",
        "Agar koi manufacturer doosri baar non-compliant packaging bechte hue pakda jata hai, toh Section "
        "36(1) ke mutabiq uspe kitna fine lag sakta hai?",
        "Under Section 36(1) of the Legal Metrology Act, 2009, a second offense for non-compliant package "
        "declarations carries a fine that may extend to fifty thousand rupees (Rs 50,000). Hinglish: Legal "
        "Metrology Act, 2009 ke Section 36(1) ke under, doosri baar non-compliant packaging ke sath pakde jane "
        "par 50,000 rupaye tak ka fine lag sakta hai.",
    ),
    (
        "An e-commerce website is selling a mobile phone but the manufacturing date is not listed in the "
        "online product details. Is this a violation?",
        "Blinkit ya Amazon par mobile phone bech rahe hain, par image gallery mein manufacturing date show "
        "nahi hai. Kya yeh Legal Metrology E-commerce rules ka violation hai?",
        "No, it is not a violation. Rule 6(10) requires e-commerce entities to display all mandatory "
        "declarations on their digital listings EXCEPT the month and year of manufacture or packing, which is "
        "specifically exempted from the online display requirement. Hinglish: Nahi, yeh violation nahi hai. "
        "Rule 6(10) ke hisaab se e-commerce websites ko digital platform par saari mandatory details dikhani "
        "hoti hain, bas manufacturing ya packing ka month aur year dikhana compulsory nahi hai.",
    ),
    (
        "What is the minimum font size required for the 'Net Quantity' declaration if the total area of a "
        "rectangular package is 75 square centimeters?",
        "Agar rectangular package ka area 75 sq cm hai, toh 'Net Quantity' declaration ke letters aur numbers "
        "ka minimum font height kitna hona chahiye?",
        "For a Principal Display Panel area between 50 and 100 square centimeters (75 sq cm falls in this "
        "band), Rule 9(3) requires a minimum numeral/letter height of 2 mm for the Net Quantity declaration. "
        "Hinglish: Agar panel ka area 50 se 100 sq cm ke beech hai (jaise 75 sq cm), toh Rule 9(3) ke hisaab se "
        "'Net Quantity' ke letters aur numbers ki minimum height 2 mm honi chahiye.",
    ),
    (
        "Do wholesale packages containing 50 individual retail soap bars need to display the retail sale "
        "price?",
        "Ek wholesale master carton jisme 50 sabun ke chote packets hain, kya us master box par retail sale "
        "price likhna zaroori hai?",
        "No. Rule 24 requires wholesale packages to declare the manufacturer's name/address, the commodity's "
        "identity, and the total number/net quantity -- but it does not mandate printing the retail sale price "
        "(MRP) on the wholesale carton itself. Hinglish: Nahi, Rule 24 ke mutabiq wholesale master carton par "
        "manufacturer ka naam/address, product ka naam aur total quantity likhna zaroori hai, par us par "
        "retail sale price (MRP) likhna mandatory nahi hai.",
    ),
    (
        "A manufacturer listed the weight as 'Jumbo Size' instead of using grams or kilograms. Which rule does "
        "this violate?",
        "Packet par weight 'Jumbo Size' likh diya hai bina gram ya kg bataye. Yeh Legal Metrology ke kis "
        "specific standard unit rule ko todta hai?",
        "This violates Rule 13, which requires the declaration of quantity to be expressed in standard metric "
        "units of weight, measure, or number (grams, kilograms, litres) rather than vague marketing terms. "
        "Hinglish: Yeh Rule 13 ka violation hai, jo yeh mandatory karta hai ki quantity hamesha standard "
        "metric units (jaise grams ya kilograms) mein honi chahiye, vague terms jaise 'Jumbo Size' mein nahi.",
    ),
    (
        "Is an imported laptop required to have the name and address of the importer, or is the foreign "
        "manufacturer's address sufficient?",
        "Imported laptop ke outer package par foreign manufacturer ka address hai par Indian importer ka "
        "address missing hai. Kya yeh legal compliance follow kar raha hai?",
        "It is not legally compliant. Under Rule 6(1), imported packages must explicitly bear the name and "
        "complete address of the Indian importer -- displaying only the foreign manufacturer's address is "
        "insufficient. Hinglish: Yeh kanooni taur par compliant nahi hai. Rule 6(1) ke mutabiq, imported "
        "product par sirf foreign company ka nahi, balki Indian importer ka naam aur complete address hona "
        "mandatory hai.",
    ),
]


def build_chunks() -> list[dict]:
    chunks: list[dict] = list(DEFINITIONS)
    for ref, text in LM_EXTENDED_RULES:
        chunks.append({"rule_reference": ref, "text": text})
    for ref, text in FSSAI_RULES:
        chunks.append({"rule_reference": ref, "text": text})
    for ref, text in PWM_RULES:
        chunks.append({"rule_reference": ref, "text": text})
    for ref, text in BIS_RULES:
        chunks.append({"rule_reference": ref, "text": text})
    for q_en, q_hi, answer in QA_PAIRS:
        chunks.append(
            {
                "rule_reference": "Verified Q&A (dataset-provided)",
                "text": f"Q: {q_en}\nQ (Hinglish): {q_hi}\nA: {answer}",
            }
        )
    return chunks


def main(verify: bool = False) -> None:
    chunks = build_chunks()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        for chunk in chunks:
            f.write(json.dumps(chunk, ensure_ascii=False) + "\n")
    print(f"Wrote {len(chunks)} chunks to {OUTPUT_PATH}")
    print(f"  Definitions: {len(DEFINITIONS)}")
    print(f"  Legal Metrology extended rules: {len(LM_EXTENDED_RULES)}")
    print(f"  FSSAI: {len(FSSAI_RULES)}")
    print(f"  Plastic Waste Management: {len(PWM_RULES)}")
    print(f"  BIS: {len(BIS_RULES)}")
    print(f"  Verified Q&A pairs: {len(QA_PAIRS)}")

    if verify:
        print("\n--- Q&A pairs for manual spot-check ---")
        for i, (q_en, q_hi, answer) in enumerate(QA_PAIRS, 1):
            print(f"\n[{i}] Q: {q_en}")
            print(f"    A: {answer[:150]}...")


if __name__ == "__main__":
    import sys

    main(verify="--verify" in sys.argv)
