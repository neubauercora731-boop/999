def bubble_sort(values):
    data = values[:]
    for i in range(len(data) - 1):
        for j in range(len(data) - 1 - i):
            if data[j] > data[j + 1]:
                data[j], data[j + 1] = data[j + 1], data[j]
    return data


def main():
    values = [64, 34, 25, 12, 22, 11, 90]
    print("Before:", values)
    print("After:", bubble_sort(values))
    print("Check:", bubble_sort(values) == sorted(values))


if __name__ == "__main__":
    main()
