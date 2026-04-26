import axios from "axios"

export const createTransaction = async ({deposit_price, deposit_charge, buyer_id, description}: {deposit_price : number, deposit_charge: number, buyer_id: string, description: string}) => {
    const response = await axios.post("/api/create-transaction", {deposit_price, deposit_charge, buyer_id, description})
    return response.data
}
