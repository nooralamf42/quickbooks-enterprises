// useStep.ts (custom hook)
import { useSetAtom, useAtomValue } from "jotai";
import stepAtom from "../atoms/atom.steps";


export const useSteps = () => {
  const setStep = useSetAtom(stepAtom);
  const step = useAtomValue(stepAtom);

  return { setStep, step };
};
