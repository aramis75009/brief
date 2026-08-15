import type { Item } from "./types";

export type TaskSort = "urgency" | "due" | "priority" | "project";

/**
 * Compare two items by urgency:
 * 1. Overdue / Earlier due dates first (ascending due time)
 * 2. Higher priority first (p1 > p2 > p3 > p4)
 * 3. Items with due dates come before items without due dates
 * 4. Creation time as tie breaker
 */
export function compareUrgency(a: Item, b: Item): number {
  const aHasDue = !!a.due;
  const bHasDue = !!b.due;

  if (aHasDue && bHasDue) {
    const timeA = new Date(a.due!).getTime();
    const timeB = new Date(b.due!).getTime();
    if (timeA !== timeB) {
      return timeA - timeB; // earlier dates first
    }
    // If same due date, higher priority first
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
  } else if (aHasDue && !bHasDue) {
    return -1; // due items come before non-due
  } else if (!aHasDue && bHasDue) {
    return 1;
  } else {
    // Both have no due date: higher priority first
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
  }

  // Fallback: newest created first
  const createdA = new Date(a.createdAt).getTime();
  const createdB = new Date(b.createdAt).getTime();
  return createdB - createdA;
}

/**
 * Compare two items strictly by due date:
 * - Items with due date come first, sorted chronologically (earliest first)
 * - Items without due date come last
 */
export function compareDue(a: Item, b: Item): number {
  if (a.due && b.due) {
    const diff = new Date(a.due).getTime() - new Date(b.due).getTime();
    if (diff !== 0) return diff;
    return a.priority - b.priority;
  }
  if (a.due && !b.due) return -1;
  if (!a.due && b.due) return 1;
  return a.priority - b.priority;
}

/**
 * Compare two items strictly by priority (p1 is highest priority 1 < 2 < 3 < 4)
 */
export function comparePriority(a: Item, b: Item): number {
  if (a.priority !== b.priority) {
    return a.priority - b.priority;
  }
  // Secondary sort by due date if available
  return compareDue(a, b);
}

/**
 * Sort a list of items based on the chosen sort strategy
 */
export function sortItems(items: Item[], sort: TaskSort): Item[] {
  const copy = [...items];
  switch (sort) {
    case "urgency":
      return copy.sort(compareUrgency);
    case "due":
      return copy.sort(compareDue);
    case "priority":
      return copy.sort(comparePriority);
    case "project":
    default:
      return copy;
  }
}
