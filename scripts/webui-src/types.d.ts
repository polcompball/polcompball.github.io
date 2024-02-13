export type Score = {
    name: string;
    values: number[];
};

export type APIActions = "ERROR" | "CONFIRM" | "SUCCESS" | "FAILURE";

export type APIResponse<T> = {
    action: APIActions;
    message: string;
    extra?: T;
};