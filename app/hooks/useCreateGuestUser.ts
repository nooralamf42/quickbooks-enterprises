import { useMutation } from "@tanstack/react-query"
import { createGuestUser } from "../lib/api/createGuestUser"

export const useCreateGuestUser = () => {
    return useMutation({
        mutationFn: (data: {firstName: string, lastName: string, email: string}) => createGuestUser(data),
    })
    
}