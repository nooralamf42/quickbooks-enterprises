import axios from "axios"

export const createTransactionComplaint = async ({transactionId, buyer_id, description}: { transactionId: string, buyer_id: string, description: string}) => {
    const response = await axios.post("/api/create-transaction-complaint", {transactionId, buyer_id, description})
    return response.data
}
