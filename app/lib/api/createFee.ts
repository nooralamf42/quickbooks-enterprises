import axios from "axios";

export const createFee = async (price: number) => {
  const response = await axios.post("/api/create-fee", { price });
  return response.data;
};
