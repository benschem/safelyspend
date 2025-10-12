import ClearDataButton from './components/clearDataButton';
import ExportDataButton from './components/exportDataButton';
import ImportDataButton from './components/importDataButton';
import Categories from './components/categories';
import Overview from './components/overview';
import useBudgetData from './hooks/useBudgetData';


export default function App() {
  const { setBudgetData } = useBudgetData();

  return (
    <>
      <h1>Budget</h1>
      <ImportDataButton onImport={setBudgetData}/>
      <ExportDataButton />
      <ClearDataButton />
      <Overview />
      <Categories />
    </>
  );
}
