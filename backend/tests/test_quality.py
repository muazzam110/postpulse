import json

import httpx
import pytest

from evals import run
from tests.test_studio import completion

DATA = run.DATA


def test_the_detectors_agree_with_every_human_label():
    assert run.detectors() == []


def test_a_wrong_label_is_reported_not_hidden():
    bad = json.loads(json.dumps(DATA))
    bad["pairs"][0]["label"] = "different"
    bad["sources"][0]["quotes"][0]["in_source"] = False
    bad["avoid"]["posts"][0]["hits"] = []
    found = run.detectors(bad)
    assert len(found) == 3 and any("pair near-copy" in f for f in found) and any("avoid" in f for f in found)


def test_the_dataset_is_well_formed():
    assert DATA["version"] == 1
    ids = [p["id"] for p in DATA["pairs"]] + [r["id"] for r in DATA["reviewed"]] + [s["id"] for s in DATA["sources"]]
    assert len(ids) == len(set(ids))
    assert {p["label"] for p in DATA["pairs"]} == {"repeat", "different"}
    for s in DATA["sources"]:
        assert {q["in_source"] for q in s["quotes"]} == {True, False}, "each source has real and invented quotes"
    for r in DATA["reviewed"]:
        assert set(r["human"]) == set(run.CRITERIA) and all(1 <= v <= 5 for v in r["human"].values())
    assert len({run.human_overall(r["human"]) for r in DATA["reviewed"]}) >= 3, "the reviewed set spans weak to strong"


def scripted(invent=False):
    """A pretend model: scores every post exactly as the humans did, and (optionally) invents one quote while summarising."""
    by_hook = {r["post"]["hook"]: r["human"] for r in DATA["reviewed"]}

    def handler(request):
        user = json.loads(request.content)["messages"][1]["content"]
        if "Score the draft" in user:
            hook = next(h for h in by_hook if h in user)
            return completion({"scores": by_hook[hook]})
        quote = "revenue doubled after the redesign" if invent else "activation rose from 31 percent to 38 percent"
        return completion({"insights": [{"kind": "claim", "text": "A claim", "evidence": quote}, {"kind": "idea", "text": "An idea", "evidence": None}],
                           "angles": [{"title": "t", "hook": "h"}] * 3})

    return handler


def test_model_checks_measure_invented_quotes_and_distance_from_human_scores(provider):
    provider(scripted())
    r = run.model_checks("sk-or-v1-" + "a1b2c3d4" * 6, "openai/gpt-6-luna")
    assert r["overall_error"] == 0 and r["overall_within_one"] == "6/6" and set(r["score_error_by_criterion"].values()) == {0}
    assert r["quotes_checked"] == 2 and r["invented_quotes"] == 1, "the pricing source has no such quote, so the second is invented there"


def test_an_inventing_model_is_caught(provider):
    provider(scripted(invent=True))
    assert run.model_checks("sk-or-v1-" + "a1b2c3d4" * 6, "m")["invented_quotes"] == 2


def test_a_model_that_scores_everything_five_is_visibly_worse(provider):
    provider(lambda r: completion({"scores": dict.fromkeys(run.CRITERIA, 5)}) if "Score the draft" in json.loads(r.content)["messages"][1]["content"] else scripted()(r))
    r = run.model_checks("sk-or-v1-" + "a1b2c3d4" * 6, "m")
    assert r["overall_error"] > 1 and r["overall_within_one"] != "6/6"


def test_the_command_never_prints_the_key_and_explains_a_missing_one(provider, monkeypatch, capsys):
    key = "sk-or-v1-" + "a1b2c3d4" * 6
    provider(scripted())
    monkeypatch.setenv("OPENROUTER_KEY", key)
    assert run.main(["--model", "m"]) == 0
    out = capsys.readouterr().out
    assert key not in out and "all agree" in out and "overall_within_one" in out
    monkeypatch.delenv("OPENROUTER_KEY")
    assert run.main(["--model", "m"]) == 2 and "OPENROUTER_KEY" in capsys.readouterr().out
    assert run.main([]) == 0, "without --model nothing needs a key"


def test_a_provider_failure_ends_with_a_message_not_a_traceback(provider, monkeypatch, capsys):
    provider(lambda r: httpx.Response(401))
    monkeypatch.setenv("OPENROUTER_KEY", "sk-or-v1-" + "a1b2c3d4" * 6)
    assert run.main(["--model", "m"]) == 1 and "stopped" in capsys.readouterr().out
