"""Source-text cleanup and evidence matching. Pure functions: no I/O."""
import html
import re

_TAG = re.compile(r"</?[A-Za-z][^>]*>")
_STAMP = re.compile(r"[\[(]?\b\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?[\])]?[ \t]*")
_INVISIBLE = re.compile(r"[​-‍⁠﻿\x00-\x08\x0b\x0c\x0e-\x1f]")


def clean(text: str, source_type: str) -> tuple[str, int]:
    """Normalise pasted material. Returns (clean text, number of transcript timestamps removed)."""
    text = html.unescape(_TAG.sub(" ", text.replace("\r\n", "\n").replace("\r", "\n")))
    text = _INVISIBLE.sub("", text)
    removed = 0
    if source_type == "transcript":  # "3:45" is only a timestamp in a transcript
        text, removed = _STAMP.subn("", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" ?\n ?", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip(), removed


def _norm(s: str) -> str:
    return " ".join(re.sub(r"[\W_]+", " ", s.casefold()).split())


def grounded(evidence: str | None, source: str) -> bool:
    """True only if the quoted evidence really occurs in the source (ignoring case and punctuation)."""
    e = _norm(evidence or "")
    return len(e) >= 12 and e in _norm(source)
