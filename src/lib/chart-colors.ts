/**
 * Centralized color constants for recharts visualizations
 */
export const CHART_COLORS = {
  // Colors for category segments - diverse, visually distinct palette
  categories: [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
    '#6366f1', // indigo
    '#14b8a6', // teal
    '#84cc16', // lime
    '#a855f7', // purple
    '#eab308', // yellow
    '#0ea5e9', // sky
    '#d946ef', // fuchsia
    '#22c55e', // green
  ],
  // Semantic colors
  income: '#22c55e', // green-500
  expense: '#ef4444', // red-500
  savings: '#3b82f6', // blue-500
  budget: '#6b7280', // gray-500
  uncategorized: '#9ca3af', // gray-400
  available: '#e5e7eb', // gray-200
};

/**
 * Get a color for a category by index
 */
export function getCategoryColor(index: number): string {
  return CHART_COLORS.categories[index % CHART_COLORS.categories.length]!;
}

/**
 * Build a stable color map for categories based on their IDs
 * This ensures the same category always gets the same color across charts
 */
export function buildCategoryColorMap(categoryIds: string[]): Record<string, string> {
  const colorMap: Record<string, string> = {};
  categoryIds.forEach((id, index) => {
    colorMap[id] = CHART_COLORS.categories[index % CHART_COLORS.categories.length]!;
  });
  colorMap['uncategorized'] = CHART_COLORS.uncategorized;
  return colorMap;
}
