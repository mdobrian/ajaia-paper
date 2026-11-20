/**
 * Destructive or closing actions require typing a phrase so a stray click
 * cannot finish them.
 */
export const DELETE_CONFIRM_WORD = "delete";
export const LEAVE_CONFIRM_WORD = "leave";

export function isTypedConfirmation(value: string, word: string): boolean {
  return value.trim().toLowerCase() === word.trim().toLowerCase();
}

export function isDeleteConfirmation(value: string): boolean {
  return isTypedConfirmation(value, DELETE_CONFIRM_WORD);
}

export function isLeaveConfirmation(value: string): boolean {
  return isTypedConfirmation(value, LEAVE_CONFIRM_WORD);
}
