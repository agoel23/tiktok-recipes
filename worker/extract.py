"""Caption / transcript / page text → structured recipe, via Claude structured outputs."""

import anthropic

from .config import CUISINES, settings
from .schema import CANONICAL_UNITS, ExtractedRecipe

SYSTEM = f"""You turn recipe content from TikTok, Instagram or recipe websites into a clean, cookable recipe.

You'll get some mix of: a post caption, a transcript of the creator's narration (automatic speech recognition, \
so expect mishearings, filler and sometimes background-music noise), and/or text and structured data from a web page.

How to build the recipe:
- Combine every source. Narration often has amounts the caption lacks, and vice versa. Where they conflict, \
prefer explicit numbers over vague ones and the written source over a likely mishearing.
- Ingredients: one entry per ingredient, as a decimal quantity (0.5, never "1/2") with a unit from {CANONICAL_UNITS}, \
or unit null for countable items ("2 eggs" → quantity 2, unit null, item "eggs"). Convert spoken units \
("tablespoon", "T", "Tbsp") to these forms. Keep the creator's sub-groups (e.g. "Sauce") in `group`.
- Missing measurements: when the source doesn't state an amount, give a sensible best guess for the stated servings \
and set estimated=true on that ingredient. Only use quantity null with scalable=false for genuine "to taste" or \
garnish items (salt to taste, a sprinkle of parsley); put "to taste" in `note`.
- Servings: use the stated yield; otherwise estimate from the quantities and set servings_estimated=true.
- Times: use stated prep/cook/total times. Otherwise estimate from the steps (marinating, baking, simmering, \
plus realistic prep) and set time_estimated=true. total_minutes is always required and should include passive time.
- Steps: concise, imperative, in order, each a single action or closely related actions. Put any duration in \
timer_minutes. Don't invent steps the source doesn't imply, but fill obvious gaps (e.g. "Preheat the oven to 400°F").
- Cuisine: the single best fit from {CUISINES}. Use "Fusion" for deliberate mashups and "Other" only if nothing fits.
- Notes: tips, substitutions and storage advice from the source, briefly. null if none.
- If the content is not a recipe at all, set is_recipe=false and fill the other fields minimally.
- Write in English, in a neutral voice (don't copy the creator's jokes or sponsorship lines)."""


class ExtractionError(Exception):
    pass


def extract(*, caption: str = "", transcript: str = "", page_text: str = "", title_hint: str | None = None) -> ExtractedRecipe:
    sections = []
    if title_hint:
        sections.append(f"<title_hint>{title_hint}</title_hint>")
    if caption:
        sections.append(f"<caption>\n{caption}\n</caption>")
    if transcript:
        sections.append(f"<narration_transcript>\n{transcript}\n</narration_transcript>")
    if page_text:
        sections.append(f"<web_page>\n{page_text}\n</web_page>")
    if not sections:
        raise ExtractionError("Nothing to extract a recipe from.")

    client = anthropic.Anthropic()
    response = client.messages.parse(
        model=settings.claude_model,
        max_tokens=16000,
        system=SYSTEM,
        messages=[{"role": "user", "content": "\n\n".join(sections)}],
        output_format=ExtractedRecipe,
    )
    if response.stop_reason == "refusal":
        raise ExtractionError("Claude declined to process this content.")
    if response.stop_reason == "max_tokens" or response.parsed_output is None:
        raise ExtractionError("Claude's response was incomplete; try re-running extraction.")
    return response.parsed_output
