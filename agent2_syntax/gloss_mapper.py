"""
Gloss Mapper — Rule-based English ↔ ISL/ASL Gloss Translation
Uses Topic-Comment reordering and ISL grammar rules.
Falls back to LLM for complex sentences.
"""

from llm_fallback import llm_to_gloss

# Stop words to remove (articles, copula, auxiliaries)
STOP_WORDS = {
    "a", "an", "the", "is", "are", "am", "was", "were", "be", "been", "being",
    "do", "does", "did", "has", "have", "had", "will", "would", "shall", "should",
    "can", "could", "may", "might", "must", "to", "of", "it", "its",
}

# Question words that move to END in ISL (Topic-Comment structure)
QUESTION_WORDS = {"what", "where", "when", "who", "how", "why", "which"}

# Common phrase mappings (English → ISL gloss)
PHRASE_MAP = {
    "my name is": ["MY", "NAME"],
    "what is your name": ["YOUR", "NAME", "WHAT"],
    "how are you": ["YOU", "HOW"],
    "i am fine": ["I", "FINE"],
    "thank you": ["THANK_YOU"],
    "i love you": ["I", "LOVE", "YOU"],
    "nice to meet you": ["MEET", "YOU", "NICE"],
    "good morning": ["MORNING", "GOOD"],
    "good night": ["NIGHT", "GOOD"],
    "please help me": ["HELP", "ME", "PLEASE"],
    "i need help": ["HELP", "I", "NEED"],
    "where is the hospital": ["HOSPITAL", "WHERE"],
    "i need a doctor": ["DOCTOR", "I", "NEED"],
    "i am in pain": ["PAIN", "I", "HAVE"],
    "call an ambulance": ["AMBULANCE", "CALL"],
    "i need water": ["WATER", "I", "NEED"],
    "i need food": ["FOOD", "I", "NEED"],
    "i want to go home": ["HOME", "GO", "I", "WANT"],
    "excuse me": ["EXCUSE"],
    "i am sorry": ["SORRY", "I"],
    "i understand": ["UNDERSTAND", "I"],
    "i don't understand": ["UNDERSTAND", "I", "NOT"],
    "can you help me": ["HELP", "ME", "YOU", "CAN"],
    "what time is it": ["TIME", "WHAT"],
    "how much does it cost": ["COST", "HOW_MUCH"],
    "i am happy": ["HAPPY", "I"],
    "i am sad": ["SAD", "I"],
}

# Gloss → English templates for reverse translation
GLOSS_TEMPLATES = {
    ("HELLO",): "Hello!",
    ("YES",): "Yes.",
    ("NO",): "No.",
    ("THANK_YOU",): "Thank you.",
    ("SORRY", "I"): "I am sorry.",
    ("HELP", "I", "NEED"): "I need help.",
    ("HOSPITAL", "WHERE"): "Where is the hospital?",
    ("YOUR", "NAME", "WHAT"): "What is your name?",
    ("MY", "NAME"): "My name is",
    ("YOU", "HOW"): "How are you?",
    ("I", "FINE"): "I am fine.",
    ("I", "LOVE", "YOU"): "I love you.",
    ("UNDERSTAND", "I"): "I understand.",
    ("UNDERSTAND", "I", "NOT"): "I don't understand.",
    ("HAPPY", "I"): "I am happy.",
    ("SAD", "I"): "I am sad.",
}


def text_to_gloss(text: str) -> tuple:
    """Convert English text to ISL gloss sequence. Returns (gloss_list, method)."""
    text_lower = text.lower().strip().rstrip("?.!,")

    # 1) Check phrase map first
    for phrase, gloss in PHRASE_MAP.items():
        if phrase in text_lower:
            # Append any remaining words not in the phrase
            remaining = text_lower.replace(phrase, "").strip()
            extra = [w.upper() for w in remaining.split() if w not in STOP_WORDS and w]
            return gloss + extra, "phrase-map"

    # 2) Rule-based ISL grammar transformation
    words = text_lower.split()
    
    # Remove stop words
    filtered = [w for w in words if w not in STOP_WORDS]
    if not filtered:
        filtered = [w for w in words if w]

    # ISL Topic-Comment: move question words to end
    question_at_start = []
    rest = []
    for w in filtered:
        if w in QUESTION_WORDS and not rest:
            question_at_start.append(w)
        else:
            rest.append(w)

    # Reorder: Topic first, then comment, question word last
    if question_at_start:
        gloss = [w.upper() for w in rest + question_at_start]
        if gloss:
            return gloss, "rule-based"

    # Negation: move NOT after the verb in ISL
    gloss = [w.upper() for w in filtered]
    
    # Simple reordering: adjectives after nouns in ISL
    # "big house" → "HOUSE BIG"
    if len(gloss) >= 2:
        adjectives = {"BIG", "SMALL", "GOOD", "BAD", "HAPPY", "SAD", "NEW", "OLD", "NICE", "FINE"}
        reordered = []
        i = 0
        while i < len(gloss):
            if gloss[i] in adjectives and i + 1 < len(gloss) and gloss[i + 1] not in adjectives:
                reordered.append(gloss[i + 1])
                reordered.append(gloss[i])
                i += 2
            else:
                reordered.append(gloss[i])
                i += 1
        gloss = reordered

    if gloss:
        return gloss, "rule-based"

    # 3) LLM fallback for complex sentences
    return llm_to_gloss(text), "llm"


def gloss_to_text(gloss: list) -> str:
    """Convert ISL/ASL gloss tokens to natural English."""
    if not gloss:
        return ""

    # 1) Check template map
    gloss_tuple = tuple(g.upper() for g in gloss)
    if gloss_tuple in GLOSS_TEMPLATES:
        return GLOSS_TEMPLATES[gloss_tuple]

    # 2) Check partial matches
    for template_key, template_text in GLOSS_TEMPLATES.items():
        if all(g in gloss_tuple for g in template_key):
            return template_text

    # 3) Heuristic reconstruction
    words = [g.lower().replace("_", " ") for g in gloss]

    # Move question words from end to beginning
    if words and words[-1] in QUESTION_WORDS:
        q = words.pop()
        words.insert(0, q)
        return " ".join(w.capitalize() if i == 0 else w for i, w in enumerate(words)) + "?"

    # Default: capitalize and join
    sentence = " ".join(words)
    sentence = sentence[0].upper() + sentence[1:] if sentence else ""
    
    if not sentence.endswith((".", "!", "?")):
        sentence += "."

    return sentence
