import { useState } from "react";
import useCategories from "../hooks/useCategories";
import CategoryCard from "./categoryView";

export default function Categories() {
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingId) {
      updateCategory(editingId, name);
      setEditingId(null);
    } else {
      addCategory(name);
    }

    setName("");
  };

  const handleEditStart = (id: string) => {
    const category = categories.find(category => category.id === id);
    if (!category) return;

    setName(category.name);
    setEditingId(id);
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input value={name} onChange={event => setName(event.target.value)} />
        <button type="submit">{editingId ? "Save" : "Add"}</button>
        {editingId && (
          <button type="button" onClick={() => { setEditingId(null); setName(""); }}>
            Cancel
          </button>
        )}
      </form>

      <ul>
        {categories.map(category => (
          <CategoryCard
            key={category.id}
            category={category}
            onEdit={handleEditStart}
            onDelete={deleteCategory}
          />
        ))}
      </ul>
    </div>
  );
}
