scores = [78, 86, "missing", 92]
numeric_scores = [score for score in scores if isinstance(score, (int, float))]

average = sum(numeric_scores) / len(numeric_scores)

print("debug-once recovery result")
print(f"valid score count: {len(numeric_scores)}")
print(f"average score: {average:.2f}")
