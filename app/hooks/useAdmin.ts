// useStep.ts (custom hook)
import { useSetAtom, useAtomValue } from "jotai";
import adminAtom from "../atoms/atom.admin";


export const useAdmin = () => {
  const setAdmin = useSetAtom(adminAtom);
  const admin = useAtomValue(adminAtom);
  
  return { setAdmin, admin };
};