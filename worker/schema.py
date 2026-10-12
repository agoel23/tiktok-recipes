"""Structured recipe shape Claude must return, plus helpers derived from it."""

from typing import Literal, Optional

from pydantic import BaseModel, Field

from .config import CUISINES

Cuisine = Literal[tuple(CUISINES)]  # type: ignore[valid-type]

CANONICAL_UNITS = [
    "tsp", "tbsp", "cup", "fl oz", "ml", "l", "g", "kg", "oz", "lb",
    "pinch", "dash", "clove", "slice", "piece", "can", "stick", "bunch", "sprig", "handful",
]


class Ingredient(BaseModel):
    group: Optional[str] = Field(description="Sub-heading like 'Sauce' or 'Marinade'; null if none")
    quantity: Optional[float] = Field(description="Numeric amount as a decimal (0.5, not '1/2'); null for 'to taste'")
    unit: Optional[str] = Field(description=f"One of {CANONICAL_UNITS}, or null for countable items like '2 eggs'")
    item: str = Field(description="Ingredient name, e.g. 'garlic, minced'")
    note: Optional[str] = Field(description="Extra info like 'to taste', 'optional', 'room temperature'")
    scalable: bool = Field(description="False for 'to taste' / garnish amounts that shouldn't change with servings")
    estimated: bool = Field(description="True if the amount is your best guess rather than stated in the source")


class Step(BaseModel):
    text: str
    timer_minutes: Optional[float] = Field(description="Wait/cook duration mentioned in this step, else null")


class ExtractedRecipe(BaseModel):
    is_recipe: bool = Field(description="False if this content is not a recipe")
    title: str
    cuisine: Cuisine  # type: ignore[valid-type]
    tags: list[str] = Field(description="3-6 lowercase tags: dish type, main protein, diet (e.g. 'pasta', 'chicken', 'vegetarian')")
    base_servings: int
    servings_estimated: bool
    prep_minutes: Optional[int]
    cook_minutes: Optional[int]
    total_minutes: int
    time_estimated: bool = Field(description="True if the times were not stated and you estimated them")
    ingredients: list[Ingredient]
    steps: list[Step]
    notes: Optional[str] = Field(description="Tips, substitutions or storage notes from the source; null if none")


def measurements_source(ingredients: list[Ingredient]) -> str:
    """'explicit' if every measurable amount was stated, 'estimated' if none were, else 'mixed'."""
    measured = [i for i in ingredients if i.scalable and i.quantity is not None]
    if not measured:
        return "explicit"
    guessed = sum(1 for i in measured if i.estimated)
    if guessed == 0:
        return "explicit"
    if guessed == len(measured):
        return "estimated"
    return "mixed"
