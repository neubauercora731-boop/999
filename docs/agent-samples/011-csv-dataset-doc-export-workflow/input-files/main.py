import csv


def load_scores(path):
    scores = []
    with open(path, newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            scores.append((row["name"], int(row["score"])))
    return scores


def main():
    scores = load_scores("data.csv")
    values = [score for _, score in scores]
    average = sum(values) / len(values)
    highest_name, highest_score = max(scores, key=lambda item: item[1])
    lowest_name, lowest_score = min(scores, key=lambda item: item[1])

    print("数据文件: data.csv")
    print(f"学生数量: {len(scores)}")
    print(f"平均分: {average:.2f}")
    print(f"最高分: {highest_name} {highest_score}")
    print(f"最低分: {lowest_name} {lowest_score}")


if __name__ == "__main__":
    main()
