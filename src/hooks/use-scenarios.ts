import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { Scenario, CreateEntity } from '@/lib/types';
import { generateId, now } from '@/lib/utils';

const USER_ID = 'local';

export function useScenarios() {
  const rawScenarios = useLiveQuery(() => db.scenarios.toArray(), []);
  const scenarios = rawScenarios ?? [];

  const activeScenarioRecord = useLiveQuery(
    () => db.activeScenario.get('singleton'),
    [],
  );
  const activeScenarioId = activeScenarioRecord?.scenarioId ?? null;

  const isLoading = rawScenarios === undefined;

  const defaultScenario = useMemo(
    () => scenarios.find((s) => s.isDefault) ?? null,
    [scenarios],
  );

  const activeScenario = useMemo(
    () => scenarios.find((s) => s.id === activeScenarioId) ?? defaultScenario,
    [scenarios, activeScenarioId, defaultScenario],
  );

  const setActiveScenarioId = useCallback(async (scenarioId: string | null) => {
    await db.activeScenario.put({
      id: 'singleton',
      scenarioId,
    });
  }, []);

  const addScenario = useCallback(
    async (data: CreateEntity<Scenario>) => {
      const timestamp = now();

      // Query current scenarios directly from DB to avoid stale closure
      const currentScenarios = await db.scenarios.toArray();
      const isDefault = data.isDefault || currentScenarios.length === 0;

      const newScenario: Scenario = {
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...data,
        isDefault,
      };

      // If new scenario is default, unset other defaults
      if (isDefault && currentScenarios.length > 0) {
        await db.transaction('rw', db.scenarios, async () => {
          // Update all existing scenarios to not be default
          await Promise.all(
            currentScenarios.map((s) =>
              db.scenarios.update(s.id, { isDefault: false, updatedAt: timestamp }),
            ),
          );
          await db.scenarios.add(newScenario);
        });
      } else {
        await db.scenarios.add(newScenario);
      }

      // Auto-select if first scenario
      if (currentScenarios.length === 0) {
        await setActiveScenarioId(newScenario.id);
      }

      return newScenario;
    },
    [setActiveScenarioId],
  );

  const updateScenario = useCallback(
    async (id: string, updates: Partial<Omit<Scenario, 'id' | 'userId' | 'createdAt'>>) => {
      const timestamp = now();

      // If setting this scenario as default, unset others
      if (updates.isDefault) {
        await db.transaction('rw', db.scenarios, async () => {
          const currentScenarios = await db.scenarios.toArray();
          await Promise.all(
            currentScenarios.map((s) =>
              s.id !== id
                ? db.scenarios.update(s.id, { isDefault: false, updatedAt: timestamp })
                : Promise.resolve(),
            ),
          );
          await db.scenarios.update(id, { ...updates, updatedAt: timestamp });
        });
      } else {
        await db.scenarios.update(id, { ...updates, updatedAt: timestamp });
      }
    },
    [],
  );

  const deleteScenario = useCallback(
    async (id: string) => {
      await db.transaction('rw', [db.scenarios, db.activeScenario], async () => {
        const currentScenarios = await db.scenarios.toArray();
        const scenarioToDelete = currentScenarios.find((s) => s.id === id);
        const remaining = currentScenarios.filter((s) => s.id !== id);

        // If we deleted the default, make the first remaining one default
        if (scenarioToDelete?.isDefault && remaining.length > 0) {
          const newDefault = remaining[0]!;
          await db.scenarios.update(newDefault.id, { isDefault: true, updatedAt: now() });
        }

        await db.scenarios.delete(id);

        // Update active scenario if needed
        const activeRecord = await db.activeScenario.get('singleton');
        if (activeRecord?.scenarioId === id) {
          const newActive = remaining.find((s) => s.isDefault) ?? remaining[0];
          await db.activeScenario.put({
            id: 'singleton',
            scenarioId: newActive?.id ?? null,
          });
        }
      });
    },
    [],
  );

  const duplicateScenario = useCallback(
    async (id: string, newName: string) => {
      const source = await db.scenarios.get(id);
      if (!source) return null;

      const timestamp = now();
      const newScenario: Scenario = {
        id: generateId(),
        userId: USER_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        name: newName,
        ...(source.description !== undefined && { description: source.description }),
        isDefault: false,
      };

      await db.scenarios.add(newScenario);
      return newScenario;
    },
    [],
  );

  return {
    scenarios,
    activeScenarioId,
    activeScenario,
    defaultScenario,
    isLoading,
    setActiveScenarioId,
    addScenario,
    updateScenario,
    deleteScenario,
    duplicateScenario,
  };
}
