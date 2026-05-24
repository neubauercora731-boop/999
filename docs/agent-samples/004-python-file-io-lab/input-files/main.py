from pathlib import Path


def parse_scores(path: Path):
    scores = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        name, score_text = line.split(",")
        scores.append((name.strip(), float(score_text.strip())))
    return scores


def main():
    scores = parse_scores(Path("data.txt"))
    values = [score for _, score in scores]
    average = sum(values) / len(values)
    highest_name, highest_score = max(scores, key=lambda item: item[1])
    lowest_name, lowest_score = min(scores, key=lambda item: item[1])

    print("Python file IO grade statistics")
    print(f"student_count={len(scores)}")
    print(f"average={average:.2f}")
    print(f"highest={highest_name}:{highest_score:.0f}")
    print(f"lowest={lowest_name}:{lowest_score:.0f}")


if __name__ == "__main__":
    main()
