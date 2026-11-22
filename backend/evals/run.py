"""Checks against the fixed dataset in evals/dataset.json.

    python -m evals.run                                    # the deterministic detectors: no key, no cost
    OPENROUTER_KEY=sk-or-... python -m evals.run --model openai/gpt-6-luna
                                                           # also asks the model, to compare prompts or models

The key is read from the environment, never from an argument, and is never printed. The model's own scores are compared with
human scores, because an AI grading AI is not evidence by itself.
"""
import argparse
import json
import os
import sys
from pathlib import Path
from statistics import mean

from app.core.errors import AppError
from app.services import evaluate, generate, source

DATA = json.loads((Path(__file__).with_name("dataset.json")).read_text(encoding="utf-8"))
CRITERIA = ("hook", "clarity", "specificity", "voice_fit", "cta")
human_overall = lambda h: int(sum(h.values()) / 5 + 0.5)  # noqa: E731 - the same rounding the server uses


def detectors(data: dict = DATA) -> list[str]:
    """Where the deterministic checks disagree with the human labels. An empty list means they agree everywhere."""
    out = []
    for s in data["sources"]:
        text, stamps = source.clean(s["text"], s["type"])
        if "timestamps" in s and stamps != s["timestamps"]:
            out.append(f"{s['id']}: removed {stamps} timestamps, expected {s['timestamps']}")
        out += [f"{s['id']}: evidence {q['quote']!r} grounded={not q['in_source']}, expected {q['in_source']}" for q in s["quotes"] if source.grounded(q["quote"], text) != q["in_source"]]
    for p in data["pairs"]:
        flagged = evaluate.overlap(p["a"], p["b"]) >= evaluate.SIMILAR_AT
        if flagged != (p["label"] == "repeat"):
            out.append(f"pair {p['id']}: flagged={flagged}, human label is {p['label']}")
    voice = {"avoid": data["avoid"]["words"]}
    out += [f"avoid {p['text']!r}: found {got}, expected {p['hits']}" for p in data["avoid"]["posts"] if (got := evaluate.avoid_hits({"hook": p["text"]}, voice)) != p["hits"]]
    return out


def model_checks(key: str, model: str, data: dict = DATA) -> dict:
    """Ask the model: how often does it invent a quote, and how far are its scores from the human ones?"""
    quotes = invented = 0
    for s in data["sources"]:
        text, _ = source.clean(s["text"], s["type"])
        for i in generate.summarize(key, model, text, s["type"]).insights:
            if i.evidence:
                quotes += 1
                invented += not i.grounded
    errors = {k: [] for k in CRITERIA}
    overall = []
    for r in data["reviewed"]:
        got = evaluate.score(key, model, r["post"], None, None)
        for k in CRITERIA:
            errors[k].append(abs(got["scores"][k] - r["human"][k]))
        overall.append(abs(got["overall"] - human_overall(r["human"])))
    return {
        "model": model, "quotes_checked": quotes, "invented_quotes": invented,
        "score_error_by_criterion": {k: round(mean(v), 2) for k, v in errors.items()},
        "overall_error": round(mean(overall), 2), "overall_within_one": f"{sum(d <= 1 for d in overall)}/{len(overall)}",
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--model", help="also run the model checks with this OpenRouter model id")
    args = ap.parse_args(argv)
    problems = detectors()
    print(f"detectors: {'all agree with the human labels' if not problems else f'{len(problems)} disagreement(s)'}")
    for p in problems:
        print("  -", p)
    if args.model:
        key = os.environ.get("OPENROUTER_KEY", "")
        if not key:
            print("set OPENROUTER_KEY in the environment to run the model checks")
            return 2
        try:
            print(json.dumps(model_checks(key, args.model), indent=2))
        except AppError as e:
            print(f"model checks stopped: {e.message}")
            return 1
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
