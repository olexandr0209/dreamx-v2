# backend/app/engine/tournament_groups/grouping.py

def make_groups(tg_user_ids: list[int], base_size: int = 4) -> list[list[int]]:
    """
    Твоя логіка:
    - базово по 4
    - якщо хвіст 1 або 2 -> додаємо в останню групу (отримаємо 5 або 6)
    - якщо хвіст 3 -> окрема група з 3
    Також:
    - якщо всього <= 6 -> одна група розміру N (3..6)
    - якщо 2 -> одна група 2 (фінал)
    - якщо 1 -> переможець (груп не треба)
    """
    ids = list(tg_user_ids)
    n = len(ids)
    if n <= 1:
        return []
    if n <= 6:
        return [ids]

    groups: list[list[int]] = []
    i = 0
    while i + base_size <= n:
        groups.append(ids[i:i+base_size])
        i += base_size

    rem = n - i
    if rem == 0:
        return groups
    if rem in (1, 2):
        # додаємо в останню групу
        groups[-1].extend(ids[i:])
        return groups
    if rem == 3:
        groups.append(ids[i:])
        return groups

    # теоретично сюди не потрапимо при base_size=4,
    # але залишимо як safety:
    groups.append(ids[i:])
    return groups
