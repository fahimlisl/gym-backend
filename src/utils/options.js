const options = {
    httpOnly:true,
    secure: process.env.NODE_ENV === "production" ? true : false,
    sameSite: processl.env.NODE_ENV === "production" ? "none" : "lax"
}
export {options}