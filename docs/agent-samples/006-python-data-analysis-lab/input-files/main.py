import csv
from pathlib import Path


def load_scores(file_name: str) -> list[tuple[str, float]]:
    rows: list[tuple[str, float]] = []
    with Path(file_name).open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            rows.append((row["name"], float(row["score"])))
    return rows


def describe_scores(scores: list[tuple[str, float]]) -> dict[str, float | int]:
    values = [score for _name, score in scores]
    return {
        "count": len(values),
        "average": sum(values) / len(values),
        "minimum": min(values),
        "maximum": max(values),
    }


def main() -> None:
    scores = load_scores("data.csv")
    stats = describe_scores(scores)

    print("Student score descriptive statistics")
    print(f"count: {stats['count']}")
    print(f"mean: {stats['average']:.2f}")
    print(f"minimum: {stats['minimum']:.2f}")
    print(f"maximum: {stats['maximum']:.2f}")


if __name__ == "__main__":
    main()
