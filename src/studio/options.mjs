// Shared by JSON validation, the editor dropdowns and URL validation.
export const CONTROL_VALUES = {
  length: Array.from({ length: 13 }, (_, i) => i + 2),
  gap: Array.from({ length: 12 }, (_, i) => i + 1),
  lineWidth: [.5, 1, 1.35, 2, 3, 4],
  fillLineWidth: [.5, 1, 1.35, 2, 3, 4],
  spacing: [12, 18, 24, 28, 36, 48],
  angle: [0, 15, 30, 45, 60, 90],
};
export const PATTERNS = ['petals', 'rows', 'crosshatch'];
export const INITIAL_DRAWING = 'petals';
