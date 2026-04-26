import { useMutation } from "@tanstack/react-query"
import { createTransaction } from "../lib/api/createTransaction"

export const useCreateTransaction = () => {
    return useMutation({
        mutationFn: (data: {buyer_id: string, deposit_price: number, deposit_charge: number, description: string}) => createTransaction(data),
    })
}