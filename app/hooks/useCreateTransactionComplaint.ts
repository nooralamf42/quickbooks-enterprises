import { useMutation } from "@tanstack/react-query"
import { createTransactionComplaint } from "../lib/api/createTransactionComplaint"

export const useCreateTransactionComplaint = () => {
    return useMutation({
        mutationFn: (data: {buyer_id: string, transactionId :string, description: string}) => createTransactionComplaint(data),
    })
}