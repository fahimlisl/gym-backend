const options = {
    httpOnly:true,
    // secure:true,
    // sameSite: "none", // will undo , while pushing to producitn for https
    secure: false,
sameSite: "lax"
}
export {options}