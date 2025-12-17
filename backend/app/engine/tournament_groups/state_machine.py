# backend/app/engine/tournament_groups/state_machine.py

def total_rounds_for_group(group_size: int) -> int:
    # Класичний round-robin:
    # N=3 -> 3
    # N=4 -> 3
    # N=5 -> 5
    # N=6 -> 5
    # N=2 -> 1
    if group_size <= 2:
        return 1
    if group_size % 2 == 0:
        return group_size - 1
    return group_size

def round_robin_rounds(players: list[int]) -> list[list[tuple[int,int]]]:
    """
    Повертає список раундів.
    Кожен раунд — список пар (p1,p2).
    Для непарної кількості додаємо BYE (None).
    """
    arr = list(players)
    if len(arr) < 2:
        return []

    if len(arr) % 2 == 1:
        arr.append(None)  # BYE

    n = len(arr)
    half = n // 2
    rounds: list[list[tuple[int,int]]] = []

    for rnd in range(n - 1):
        pairs: list[tuple[int,int]] = []
        for i in range(half):
            a = arr[i]
            b = arr[n - 1 - i]
            if a is None or b is None:
                continue
            # трошки перемішуємо home/away для симетрії
            if rnd % 2 == 0:
                pairs.append((a, b))
            else:
                pairs.append((b, a))
        rounds.append(pairs)

        # rotate (circle method), first fixed
        arr = [arr[0]] + [arr[-1]] + arr[1:-1]

    return rounds
