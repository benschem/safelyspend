/**
 * Centralised colour constants for recharts visualisations
 */
export const CHART_COLORS = {
  // Colours for category segments - ordered for maximum contrast between adjacent colours
  categories: [
    '#ef4444', // red
    '#22c55e', // green
    '#3b82f6', // blue
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#14b8a6', // teal
    '#f97316', // orange
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#a855f7', // purple
    '#eab308', // yellow
    '#6366f1', // indigo
    '#10b981', // emerald
    '#d946ef', // fuchsia
    '#0ea5e9', // sky
  ],
  // Semantic colours
  income: '#22c55e', // green-500
  expense: '#ef4444', // red-500
  savings: '#3b82f6', // blue-500
  budget: '#6b7280', // gray-500
  uncategorized: '#9ca3af', // gray-400
  available: '#e5e7eb', // gray-200
};

/**
 * Get a colour for a category by index
 */
export function getCategoryColor(index: number): string {
  return CHART_COLORS.categories[index % CHART_COLORS.categories.length]!;
}

/**
 * Build a stable colour map for categories based on their IDs
 * This ensures the same category always gets the same colour across charts
 */
export function buildCategoryColorMap(categoryIds: string[]): Record<string, string> {
  const colorMap: Record<string, string> = {};
  categoryIds.forEach((id, index) => {
    colorMap[id] = CHART_COLORS.categories[index % CHART_COLORS.categories.length]!;
  });
  colorMap['uncategorized'] = CHART_COLORS.uncategorized;
  return colorMap;
}
