import { useMutation } from "@tanstack/react-query";
import { createFee } from "../lib/api/createFee";

export const useCreateFee = () => {
  return useMutation({
    mutationFn: (price: number) => createFee(price),
  });
};
