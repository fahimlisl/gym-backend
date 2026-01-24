class ApiError extends Error{
    constructor(
        status,
        message = "something went wrong",
        stack,
        errors = []
    ){
        super(message)
        this.stack = stack
        this.data = null
        this.status = status
        this.success = false
        this.errors = errors
        if (stack) {
            this.stack = stack
        }else{
            Error.captureStackTrace(this,this.constructor)
        }
    }
}

export {ApiError}