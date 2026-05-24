class Student:
    def __init__(self, name: str, student_id: str, score: float):
        self.name = name
        self.student_id = student_id
        self.score = score

    def is_pass(self) -> bool:
        return self.score >= 60

    def display(self) -> str:
        status = "pass" if self.is_pass() else "fail"
        return f"{self.student_id} {self.name} score={self.score:.1f} status={status}"


def main():
    students = [
        Student("Alice", "S001", 92),
        Student("Bob", "S002", 58),
        Student("Carol", "S003", 77),
    ]

    print("Python OOP Student class lab")
    for student in students:
        print(student.display())


if __name__ == "__main__":
    main()
