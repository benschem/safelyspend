import useLocalStorage from "./useLocalStorage";
import type { StartingBankBalance } from "../types";

export default function useStartingBankBalance() {
  const currentDate = new Date().toISOString()
  const [startingBankBalance, setStartingBankBalance] = useLocalStorage<StartingBankBalance>("startingBankBalance", { amount: 0, date: currentDate });


  return { startingBankBalance, setStartingBankBalance };
}
