from pathlib import Path
import re
import ftfy

root = Path(__file__).resolve().parent
paid_dir = root / "paid-courses"

paid_to_demo = {
    "a1-course.html": "a1-demo.html",
    "a1-vocabulary.html": "a1-demo-vocabulary.html",
    "a2-course.html": "a2-demo.html",
    "a2-vocabulary.html": "a2-demo-vocabulary.html",
    "b1-course.html": "b1-demo.html",
    "b1-vocabulary.html": "b1-demo-vocabulary.html",
    "b2-course.html": "b2-demo.html",
    "b2-vocabulary.html": "b2-demo-vocabulary.html",
}

suspect_re = re.compile(r"рџ|вњ|вљ|в­|СЂСџ|Р'|С'|(?:Р.|С.){2,}|(?:р.|с.){2,}|[ЃѓЉЊЋЏђєѕіјљњќўџ]")
word_re = re.compile(r"[A-Za-zА-Яа-яЁёЀ-ӿ]+(?:['’`][A-Za-zА-Яа-яЁёЀ-ӿ]+)?")
cyr_word_re = re.compile(r"[А-Яа-яЁёЀ-ӿ]+(?:['’][А-Яа-яЁёЀ-ӿ]+)?")


def ensure_utf8_meta(text: str) -> str:
    text = re.sub(
        r'(<meta[^>]*charset\s*=\s*["\']?)(windows-1251|cp-?1251|koi8-r|iso-8859-5|utf8)(["\']?[^>]*>)',
        r'\1UTF-8\3',
        text,
        flags=re.IGNORECASE,
    )

    if not re.search(r'<meta\s+charset\s*=\s*["\']?UTF-8["\']?', text, flags=re.IGNORECASE):
        text = re.sub(
            r'(<head[^>]*>)',
            r'\1\n    <meta charset="UTF-8">',
            text,
            count=1,
            flags=re.IGNORECASE,
        )

    text = re.sub(
        r'<meta\s+charset\s*=\s*["\']?[^"\'>\s]+["\']?\s*>',
        '<meta charset="UTF-8">',
        text,
        count=1,
        flags=re.IGNORECASE,
    )

    return text


def split_non_ascii_chunks(line: str) -> list[tuple[bool, str]]:
    chunks: list[tuple[bool, str]] = []
    index = 0
    length = len(line)

    while index < length:
        current = line[index]
        if ord(current) > 127:
            end = index + 1
            while end < length:
                next_char = line[end]
                if ord(next_char) > 127 or next_char in {'"', "'", "`", "’", "“", "”"}:
                    end += 1
                else:
                    break
            chunks.append((True, line[index:end]))
            index = end
        else:
            end = index + 1
            while end < length and ord(line[end]) <= 127:
                end += 1
            chunks.append((False, line[index:end]))
            index = end

    return chunks


def skeleton(line: str) -> str:
    return "".join("¤" if is_non_ascii else chunk for is_non_ascii, chunk in split_non_ascii_chunks(line))


def decode_cp1251_utf8(value: str) -> str | None:
    try:
        return value.encode("cp1251").decode("utf-8")
    except UnicodeError:
        return None


def is_suspicious_word(word: str) -> bool:
    if not re.search(r"[\u0400-\u04FF]", word):
        return False

    if re.search(r"[ЃѓЉЊЋЏђєѕіјљњќўџ]", word):
        return True

    if "Р'" in word or "С'" in word or "Р`" in word or "С`" in word or "рџ" in word:
        return True

    if len(re.findall(r"[РСрс]", word)) >= 2 and len(word) >= 4:
        return True

    return False


def fix_word(word: str, demo_words: set[str]) -> str:
    if not is_suspicious_word(word):
        return word

    variants = {word}
    normalized = (
        word.replace("Р'", "Р’")
        .replace("С'", "С‘")
        .replace("Р`", "Р‘")
        .replace("С`", "С‘")
        .replace("р'", "р’")
        .replace("с'", "с‘")
    )
    variants.update({normalized, ftfy.fix_text(word), ftfy.fix_text(normalized)})

    for base in list(variants):
        decoded = decode_cp1251_utf8(base)
        if decoded:
            variants.update({decoded, ftfy.fix_text(decoded)})
            decoded_twice = decode_cp1251_utf8(decoded)
            if decoded_twice:
                variants.add(decoded_twice)

    def candidate_score(candidate: str) -> tuple[int, int, int, int]:
        in_demo = 1 if candidate.lower() in demo_words else 0
        badness = 0
        if re.search(r"[ЃѓЉЊЋЏђєѕіјљњќўџ]", candidate):
            badness += 5
        badness += len(re.findall(r"(?:Р.|С.|р.|с.)", candidate))
        badness += candidate.count("рџ") + candidate.count("вњ") + candidate.count("вљ")
        badness += candidate.count("Р'") + candidate.count("С'")
        cyr_count = len(re.findall(r"[\u0400-\u04FF]", candidate))
        length_distance = abs(len(candidate) - len(word))
        return in_demo, -badness, cyr_count, -length_distance

    best = word
    best_score = candidate_score(best)

    for candidate in variants:
        if not candidate:
            continue
        score = candidate_score(candidate)
        if score > best_score:
            best = candidate
            best_score = score

    return best


def replace_non_ascii_chunks_from_demo(
    paid_line: str,
    demo_line: str,
) -> tuple[str, bool]:
    paid_chunks = split_non_ascii_chunks(paid_line)
    demo_chunks = split_non_ascii_chunks(demo_line)

    paid_segments = [chunk for is_non_ascii, chunk in paid_chunks if is_non_ascii]
    demo_segments = [chunk for is_non_ascii, chunk in demo_chunks if is_non_ascii]

    if not paid_segments or len(paid_segments) != len(demo_segments):
        return paid_line, False

    rebuilt: list[str] = []
    changed = False
    demo_index = 0

    for is_non_ascii, paid_chunk in paid_chunks:
        if is_non_ascii:
            demo_chunk = demo_segments[demo_index]
            demo_index += 1
            rebuilt.append(demo_chunk)
            if demo_chunk != paid_chunk:
                changed = True
        else:
            rebuilt.append(paid_chunk)

    return "".join(rebuilt), changed


def preserve_line_endings(text: str, had_crlf: bool) -> str:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    if had_crlf:
        return normalized.replace("\n", "\r\n")
    return normalized


def fix_paid_file(paid_name: str, demo_name: str) -> tuple[int, int, int, int, int]:
    paid_path = paid_dir / paid_name
    demo_path = root / demo_name

    paid_raw = paid_path.read_bytes()
    paid_text = paid_raw.decode("utf-8-sig")
    demo_text = demo_path.read_text(encoding="utf-8-sig")

    original = paid_text
    before_score = len(suspect_re.findall(original))

    paid_text = ensure_utf8_meta(paid_text)
    paid_text = ftfy.fix_text(paid_text)

    demo_lines = demo_text.splitlines()
    demo_words = {word.lower() for word in cyr_word_re.findall(demo_text)}
    demo_skeleton_map: dict[str, list[tuple[int, str]]] = {}
    for demo_idx, demo_line in enumerate(demo_lines):
        demo_skeleton_map.setdefault(skeleton(demo_line), []).append((demo_idx, demo_line))

    paid_lines = paid_text.splitlines()
    fixed_lines: list[str] = []
    line_segment_replacements = 0
    word_replacements = 0

    for paid_idx, paid_line in enumerate(paid_lines):
        updated_line = paid_line

        if suspect_re.search(updated_line):
            line_skeleton = skeleton(updated_line)
            candidates = demo_skeleton_map.get(line_skeleton)
            if candidates:
                target_idx = int(paid_idx * len(demo_lines) / max(1, len(paid_lines)))
                _, closest_demo_line = min(candidates, key=lambda item: abs(item[0] - target_idx))
                candidate_line, changed = replace_non_ascii_chunks_from_demo(updated_line, closest_demo_line)
                if changed:
                    updated_line = candidate_line
                    line_segment_replacements += 1

        def replace_word(match: re.Match[str]) -> str:
            nonlocal word_replacements
            token = match.group(0)
            fixed_token = fix_word(token, demo_words)
            if fixed_token != token:
                word_replacements += 1
            return fixed_token

        updated_line = word_re.sub(replace_word, updated_line)
        fixed_lines.append(updated_line)

    fixed_text = "\n".join(fixed_lines)
    fixed_text = ensure_utf8_meta(ftfy.fix_text(fixed_text))

    had_crlf = b"\r\n" in paid_raw
    fixed_text = preserve_line_endings(fixed_text, had_crlf)

    if fixed_text != original:
        paid_path.write_text(fixed_text, encoding="utf-8", newline="")

    after_score = len(suspect_re.findall(fixed_text))
    return before_score, after_score, int(fixed_text != original), line_segment_replacements, word_replacements


results = []
for paid_name, demo_name in paid_to_demo.items():
    before, after, changed, line_repl, word_repl = fix_paid_file(paid_name, demo_name)
    results.append((paid_name, before, after, changed, line_repl, word_repl))

print(f"Total paid HTML: {len(results)}")
print(f"Changed: {sum(item[3] for item in results)}")
for paid_name, before, after, changed, line_repl, word_repl in results:
    status = "changed" if changed else "unchanged"
    print(f"- paid-courses/{paid_name} [{before} -> {after}] ({status}, line={line_repl}, word={word_repl})")
