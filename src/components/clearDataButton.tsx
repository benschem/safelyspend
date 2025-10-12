


export default function ClearDataButton() {
  const handleClear = () => {
    if (confirm('Are you sure you want to delete all budget data?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return <button onClick={handleClear}>Clear All Data</button>;
}
