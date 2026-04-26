import {atom} from  'jotai'


const userDetailsAtom = atom({
    firstName : '',
    lastName : '',
    email : '',
    password : '',
    companyName: '',
    phone : '',
    address : '',
    city : '',
    state : '',
    zipCode : '',
    country : '',
    guestUserId : '',
})


export default userDetailsAtom;


