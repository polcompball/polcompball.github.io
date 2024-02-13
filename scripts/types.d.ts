import type { Ctype } from "./enums";
export type Optional<T> = undefined | null | T;

export type RespTuple = [resp: string, ctype: Ctype, status: number];

export type Score = {
    name: string;
    values: number[];
};
