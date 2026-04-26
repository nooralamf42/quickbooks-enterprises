import { useAtomValue, useSetAtom} from "jotai"
import userDetailsAtom from "../atoms/atom.userDetails"

export const useUserDetails = () => {
    const userDetails = useAtomValue(userDetailsAtom)
    const setUserDetailsAtom = useSetAtom(userDetailsAtom)
    const setUserDetails = (userDetails: {firstName? : string, lastName? : string, email? : string, password? : string, companyName?: string, phone? : string, address? : string, city? : string, state? : string, zipCode? : string, deposit_price?: number, deposit_charge?: number, guestUserId?: string}) => {
        setUserDetailsAtom((prev) => ({
            ...prev, 
            ...userDetails
        }))
    }

    return {userDetails, setUserDetails}

}