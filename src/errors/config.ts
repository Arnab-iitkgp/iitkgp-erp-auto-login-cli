import { AppError } from "./base.js";

export class ConfigNotFoundError extends AppError{
    constructor(){
        super("Configuration file not found");
    }
}

export class InvalidConfigError extends AppError{
    constructor (message = "Configuration file is invalid"){
        super(message);
    }
}